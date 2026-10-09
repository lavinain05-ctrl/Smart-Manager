import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db, secondaryAuth, adminResetPasswordFn } from "../firebase/firebase";
import { recordLoginEvent, getPortalFromRole, cleanUserIdentifier } from "./loginTrackerService";
import { checkIfMobileBlocked } from "./blockService";
import { terminateAllOtherSessions } from "./sessionService";

// =============================
// Constants
// =============================

export const AUTH_EMAIL_DOMAIN = "smart-manager-aad4d.firebaseapp.com";
export const PROTECTED_ADMIN_UID = "92jYvGPlKMexX37WEzs7MaDuc7U2";
export const ADMIN_EMAILS = ["dharmendrasngh101@gmail.com"];

export function isExactAdminEmail(email) {
  if (!email) return false;
  const clean = String(email).trim().toLowerCase();
  return ADMIN_EMAILS.includes(clean);
}

/**
 * Validates if an email is a genuine user-provided email address,
 * rather than a synthetic Firebase Auth placeholder (@...firebaseapp.com).
 */
export function isRealEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) return false;
  if (trimmed.toLowerCase().includes("firebaseapp.com")) return false;
  if (/^\d{10}@/.test(trimmed)) return false;
  return true;
}

// =============================
// Mobile Number Normalization & Validation
// =============================

/**
 * Normalize any mobile number format to a clean 10-digit string.
 * Handles:
 * - "+91 8920300027" -> "8920300027"
 * - "+918920300027"  -> "8920300027"
 * - "91-8920300027"  -> "8920300027"
 * - "08920300027"    -> "8920300027"
 * - "8920300027"     -> "8920300027"
 */
export function normalizeMobile(mobile) {
  if (!mobile) return "";
  const digits = String(mobile).replace(/\D/g, "");

  // If 12 digits starting with 91 (India country code)
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  // If 11 digits starting with 0 (national trunk prefix)
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  // If more than 10 digits, extract the last 10 digits
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Validate 10-digit Indian mobile number format.
 * Returns null if valid, or an error string if invalid.
 */
export function validateMobile(mobile) {
  const cleaned = normalizeMobile(mobile);
  if (!cleaned || cleaned.length !== 10) {
    return "Enter a valid 10-digit mobile number.";
  }
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    return "Enter a valid 10-digit mobile number (starting with 6, 7, 8, or 9).";
  }
  return null;
}

// =============================
// Mobile → pseudo-email
// =============================

/**
 * Convert a 10-digit mobile number to the pseudo-email used
 * internally by Firebase Auth for this application.
 *
 * Example: "8920300027" → "8920300027@smart-manager-aad4d.firebaseapp.com"
 */
export function mobileToAuthEmail(mobile) {
  const clean = normalizeMobile(mobile);
  return `${clean}@${AUTH_EMAIL_DOMAIN}`;
}

// =============================
// Centralized Auth Lookup Management
// =============================

/**
 * Write or update a mobile → auth identity mapping in authLookup/{mobile}.
 * Also creates flat-based lookup in authLookup/flat_{flat} for fast recovery.
 */
export async function writeAuthLookup(mobile, email, uid, personalEmail = "", flat = "", name = "") {
  const clean = normalizeMobile(mobile);
  if (!clean || clean.length !== 10) return;

  try {
    const updateData = {
      mobile: clean,
      email: email,
      uid: uid || "",
      updatedAt: serverTimestamp(),
    };
    if (personalEmail && !personalEmail.includes(`@${AUTH_EMAIL_DOMAIN}`)) {
      updateData.personalEmail = personalEmail.toLowerCase().trim();
    }
    if (flat) {
      updateData.flat = String(flat).replace(/[\s-]/g, "").toUpperCase();
    }
    if (name) {
      updateData.name = String(name).trim();
    }

    await setDoc(doc(db, "authLookup", clean), updateData, { merge: true });

    // Also write flat lookup for fast recovery by flat number
    if (flat) {
      const cleanFlat = String(flat).replace(/[\s-]/g, "").replaceAll("/", "_").replaceAll("\\", "_").toUpperCase();
      if (cleanFlat) {
        await setDoc(doc(db, "authLookup", `flat_${cleanFlat}`), {
          ...updateData,
          flatKey: cleanFlat,
        }, { merge: true });
      }
    }

    // Also write email lookup for fast recovery & existence verification
    const cleanPersonal = (personalEmail || "").toLowerCase().trim();
    if (cleanPersonal && isRealEmail(cleanPersonal)) {
      const safeEmailKey = `email_${cleanPersonal.replace(/\//g, "_")}`;
      await setDoc(doc(db, "authLookup", safeEmailKey), {
        ...updateData,
        emailKey: safeEmailKey,
      }, { merge: true });
      if (!cleanPersonal.includes("/")) {
        await setDoc(doc(db, "authLookup", cleanPersonal), {
          ...updateData,
          emailKey: cleanPersonal,
        }, { merge: true }).catch(() => {});
      }
    }

    // If main auth email is a real email (e.g. admin or custom email)
    const cleanMainEmail = (email || "").toLowerCase().trim();
    if (cleanMainEmail && isRealEmail(cleanMainEmail) && cleanMainEmail !== cleanPersonal) {
      const safeMainKey = `email_${cleanMainEmail.replace(/\//g, "_")}`;
      await setDoc(doc(db, "authLookup", safeMainKey), {
        ...updateData,
        emailKey: safeMainKey,
      }, { merge: true }).catch(() => {});
    }
  } catch (err) {
    console.warn("[Auth] Failed to write authLookup:", err.message);
  }
}

/**
 * Delete a mobile mapping from authLookup/{mobile} and optional flat/email mapping.
 */
export async function deleteAuthLookup(mobile, flat = "", personalEmail = "") {
  const clean = normalizeMobile(mobile);
  if (!clean) return;

  try {
    await deleteDoc(doc(db, "authLookup", clean));
    if (flat) {
      const cleanFlat = String(flat).replace(/[\s-]/g, "").replaceAll("/", "_").replaceAll("\\", "_").toUpperCase();
      if (cleanFlat) {
        await deleteDoc(doc(db, "authLookup", `flat_${cleanFlat}`));
      }
    }
    if (personalEmail && isRealEmail(personalEmail)) {
      const cleanEm = personalEmail.toLowerCase().trim();
      await deleteDoc(doc(db, "authLookup", `email_${cleanEm.replace(/\//g, "_")}`)).catch(() => {});
      if (!cleanEm.includes("/")) {
        await deleteDoc(doc(db, "authLookup", cleanEm)).catch(() => {});
      }
    }
    console.log("[Auth] authLookup deleted for mobile:", clean);
  } catch (err) {
    console.warn("[Auth] Failed to delete authLookup:", err.message);
  }
}

/**
 * Look up the Firebase Auth email for a mobile number.
 *
 * Lookup order:
 * 1. authLookup/{cleanMobile} in Firestore
 * 2. Fallback check in users / residents collections to repair missing lookup
 * 3. Fallback to canonical pseudo-email: {cleanMobile}@smart-manager-aad4d.firebaseapp.com
 */
export async function lookupEmailByMobile(mobile) {
  const clean = normalizeMobile(mobile);
  if (!clean) return "";

  // 1. Check authLookup collection (public read enabled)
  try {
    const lookupDoc = await getDoc(doc(db, "authLookup", clean));
    if (lookupDoc.exists()) {
      const data = lookupDoc.data();
      if (data.email) {
        console.log("[Auth] Found email in authLookup for mobile:", clean);
        return data.email;
      }
    }
  } catch (err) {
    console.warn("[Auth] authLookup read failed:", err.message);
  }

  // 2. Known Admin Mobile Fallback (Self-Healing if authLookup was wiped)
  if (clean === "9643445720") {
    console.log("[Auth] Found primary admin mobile 9643445720 -> dharmendrasngh101@gmail.com");
    return "dharmendrasngh101@gmail.com";
  }

  // 3. Fallback: Check if user doc is admin with custom email
  try {
    const usersQ = query(collection(db, "users"), where("phone", "==", clean));
    const usersSnap = await getDocs(usersQ);
    if (!usersSnap.empty) {
      const uData = usersSnap.docs[0].data();
      if (uData.role === "admin" && uData.email) {
        writeAuthLookup(clean, uData.email, usersSnap.docs[0].id);
        return uData.email;
      }
    }
  } catch (lookupErr) {
    console.warn("[Auth] Firestore profile lookup failed:", lookupErr.message);
  }

  // 4. Canonical fallback: pseudo-email from mobile
  console.log("[Auth] Falling back to canonical pseudo-email for:", clean);
  return mobileToAuthEmail(clean);
}

// =============================
// Resident Personal Email Finder
// =============================

/**
 * Detect and correct common email domain typos (e.g. .cm instead of .com, @gmai.com instead of @gmail.com)
 */
export function correctEmailTypo(email) {
  if (!email || !email.includes("@")) return { email, wasCorrected: false, original: email };
  const original = email.toLowerCase().trim();
  let candidate = original;

  candidate = candidate
    .replace(/@gmail\.cm$/i, "@gmail.com")
    .replace(/@gmai\.com$/i, "@gmail.com")
    .replace(/@gmial\.com$/i, "@gmail.com")
    .replace(/@gamil\.com$/i, "@gmail.com")
    .replace(/@yahoo\.cm$/i, "@yahoo.com")
    .replace(/@yaho\.com$/i, "@yahoo.com")
    .replace(/@hotmial\.com$/i, "@hotmail.com")
    .replace(/@outlok\.com$/i, "@outlook.com")
    .replace(/\.cm$/i, ".com");

  return {
    email: candidate,
    wasCorrected: original !== candidate,
    original,
  };
}

/**
 * Look up whether a resident or user has a registered personal email
 * by their 10-digit mobile number, flat number (e.g. D571), or direct email address.
 * Filters out internal Firebase pseudo-emails and verifies existence in registered accounts.
 */
export async function findPersonalEmailForIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) return { found: false, error: "Please enter your registered email address or 10-digit mobile number." };

  // 1. Direct Email entered
  if (raw.includes("@")) {
    const typoCheck = correctEmailTypo(raw);
    const emailCandidate = typoCheck.email.toLowerCase().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)) {
      return { found: false, error: "Please enter a valid email address format (e.g. name@gmail.com)." };
    }
    if (
      emailCandidate.includes(`@${AUTH_EMAIL_DOMAIN}`) ||
      emailCandidate.includes("firebaseapp.com")
    ) {
      return { found: false, error: "Internal pseudo-emails cannot be used for recovery. Please enter your registered personal email." };
    }

    // 1a. Master Admin email
    if (isExactAdminEmail(emailCandidate)) {
      return {
        found: true,
        email: emailCandidate,
        name: "Administrator",
        role: "admin",
        matchedBy: "admin_email",
        isDirectEmail: true,
        wasCorrected: typoCheck.wasCorrected,
        correctedFrom: typoCheck.wasCorrected ? typoCheck.original : null,
      };
    }

    // 1b. Check authLookup collection (publicly readable document by key)
    const safeEmailKey = `email_${emailCandidate.replace(/\//g, "_")}`;
    try {
      const emailDoc = await getDoc(doc(db, "authLookup", safeEmailKey));
      if (emailDoc.exists()) {
        const data = emailDoc.data();
        return {
          found: true,
          email: emailCandidate,
          mobile: data.mobile || "",
          flat: data.flat || "",
          name: data.name || "",
          uid: data.uid || "",
          matchedBy: "email",
          isDirectEmail: true,
          wasCorrected: typoCheck.wasCorrected,
          correctedFrom: typoCheck.wasCorrected ? typoCheck.original : null,
        };
      }
    } catch (err) {
      console.warn("[Auth] authLookup email lookup error:", err.message);
    }

    try {
      const directDoc = await getDoc(doc(db, "authLookup", emailCandidate));
      if (directDoc.exists()) {
        const data = directDoc.data();
        return {
          found: true,
          email: emailCandidate,
          mobile: data.mobile || "",
          flat: data.flat || "",
          name: data.name || "",
          uid: data.uid || "",
          matchedBy: "email",
          isDirectEmail: true,
          wasCorrected: typoCheck.wasCorrected,
          correctedFrom: typoCheck.wasCorrected ? typoCheck.original : null,
        };
      }
    } catch (err) {
      console.warn("[Auth] direct authLookup lookup error:", err.message);
    }

    // 1b-2. Query authLookup collection by personalEmail (with auto-healing)
    try {
      const q = query(
        collection(db, "authLookup"),
        where("personalEmail", "==", emailCandidate)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const mobileDoc = snap.docs.find((d) => /^\d{10}$/.test(d.id)) || snap.docs[0];
        const data = mobileDoc.data();
        const mob = data.mobile || (/^\d{10}$/.test(mobileDoc.id) ? mobileDoc.id : "");

        // Auto-heal safe email key in authLookup for ultra-fast subsequent lookups
        try {
          await setDoc(doc(db, "authLookup", safeEmailKey), {
            ...data,
            mobile: mob,
            emailKey: safeEmailKey,
          }, { merge: true });
        } catch {}

        return {
          found: true,
          email: emailCandidate,
          mobile: mob,
          flat: data.flat || "",
          name: data.name || "",
          uid: data.uid || "",
          matchedBy: "email",
          isDirectEmail: true,
          wasCorrected: typoCheck.wasCorrected,
          correctedFrom: typoCheck.wasCorrected ? typoCheck.original : null,
        };
      }
    } catch (err) {
      console.warn("[Auth] authLookup personalEmail query error:", err.message);
    }

    // 1b-3. Query authLookup collection by email (main auth email if real)
    try {
      const qAuth = query(
        collection(db, "authLookup"),
        where("email", "==", emailCandidate)
      );
      const snapAuth = await getDocs(qAuth);
      if (!snapAuth.empty) {
        const mobileDoc = snapAuth.docs.find((d) => /^\d{10}$/.test(d.id)) || snapAuth.docs[0];
        const data = mobileDoc.data();
        const mob = data.mobile || (/^\d{10}$/.test(mobileDoc.id) ? mobileDoc.id : "");
        return {
          found: true,
          email: emailCandidate,
          mobile: mob,
          flat: data.flat || "",
          name: data.name || "",
          uid: data.uid || "",
          matchedBy: "email",
          isDirectEmail: true,
          wasCorrected: typoCheck.wasCorrected,
          correctedFrom: typoCheck.wasCorrected ? typoCheck.original : null,
        };
      }
    } catch (err) {
      console.warn("[Auth] authLookup email query error:", err.message);
    }

    // 1c. Check users / residents collections as fallback if readable
    try {
      const usersQ = query(collection(db, "users"), where("email", "==", emailCandidate));
      const usersSnap = await getDocs(usersQ);
      if (!usersSnap.empty) {
        const uData = usersSnap.docs[0].data();
        return {
          found: true,
          email: emailCandidate,
          mobile: uData.phone || uData.mobile || "",
          flat: uData.flat || uData.flatNumber || "",
          uid: usersSnap.docs[0].id,
          name: uData.name || "",
          matchedBy: "users",
          isDirectEmail: true,
          wasCorrected: typoCheck.wasCorrected,
          correctedFrom: typoCheck.wasCorrected ? typoCheck.original : null,
        };
      }
    } catch {}

    try {
      const resQ = query(collection(db, "residents"), where("email", "==", emailCandidate));
      const resSnap = await getDocs(resQ);
      if (!resSnap.empty) {
        const rData = resSnap.docs[0].data();
        return {
          found: true,
          email: emailCandidate,
          mobile: rData.mobile || "",
          flat: rData.flat || rData.flatNumber || "",
          uid: resSnap.docs[0].id,
          name: rData.owner || "",
          matchedBy: "residents",
          isDirectEmail: true,
          wasCorrected: typoCheck.wasCorrected,
          correctedFrom: typoCheck.wasCorrected ? typoCheck.original : null,
        };
      }
    } catch {}

    // Not found in any registered account!
    return {
      found: false,
      email: emailCandidate,
      error: `No registered account found with email "${emailCandidate}".`,
      tip: "Please enter the registered email address linked to your account, or use 'Request Admin Permission'.",
      wasCorrected: typoCheck.wasCorrected,
      correctedFrom: typoCheck.wasCorrected ? typoCheck.original : null,
    };
  }

  // 2. Mobile number entered (10 digits)
  const cleanMobile = normalizeMobile(raw);
  if (cleanMobile.length === 10) {
    // Check authLookup doc (publicly readable for unauthenticated users)
    try {
      const lookupDoc = await getDoc(doc(db, "authLookup", cleanMobile));
      if (lookupDoc.exists()) {
        const data = lookupDoc.data();
        const em = data.personalEmail || data.email;
        if (
          em &&
          !em.includes(`@${AUTH_EMAIL_DOMAIN}`) &&
          !em.includes("firebaseapp.com")
        ) {
          return {
            found: true,
            email: em.toLowerCase(),
            mobile: cleanMobile,
            flat: data.flat || "",
            name: data.name || "",
            uid: data.uid || "",
            matchedBy: "mobile",
          };
        }
      }
    } catch (err) {
      console.warn("[Auth] authLookup check failed:", err.message);
    }

    // Check users collection (where phone == cleanMobile) if readable
    try {
      const usersQ = query(collection(db, "users"), where("phone", "==", cleanMobile));
      const usersSnap = await getDocs(usersQ);
      if (!usersSnap.empty) {
        const uData = usersSnap.docs[0].data();
        const em = uData.personalEmail || uData.email;
        if (
          em &&
          !em.includes(`@${AUTH_EMAIL_DOMAIN}`) &&
          !em.includes("firebaseapp.com")
        ) {
          return {
            found: true,
            email: em.toLowerCase(),
            mobile: cleanMobile,
            flat: uData.flat || uData.flatNumber || "",
            uid: usersSnap.docs[0].id,
            name: uData.name || "",
            matchedBy: "mobile",
          };
        }
      }
    } catch (err) {
      console.warn("[Auth] users lookup failed:", err.message);
    }

    // Check residents collection (where mobile == cleanMobile) if readable
    try {
      const resQ = query(collection(db, "residents"), where("mobile", "==", cleanMobile));
      const resSnap = await getDocs(resQ);
      if (!resSnap.empty) {
        const rData = resSnap.docs[0].data();
        const em = rData.email || rData.personalEmail;
        if (
          em &&
          !em.includes(`@${AUTH_EMAIL_DOMAIN}`) &&
          !em.includes("firebaseapp.com")
        ) {
          return {
            found: true,
            email: em.toLowerCase(),
            mobile: cleanMobile,
            flat: rData.flat || rData.flatNumber || "",
            uid: resSnap.docs[0].id,
            name: rData.owner || "",
            matchedBy: "mobile",
          };
        }
      }
    } catch (err) {
      console.warn("[Auth] residents lookup failed:", err.message);
    }

    return {
      found: false,
      mobile: cleanMobile,
      error: `No registered account found with mobile number "${cleanMobile}".`,
      tip: "Please check if you mistyped any digits, or try searching by Flat Number (e.g. D571).",
    };
  }

  // 3. Flat Number Lookup (e.g. "D571", "571", "D-571", "d571", "PH1/101")
  const cleanFlat = raw.replace(/[\s-]/g, "").replaceAll("/", "_").replaceAll("\\", "_").toUpperCase();
  const flatCandidates = [
    `flat_${cleanFlat}`,
  ];
  if (!raw.includes("/") && !raw.includes("\\")) {
    flatCandidates.push(cleanFlat);
  }
  if (!/^[A-Z]/.test(cleanFlat)) {
    flatCandidates.push(`flat_D${cleanFlat}`);
  }

  for (const fKey of flatCandidates) {
    try {
      const fDoc = await getDoc(doc(db, "authLookup", fKey));
      if (fDoc.exists()) {
        const fData = fDoc.data();
        const em = fData.personalEmail || fData.email;
        if (
          em &&
          !em.includes(`@${AUTH_EMAIL_DOMAIN}`) &&
          !em.includes("firebaseapp.com")
        ) {
          return {
            found: true,
            email: em.toLowerCase(),
            mobile: fData.mobile || "",
            flat: fData.flat || cleanFlat,
            name: fData.name || "",
            uid: fData.uid || "",
            matchedBy: "flat",
          };
        }
      }
    } catch (fErr) {
      console.warn("[Auth] Flat lookup error:", fErr.message);
    }
  }

  return {
    found: false,
    error: `No registered account found matching "${raw}".`,
    tip: "Please enter your 10-digit mobile number, Flat number (e.g. D571), or registered email address.",
  };
}

// =============================
// Fetch & Self-Heal User Profile
// =============================

/**
 * Fetch the user's canonical profile.
 * If users/{uid} is missing, attempts self-healing against residents,
 * committee, collectors, and registrationRequests to eliminate the
 * "No account found" error.
 */
export async function fetchUserProfile(firebaseUser) {
  if (!firebaseUser) return null;

  const uid = firebaseUser.uid;
  console.log("[Auth] UID:", uid);

  // 1. Check users/{uid} first (approved users)
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      let data = userDoc.data();
      console.log("[Auth] Firestore user document found, role:", data.role);

      // For admin accounts, verify active === true
      if (data.role === "admin") {
        if (data.active === false) {
          console.warn("[Auth] Admin account is deactivated");
          return null;
        }
      }

      // If user was previously registered as resident but is now in committee, elevate their role
      const emailPrefix = (firebaseUser.email || "").split("@")[0];
      const fallbackMob = /^\d{10}$/.test(emailPrefix) ? emailPrefix : "";
      const effectiveMob = normalizeMobile(data.phone || data.mobile || fallbackMob);
      if (data.role !== "admin" && data.role !== "committee") {
        try {
          let commSnap = null;
          if (effectiveMob) {
            commSnap = await getDocs(query(collection(db, "committee"), where("phone", "==", effectiveMob)));
          }
          if ((!commSnap || commSnap.empty) && data.residentId) {
            const byIdDoc = await getDoc(doc(db, "committee", data.residentId));
            if (byIdDoc.exists()) {
              commSnap = { empty: false, docs: [byIdDoc] };
            }
          }
          if (commSnap && !commSnap.empty) {
            const cData = commSnap.docs[0].data();
            console.log("[Auth] User found in committee collection! Upgrading role to committee.");
            data.role = "committee";
            data.designation = cData.designation || data.designation || "Member";
            data.permissions = cData.permissions || data.permissions || {};
            data.isResident = true;
            data.residentId = data.residentId || cData.residentId || "";
            await setDoc(doc(db, "users", uid), {
              role: "committee",
              designation: data.designation,
              permissions: data.permissions,
              isResident: true,
              residentId: data.residentId,
            }, { merge: true });
          }
        } catch (commErr) {
          console.warn("[Auth] Committee elevation check:", commErr.message);
        }
      }

      return {
        uid,
        email: firebaseUser.email,
        ...data,
        mobile: data.mobile || data.phone || "",
        phone: data.phone || data.mobile || "",
        mustChangePassword: data.mustChangePassword === true,
      };
    }
  } catch (err) {
    console.warn("[Auth] users/{uid} read failed:", err.message);
  }

  console.log("[Auth] No users/{uid} document — starting self-healing resolution");

  // Extract mobile if using pseudo-email (e.g. 8920300027@...)
  const emailPrefix = (firebaseUser.email || "").split("@")[0];
  const possibleMobile = /^\d{10}$/.test(emailPrefix) ? emailPrefix : "";

  // 2. Check committee by mobile FIRST (so committee members get committee portal)
  if (possibleMobile) {
    try {
      const commQ = query(collection(db, "committee"), where("phone", "==", possibleMobile));
      const commSnap = await getDocs(commQ);
      if (!commSnap.empty) {
        const cMatched = commSnap.docs[0];
        const cData = cMatched.data();

        // Also check if there's a resident record to carry forward flat details
        let residentInfo = {
          flat: cData.flat || "",
          flatNumber: cData.flatNumber || cData.flat || "",
          block: cData.block || "",
          blockId: cData.blockId || "",
          residentId: cData.residentId || "",
        };
        try {
          const resQ = query(collection(db, "residents"), where("mobile", "==", possibleMobile));
          const resSnap = await getDocs(resQ);
          if (!resSnap.empty) {
            const rData = resSnap.docs[0].data();
            residentInfo = {
              flat: residentInfo.flat || rData.flat || "",
              flatNumber: residentInfo.flatNumber || rData.flatNumber || rData.flat || "",
              block: residentInfo.block || rData.block || "",
              blockId: residentInfo.blockId || rData.blockId || "",
              residentId: residentInfo.residentId || resSnap.docs[0].id,
            };
          }
        } catch {}

        const repairedUser = {
          role: "committee",
          name: cData.name || "",
          phone: cData.phone || possibleMobile,
          email: firebaseUser.email || cData.email || "",
          designation: cData.designation || "Member",
          permissions: cData.permissions || {},
          profilePhotoUrl: cData.profilePhotoUrl || "",
          ...residentInfo,
          isResident: Boolean(residentInfo.flat || residentInfo.residentId),
          status: cData.status || "active",
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", uid), repairedUser, { merge: true });
        // Link committee doc if it had a different id
        await setDoc(doc(db, "committee", uid), { ...cData, uid }, { merge: true });
        writeAuthLookup(possibleMobile, firebaseUser.email, uid, repairedUser.email, repairedUser.flat, repairedUser.name);
        return { uid, ...repairedUser };
      }
    } catch (commErr) {
      console.warn("[Auth] committee query by mobile failed:", commErr.message);
    }
  }

  // 3. Check collectors by mobile
  if (possibleMobile) {
    try {
      const colQ = query(collection(db, "collectors"), where("mobile", "==", possibleMobile));
      const colSnap = await getDocs(colQ);
      if (!colSnap.empty) {
        const cData = colSnap.docs[0].data();
        const repairedUser = {
          role: "collector",
          name: cData.name || "",
          phone: cData.mobile || possibleMobile,
          email: firebaseUser.email || cData.email || "",
          area: cData.area || "",
          vehicle: cData.vehicle || "",
          status: cData.status || "Active",
          mustChangePassword: cData.mustChangePassword === true,
          assignedModules: Array.isArray(cData.assignedModules) && cData.assignedModules.length > 0 ? cData.assignedModules : ["garbage"],
          assignedCampaigns: Array.isArray(cData.assignedCampaigns) ? cData.assignedCampaigns : [],
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", uid), repairedUser, { merge: true });
        writeAuthLookup(possibleMobile, firebaseUser.email, uid);
        return { uid, ...repairedUser };
      }
    } catch (err) {
      console.warn("[Auth] collectors query by mobile failed:", err.message);
    }
  }

  // 4. Check residents collection by mobile number (in case resident doc had auto-id)
  if (possibleMobile) {
    try {
      const resQ = query(collection(db, "residents"), where("mobile", "==", possibleMobile));
      const resSnap = await getDocs(resQ);
      if (!resSnap.empty) {
        const matched = resSnap.docs[0];
        const resData = matched.data();
        const repairedUser = {
          role: "resident",
          name: resData.owner || "",
          phone: resData.mobile || possibleMobile,
          email: firebaseUser.email || resData.email || "",
          flat: resData.flat || "",
          flatNumber: resData.flatNumber || resData.flat || "",
          block: resData.block || "",
          blockId: resData.blockId || "",
          residentId: matched.id,
          status: "active",
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", uid), repairedUser, { merge: true });
        writeAuthLookup(possibleMobile, firebaseUser.email, uid);
        return { uid, ...repairedUser };
      }
    } catch (err) {
      console.warn("[Auth] residents query by mobile failed:", err.message);
    }
  }

  // 5. Check committee/{uid} doc directly
  try {
    const commDoc = await getDoc(doc(db, "committee", uid));
    if (commDoc.exists()) {
      const cData = commDoc.data();
      const repairedUser = {
        role: "committee",
        name: cData.name || "",
        phone: cData.phone || possibleMobile,
        email: firebaseUser.email || cData.email || "",
        designation: cData.designation || "Member",
        permissions: cData.permissions || {},
        status: "active",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", uid), repairedUser, { merge: true });
      if (cData.phone) writeAuthLookup(cData.phone, firebaseUser.email, uid);
      return { uid, ...repairedUser };
    }
  } catch (err) {
    console.warn("[Auth] committee/{uid} check failed:", err.message);
  }

  // 6. Check residents/{uid} doc directly
  try {
    const residentDoc = await getDoc(doc(db, "residents", uid));
    if (residentDoc.exists()) {
      const resData = residentDoc.data();
      const repairedUser = {
        role: "resident",
        name: resData.owner || "",
        phone: resData.mobile || possibleMobile,
        email: firebaseUser.email || resData.email || "",
        flat: resData.flat || "",
        flatNumber: resData.flatNumber || resData.flat || "",
        block: resData.block || "",
        blockId: resData.blockId || "",
        residentId: uid,
        status: "active",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", uid), repairedUser, { merge: true });
      if (resData.mobile) {
        writeAuthLookup(resData.mobile, firebaseUser.email, uid);
      }
      return { uid, ...repairedUser };
    }
  } catch (err) {
    console.warn("[Auth] residents/{uid} check failed:", err.message);
  }

  // 5. Check collectors/{uid}
  try {
    const colDoc = await getDoc(doc(db, "collectors", uid));
    if (colDoc.exists()) {
      const cData = colDoc.data();
      const repairedUser = {
        role: "collector",
        name: cData.name || "",
        phone: cData.mobile || possibleMobile,
        email: firebaseUser.email || cData.email || "",
        area: cData.area || "",
        vehicle: cData.vehicle || "",
        status: cData.status || "Active",
        mustChangePassword: cData.mustChangePassword === true,
        assignedModules: Array.isArray(cData.assignedModules) && cData.assignedModules.length > 0 ? cData.assignedModules : ["garbage"],
        assignedCampaigns: Array.isArray(cData.assignedCampaigns) ? cData.assignedCampaigns : [],
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", uid), repairedUser, { merge: true });
      if (cData.mobile) writeAuthLookup(cData.mobile, firebaseUser.email, uid);
      return { uid, ...repairedUser };
    }
  } catch (err) {
    console.warn("[Auth] collectors/{uid} check failed:", err.message);
  }

  // 6. Check registrationRequests/{uid}
  try {
    const regDoc = await getDoc(doc(db, "registrationRequests", uid));
    if (regDoc.exists()) {
      const regData = regDoc.data();
      // If admin already approved it, create the users doc immediately
      if (regData.status === "approved") {
        const repairedUser = {
          role: "resident",
          name: regData.name || "",
          phone: regData.mobile || possibleMobile,
          email: firebaseUser.email || regData.email || "",
          flat: regData.flat || "",
          flatNumber: regData.flatNumber || regData.flat || "",
          block: regData.block || "",
          blockId: regData.blockId || "",
          residentId: uid,
          status: "active",
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", uid), repairedUser, { merge: true });
        if (regData.mobile) writeAuthLookup(regData.mobile, firebaseUser.email, uid);
        return { uid, ...repairedUser };
      }

      // Still pending or rejected
      return {
        uid,
        email: firebaseUser.email,
        name: regData.name || "",
        mobile: regData.mobile || "",
        phone: regData.mobile || "",
        flat: regData.flat || "",
        block: regData.block || "",
        role: "pending_registration",
        status: regData.status || "pending",
        rejectionReason: regData.rejectionReason || "",
        registeredAt: regData.registeredAt,
      };
    }
  } catch (regError) {
    if (regError.code !== "permission-denied" && regError.code !== "PERMISSION_DENIED") {
      console.warn("[Auth] registrationRequests read failed:", regError.message);
    }
  }

  // 7. Check if main Admin UID
  if (uid === PROTECTED_ADMIN_UID) {
    const adminProfile = {
      role: "admin",
      name: "Admin",
      email: firebaseUser.email,
      phone: possibleMobile || "",
      active: true,
      status: "active",
    };
    await setDoc(doc(db, "users", uid), adminProfile, { merge: true });
    if (possibleMobile) writeAuthLookup(possibleMobile, firebaseUser.email, uid);
    return { uid, ...adminProfile };
  }

  console.log("[Auth] No profile could be resolved for UID:", uid);
  return null;
}

// =============================
// Login (Mobile Number + Password)
// =============================

export async function login(identifier, password) {
  console.log("[Auth] Login attempt with identifier:", identifier);

  const raw = (identifier || "").trim();
  const normalized = normalizeMobile(raw);

  // 0. Pre-authentication Check: Is this mobile number blocked or suspended?
  if (normalized.length === 10) {
    const blockCheck = await checkIfMobileBlocked(normalized);
    if (blockCheck.isBlocked) {
      const bData = blockCheck.blockData;
      if (bData.blockType === "temporary" && bData.blockedUntil) {
        const untilDate = bData.blockedUntil.toDate
          ? bData.blockedUntil.toDate()
          : new Date(bData.blockedUntil);
        const untilStr = untilDate.toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        throw new Error(
          `🚫 Access Suspended: Your access has been temporarily blocked until ${untilStr}. Reason: ${bData.reason || "Administrative action"}. Please contact Society Administration.`
        );
      } else {
        throw new Error(
          `🚫 Access Blocked: Your account has been blocked by Society Administration. Reason: ${bData.reason || "Administrative action"}. Please contact Society Administration.`
        );
      }
    }
  }

  let authEmail;

  if (normalized.length === 10) {
    authEmail = await lookupEmailByMobile(normalized);
  } else if (raw.includes("@")) {
    // Legacy support if someone provides direct email
    authEmail = raw;
  } else {
    throw new Error("Please enter a valid 10-digit mobile number or email.");
  }

  console.log("[Auth] Resolved auth email for sign-in:", authEmail);

  try {
    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, authEmail, password);
    } catch (primaryErr) {
      // Self-Healing Recovery:
      // If primary email sign-in failed, test canonical pseudo-email, personal email lookups, and known fallbacks
      const candidates = [];
      if (normalized.length === 10) {
        const pseudo = mobileToAuthEmail(normalized);
        if (pseudo.toLowerCase() !== (authEmail || "").toLowerCase()) {
          candidates.push(pseudo);
        }
        // Also check if user has a registered personal email in authLookup
        try {
          const lookupDoc = await getDoc(doc(db, "authLookup", normalized));
          if (lookupDoc.exists()) {
            const lData = lookupDoc.data();
            const pEmail = (lData.personalEmail || "").trim().toLowerCase();
            if (pEmail && isRealEmail(pEmail) && pEmail !== (authEmail || "").toLowerCase()) {
              candidates.push(pEmail);
            }
          }
        } catch (lookupErr) {
          console.warn("[Auth] Fallback personalEmail lookup failed:", lookupErr.message);
        }
      } else if (raw.includes("@")) {
        // If resident entered their personal email, look up their linked mobile number
        try {
          const cleanEmail = raw.trim().toLowerCase();
          const uSnap = await getDocs(query(collection(db, "users"), where("email", "==", cleanEmail)));
          if (!uSnap.empty) {
            const uData = uSnap.docs[0].data();
            const mob = normalizeMobile(uData.phone || uData.mobile || "");
            if (mob.length === 10) candidates.push(mobileToAuthEmail(mob));
          } else {
            const rSnap = await getDocs(query(collection(db, "residents"), where("email", "==", cleanEmail)));
            if (!rSnap.empty) {
              const rData = rSnap.docs[0].data();
              const mob = normalizeMobile(rData.mobile || "");
              if (mob.length === 10) candidates.push(mobileToAuthEmail(mob));
            } else {
              const reqSnap = await getDocs(query(collection(db, "registrationRequests"), where("email", "==", cleanEmail)));
              if (!reqSnap.empty) {
                const reqData = reqSnap.docs[0].data();
                const mob = normalizeMobile(reqData.mobile || "");
                if (mob.length === 10) candidates.push(mobileToAuthEmail(mob));
              }
            }
          }
        } catch (emailLookupErr) {
          console.warn("[Auth] Personal email candidate lookup failed:", emailLookupErr.message);
        }
      }
      if (normalized === "9643445720") {
        candidates.push("dharmendrasngh101@gmail.com");
      }

      let fallbackSuccess = false;
      for (const altEmail of candidates) {
        try {
          console.log("[Auth] Attempting self-healing fallback with:", altEmail);
          credential = await signInWithEmailAndPassword(auth, altEmail, password);
          authEmail = altEmail;
          fallbackSuccess = true;
          console.log("[Auth] Fallback sign-in succeeded!");
          break;
        } catch (altErr) {
          console.warn("[Auth] Fallback failed for", altEmail, altErr.code);
        }
      }
      if (!fallbackSuccess && normalized.length === 10 && password && password.length >= 6) {
        const canonicalEmail = mobileToAuthEmail(normalized);
        try {
          // Check if this mobile number is a registered member in our database
          const lookupDoc = await getDoc(doc(db, "authLookup", normalized));
          if (lookupDoc.exists()) {
            const methods = await fetchSignInMethodsForEmail(auth, canonicalEmail);
            if (!methods || methods.length === 0) {
              console.log("[Auth] Registered member has no Firebase Auth user — auto-provisioning with entered password for:", normalized);
              credential = await createUserWithEmailAndPassword(auth, canonicalEmail, password);
              authEmail = canonicalEmail;
              fallbackSuccess = true;
              console.log("[Auth] Auto-provisioning succeeded! UID:", credential.user.uid);
            }
          }
        } catch (provisionErr) {
          if (provisionErr.code === "auth/email-already-in-use") {
            console.log("[Auth] Account already exists in Auth, incorrect password was entered.");
          } else {
            console.warn("[Auth] Auto-provisioning error:", provisionErr.code, provisionErr.message);
          }
        }
      }
      if (!fallbackSuccess) {
        throw primaryErr;
      }
    }

    console.log("[Auth] Firebase Auth successful, UID:", credential.user.uid);

    const profile = await fetchUserProfile(credential.user);

    if (!profile) {
      throw new Error("No account profile found for this mobile number. Please contact Admin.");
    }

    // Ensure authLookup mapping is confirmed / restored
    const effectiveMobile =
      normalized.length === 10
        ? normalized
        : normalizeMobile(profile.phone || profile.mobile || "");

    // Post-auth security check: verify if profile or effectiveMobile is blocked
    const postMobile = effectiveMobile || normalizeMobile(profile.phone || profile.mobile || "");
    if (postMobile) {
      const postCheck = await checkIfMobileBlocked(postMobile);
      if (postCheck.isBlocked) {
        await signOut(auth);
        const bData = postCheck.blockData;
        throw new Error(
          `🚫 Access Blocked: Your account has been blocked by Society Administration. Reason: ${bData.reason || "Administrative action"}. Please contact Society Administration.`
        );
      }
    }

    if (profile.isBlocked || profile.status === "blocked" || profile.status === "Blocked") {
      await signOut(auth);
      throw new Error(
        `🚫 Access Blocked: Your account has been blocked by Society Administration. Reason: ${profile.blockReason || "Administrative action"}. Please contact Society Administration.`
      );
    }

    if (effectiveMobile && effectiveMobile.length === 10) {
      console.log("[Auth] Restoring authLookup for mobile:", effectiveMobile);
      writeAuthLookup(effectiveMobile, authEmail, credential.user.uid);
    }

    // If admin, automatically re-sync any missing authLookup entries in the background
    if (profile.role === "admin") {
      syncAllAuthLookups().catch((err) =>
        console.warn("[Auth] Background authLookup sync:", err.message)
      );
    }

    // Record login event for portal tracking & audit
    recordLoginEvent({
      uid: credential.user.uid,
      name: profile.name || "User",
      identifier: cleanUserIdentifier(effectiveMobile || profile.mobile || profile.phone || raw),
      role: profile.role || "resident",
      portal: getPortalFromRole(profile.role),
      status: "success",
      extra: {
        flat: profile.flat || profile.flatNumber || "",
        block: profile.block || "",
      },
    }).catch((e) => console.warn("[Auth] Login tracking error:", e.message));

    return profile;
  } catch (error) {
    // Record failed login attempt for audit
    recordLoginEvent({
      uid: "",
      name: "Unknown",
      identifier: cleanUserIdentifier(raw),
      role: "unknown",
      portal: "Login Portal",
      status: "failed",
      error: error.message || error.code || "Authentication failed",
    }).catch(() => {});

    if (
      error.code === "auth/user-not-found" ||
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password"
    ) {
      throw new Error("Invalid mobile number or password.");
    }
    if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed attempts. Please try again later.");
    }
    throw error;
  }
}

/**
 * Rebuild / sync all authLookup documents for all residents, collectors, committee, and users.
 * Automatically called when admin logs in, and can be triggered manually.
 */
export async function syncAllAuthLookups(force = false) {
  if (!auth.currentUser) return;

  // Avoid running full sync more than once per browser session
  if (!force && typeof window !== "undefined" && window.sessionStorage) {
    if (sessionStorage.getItem("rwa_auth_lookups_synced")) {
      return;
    }
  }

  try {
    const lookupMap = new Map();

    // 1. Sync from residents
    try {
      if (!auth.currentUser) return;
      const resSnap = await getDocs(collection(db, "residents"));
      for (const rDoc of resSnap.docs) {
        const data = rDoc.data();
        const clean = normalizeMobile(data.mobile || "");
        if (clean && clean.length === 10) {
          lookupMap.set(clean, {
            email: mobileToAuthEmail(clean),
            uid: rDoc.id,
            flat: data.flat || "",
            name: data.owner || data.name || "",
          });
        }
      }
    } catch {}

    // 2. Sync from collectors
    try {
      if (!auth.currentUser) return;
      const colSnap = await getDocs(collection(db, "collectors"));
      for (const cDoc of colSnap.docs) {
        const data = cDoc.data();
        const clean = normalizeMobile(data.mobile || "");
        if (clean && clean.length === 10 && !lookupMap.has(clean)) {
          lookupMap.set(clean, {
            email: mobileToAuthEmail(clean),
            uid: cDoc.id,
            name: data.name || "",
          });
        }
      }
    } catch {}

    // 3. Sync from committee
    try {
      if (!auth.currentUser) return;
      const commSnap = await getDocs(collection(db, "committee"));
      for (const mDoc of commSnap.docs) {
        const data = mDoc.data();
        const clean = normalizeMobile(data.phone || "");
        if (clean && clean.length === 10 && !lookupMap.has(clean)) {
          lookupMap.set(clean, {
            email: mobileToAuthEmail(clean),
            uid: mDoc.id,
            name: data.name || "",
          });
        }
      }
    } catch {}

    // 4. Sync from users (takes priority for admin accounts with personal emails)
    try {
      if (!auth.currentUser) return;
      const usersSnap = await getDocs(collection(db, "users"));
      for (const uDoc of usersSnap.docs) {
        const data = uDoc.data();
        const clean = normalizeMobile(data.phone || data.mobile || "");
        if (clean && clean.length === 10) {
          const email =
            data.role === "admin" &&
            data.email &&
            !data.email.endsWith("@smart-manager-aad4d.firebaseapp.com")
              ? data.email
              : lookupMap.get(clean)?.email || mobileToAuthEmail(clean);
          lookupMap.set(clean, {
            email,
            uid: uDoc.id,
            flat: data.flat || lookupMap.get(clean)?.flat || "",
            name: data.name || lookupMap.get(clean)?.name || "",
          });
        }
      }
    } catch {}

    // Write deduplicated lookups in parallel batches
    const writePromises = [];
    for (const [clean, info] of lookupMap.entries()) {
      writePromises.push(
        writeAuthLookup(clean, info.email, info.uid, "", info.flat || "", info.name || "")
      );
    }
    await Promise.all(writePromises);

    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.setItem("rwa_auth_lookups_synced", "true");
    }
    console.log(`[Auth] Auth lookup sync completed (${lookupMap.size} records synced).`);
  } catch (err) {
    console.warn("[Auth] Failed to sync authLookups:", err.message);
  }
}

// =============================
// Role-Based Home Routes
// =============================

export function getHomeRouteForRole(role) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "/admin/dashboard";
    case "collector":
      return "/collector/dashboard";
    case "committee":
      return "/resident/dashboard";
    case "resident":
      return "/resident/dashboard";
    case "family":
      return "/family/dashboard";
    case "pending_registration":
      return "/pending-approval";
    default:
      return "/";
  }
}

// =============================
// Logout
// =============================

export async function logout() {
  return signOut(auth);
}

// =============================
// Auth State Listener
// =============================

export function subscribeAuth(callback) {
  let aborted = false;

  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      if (aborted) return;
      callback(null);
    } else {
      try {
        const profile = await fetchUserProfile(firebaseUser);
        if (aborted) return;

        // Auto-logout if user account is blocked
        if (profile?.isBlocked || profile?.status === "blocked" || profile?.status === "Blocked") {
          console.warn("[Auth] Logged-in user is blocked, revoking session");
          await signOut(auth);
          callback(null);
          return;
        }

        callback(profile);
      } catch (error) {
        if (aborted) return;
        console.error("Auth state error:", error);
        callback(null);
      }
    }
  });

  return () => {
    aborted = true;
    unsubscribe();
  };
}

// =============================
// Admin: Bulletproof Credential Reset (Spark & Blaze Resilient)
// =============================

export async function adminResetUserCredentials({
  targetUid,
  mobile,
  password,
  name = "",
  role = "resident",
  flat = "",
  block = "",
}) {
  const cleanMobile = normalizeMobile(mobile);
  if (!cleanMobile || cleanMobile.length !== 10) {
    throw new Error("A valid 10-digit mobile number is required to reset credentials.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  // 1. Try Cloud Function first (if deployed on Blaze plan)
  let cloudSuccess = false;
  if (targetUid) {
    try {
      const fnResult = await adminResetPasswordFn({ targetUid, password });
      if (fnResult?.data?.success) {
        cloudSuccess = true;
        console.log("[Auth] Cloud Function password reset succeeded for:", targetUid);
      }
    } catch (fnErr) {
      console.log("[Auth] Cloud Function unavailable on Spark plan, using secondaryAuth:", fnErr.message);
    }
  }

  let finalUid = targetUid;
  let finalAuthEmail = mobileToAuthEmail(cleanMobile);

  // 2. If Cloud Function didn't update password, provision via secondaryAuth
  if (!cloudSuccess) {
    let authUserCreated = false;

    // Check if canonical email can be created
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, finalAuthEmail, password);
      finalUid = cred.user.uid;
      authUserCreated = true;
      console.log("[Auth] Created canonical secondaryAuth user:", finalUid);
    } catch (createErr) {
      if (
        createErr.code === "auth/email-already-in-use" ||
        createErr.message?.includes("email-already-in-use") ||
        createErr.message?.includes("EMAIL_EXISTS")
      ) {
        // Canonical email already exists in Firebase Auth with old forgotten password.
        // Create an alias versioned email for this mobile number!
        finalAuthEmail = `${cleanMobile}.r${Date.now()}@${AUTH_EMAIL_DOMAIN}`;
        const cred = await createUserWithEmailAndPassword(secondaryAuth, finalAuthEmail, password);
        finalUid = cred.user.uid;
        authUserCreated = true;
        console.log("[Auth] Created versioned alias secondaryAuth user:", finalAuthEmail, finalUid);
      } else {
        throw createErr;
      }
    } finally {
      try {
        await signOut(secondaryAuth);
      } catch {}
    }
  }

  // 3. Find existing resident or user data to preserve everything
  let existingData = {};
  let originalResidentId = targetUid;

  // Try reading target user doc
  if (targetUid) {
    try {
      const uSnap = await getDoc(doc(db, "users", targetUid));
      if (uSnap.exists()) {
        existingData = { ...uSnap.data() };
        originalResidentId = existingData.residentId || targetUid;
      }
    } catch (e) {
      console.warn("[Auth] Failed to read old users doc:", e.message);
    }
  }

  // Also check residents collection by mobile to preserve all flat / resident info
  try {
    const rSnap = await getDocs(query(collection(db, "residents"), where("mobile", "==", cleanMobile)));
    if (!rSnap.empty) {
      const rDoc = rSnap.docs[0];
      originalResidentId = rDoc.id;
      const rData = rDoc.data();
      existingData = {
        ...existingData,
        name: existingData.name || rData.owner || name,
        flat: existingData.flat || rData.flat || flat,
        block: existingData.block || rData.block || block,
        blockId: existingData.blockId || rData.blockId,
        floor: existingData.floor || rData.floor,
        flatNumber: existingData.flatNumber || rData.flatNumber,
        plotNumber: existingData.plotNumber || rData.plotNumber,
        unitNumber: existingData.unitNumber || rData.unitNumber,
        fatherHusbandName: existingData.fatherHusbandName || rData.fatherHusbandName,
        personType: existingData.personType || rData.personType,
      };
    }
  } catch (e) {
    console.warn("[Auth] Failed to check residents doc:", e.message);
  }

  // 4. Update authLookup so login instantly resolves this email and new UID
  await setDoc(
    doc(db, "authLookup", cleanMobile),
    {
      mobile: cleanMobile,
      email: finalAuthEmail,
      uid: finalUid,
      name: existingData.name || name || "",
      flat: existingData.flat || flat || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 5. Update/create users/{finalUid}
  const updatedUserDoc = {
    ...existingData,
    uid: finalUid,
    residentId: originalResidentId || finalUid,
    role: existingData.role || role || "resident",
    phone: cleanMobile,
    mobile: cleanMobile,
    name: existingData.name || name || "",
    mustChangePassword: true,
    tempPasswordSetAt: serverTimestamp(),
    passwordChangedAt: serverTimestamp(),
    status: "active",
    approved: true,
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, "users", finalUid), updatedUserDoc, { merge: true });

  // If finalUid is different from targetUid, also keep original targetUid marked
  if (targetUid && targetUid !== finalUid) {
    try {
      await updateDoc(doc(db, "users", targetUid), {
        mustChangePassword: true,
        passwordChangedAt: serverTimestamp(),
        activeAuthUid: finalUid,
      });
    } catch {}
  }

  // 6. Update residents doc with active authUid and link
  if (originalResidentId) {
    try {
      await updateDoc(doc(db, "residents", originalResidentId), {
        uid: finalUid,
        authUid: finalUid,
        mustChangePassword: true,
        updatedAt: serverTimestamp(),
      });
    } catch (rErr) {
      console.warn("[Auth] Failed to update resident doc:", rErr.message);
    }
  }

  // 7. Terminate any previous active sessions
  try {
    if (targetUid) {
      await terminateAllOtherSessions(
        targetUid,
        null,
        "Your password was reset by administrator. Please log in with your temporary password."
      );
    }
    if (finalUid && finalUid !== targetUid) {
      await terminateAllOtherSessions(
        finalUid,
        null,
        "Your password was reset by administrator. Please log in with your temporary password."
      );
    }
  } catch {}

  return {
    success: true,
    tempPassword: password,
    authEmail: finalAuthEmail,
    uid: finalUid,
    residentId: originalResidentId || finalUid,
  };
}
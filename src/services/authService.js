import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";
import { recordLoginEvent, getPortalFromRole, cleanUserIdentifier } from "./loginTrackerService";
import { checkIfMobileBlocked } from "./blockService";

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
 */
export async function writeAuthLookup(mobile, email, uid) {
  const clean = normalizeMobile(mobile);
  if (!clean || clean.length !== 10) return;

  try {
    await setDoc(doc(db, "authLookup", clean), {
      mobile: clean,
      email: email,
      uid: uid || "",
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log("[Auth] authLookup written for mobile:", clean);
  } catch (err) {
    console.warn("[Auth] Failed to write authLookup:", err.message);
  }
}

/**
 * Delete a mobile mapping from authLookup/{mobile}.
 */
export async function deleteAuthLookup(mobile) {
  const clean = normalizeMobile(mobile);
  if (!clean) return;

  try {
    await deleteDoc(doc(db, "authLookup", clean));
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
 * Look up whether a resident or user has a registered personal email
 * by either their 10-digit mobile number or their entered email address.
 * Filters out internal Firebase pseudo-emails.
 */
export async function findPersonalEmailForIdentifier(identifier) {
  const raw = String(identifier || "").trim();
  if (!raw) return { found: false, error: "Please enter your email or mobile number." };

  // 1. Direct Email entered
  if (raw.includes("@")) {
    const emailCandidate = raw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate)) {
      return { found: false, error: "Please enter a valid email address format." };
    }
    if (
      emailCandidate.includes(`@${AUTH_EMAIL_DOMAIN}`) ||
      emailCandidate.includes("firebaseapp.com")
    ) {
      return { found: false, error: "Please enter a valid personal email address." };
    }
    return {
      found: true,
      email: emailCandidate,
      isDirectEmail: true,
    };
  }

  // 2. Mobile number entered
  const cleanMobile = normalizeMobile(raw);
  if (cleanMobile.length !== 10) {
    return { found: false, error: "Please enter a valid 10-digit mobile number or email." };
  }

  // Check authLookup doc (publicly readable)
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
          uid: data.uid || "",
        };
      }
    }
  } catch (err) {
    console.warn("[Auth] authLookup check failed:", err.message);
  }

  // Check users collection (where phone == cleanMobile)
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
          uid: usersSnap.docs[0].id,
          name: uData.name || "",
        };
      }
    }
  } catch (err) {
    console.warn("[Auth] users lookup failed:", err.message);
  }

  // Check residents collection (where mobile == cleanMobile)
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
          uid: resSnap.docs[0].id,
          name: rData.owner || "",
        };
      }
    }
  } catch (err) {
    console.warn("[Auth] residents lookup failed:", err.message);
  }

  return {
    found: false,
    mobile: cleanMobile,
    error: "No registered personal email found for this mobile number.",
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
async function fetchUserProfile(firebaseUser) {
  if (!firebaseUser) return null;

  const uid = firebaseUser.uid;
  console.log("[Auth] UID:", uid);

  // 1. Check users/{uid} first (approved users)
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log("[Auth] Firestore user document found, role:", data.role);

      // For admin accounts, verify active === true
      if (data.role === "admin") {
        if (data.active === false) {
          console.warn("[Auth] Admin account is deactivated");
          return null;
        }
      }

      return {
        uid,
        email: firebaseUser.email,
        ...data,
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

  // 2. Check residents/{uid}
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

  // 3. Check residents collection by mobile number (in case resident doc had auto-id)
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

  // 4. Check committee/{uid}
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
        status: "active",
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
      // If primary email sign-in failed, test canonical pseudo-email and known fallbacks
      const candidates = [];
      if (normalized.length === 10) {
        const pseudo = mobileToAuthEmail(normalized);
        if (pseudo.toLowerCase() !== (authEmail || "").toLowerCase()) {
          candidates.push(pseudo);
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
export async function syncAllAuthLookups() {
  try {
    console.log("[Auth] Starting full authLookup sync...");

    // 1. Sync from residents
    try {
      const resSnap = await getDocs(collection(db, "residents"));
      for (const rDoc of resSnap.docs) {
        const data = rDoc.data();
        const clean = normalizeMobile(data.mobile || "");
        if (clean && clean.length === 10) {
          writeAuthLookup(clean, mobileToAuthEmail(clean), rDoc.id);
        }
      }
    } catch (e) {
      console.warn("[Auth] Residents sync skipped:", e.message);
    }

    // 2. Sync from collectors
    try {
      const colSnap = await getDocs(collection(db, "collectors"));
      for (const cDoc of colSnap.docs) {
        const data = cDoc.data();
        const clean = normalizeMobile(data.mobile || "");
        if (clean && clean.length === 10) {
          writeAuthLookup(clean, mobileToAuthEmail(clean), cDoc.id);
        }
      }
    } catch (e) {
      console.warn("[Auth] Collectors sync skipped:", e.message);
    }

    // 3. Sync from committee
    try {
      const commSnap = await getDocs(collection(db, "committee"));
      for (const mDoc of commSnap.docs) {
        const data = mDoc.data();
        const clean = normalizeMobile(data.phone || "");
        if (clean && clean.length === 10) {
          writeAuthLookup(clean, mobileToAuthEmail(clean), mDoc.id);
        }
      }
    } catch (e) {
      console.warn("[Auth] Committee sync skipped:", e.message);
    }

    // 4. Sync from users
    try {
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
              : mobileToAuthEmail(clean);
          writeAuthLookup(clean, email, uDoc.id);
        }
      }
    } catch (e) {
      console.warn("[Auth] Users sync skipped:", e.message);
    }

    console.log("[Auth] Full authLookup sync complete!");
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
      return "/committee/dashboard";
    case "resident":
      return "/resident/dashboard";
    case "family":
      return "/family/dashboard";
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
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { db, secondaryAuth, storage, adminResetPasswordFn } from "../firebase/firebase";
import {
  mobileToAuthEmail,
  writeAuthLookup,
  deleteAuthLookup,
  normalizeMobile,
  validateMobile,
  isRealEmail,
} from "./authService";
import { deleteFirebaseAuthAccount } from "./accountDeletionService";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

const committeeRef = collection(db, "committee");

// =============================
// Accepted image types & max size
// =============================

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validate an image file for type and size.
 * Returns null if valid, or an error message string.
 */
export function validateProfilePhoto(file) {
  if (!file) return "No file selected.";
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Invalid file type. Only JPG, PNG, and WebP are accepted.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File is too large. Maximum size is 5 MB.";
  }
  return null;
}

/**
 * Get the Firebase Storage path for a committee member's profile photo.
 */
function getPhotoStoragePath(memberId) {
  return `committeeMembers/${memberId}/profilePhoto`;
}

/**
 * Upload a committee member's profile photo.
 * Returns the download URL.
 */
export async function uploadCommitteePhoto(memberId, file) {
  if (!memberId || typeof memberId !== "string") {
    console.warn("[uploadCommitteePhoto] Invalid memberId:", memberId);
    return null;
  }
  const validationError = validateProfilePhoto(file);
  if (validationError) throw new Error(validationError);

  const storagePath = getPhotoStoragePath(memberId);
  const storageRef = ref(storage, storagePath);

  // Upload with 15s timeout
  const uploadPromise = uploadBytes(storageRef, file);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error("Photo upload timed out. Check network or storage rules.")),
      15000
    )
  );

  const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
  const downloadUrl = await getDownloadURL(snapshot.ref);

  // Update Firestore doc with the new URL
  await updateDoc(doc(db, "committee", memberId), {
    profilePhotoUrl: downloadUrl,
    updatedAt: serverTimestamp(),
  });

  return downloadUrl;
}

/**
 * Delete a committee member's profile photo from Storage + clear Firestore field.
 */
export async function deleteCommitteePhoto(memberId) {
  const storagePath = getPhotoStoragePath(memberId);

  // Delete from Storage (best-effort — file may not exist)
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    if (error.code !== "storage/object-not-found") {
      console.warn("[Storage] delete failed:", error.message);
    }
  }

  // Clear Firestore field
  await updateDoc(doc(db, "committee", memberId), {
    profilePhotoUrl: "",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Replace a committee member's profile photo.
 * Uploads new photo first, then deletes old one only after success.
 */
export async function replaceCommitteePhoto(memberId, newFile) {
  // Upload new photo first (also updates Firestore)
  const newUrl = await uploadCommitteePhoto(memberId, newFile);

  // Old photo at the same Storage path is automatically overwritten
  // by uploadBytes, so no separate delete needed for the same path.

  return newUrl;
}

// =============================
// Subscribe to committee members
// =============================

export function subscribeCommittee(callback) {
  return onSnapshot(committeeRef, (snapshot) => {
    const rawList = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // Deduplicate by clean phone number or residentId or ID to guarantee no duplicate cards
    const seen = new Set();
    const list = [];
    for (const m of rawList) {
      const cleanP = normalizeMobile(m.phone || m.mobile || "");
      const resId = m.residentId || "";
      const dedupKey = cleanP ? `phone_${cleanP}` : resId ? `res_${resId}` : `id_${m.id}`;
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        list.push(m);
      }
    }

    list.sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
    callback(list);
  }, (error) => {
    console.error("[Firestore] committee listener error:", error.message);
  });
}

// =============================
// Default Committee Delegated Permissions
// =============================

export const DEFAULT_COMMITTEE_PERMISSIONS = {
  canManageResidents: false,
  canManageCollectors: false,
  canManageRegistrations: false,
  canManageProfileRequests: false,
  canManageAccountRecovery: false,
  canCollectGarbage: false,
  canCollectSpecial: false,
  specialCollectionScope: "all", // "all" | "specific"
  allowedSpecialCollections: [], // array of campaign IDs
  allowedSpecialCollectionNames: [], // array of campaign titles
  canViewGarbageReports: false,
};

// =============================
// Add committee member with auth account
// Uses mobile-based auth (same pattern as residents)
// Email is optional contact info, NOT used for auth
// =============================

export async function addCommitteeMember({
  name,
  designation,
  phone,
  email,
  password,
  tenure,
  introduction,
  order,
  flat,
  block,
  blockId,
  residentId,
  permissions = {},
  mustChangePassword = true,
  profilePhotoUrl = "",
}) {
  // Validate required phone number
  const cleanPhone = normalizeMobile(phone);
  const phoneError = validateMobile(cleanPhone);
  if (phoneError) {
    throw new Error(phoneError);
  }

  const canCollectGarbage = Boolean(permissions?.canCollectGarbage);
  const canCollectSpecial = Boolean(permissions?.canCollectSpecial);
  const specialCollectionScope = permissions?.specialCollectionScope || "all";
  const allowedSpecialCollections = Array.isArray(permissions?.allowedSpecialCollections)
    ? permissions.allowedSpecialCollections
    : [];
  const allowedSpecialCollectionNames = Array.isArray(permissions?.allowedSpecialCollectionNames)
    ? permissions.allowedSpecialCollectionNames
    : [];
  const canViewReports = Boolean(
    permissions?.canViewGarbageReports ||
    permissions?.canViewReports ||
    permissions?.canViewAnalytics
  );
  const finalPermissions = {
    ...DEFAULT_COMMITTEE_PERMISSIONS,
    ...(permissions || {}),
    canCollectGarbage,
    canCollectSpecial,
    specialCollectionScope,
    allowedSpecialCollections,
    allowedSpecialCollectionNames,
    canViewGarbageReports: canViewReports,
  };
  let uid = residentId || null;
  let isExistingAccount = Boolean(residentId);

  // Check if this mobile number already exists in committee
  try {
    const commByPhoneQ = query(collection(db, "committee"), where("phone", "==", cleanPhone));
    const commByPhoneSnap = await getDocs(commByPhoneQ);
    if (!commByPhoneSnap.empty) {
      throw new Error("This person is already registered as an active committee official.");
    }
  } catch (commErr) {
    if (commErr.message.includes("already registered as an active committee official")) {
      throw commErr;
    }
    console.warn("[Committee] phone check:", commErr.message);
  }

  const authEmail = mobileToAuthEmail(cleanPhone);

  // 1. Check if user already exists in authLookup (fastest and most accurate)
  if (!uid) {
    try {
      const lookupDoc = await getDoc(doc(db, "authLookup", cleanPhone));
      if (lookupDoc.exists() && lookupDoc.data()?.uid) {
        uid = lookupDoc.data().uid;
        isExistingAccount = true;
      }
    } catch (findErr) {
      console.warn("[Committee] Error checking authLookup:", findErr.message);
    }
  }

  // 2. Check if user already exists in users collection
  if (!uid) {
    try {
      const uSnap = await getDocs(query(collection(db, "users"), where("phone", "==", cleanPhone)));
      if (!uSnap.empty) {
        uid = uSnap.docs[0].id;
        isExistingAccount = true;
      } else {
        const uSnapMobile = await getDocs(query(collection(db, "users"), where("mobile", "==", cleanPhone)));
        if (!uSnapMobile.empty) {
          uid = uSnapMobile.docs[0].id;
          isExistingAccount = true;
        }
      }
    } catch (uErr) {
      console.warn("[Committee] Error checking users doc:", uErr.message);
    }
  }

  // 3. Check if user exists in residents collection
  if (!uid) {
    try {
      const resSnap = await getDocs(query(collection(db, "residents"), where("mobile", "==", cleanPhone)));
      if (!resSnap.empty) {
        uid = resSnap.docs[0].data()?.uid || resSnap.docs[0].id;
        isExistingAccount = true;
      }
    } catch (rErr) {
      console.warn("[Committee] Error checking residents doc:", rErr.message);
    }
  }

  const effectivePassword =
    password && password.length >= 6 ? password : `RWA@${cleanPhone.slice(-6)}`;

  // 4. If account does NOT exist anywhere, create in Firebase Auth
  if (!isExistingAccount && !uid) {
    try {
      const credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        authEmail,
        effectivePassword
      );
      uid = credential.user.uid;
      console.log("[Committee] Created Firebase Auth user with UID:", uid);
    } catch (authError) {
      if (
        authError.code === "auth/email-already-in-use" ||
        authError.code === "auth/email-already-exists" ||
        authError.message?.includes("EMAIL_EXISTS") ||
        authError.message?.includes("email-already-in-use")
      ) {
        isExistingAccount = true;
        // Resolve UID from authLookup if available
        try {
          const lookupDoc = await getDoc(doc(db, "authLookup", cleanPhone));
          if (lookupDoc.exists() && lookupDoc.data()?.uid) {
            uid = lookupDoc.data().uid;
          }
        } catch {}
      } else if (authError.code === "auth/weak-password") {
        throw new Error("Password is too weak. Use at least 6 characters.");
      } else {
        console.warn("[Committee] createUserWithEmailAndPassword note:", authError.message);
        isExistingAccount = true;
      }
    } finally {
      try {
        await signOut(secondaryAuth);
      } catch (soErr) {
        // Ignore
      }
    }
  }

  // If admin provided a password and account exists, attempt update
  if (isExistingAccount && password && password.length >= 6 && uid) {
    try {
      await adminResetPasswordFn({ targetUid: uid, password });
    } catch (pwErr) {
      console.warn(
        "[Committee] could not reset password on existing account:",
        pwErr.message
      );
    }
  }

  if (!uid) {
    uid = residentId || doc(collection(db, "committee")).id;
  }

  // Check if they are also a resident
  let wasResident = Boolean(residentId);
  let oldUserData = {};
  if (isExistingAccount) {
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        oldUserData = userSnap.data();
        if (oldUserData.role === "resident" || oldUserData.isResident) {
          wasResident = true;
        }
      }
      const resSnap = await getDoc(doc(db, "residents", uid));
      if (resSnap.exists()) {
        wasResident = true;
      }
    } catch (checkErr) {
      console.warn("Resident check error:", checkErr.message);
    }
  }

  const realEmail = isRealEmail(email)
    ? email.trim()
    : isRealEmail(oldUserData.email)
    ? oldUserData.email.trim()
    : "";

  // Create users/{uid} role doc or merge with existing
  const userPayload = {
    role: "committee",
    designation,
    name,
    email: realEmail,
    phone: cleanPhone,
    flat: flat || oldUserData.flat || "",
    block: block || oldUserData.block || "",
    blockId: blockId || oldUserData.blockId || "",
    residentId: residentId || oldUserData.residentId || (wasResident ? uid : ""),
    isResident: wasResident,
    permissions: finalPermissions,
    canCollectGarbage,
    canCollectSpecial,
    canViewGarbageReports: canViewReports,
    profilePhotoUrl: profilePhotoUrl || oldUserData.profilePhotoUrl || "",
    status: "active",
    ...(isExistingAccount
      ? {
          previousRole: oldUserData.role || "resident",
          updatedAt: serverTimestamp(),
        }
      : {
          mustChangePassword: mustChangePassword === true,
          createdAt: serverTimestamp(),
        }),
  };

  await setDoc(doc(db, "users", uid), userPayload, { merge: true });

  // Create committee/{uid} profile doc
  await setDoc(doc(db, "committee", uid), {
    name,
    designation,
    phone: cleanPhone,
    email: realEmail,
    uid,
    profilePhotoUrl: profilePhotoUrl || oldUserData.profilePhotoUrl || "",
    tenure: tenure || "",
    introduction: introduction || "",
    order: order || 99,
    flat: flat || oldUserData.flat || "",
    block: block || oldUserData.block || "",
    blockId: blockId || oldUserData.blockId || "",
    residentId: residentId || oldUserData.residentId || (wasResident ? uid : ""),
    isResident: wasResident,
    permissions: finalPermissions,
    canCollectGarbage,
    canCollectSpecial,
    canViewGarbageReports: canViewReports,
    status: "active",
    mustChangePassword: isExistingAccount ? false : mustChangePassword === true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Always write / update authLookup so the phone number resolves instantly
  try {
    await writeAuthLookup(
      cleanPhone,
      authEmail,
      uid,
      (email || "").trim(),
      flat || oldUserData.flat || "",
      name.trim()
    );
  } catch (lookupErr) {
    console.warn("[Committee] writeAuthLookup error:", lookupErr.message);
  }

  return uid;
}

/**
 * Set committee member photo URL directly (supports public paths or external URLs).
 */
export async function setCommitteePhotoUrl(memberId, photoUrl) {
  const cleanUrl = (photoUrl || "").trim();
  await updateDoc(doc(db, "committee", memberId), {
    profilePhotoUrl: cleanUrl,
    updatedAt: serverTimestamp(),
  });
  try {
    await updateDoc(doc(db, "users", memberId), {
      profilePhotoUrl: cleanUrl,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // Non-critical if user doc doesn't exist
  }
  return cleanUrl;
}

// =============================
// Update committee member
// =============================

export async function updateCommitteeMember(uid, data) {
  const { ...cleanData } = data;
  const cleanPhone = data.phone !== undefined ? normalizeMobile(data.phone) : undefined;
  
  let canCollectGarbage = undefined;
  if (cleanData.permissions && cleanData.permissions.canCollectGarbage !== undefined) {
    canCollectGarbage = Boolean(cleanData.permissions.canCollectGarbage);
  } else if (cleanData.canCollectGarbage !== undefined) {
    canCollectGarbage = Boolean(cleanData.canCollectGarbage);
  }

  let canCollectSpecial = undefined;
  if (cleanData.permissions && cleanData.permissions.canCollectSpecial !== undefined) {
    canCollectSpecial = Boolean(cleanData.permissions.canCollectSpecial);
  } else if (cleanData.canCollectSpecial !== undefined) {
    canCollectSpecial = Boolean(cleanData.canCollectSpecial);
  }

  if (canCollectGarbage !== undefined) {
    cleanData.canCollectGarbage = canCollectGarbage;
    cleanData.permissions = {
      ...(cleanData.permissions || {}),
      canCollectGarbage,
    };
  }

  const specialCollectionScope = cleanData.permissions?.specialCollectionScope ?? cleanData.specialCollectionScope;
  const allowedSpecialCollections = cleanData.permissions?.allowedSpecialCollections ?? cleanData.allowedSpecialCollections;
  const allowedSpecialCollectionNames = cleanData.permissions?.allowedSpecialCollectionNames ?? cleanData.allowedSpecialCollectionNames;

  if (canCollectSpecial !== undefined) {
    cleanData.canCollectSpecial = canCollectSpecial;
    cleanData.permissions = {
      ...(cleanData.permissions || {}),
      canCollectSpecial,
      ...(specialCollectionScope !== undefined ? { specialCollectionScope } : {}),
      ...(allowedSpecialCollections !== undefined ? { allowedSpecialCollections } : {}),
      ...(allowedSpecialCollectionNames !== undefined ? { allowedSpecialCollectionNames } : {}),
    };
  }

  let canViewReports = undefined;
  if (cleanData.permissions && cleanData.permissions.canViewGarbageReports !== undefined) {
    canViewReports = Boolean(cleanData.permissions.canViewGarbageReports);
  } else if (cleanData.canViewGarbageReports !== undefined) {
    canViewReports = Boolean(cleanData.canViewGarbageReports);
  }

  if (canViewReports !== undefined) {
    cleanData.canViewGarbageReports = canViewReports;
    cleanData.permissions = {
      ...(cleanData.permissions || {}),
      canViewGarbageReports: canViewReports,
    };
  }

  // If phone changed, update authLookup
  if (cleanPhone) {
    try {
      const commDoc = await getDoc(doc(db, "committee", uid));
      if (commDoc.exists()) {
        const oldPhone = normalizeMobile(commDoc.data().phone);
        if (oldPhone && oldPhone !== cleanPhone) {
          await deleteAuthLookup(oldPhone);
          const authEmail = mobileToAuthEmail(cleanPhone);
          await writeAuthLookup(cleanPhone, authEmail, uid);
        }
      }
    } catch (err) {
      console.warn("[updateCommitteeMember] authLookup sync error:", err.message);
    }
  }

  // Update committee/{uid}
  await updateDoc(doc(db, "committee", uid), {
    ...cleanData,
    ...(cleanPhone ? { phone: cleanPhone } : {}),
    updatedAt: serverTimestamp(),
  });

  // Also update users/{uid} if name/designation/phone/flat/block/permissions changed
  const userUpdates = {};
  if (cleanData.name !== undefined) userUpdates.name = cleanData.name;
  if (cleanData.designation !== undefined) userUpdates.designation = cleanData.designation;
  if (cleanPhone !== undefined) userUpdates.phone = cleanPhone;
  if (cleanData.flat !== undefined) userUpdates.flat = cleanData.flat;
  if (cleanData.block !== undefined) userUpdates.block = cleanData.block;
  if (cleanData.blockId !== undefined) userUpdates.blockId = cleanData.blockId;
  if (cleanData.residentId !== undefined) userUpdates.residentId = cleanData.residentId;
  if (cleanData.email !== undefined) {
    const validEmail = isRealEmail(cleanData.email) ? cleanData.email.trim() : "";
    cleanData.email = validEmail;
    userUpdates.email = validEmail;
  }
  if (cleanData.permissions !== undefined) userUpdates.permissions = cleanData.permissions;
  if (canCollectGarbage !== undefined) {
    userUpdates.canCollectGarbage = canCollectGarbage;
  }
  if (canCollectSpecial !== undefined) {
    userUpdates.canCollectSpecial = canCollectSpecial;
    if (specialCollectionScope !== undefined) userUpdates.specialCollectionScope = specialCollectionScope;
    if (allowedSpecialCollections !== undefined) userUpdates.allowedSpecialCollections = allowedSpecialCollections;
    if (allowedSpecialCollectionNames !== undefined) userUpdates.allowedSpecialCollectionNames = allowedSpecialCollectionNames;
  }
  if (canViewReports !== undefined) {
    userUpdates.canViewGarbageReports = canViewReports;
  }

  if (Object.keys(userUpdates).length > 0) {
    await setDoc(doc(db, "users", uid), {
      ...userUpdates,
      role: "committee",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}

/**
 * Quick toggle for committee Garbage Collection power by Admin
 */
export async function toggleCommitteeGarbagePower(uid, enabled) {
  const isAllowed = Boolean(enabled);
  const update = {
    canCollectGarbage: isAllowed,
    "permissions.canCollectGarbage": isAllowed,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "committee", uid), update);
  try {
    await updateDoc(doc(db, "users", uid), {
      canCollectGarbage: isAllowed,
      "permissions.canCollectGarbage": isAllowed,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[toggleCommitteeGarbagePower] users doc sync:", err.message);
  }
}

/**
 * Quick toggle for committee Special Collections power by Admin
 */
export async function toggleCommitteeSpecialPower(uid, enabled) {
  const isAllowed = Boolean(enabled);
  const update = {
    canCollectSpecial: isAllowed,
    "permissions.canCollectSpecial": isAllowed,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "committee", uid), update);
  try {
    await updateDoc(doc(db, "users", uid), {
      canCollectSpecial: isAllowed,
      "permissions.canCollectSpecial": isAllowed,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[toggleCommitteeSpecialPower] users doc sync:", err.message);
  }
}

/**
 * Quick toggle for committee fee collection power by Admin (alias to garbage power)
 */
export async function toggleCommitteeCollectionPower(uid, enabled) {
  return toggleCommitteeGarbagePower(uid, enabled);
}

/**
 * Quick toggle for committee member Society Analytics / Reports viewing power by Admin
 */
export async function toggleCommitteeReportAccess(uid, enabled) {
  const isAllowed = Boolean(enabled);
  const update = {
    canViewGarbageReports: isAllowed,
    "permissions.canViewGarbageReports": isAllowed,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "committee", uid), update);
  try {
    await updateDoc(doc(db, "users", uid), {
      canViewGarbageReports: isAllowed,
      "permissions.canViewGarbageReports": isAllowed,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[toggleCommitteeReportAccess] users doc sync:", err.message);
  }
}

// =============================
// Remove committee member
// =============================

export async function removeCommitteeMember(uid) {
  // Check if member was also a resident
  let wasResident = false;
  try {
    const commDoc = await getDoc(doc(db, "committee", uid));
    if (commDoc.exists()) {
      wasResident = commDoc.data().isResident || Boolean(commDoc.data().residentId);
    }
    if (!wasResident) {
      const resDoc = await getDoc(doc(db, "residents", uid));
      if (resDoc.exists()) wasResident = true;
    }
  } catch (err) {
    console.warn("[removeCommitteeMember] check resident failed:", err.message);
  }

  // Delete profile photo from Storage (best-effort)
  try {
    const storageRef = ref(storage, getPhotoStoragePath(uid));
    await deleteObject(storageRef);
  } catch {
    // Photo may not exist — not critical
  }

  // Delete committee/{uid} doc
  try {
    await deleteDoc(doc(db, "committee", uid));
  } catch {
    // May not exist
  }

  if (wasResident) {
    // Member is also a society resident! Do NOT delete their user or auth account!
    // Safely revert their role to "resident"
    try {
      await updateDoc(doc(db, "users", uid), {
        role: "resident",
        designation: "",
        updatedAt: serverTimestamp(),
      });
    } catch (uErr) {
      console.warn("Revert user role failed:", uErr.message);
    }
  } else {
    // Non-resident committee member: remove authLookup, users doc, and Firebase Auth
    let commPhone = null;
    let commEmail = null;
    try {
      const commDoc = await getDoc(doc(db, "committee", uid));
      if (commDoc.exists()) {
        const cData = commDoc.data();
        commPhone = cData.phone || cData.mobile;
        commEmail = cData.email;
        if (commPhone) {
          await deleteAuthLookup(commPhone);
        }
      }
    } catch (err) {
      console.warn("[removeCommitteeMember] authLookup delete error:", err.message);
    }

    try {
      const uDoc = await getDoc(doc(db, "users", uid));
      if (uDoc.exists()) {
        const uData = uDoc.data();
        if (uData.phone) await deleteAuthLookup(uData.phone);
        if (!commEmail) commEmail = uData.email;
      }
      await deleteDoc(doc(db, "users", uid));
    } catch {
      // May not exist
    }

    try {
      await deleteFirebaseAuthAccount({
        uid,
        phone: commPhone,
        email: commEmail,
      });
    } catch (authErr) {
      console.warn("[removeCommitteeMember] Auth delete error:", authErr.message);
    }
  }
}


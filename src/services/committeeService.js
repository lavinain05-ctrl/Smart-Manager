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
    const list = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
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
}) {
  // Validate required phone number
  const cleanPhone = normalizeMobile(phone);
  const phoneError = validateMobile(cleanPhone);
  if (phoneError) {
    throw new Error(phoneError);
  }

  const finalPermissions = {
    ...DEFAULT_COMMITTEE_PERMISSIONS,
    ...(permissions || {}),
  };

  let uid = null;
  let isExistingAccount = false;

  // Check if this mobile number already exists in authLookup
  try {
    const lookupDoc = await getDoc(doc(db, "authLookup", cleanPhone));
    if (lookupDoc.exists()) {
      const existingUid = lookupDoc.data().uid;
      // Check if already in committee
      const existingCommDoc = await getDoc(doc(db, "committee", existingUid));
      if (existingCommDoc.exists()) {
        throw new Error("This person is already registered as an active committee official.");
      }
      // They already have an account (e.g. resident or family member)
      // Elevate them to committee!
      uid = existingUid;
      isExistingAccount = true;
    }
  } catch (err) {
    if (err.message.includes("already registered as an active committee official")) {
      throw err;
    }
    console.warn("[Committee] authLookup check:", err.message);
  }

  const authEmail = mobileToAuthEmail(cleanPhone);

  if (!isExistingAccount) {
    // New account: create in Firebase Auth
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        authEmail,
        password
      );
    } catch (authError) {
      if (authError.code === "auth/email-already-in-use") {
        // Fallback: If Auth email already exists, link existing account
        const existingLookup = await getDoc(doc(db, "authLookup", cleanPhone));
        if (existingLookup.exists()) {
          uid = existingLookup.data().uid;
          isExistingAccount = true;
        } else {
          throw new Error("This mobile number is already registered.");
        }
      } else if (authError.code === "auth/weak-password") {
        throw new Error("Password is too weak. Use at least 6 characters.");
      } else {
        throw authError;
      }
    }

    if (!isExistingAccount && credential) {
      uid = credential.user.uid;
      // Write mobile lookup
      await writeAuthLookup(cleanPhone, authEmail, uid);
      // Sign out secondary instance
      await signOut(secondaryAuth);
    }
  }

  // If existing account and admin provided a new password, update it
  if (isExistingAccount && password && password.length >= 6) {
    try {
      await adminResetPasswordFn({ targetUid: uid, password });
    } catch (pwErr) {
      console.warn("[Committee] could not reset password on existing account:", pwErr.message);
    }
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

  // Create users/{uid} role doc or merge with existing
  const userPayload = {
    role: "committee",
    designation,
    name,
    email: (email || "").trim() || oldUserData.email || authEmail,
    phone: cleanPhone,
    flat: flat || oldUserData.flat || "",
    block: block || oldUserData.block || "",
    blockId: blockId || oldUserData.blockId || "",
    residentId: residentId || oldUserData.residentId || (wasResident ? uid : ""),
    isResident: wasResident,
    permissions: finalPermissions,
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
    email: (email || "").trim(),
    uid,
    profilePhotoUrl: oldUserData.profilePhotoUrl || "",
    tenure: tenure || "",
    introduction: introduction || "",
    order: order || 99,
    flat: flat || oldUserData.flat || "",
    block: block || oldUserData.block || "",
    blockId: blockId || oldUserData.blockId || "",
    residentId: residentId || oldUserData.residentId || (wasResident ? uid : ""),
    isResident: wasResident,
    permissions: finalPermissions,
    status: "active",
    mustChangePassword: isExistingAccount ? false : mustChangePassword === true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return uid;
}

// =============================
// Update committee member
// =============================

export async function updateCommitteeMember(uid, data) {
  const cleanPhone = data.phone !== undefined ? normalizeMobile(data.phone) : undefined;

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
    ...data,
    ...(cleanPhone ? { phone: cleanPhone } : {}),
    updatedAt: serverTimestamp(),
  });

  // Also update users/{uid} if name/designation/phone/flat/block/permissions changed
  const userUpdates = {};
  if (data.name !== undefined) userUpdates.name = data.name;
  if (data.designation !== undefined) userUpdates.designation = data.designation;
  if (cleanPhone !== undefined) userUpdates.phone = cleanPhone;
  if (data.flat !== undefined) userUpdates.flat = data.flat;
  if (data.block !== undefined) userUpdates.block = data.block;
  if (data.blockId !== undefined) userUpdates.blockId = data.blockId;
  if (data.residentId !== undefined) userUpdates.residentId = data.residentId;
  if (data.email !== undefined) userUpdates.email = (data.email || "").trim();
  if (data.permissions !== undefined) userUpdates.permissions = data.permissions;

  if (Object.keys(userUpdates).length > 0) {
    await updateDoc(doc(db, "users", uid), userUpdates);
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


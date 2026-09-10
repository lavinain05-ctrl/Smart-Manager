const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Initialize Firebase Admin
initializeApp();

const db = getFirestore();
const auth = getAuth();

// =============================================
// deleteAuthAccount — Callable Cloud Function
// =============================================
//
// Securely deletes a Firebase Authentication account.
// Only callable by users with role === "admin" in Firestore.
//
// Parameters:
//   uid  (string) — The UID of the account to delete
//
// Returns:
//   { success: true, message: "..." }
//
// Security:
//   1. Caller must be authenticated
//   2. Caller must have role === "admin" in users/{callerUid}
//   3. Cannot delete your own account
// =============================================

exports.deleteAuthAccount = onCall({ cors: true }, async (request) => {
  // 1. Verify caller is authenticated
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to delete accounts."
    );
  }

  const callerUid = request.auth.uid;
  const data = request.data || {};
  const targetUid = data.uid || data.targetUid;
  const rawPhones = [data.phone, data.mobile, ...(data.phones || [])].filter(Boolean);
  const rawEmails = [data.email, ...(data.emails || [])].filter(Boolean);
  const extraUids = Array.isArray(data.uids) ? data.uids : [];

  // 2. Verify caller is admin
  try {
    const callerDoc = await db.collection("users").doc(callerUid).get();

    if (!callerDoc.exists || callerDoc.data().role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only administrators can delete accounts."
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "Failed to verify admin permissions."
    );
  }

  const PROTECTED_ADMIN_UID = "92jYvGPlKMexX37WEzs7MaDuc7U2";
  const PROTECTED_ADMIN_EMAIL = "dharmendrasngh101@gmail.com";
  const AUTH_EMAIL_DOMAIN = "smart-manager-aad4d.firebaseapp.com";

  // Normalize all phone numbers
  function normalizeMobile(mob) {
    if (!mob) return "";
    const digits = String(mob).replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  }

  const cleanPhones = new Set(rawPhones.map(normalizeMobile).filter((p) => p && p.length === 10));
  const emailsToCheck = new Set(rawEmails.map((e) => (e || "").trim().toLowerCase()).filter(Boolean));
  for (const p of cleanPhones) {
    emailsToCheck.add(`${p}@${AUTH_EMAIL_DOMAIN}`);
  }

  const uidsToDelete = new Set([targetUid, ...extraUids].filter(Boolean));

  // Look up UIDs by email / pseudo-email
  for (const em of emailsToCheck) {
    try {
      const u = await auth.getUserByEmail(em);
      if (u) uidsToDelete.add(u.uid);
    } catch {
      // not found in auth
    }
  }

  // Look up UIDs by phone (+91...)
  for (const p of cleanPhones) {
    try {
      const u = await auth.getUserByPhoneNumber(`+91${p}`);
      if (u) uidsToDelete.add(u.uid);
    } catch {
      // not found in auth
    }
  }

  const deletedUids = [];

  // Delete from Firebase Authentication
  for (const uid of uidsToDelete) {
    if (uid === callerUid || uid === PROTECTED_ADMIN_UID) {
      console.warn(`[Cloud Function] Skipping protected UID: ${uid}`);
      continue;
    }

    try {
      const u = await auth.getUser(uid);
      if (u.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()) {
        console.warn(`[Cloud Function] Skipping protected email: ${u.email}`);
        continue;
      }

      await auth.deleteUser(uid);
      deletedUids.push(uid);
      console.log(`[Cloud Function] Deleted auth user: ${uid} (${u.email || u.phoneNumber})`);
    } catch (err) {
      if (err.code !== "auth/user-not-found") {
        console.error(`[Cloud Function] Error deleting ${uid}:`, err.message);
      }
    }
  }

  // Clean up Firestore authLookup for these phone numbers
  for (const p of cleanPhones) {
    try {
      await db.collection("authLookup").doc(p).delete();
      console.log(`[Cloud Function] Deleted authLookup/${p}`);
    } catch (lookupErr) {
      console.warn(`[Cloud Function] authLookup delete error for ${p}:`, lookupErr.message);
    }
  }

  return {
    success: true,
    deletedUids,
    deletedCount: deletedUids.length,
    message: `Successfully deleted ${deletedUids.length} Firebase Auth account(s) and associated phone mappings.`,
  };
});


// =============================================
// migrateAdminToMobile — Callable Cloud Function
// =============================================
//
// One-time migration: changes the admin's Firebase Auth email
// from a legacy real email (e.g. dharmendra@gmail.com) to a
// mobile-based pseudo-email (e.g. 9876543210@smart-manager-aad4d.firebaseapp.com).
//
// After migration, the admin logs in with mobile number + password.
//
// Security:
//   1. Caller must be authenticated
//   2. Caller must have role === "admin" in Firestore
//   3. Only updates the caller's own Auth account
//
// Parameters:
//   mobile (string) — 10-digit mobile number
// =============================================

exports.migrateAdminToMobile = onCall({ cors: true }, async (request) => {
  // 1. Verify caller is authenticated
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to migrate your account."
    );
  }

  const callerUid = request.auth.uid;
  const mobile = request.data?.mobile;

  // 2. Validate mobile format
  if (!mobile || typeof mobile !== "string" || !/^\d{10}$/.test(mobile)) {
    throw new HttpsError(
      "invalid-argument",
      "A valid 10-digit mobile number is required."
    );
  }

  // 3. Verify caller is admin in Firestore
  try {
    const userDoc = await db.collection("users").doc(callerUid).get();
    if (!userDoc.exists || userDoc.data().role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only admin accounts can be migrated."
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Admin verification error:", error);
    throw new HttpsError("internal", "Failed to verify admin status.");
  }

  const pseudoEmail = `${mobile}@smart-manager-aad4d.firebaseapp.com`;

  // 4. Check if another Auth account already uses this pseudo-email
  try {
    const existingUser = await auth.getUserByEmail(pseudoEmail);
    if (existingUser.uid !== callerUid) {
      throw new HttpsError(
        "already-exists",
        "This mobile number is already associated with a different account."
      );
    }
    // If same UID, already migrated — just update Firestore
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error.code !== "auth/user-not-found") {
      console.error("Email check error:", error);
      throw new HttpsError("internal", "Failed to check mobile availability.");
    }
    // auth/user-not-found = mobile is free, proceed
  }

  // 5. Update Firebase Auth email
  try {
    await auth.updateUser(callerUid, {
      email: pseudoEmail,
      emailVerified: true, // Skip verification for pseudo-emails
    });
  } catch (error) {
    console.error("Auth email update error:", error);
    throw new HttpsError(
      "internal",
      `Failed to update Auth email: ${error.message}`
    );
  }

  // 6. Update Firestore users/{uid} with phone number
  try {
    await db.collection("users").doc(callerUid).update({
      phone: mobile,
      email: pseudoEmail,
    });
  } catch (error) {
    console.error("Firestore update error:", error);
    // Auth was already updated — log but don't fail
  }

  console.log(`[migrateAdminToMobile] Admin ${callerUid} migrated to mobile: ${mobile}`);

  return {
    success: true,
    message: `Admin account migrated. You can now log in with mobile number ${mobile} and your existing password.`,
  };
});

// =============================================
// checkRegistrationAvailability — Callable Cloud Function
// =============================================
//
// Secure pre-registration duplicate check.
// Callable WITHOUT authentication (used before account creation).
// Returns only { available, reason } — never exposes existing user data.
//
// Parameters:
//   mobile      (string) — 10-digit mobile number
//   blockId     (string) — Firestore block document ID
//   flatNumber  (string) — Normalized flat number (e.g. "A101")
//
// Returns:
//   { available: true }
//   or { available: false, reason: "mobile_taken" | "flat_occupied" | ... }
// =============================================

exports.checkRegistrationAvailability = onCall({ cors: true }, async (request) => {
  const { mobile, blockId, flatNumber } = request.data || {};

  // Validate inputs
  if (!mobile || typeof mobile !== "string" || !/^\d{10}$/.test(mobile)) {
    throw new HttpsError(
      "invalid-argument",
      "A valid 10-digit mobile number is required."
    );
  }

  if (!blockId || typeof blockId !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "A valid block selection is required."
    );
  }

  if (!flatNumber || typeof flatNumber !== "string" || !/^[A-Z]\d+$/.test(flatNumber)) {
    throw new HttpsError(
      "invalid-argument",
      "A valid flat number is required (e.g. A101)."
    );
  }

  const pseudoEmail = `${mobile}@smart-manager-aad4d.firebaseapp.com`;

  // 1. Check if mobile pseudo-email already exists in Firebase Auth.
  //    This catches ALL existing accounts (approved, pending, any role).
  try {
    await auth.getUserByEmail(pseudoEmail);
    // If we reach here, the account exists
    return { available: false, reason: "mobile_taken" };
  } catch (e) {
    if (e.code !== "auth/user-not-found") {
      console.error("Auth lookup error:", e);
      throw new HttpsError("internal", "Failed to verify mobile availability.");
    }
    // auth/user-not-found means the mobile is available — continue checks
  }

  // 1b. Check authLookup collection
  try {
    const lookupDoc = await db.collection("authLookup").doc(mobile).get();
    if (lookupDoc.exists) {
      return { available: false, reason: "mobile_taken" };
    }
  } catch (lookupErr) {
    console.warn("authLookup check error:", lookupErr.message);
  }

  // 1c. Check active residents by mobile
  try {
    const resMobSnap = await db.collection("residents").where("mobile", "==", mobile).get();
    const activeRes = resMobSnap.docs.find((d) => (d.data().status || "").toLowerCase() === "active");
    if (activeRes) {
      return { available: false, reason: "mobile_taken" };
    }
  } catch (resErr) {
    console.warn("residents mobile check error:", resErr.message);
  }

  // 2. Check approved residents for blockId + flatNumber combo
  try {
    const residentsSnap = await db.collection("residents")
      .where("blockId", "==", blockId)
      .where("flatNumber", "==", flatNumber)
      .get();

    // Check for active residents (status could be "Active" or "active")
    const activeResident = residentsSnap.docs.find((d) => {
      const status = (d.data().status || "").toLowerCase();
      return status === "active";
    });

    if (activeResident) {
      return { available: false, reason: "flat_occupied" };
    }
  } catch (e) {
    console.error("Residents lookup error:", e);
    throw new HttpsError("internal", "Failed to verify flat availability.");
  }

  // 3. Check pending registrationRequests for same mobile
  try {
    const mobileReqSnap = await db.collection("registrationRequests")
      .where("mobile", "==", mobile)
      .where("status", "==", "pending")
      .get();

    if (!mobileReqSnap.empty) {
      return { available: false, reason: "mobile_pending" };
    }
  } catch (e) {
    console.error("Registration mobile lookup error:", e);
    throw new HttpsError("internal", "Failed to verify mobile availability.");
  }

  // 4. Check pending registrationRequests for same blockId + flat
  try {
    const flatReqSnap = await db.collection("registrationRequests")
      .where("blockId", "==", blockId)
      .where("flat", "==", flatNumber)
      .where("status", "==", "pending")
      .get();

    if (!flatReqSnap.empty) {
      return { available: false, reason: "flat_pending" };
    }
  } catch (e) {
    console.error("Registration flat lookup error:", e);
    throw new HttpsError("internal", "Failed to verify flat availability.");
  }

  return { available: true };
});

// =============================================
// adminResetPassword — Callable Cloud Function
// =============================================
//
// Admin-assisted secure password reset for residents.
// Generates a temporary password, sets it in Firebase Auth,
// and flags the user to change their password on next login.
//
// Parameters:
//   targetUid   (string) — UID of the account to reset
//   requestId   (string) — The recovery request doc ID
//
// Security:
//   1. Caller must be authenticated
//   2. Caller must have role === "admin"
//   3. Cannot reset the main admin account
//
// Returns:
//   { success: true, tempPassword: "..." }
// =============================================

const PROTECTED_ADMIN_UID = "92jYvGPlKMexX37WEzs7MaDuc7U2";

exports.adminResetPassword = onCall({ cors: true }, async (request) => {
  // 1. Verify caller is authenticated
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to reset passwords."
    );
  }

  const callerUid = request.auth.uid;
  const targetUid = request.data?.targetUid;
  const requestId = request.data?.requestId;
  const customPassword = request.data?.password;

  // 2. Validate inputs
  if (!targetUid || typeof targetUid !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "A valid target user UID is required."
    );
  }

  if (customPassword && (typeof customPassword !== "string" || customPassword.length < 6)) {
    throw new HttpsError(
      "invalid-argument",
      "Custom password must be at least 6 characters."
    );
  }

  // 3. Prevent resetting the main admin account
  if (targetUid === PROTECTED_ADMIN_UID) {
    throw new HttpsError(
      "failed-precondition",
      "The main admin account cannot be reset through this system."
    );
  }

  // 4. Verify caller is admin
  try {
    const callerDoc = await db.collection("users").doc(callerUid).get();

    if (!callerDoc.exists || callerDoc.data().role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only administrators can reset passwords."
      );
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "Failed to verify admin permissions."
    );
  }

  // 5. Verify the target user exists in Firebase Auth
  try {
    await auth.getUser(targetUid);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new HttpsError(
        "not-found",
        "The target user account does not exist in Firebase Auth."
      );
    }
    throw new HttpsError("internal", "Failed to verify target user.");
  }

  // 6. Generate or use specified temporary password
  const tempPassword = customPassword
    ? customPassword
    : crypto.randomBytes(9).toString("base64").slice(0, 12);

  // 7. Set the temporary password in Firebase Auth
  try {
    await auth.updateUser(targetUid, {
      password: tempPassword,
    });
  } catch (error) {
    console.error("Password reset error:", error);
    throw new HttpsError(
      "internal",
      `Failed to reset password: ${error.message}`
    );
  }

  // 8. Hash the temp password for audit storage (never store plaintext)
  const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

  // 9. Set expiry to 24 hours from now
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 10. Update the recovery request document if requestId provided
  if (requestId && typeof requestId === "string") {
    try {
      await db.collection("recoveryRequests").doc(requestId).update({
        status: "completed",
        tempPasswordHash: tempPasswordHash,
        tempPasswordExpiresAt: expiresAt,
        mustChangePassword: true,
        processedBy: callerUid,
        processedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error("Firestore update error:", error);
      // Auth password was already changed — log but don't fail
    }
  }

  // 11. Set mustChangePassword flag on the user's Firestore doc
  try {
    await db.collection("users").doc(targetUid).update({
      mustChangePassword: true,
    });
  } catch (error) {
    console.error("User doc update error:", error);
    // Non-fatal — the flag check will still work via recovery request
  }

  console.log(`[adminResetPassword] Password reset for ${targetUid} by admin ${callerUid}`);

  return {
    success: true,
    tempPassword: tempPassword,
  };
});

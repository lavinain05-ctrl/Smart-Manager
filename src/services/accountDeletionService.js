import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { db, deleteAuthAccountFn } from "../firebase/firebase";
import { logActivity } from "./activityLogService";
import { deleteAuthLookup, normalizeMobile } from "./authService";

// =============================================
// Helper: Calculate account lifetime string
// =============================================

function calcLifetime(fromTimestamp) {
  if (!fromTimestamp) return "Unknown";

  const from = fromTimestamp.toDate
    ? fromTimestamp.toDate()
    : new Date(fromTimestamp);
  const now = new Date();
  const diffMs = now - from;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days < 1) return "Less than a day";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? "s" : ""}`;
  }
  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);
  return `${years} year${years > 1 ? "s" : ""}${remainingMonths > 0 ? `, ${remainingMonths} month${remainingMonths > 1 ? "s" : ""}` : ""}`;
}

// =============================================
// Archive a deleted account (read-only record)
// =============================================

async function archiveDeletedAccount({
  uid,
  name,
  email,
  phone,
  role,
  flat,
  block,
  reason,
  adminName,
  adminUid,
  registeredAt,
  approvedAt,
  deletionType,
  cleanupResults,
}) {
  await addDoc(collection(db, "deletedAccounts"), {
    originalUid: uid || "",
    name: name || "Unknown",
    email: email || "",
    phone: phone || "",
    role: role || "unknown",
    flat: flat || "",
    block: block || "",
    reason: reason || "No reason provided",
    deletedBy: adminName || "Admin",
    deletedByUid: adminUid || "",
    deletedAt: serverTimestamp(),
    registeredAt: registeredAt || null,
    approvedAt: approvedAt || null,
    accountLifetime: calcLifetime(registeredAt),
    deletionType: deletionType || "admin_deleted",
    cleanupResults: cleanupResults || { cleaned: [], errors: [] },
  });
}

// =============================================
// Delete Firebase Auth account via Dev Bridge or Cloud Function
// =============================================


export async function deleteFirebaseAuthAccount(params) {
  const payload = typeof params === "string" ? { uid: params } : (params || {});

  // 1. Try local dev bridge first (works instantly in dev without Cloud Functions / Blaze plan)
  try {
    const devRes = await fetch("/api/admin/delete-auth-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (devRes.ok) {
      const devData = await devRes.json();
      if (devData.success) {
        console.log("[Auth Deletion] Deleted via dev bridge:", devData);
        return {
          success: true,
          message: "Deleted via Admin Dev Bridge",
          deletedCount: devData.count,
        };
      }
    }
  } catch {
    // Expected in production or if dev bridge is unreachable — fall through to Cloud Function
  }

  // 2. Cloud Function fallback (for production deployment on Blaze plan)
  try {
    const result = await deleteAuthAccountFn(payload);
    return result.data || { success: true };
  } catch (error) {
    console.error("[Cloud Function] deleteAuthAccount error:", error.message);
    // Don't throw — auth deletion failure shouldn't block Firestore cleanup
    return {
      success: false,
      message: error.message,
    };
  }
}


// =============================================
// Release flat when resident is deleted
// =============================================

async function releaseFlat(flat, block, residentId) {
  try {
    let flatSnap;

    // Primary: find flat by residentId (most reliable)
    if (residentId) {
      const q = query(
        collection(db, "flats"),
        where("residentId", "==", residentId)
      );
      flatSnap = await getDocs(q);
    }

    // Fallback: find by flatNumber + blockName
    if ((!flatSnap || flatSnap.empty) && flat && block) {
      const q = query(
        collection(db, "flats"),
        where("flatNumber", "==", flat),
        where("blockName", "==", block)
      );
      flatSnap = await getDocs(q);
    }

    if (flatSnap && flatSnap.size > 0) {
      const batch = writeBatch(db);
      flatSnap.docs.forEach((flatDoc) => {
        batch.update(flatDoc.ref, {
          residentId: "",
          status: "vacant",
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error("[Flat Release] Error:", error.message);
  }
}

// =============================================
// Remove user from event registrations
// =============================================

async function cleanupEventRegistrations(userId) {
  try {
    const eventsSnap = await getDocs(collection(db, "events"));
    const batch = writeBatch(db);
    let updated = 0;

    eventsSnap.docs.forEach((eventDoc) => {
      const data = eventDoc.data();
      const registrations = data.registrations || [];

      const filtered = registrations.filter(
        (r) => r.residentId !== userId
      );

      if (filtered.length !== registrations.length) {
        batch.update(eventDoc.ref, { registrations: filtered });
        updated++;
      }
    });

    if (updated > 0) {
      await batch.commit();
    }

    return updated;
  } catch (error) {
    console.error("[Event Cleanup] Error:", error.message);
    return 0;
  }
}

// =============================================
// Comprehensive Account Deletion
// Handles ALL roles: resident, family, collector, committee, pending
// =============================================

export async function deleteUserAccount({
  userId,
  userName,
  userEmail,
  userPhone,
  userRole,
  userFlat,
  userBlock,
  deletionReason,
  familyAction, // "delete" | "deactivate" | "keep"
  adminName,
  adminUid,
  registeredAt,
  approvedAt,
}) {
  const results = {
    success: true,
    cleaned: [],
    errors: [],
    authDeleted: false,
  };

  try {
    // =============================================
    // 0. Auto-Discovery: Find ALL associated phones, emails, and UIDs
    // =============================================
    const allUids = new Set([userId].filter(Boolean));
    const allPhones = new Set();
    const allEmails = new Set();

    if (userPhone) {
      const clean = normalizeMobile(userPhone);
      if (clean && clean.length === 10) allPhones.add(clean);
    }
    if (userEmail) {
      allEmails.add(userEmail.trim().toLowerCase());
    }

    // A. Check users/{userId}
    try {
      const uDoc = await getDoc(doc(db, "users", userId));
      if (uDoc.exists()) {
        const d = uDoc.data();
        if (d.phone) allPhones.add(normalizeMobile(d.phone));
        if (d.mobile) allPhones.add(normalizeMobile(d.mobile));
        if (d.email) allEmails.add(d.email.trim().toLowerCase());
        if (d.residentId) allUids.add(d.residentId);
      }
    } catch (e) {
      console.warn("[Discovery] users/{userId} read failed:", e.message);
    }

    // B. Check residents/{userId}
    try {
      const rDoc = await getDoc(doc(db, "residents", userId));
      if (rDoc.exists()) {
        const d = rDoc.data();
        if (d.mobile) allPhones.add(normalizeMobile(d.mobile));
        if (d.alternateMobile) allPhones.add(normalizeMobile(d.alternateMobile));
        if (d.email) allEmails.add(d.email.trim().toLowerCase());
        if (d.residentId) allUids.add(d.residentId);
        if (d.uid) allUids.add(d.uid);
      }
    } catch (e) {
      console.warn("[Discovery] residents/{userId} read failed:", e.message);
    }

    // C. Check collectors/{userId}
    try {
      const colDoc = await getDoc(doc(db, "collectors", userId));
      if (colDoc.exists()) {
        const d = colDoc.data();
        if (d.mobile) allPhones.add(normalizeMobile(d.mobile));
        if (d.email) allEmails.add(d.email.trim().toLowerCase());
      }
    } catch {}

    // D. Check committee/{userId}
    try {
      const commDoc = await getDoc(doc(db, "committee", userId));
      if (commDoc.exists()) {
        const d = commDoc.data();
        if (d.phone) allPhones.add(normalizeMobile(d.phone));
        if (d.mobile) allPhones.add(normalizeMobile(d.mobile));
        if (d.email) allEmails.add(d.email.trim().toLowerCase());
      }
    } catch {}

    // E. Query residents & users by discovered phones
    for (const phoneItem of Array.from(allPhones)) {
      if (!phoneItem || phoneItem.length !== 10) continue;
      try {
        const rQ = query(collection(db, "residents"), where("mobile", "==", phoneItem));
        const rSnap = await getDocs(rQ);
        rSnap.forEach((d) => {
          allUids.add(d.id);
          const data = d.data();
          if (data.email) allEmails.add(data.email.trim().toLowerCase());
          if (data.alternateMobile) allPhones.add(normalizeMobile(data.alternateMobile));
        });
      } catch {}

      try {
        const uQ = query(collection(db, "users"), where("phone", "==", phoneItem));
        const uSnap = await getDocs(uQ);
        uSnap.forEach((d) => {
          allUids.add(d.id);
          const data = d.data();
          if (data.email) allEmails.add(data.email.trim().toLowerCase());
        });
      } catch {}
    }

    // Clean sets of invalid values
    const validPhones = Array.from(allPhones).filter((p) => p && p.length === 10);
    const validEmails = Array.from(allEmails).filter(Boolean);
    const validUids = Array.from(allUids).filter(Boolean);

    console.log("[Account Deletion] Target profile discovered:", {
      uids: validUids,
      phones: validPhones,
      emails: validEmails,
    });

    // =============================================
    // 1. Delete ALL registered numbers from authLookup IMMEDIATELY
    // =============================================
    for (const p of validPhones) {
      try {
        await deleteAuthLookup(p);
        results.cleaned.push(`authLookup (${p}): deleted`);
      } catch (err) {
        results.errors.push(`authLookup cleanup (${p}): ${err.message}`);
      }
    }

    // Also remove any block/suspension for these phone numbers
    for (const p of validPhones) {
      try {
        await deleteDoc(doc(db, "blockedAccounts", p));
      } catch {}
    }

    // =====================
    // 2. Handle family members (only for residents)
    // =====================
    if (userRole === "resident") {
      try {
        const familyQ = query(
          collection(db, "users"),
          where("role", "==", "family"),
          where("parentResidentId", "==", userId)
        );
        const familySnap = await getDocs(familyQ);

        if (familySnap.size > 0) {
          for (const famDoc of familySnap.docs) {
            const famData = famDoc.data();
            const famPhone = normalizeMobile(famData.phone || famData.mobile);

            if (familyAction === "delete") {
              // Delete family member's auth account and authLookup
              const famAuthResult = await deleteFirebaseAuthAccount({
                uid: famDoc.id,
                phone: famPhone,
                email: famData.email,
              });

              if (famPhone) {
                await deleteAuthLookup(famPhone);
              }

              // Archive the family member
              await archiveDeletedAccount({
                uid: famDoc.id,
                name: famData.name,
                email: famData.email,
                phone: famPhone || famData.phone,
                role: "family",
                flat: famData.flat,
                block: famData.block,
                reason: `Parent resident (${userName}) deleted`,
                adminName,
                adminUid,
                registeredAt: famData.createdAt,
                approvedAt: famData.createdAt,
                deletionType: "admin_deleted",
                cleanupResults: {
                  cleaned: ["auth_deleted", "authLookup_deleted"],
                  errors: famAuthResult.success ? [] : [famAuthResult.message],
                },
              });

              await deleteDoc(famDoc.ref);
            } else if (familyAction === "deactivate") {
              await updateDoc(famDoc.ref, {
                status: "inactive",
                deactivatedAt: serverTimestamp(),
                deactivationReason: `Primary account holder (${userName}) deleted`,
              });
            }
            // "keep" — do nothing
          }

          results.cleaned.push(
            `Family members: ${familySnap.size} ${familyAction === "delete" ? "deleted" : familyAction === "deactivate" ? "deactivated" : "kept"}`
          );
        }
      } catch (error) {
        results.errors.push(`Family cleanup: ${error.message}`);
      }
    }

    // =====================
    // 3. Anonymize payments (preserve for audit)
    // =====================
    try {
      const paymentsQ = query(
        collection(db, "payments"),
        where("residentId", "==", userId)
      );
      const paymentSnap = await getDocs(paymentsQ);

      if (paymentSnap.size > 0) {
        const batch = writeBatch(db);
        paymentSnap.docs.forEach((payDoc) => {
          batch.update(payDoc.ref, {
            residentName: "Deleted Resident",
            originalResidentId: userId,
            originalResidentName: userName || "Unknown",
            residentDeleted: true,
          });
        });
        await batch.commit();
        results.cleaned.push(`Payments: ${paymentSnap.size} anonymized`);
      }
    } catch (error) {
      results.errors.push(`Payment anonymize: ${error.message}`);
    }

    // =====================
    // 4. Anonymize bills (preserve for audit)
    // =====================
    try {
      const billsQ = query(
        collection(db, "bills"),
        where("residentId", "==", userId)
      );
      const billSnap = await getDocs(billsQ);

      if (billSnap.size > 0) {
        const batch = writeBatch(db);
        billSnap.docs.forEach((billDoc) => {
          batch.update(billDoc.ref, {
            residentName: "Deleted Resident",
            originalResidentId: userId,
            originalResidentName: userName || "Unknown",
            residentDeleted: true,
          });
        });
        await batch.commit();
        results.cleaned.push(`Bills: ${billSnap.size} anonymized`);
      }
    } catch (error) {
      results.errors.push(`Bill anonymize: ${error.message}`);
    }

    // =====================
    // 5. Archive complaints (preserve for audit)
    // =====================
    try {
      const complaintsQ = query(
        collection(db, "complaints"),
        where("residentId", "==", userId)
      );
      const complaintSnap = await getDocs(complaintsQ);

      if (complaintSnap.size > 0) {
        const batch = writeBatch(db);
        complaintSnap.docs.forEach((compDoc) => {
          batch.update(compDoc.ref, {
            residentName: "Deleted Resident",
            originalResidentId: userId,
            residentDeleted: true,
            status: compDoc.data().status === "resolved" ? "resolved" : "archived",
          });
        });
        await batch.commit();
        results.cleaned.push(`Complaints: ${complaintSnap.size} archived`);
      }
    } catch (error) {
      results.errors.push(`Complaint cleanup: ${error.message}`);
    }

    // =====================
    // 6. Delete notifications
    // =====================
    try {
      for (const u of validUids) {
        const notifQ = query(
          collection(db, "notifications"),
          where("userId", "==", u)
        );
        const notifSnap = await getDocs(notifQ);
        if (notifSnap.size > 0) {
          const batch = writeBatch(db);
          notifSnap.docs.forEach((nDoc) => batch.delete(nDoc.ref));
          await batch.commit();
          results.cleaned.push(`Notifications: ${notifSnap.size} deleted`);
        }
      }
    } catch (error) {
      results.errors.push(`Notification cleanup: ${error.message}`);
    }

    // =====================
    // 7. Delete profile update requests
    // =====================
    try {
      for (const u of validUids) {
        const profQ = query(
          collection(db, "profileUpdateRequests"),
          where("userId", "==", u)
        );
        const profSnap = await getDocs(profQ);
        if (profSnap.size > 0) {
          const batch = writeBatch(db);
          profSnap.docs.forEach((pDoc) => batch.delete(pDoc.ref));
          await batch.commit();
          results.cleaned.push(`Profile requests: ${profSnap.size} deleted`);
        }
      }
    } catch (error) {
      results.errors.push(`Profile request cleanup: ${error.message}`);
    }

    // =====================
    // 8. Delete registration requests
    // =====================
    try {
      for (const u of validUids) {
        await deleteDoc(doc(db, "registrationRequests", u));
      }
      for (const p of validPhones) {
        const regQ = query(collection(db, "registrationRequests"), where("mobile", "==", p));
        const regSnap = await getDocs(regQ);
        for (const rDoc of regSnap.docs) {
          await deleteDoc(rDoc.ref);
        }
      }
      results.cleaned.push("Registration request: deleted");
    } catch {
      // May not exist
    }

    // =====================
    // 9. Delete recovery requests
    // =====================
    try {
      for (const u of validUids) {
        const recQ = query(collection(db, "recoveryRequests"), where("residentId", "==", u));
        const recSnap = await getDocs(recQ);
        for (const rDoc of recSnap.docs) {
          await deleteDoc(rDoc.ref);
        }
      }
      for (const p of validPhones) {
        const recQ = query(collection(db, "recoveryRequests"), where("mobile", "==", p));
        const recSnap = await getDocs(recQ);
        for (const rDoc of recSnap.docs) {
          await deleteDoc(rDoc.ref);
        }
      }
      results.cleaned.push("Recovery requests: deleted");
    } catch {}

    // =====================
    // 10. Clean up event registrations
    // =====================
    try {
      const eventsUpdated = await cleanupEventRegistrations(userId);
      if (eventsUpdated > 0) {
        results.cleaned.push(`Event registrations: ${eventsUpdated} cleaned`);
      }
    } catch (error) {
      results.errors.push(`Event cleanup: ${error.message}`);
    }

    // =====================
    // 11. Release flat (residents only)
    // =====================
    if (userRole === "resident") {
      try {
        await releaseFlat(userFlat, userBlock, userId);
        results.cleaned.push(`Flat ${userFlat || "?"} Block ${userBlock || "?"}: released`);
      } catch (error) {
        results.errors.push(`Flat release: ${error.message}`);
      }
    }

    // =====================
    // 12. Clean up garbage accounts (residents only)
    // =====================
    if (userRole === "resident") {
      try {
        const gcAccQ = query(
          collection(db, "garbageAccounts"),
          where("residentId", "==", userId)
        );
        const gcAccSnap = await getDocs(gcAccQ);

        if (gcAccSnap.size > 0) {
          const batch = writeBatch(db);
          gcAccSnap.docs.forEach((gDoc) => {
            batch.delete(gDoc.ref);
          });
          await batch.commit();
          results.cleaned.push(`Garbage accounts: ${gcAccSnap.size} deleted`);
        }
      } catch (error) {
        results.errors.push(`Garbage account cleanup: ${error.message}`);
      }

      try {
        const gcBillsQ = query(
          collection(db, "garbageBills"),
          where("residentId", "==", userId)
        );
        const gcBillSnap = await getDocs(gcBillsQ);

        if (gcBillSnap.size > 0) {
          const batch = writeBatch(db);
          gcBillSnap.docs.forEach((bDoc) => {
            batch.update(bDoc.ref, {
              originalResidentId: userId,
              originalResidentName: userName || "Unknown",
              residentDeleted: true,
            });
          });
          await batch.commit();
          results.cleaned.push(`Garbage bills: ${gcBillSnap.size} anonymized`);
        }
      } catch (error) {
        results.errors.push(`Garbage bill cleanup: ${error.message}`);
      }
    }

    // =====================
    // 13. Delete residents collection documents
    // =====================
    try {
      for (const u of validUids) {
        await deleteDoc(doc(db, "residents", u));
      }
      for (const p of validPhones) {
        const resQ = query(collection(db, "residents"), where("mobile", "==", p));
        const resSnap = await getDocs(resQ);
        for (const rDoc of resSnap.docs) {
          await deleteDoc(rDoc.ref);
        }
      }
      results.cleaned.push("Resident documents: deleted");
    } catch (error) {
      results.errors.push(`Resident doc: ${error.message}`);
    }

    // =====================
    // 14. Delete committee collection documents
    // =====================
    try {
      for (const u of validUids) {
        await deleteDoc(doc(db, "committee", u));
        const committeeQ = query(
          collection(db, "committee"),
          where("userId", "==", u)
        );
        const committeeSnap = await getDocs(committeeQ);
        for (const cDoc of committeeSnap.docs) {
          await deleteDoc(cDoc.ref);
        }
      }
      results.cleaned.push("Committee document: deleted");
    } catch (error) {
      results.errors.push(`Committee cleanup: ${error.message}`);
    }

    // =====================
    // 15. Delete collectors collection documents
    // =====================
    try {
      for (const u of validUids) {
        await deleteDoc(doc(db, "collectors", u));
      }
      for (const p of validPhones) {
        const colQ = query(collection(db, "collectors"), where("mobile", "==", p));
        const colSnap = await getDocs(colQ);
        for (const cDoc of colSnap.docs) {
          await deleteDoc(cDoc.ref);
        }
      }
      results.cleaned.push("Collector document: deleted");
    } catch (error) {
      results.errors.push(`Collector cleanup: ${error.message}`);
    }

    // =====================
    // 16. Delete users collection documents (revokes login role)
    // =====================
    try {
      for (const u of validUids) {
        await deleteDoc(doc(db, "users", u));
      }
      for (const p of validPhones) {
        const uQ = query(collection(db, "users"), where("phone", "==", p));
        const uSnap = await getDocs(uQ);
        for (const uDoc of uSnap.docs) {
          await deleteDoc(uDoc.ref);
        }
      }
      results.cleaned.push("User role document: deleted");
    } catch (error) {
      results.errors.push(`User doc: ${error.message}`);
    }

    // =====================
    // 17. Delete Firebase Auth accounts permanently
    // =====================
    try {
      const authResult = await deleteFirebaseAuthAccount({
        uid: userId,
        phone: validPhones[0] || userPhone,
        email: validEmails[0] || userEmail,
        uids: validUids,
        phones: validPhones,
        emails: validEmails,
      });

      results.authDeleted = authResult.success;

      if (authResult.success) {
        results.cleaned.push("Firebase Auth accounts & login credentials: permanently deleted");
      } else {
        results.errors.push(`Auth deletion: ${authResult.message}`);
      }
    } catch (error) {
      results.errors.push(`Auth deletion: ${error.message}`);
    }

    // =====================
    // 18. Archive to deletedAccounts
    // =====================
    try {
      await archiveDeletedAccount({
        uid: userId,
        name: userName,
        email: validEmails[0] || userEmail || "",
        phone: validPhones[0] || userPhone || "",
        role: userRole,
        flat: userFlat,
        block: userBlock,
        reason: deletionReason,
        adminName,
        adminUid,
        registeredAt,
        approvedAt,
        deletionType: "admin_deleted",
        cleanupResults: {
          cleaned: results.cleaned,
          errors: results.errors,
        },
      });
      results.cleaned.push("Archived to deletedAccounts");
    } catch (error) {
      results.errors.push(`Archive: ${error.message}`);
    }

    // =====================
    // 19. Activity Log
    // =====================
    try {
      await logActivity({
        action: `Deleted ${userRole} account: ${userName}`,
        category: "auth",
        performedBy: "admin",
        performedByName: adminName || "Admin",
        targetId: userId,
        targetName: userName || "Unknown",
        details: [
          `Role: ${userRole}`,
          userFlat ? `Flat: ${userFlat}` : "",
          userBlock ? `Block: ${userBlock}` : "",
          validPhones.length > 0 ? `Phones: ${validPhones.join(", ")}` : "",
          deletionReason ? `Reason: ${deletionReason}` : "",
          `Family: ${familyAction || "n/a"}`,
          `Auth deleted: ${results.authDeleted}`,
          `Cleaned: ${results.cleaned.join(", ")}`,
          results.errors.length > 0 ? `Errors: ${results.errors.join(", ")}` : "",
        ].filter(Boolean).join(" | "),
      });
    } catch (error) {
      results.errors.push(`Activity log: ${error.message}`);
    }
  } catch (error) {
    results.success = false;
    results.errors.push(`Critical: ${error.message}`);
  }

  return results;
}

// =============================================
// Reject & Delete Registration
// Specifically for the registration rejection flow
// =============================================

export async function rejectAndDeleteRegistration({
  requestId,
  requestData,
  reason,
  adminName,
  adminUid,
}) {
  const results = {
    success: true,
    cleaned: [],
    errors: [],
    authDeleted: false,
  };

  const uid = requestData.uid || requestId;
  const rawPhones = [requestData.mobile, requestData.phone, requestData.alternateMobile].filter(Boolean);
  const cleanPhones = Array.from(new Set(rawPhones.map(normalizeMobile).filter((p) => p && p.length === 10)));
  const email = (requestData.email || "").trim().toLowerCase();

  try {
    // 1. Delete notifications for this user
    try {
      const notifQ = query(
        collection(db, "notifications"),
        where("userId", "==", uid)
      );
      const notifSnap = await getDocs(notifQ);

      if (notifSnap.size > 0) {
        const batch = writeBatch(db);
        notifSnap.docs.forEach((nDoc) => batch.delete(nDoc.ref));
        await batch.commit();
        results.cleaned.push(`Notifications: ${notifSnap.size} deleted`);
      }
    } catch (error) {
      results.errors.push(`Notification cleanup: ${error.message}`);
    }

    // 2. Delete the registration request document
    try {
      await deleteDoc(doc(db, "registrationRequests", requestId));
      results.cleaned.push("Registration request: deleted");
    } catch (error) {
      results.errors.push(`Registration doc: ${error.message}`);
    }

    // 3. Delete registered numbers from authLookup
    for (const p of cleanPhones) {
      try {
        await deleteAuthLookup(p);
        results.cleaned.push(`authLookup (${p}): deleted`);
      } catch (err) {
        results.errors.push(`authLookup cleanup (${p}): ${err.message}`);
      }
    }

    // 4. Delete users/{uid} and any recovery requests if created
    try {
      await deleteDoc(doc(db, "users", uid));
    } catch {}
    for (const p of cleanPhones) {
      try {
        await deleteDoc(doc(db, "blockedAccounts", p));
      } catch {}
    }

    // 5. Delete Firebase Auth account
    try {
      const authResult = await deleteFirebaseAuthAccount({
        uid,
        phone: cleanPhones[0],
        email,
        uids: [uid, requestId],
        phones: cleanPhones,
        emails: email ? [email] : [],
      });
      results.authDeleted = authResult.success;

      if (authResult.success) {
        results.cleaned.push("Firebase Auth account: deleted");
      } else {
        results.errors.push(`Auth deletion: ${authResult.message}`);
      }
    } catch (error) {
      results.errors.push(`Auth deletion: ${error.message}`);
    }

    // 6. Archive to deletedAccounts
    try {
      await archiveDeletedAccount({
        uid,
        name: requestData.name,
        email: requestData.email,
        phone: cleanPhones[0] || requestData.mobile || requestData.phone,
        role: "pending_registration",
        flat: requestData.flat,
        block: requestData.block,
        reason: reason || "Registration rejected",
        adminName,
        adminUid,
        registeredAt: requestData.registeredAt,
        approvedAt: null,
        deletionType: "rejected",
        cleanupResults: {
          cleaned: results.cleaned,
          errors: results.errors,
        },
      });
      results.cleaned.push("Archived to deletedAccounts");
    } catch (error) {
      results.errors.push(`Archive: ${error.message}`);
    }

    // 7. Activity Log
    try {
      await logActivity({
        action: `Rejected & deleted registration: ${requestData.name}`,
        category: "auth",
        performedBy: "admin",
        performedByName: adminName || "Admin",
        targetId: uid,
        targetName: requestData.name || "Unknown",
        details: [
          `Email: ${requestData.email || "N/A"}`,
          `Flat: ${requestData.flat || "N/A"}`,
          cleanPhones.length > 0 ? `Phones: ${cleanPhones.join(", ")}` : "",
          reason ? `Reason: ${reason}` : "",
          `Auth deleted: ${results.authDeleted}`,
        ].filter(Boolean).join(" | "),
      });
    } catch (error) {
      results.errors.push(`Activity log: ${error.message}`);
    }
  } catch (error) {
    results.success = false;
    results.errors.push(`Critical: ${error.message}`);
  }

  return results;
}


import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { normalizeMobile } from "./authService";
import { logActivity } from "./activityLogService";

const BLOCKED_COLLECTION = "blockedAccounts";

/**
 * Check if a mobile number is currently blocked.
 * Handles auto-expiration of temporary blocks.
 * Returns: { isBlocked: boolean, blockData: object | null }
 */
export async function checkIfMobileBlocked(mobile) {
  const clean = normalizeMobile(mobile || "");
  if (!clean || clean.length !== 10) {
    return { isBlocked: false, blockData: null };
  }

  try {
    const docRef = doc(db, BLOCKED_COLLECTION, clean);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { isBlocked: false, blockData: null };
    }

    const data = snap.data();
    if (data.status !== "blocked") {
      return { isBlocked: false, blockData: null };
    }

    // Check temporary block expiration
    if (data.blockType === "temporary" && data.blockedUntil) {
      const untilDate = data.blockedUntil.toDate
        ? data.blockedUntil.toDate()
        : new Date(data.blockedUntil);

      if (new Date() > untilDate) {
        // Automatically mark as unblocked because duration expired
        await updateDoc(docRef, {
          status: "expired",
          unblockedAt: serverTimestamp(),
          unblockReason: "Auto-expired temporary suspension",
        });
        return { isBlocked: false, blockData: null };
      }
    }

    return { isBlocked: true, blockData: data };
  } catch (err) {
    console.warn("[BlockService] Error checking mobile block status:", err.message);
    return { isBlocked: false, blockData: null };
  }
}

/**
 * Block or temporarily suspend an account / mobile number
 */
export async function blockAccount({
  mobile,
  userId = "",
  name = "",
  role = "resident",
  blockType = "permanent", // "permanent" | "temporary"
  blockedUntil = null, // Date object, ISO string, or Timestamp
  reason = "",
  adminUser = null,
}) {
  const clean = normalizeMobile(mobile || "");
  if (!clean || clean.length !== 10) {
    throw new Error("Please enter a valid 10-digit mobile number to block.");
  }

  const adminUid = adminUser?.uid || "admin";
  const adminName = adminUser?.name || adminUser?.email || "Admin";

  // Format blockedUntil timestamp if temporary
  let untilTimestamp = null;
  if (blockType === "temporary" && blockedUntil) {
    untilTimestamp =
      blockedUntil instanceof Date
        ? Timestamp.fromDate(blockedUntil)
        : typeof blockedUntil === "string"
        ? Timestamp.fromDate(new Date(blockedUntil))
        : blockedUntil;
  }

  const blockRecord = {
    mobile: clean,
    userId: userId || "",
    name: name || "User",
    role: (role || "resident").toLowerCase(),
    blockType, // "permanent" | "temporary"
    blockedUntil: untilTimestamp,
    reason: reason || "Administrative action",
    blockedBy: adminUid,
    blockedByName: adminName,
    status: "blocked",
    blockedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // 1. Write to blockedAccounts/{mobile}
  await setDoc(doc(db, BLOCKED_COLLECTION, clean), blockRecord);

  // 2. Synchronize role documents
  if (userId) {
    // Update users/{uid}
    try {
      await updateDoc(doc(db, "users", userId), {
        status: "blocked",
        isBlocked: true,
        blockType,
        blockedUntil: untilTimestamp,
        blockReason: reason,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[BlockService] users doc update skipped:", e.message);
    }

    // Update residents/{userId} if resident
    if (role === "resident") {
      try {
        await updateDoc(doc(db, "residents", userId), {
          status: "Blocked",
          isBlocked: true,
          blockReason: reason,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("[BlockService] residents doc update skipped:", e.message);
      }
    }

    // Update collectors/{userId} if collector
    if (role === "collector") {
      try {
        await updateDoc(doc(db, "collectors", userId), {
          status: "Blocked",
          isBlocked: true,
          blockReason: reason,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("[BlockService] collectors doc update skipped:", e.message);
      }
    }

    // Update committee/{userId} if committee
    if (role === "committee") {
      try {
        await updateDoc(doc(db, "committee", userId), {
          status: "Blocked",
          isBlocked: true,
          blockReason: reason,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("[BlockService] committee doc update skipped:", e.message);
      }
    }
  }

  // 3. Log to Activity Audit
  await logActivity({
    action: `Blocked Access: ${name || clean} (${blockType.toUpperCase()})`,
    category: "auth",
    performedBy: adminUid,
    performedByName: adminName,
    performedByRole: "admin",
    portal: "Admin Portal",
    targetId: userId || clean,
    targetName: `${name || "Mobile"} (${clean})`,
    details: `Type: ${blockType} • Reason: ${reason || "None specified"}${
      untilTimestamp ? ` • Until: ${new Date(untilTimestamp.toDate()).toLocaleString("en-IN")}` : ""
    }`,
  });

  return blockRecord;
}

/**
 * Unblock an account / mobile number
 */
export async function unblockAccount(mobile, adminUser = null, unblockReason = "") {
  const clean = normalizeMobile(mobile || "");
  if (!clean) throw new Error("Invalid mobile number");

  const adminUid = adminUser?.uid || "admin";
  const adminName = adminUser?.name || adminUser?.email || "Admin";

  const docRef = doc(db, BLOCKED_COLLECTION, clean);
  const snap = await getDoc(docRef);
  const currentData = snap.exists() ? snap.data() : {};

  // 1. Mark as unblocked in blockedAccounts
  await updateDoc(docRef, {
    status: "unblocked",
    unblockedAt: serverTimestamp(),
    unblockedBy: adminUid,
    unblockedByName: adminName,
    unblockReason: unblockReason || "Admin lifted block",
    updatedAt: serverTimestamp(),
  });

  const userId = currentData.userId;
  const role = currentData.role || "resident";
  const name = currentData.name || "User";

  // 2. Restore role documents
  if (userId) {
    try {
      await updateDoc(doc(db, "users", userId), {
        status: "active",
        isBlocked: false,
        blockReason: null,
        blockType: null,
        blockedUntil: null,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[BlockService] users unblock skipped:", e.message);
    }

    if (role === "resident") {
      try {
        await updateDoc(doc(db, "residents", userId), {
          status: "Active",
          isBlocked: false,
          blockReason: null,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("[BlockService] residents unblock skipped:", e.message);
      }
    }

    if (role === "collector") {
      try {
        await updateDoc(doc(db, "collectors", userId), {
          status: "Active",
          isBlocked: false,
          blockReason: null,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("[BlockService] collectors unblock skipped:", e.message);
      }
    }

    if (role === "committee") {
      try {
        await updateDoc(doc(db, "committee", userId), {
          status: "Active",
          isBlocked: false,
          blockReason: null,
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("[BlockService] committee unblock skipped:", e.message);
      }
    }
  }

  // 3. Log to Activity Audit
  await logActivity({
    action: `Unblocked Access: ${name} (${clean})`,
    category: "auth",
    performedBy: adminUid,
    performedByName: adminName,
    performedByRole: "admin",
    portal: "Admin Portal",
    targetId: userId || clean,
    targetName: `${name} (${clean})`,
    details: `Restored full login access. Reason: ${unblockReason || "Admin action"}`,
  });

  return true;
}

/**
 * Real-time subscription to all blocked accounts
 */
export function subscribeBlockedAccounts(callback) {
  const colRef = collection(db, BLOCKED_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const records = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(records);
    },
    (error) => {
      console.warn("[BlockService] Listener error:", error.message);
    }
  );
}

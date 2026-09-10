import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const deletedRef = collection(db, "deletedAccounts");

// =============================
// Subscribe to deleted accounts (admin only)
// =============================

export function subscribeDeletedAccounts(callback) {
  const q = query(deletedRef, orderBy("deletedAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] deletedAccounts listener error:", error.message);
  });
}

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const noticeRef = collection(db, "notices");

// =============================
// Get Single Notice by ID (for public share pages)
// =============================

export async function getNoticeById(id) {
  const snap = await getDoc(doc(db, "notices", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// =============================
// Realtime Notices (newest first)
// =============================

export function subscribeNotices(callback) {
  const q = query(noticeRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] notices listener error:", error.message);
  });
}

// =============================
// Add Notice
// =============================

export async function addNotice(notice) {
  return await addDoc(noticeRef, {
    ...notice,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Update Notice
// =============================

export async function updateNotice(id, data) {
  return await updateDoc(doc(db, "notices", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Delete Notice
// =============================

export async function deleteNotice(id) {
  return await deleteDoc(doc(db, "notices", id));
}

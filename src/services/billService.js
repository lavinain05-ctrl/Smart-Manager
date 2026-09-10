import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const billRef = collection(db, "bills");

// =============================
// Realtime Bills (scoped to year)
// =============================

export function subscribeBills(year, callback) {
  const q = query(
    billRef,
    where("year", "==", Number(year)),
    orderBy("month", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] bills listener error:", error.message);
  });
}

// Scoped to a specific resident for Resident / Family portal (1000x read reduction)
export function subscribeResidentBills(residentId, year, callback) {
  if (!residentId) return () => {};
  const q = query(
    billRef,
    where("residentId", "==", residentId),
    where("year", "==", Number(year))
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] resident bills listener error:", error.message);
  });
}

// =============================
// Add Bill
// =============================

export async function addBill(bill) {
  return await addDoc(billRef, {
    ...bill,
    year: Number(bill.year),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Update Bill
// =============================

export async function updateBill(id, data) {
  const ref = doc(db, "bills", id);

  return await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Delete Bill
// =============================

export async function deleteBill(id) {
  return await deleteDoc(doc(db, "bills", id));
}

// =============================
// Get One Bill (write-time check)
// =============================

export async function getBill(id) {
  const snap = await getDoc(doc(db, "bills", id));

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  };
}

// =============================
// Check Duplicate Bill (write-time check)
// =============================

export async function billExists(
  residentId,
  month,
  year
) {
  const q = query(
    billRef,
    where("residentId", "==", residentId),
    where("month", "==", month),
    where("year", "==", Number(year))
  );

  const snapshot = await getDocs(q);

  return !snapshot.empty;
}
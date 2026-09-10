import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const paymentRef = collection(db, "payments");

// =============================
// Add Payment
// =============================

export async function addPaymentToFirestore(payment) {
  return await addDoc(paymentRef, payment);
}

// =============================
// Real-time Payments (scoped to year)
// =============================

export function subscribePayments(year, callback) {
  const y = Number(year) || new Date().getFullYear();
  const q = query(
    paymentRef,
    where("year", "in", [y - 1, y, y + 1])
  );

  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    callback(payments);
  }, (error) => {
    console.error("[Firestore] payments listener error:", error.message);
  });
}

// Scoped to a specific resident for Resident / Family portal (1000x read reduction)
export function subscribeResidentPayments(residentId, callback) {
  if (!residentId) return () => {};
  const q = query(
    paymentRef,
    where("residentId", "==", residentId)
  );

  return onSnapshot(q, (snapshot) => {
    const payments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    callback(payments);
  }, (error) => {
    console.error("[Firestore] resident payments listener error:", error.message);
  });
}

// =============================
// Check if resident has already paid for this month
// (One-time query — needed at write time only)
// =============================

export async function checkPaymentExists(
  residentId,
  month,
  year
) {
  const q = query(
    paymentRef,
    where("residentId", "==", residentId),
    where("month", "==", month),
    where("year", "==", Number(year))
  );

  const snapshot = await getDocs(q);

  return !snapshot.empty;
}

// =============================
// Delete Payment (Admin only)
// =============================

export async function deletePaymentFromFirestore(paymentId) {
  return await deleteDoc(doc(db, "payments", paymentId));
}

// =============================
// Find matching bill by residentId + month + year
// (One-time query — needed at write time only)
// =============================

export async function findMatchingBill(residentId, month, year) {
  const billRef = collection(db, "bills");
  const q = query(
    billRef,
    where("residentId", "==", residentId),
    where("month", "==", month),
    where("year", "==", Number(year))
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  };
}

// =============================
// Write audit record
// =============================

export async function addPaymentAudit(audit) {
  return await addDoc(collection(db, "paymentAudit"), {
    ...audit,
    deletedAt: serverTimestamp(),
  });
}
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

const auditRef = collection(db, "specialCollectionAudit");

/**
 * Log a financial or administrative action in Special Collections
 *
 * @param {Object} entry
 * @param {string} entry.action - Action code e.g. SPECIAL_COLLECTION_CREATED, PAYMENT_CONFIRMED
 * @param {string} entry.collectionId - Target collection ID
 * @param {string} [entry.paymentId] - Target payment ID if applicable
 * @param {string} entry.actorUid - User UID who performed the action
 * @param {string} entry.actorRole - Role of the actor (admin, resident, public)
 * @param {string} [entry.actorName] - Display name of actor
 * @param {string} [entry.remarks] - Any administrative or system remarks
 * @param {Object} [entry.metadata] - Additional contextual data (amount, utr, etc.)
 */
export async function logSpecialCollectionAction(entry) {
  try {
    await addDoc(auditRef, {
      ...entry,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[SpecialCollectionAudit] Failed to record audit log:", err.message);
  }
}

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const contactsRef = collection(db, "emergencyContacts");

// =============================
// Default Categories
// =============================

export const CONTACT_CATEGORIES = [
  "Police",
  "Fire Brigade",
  "Ambulance",
  "Hospital",
  "Electricity",
  "Water Supply",
  "Gas Emergency",
  "Society Office",
  "Security Guard",
  "Plumber",
  "Electrician",
  "Other",
];

// =============================
// Subscribe
// =============================

export function subscribeEmergencyContacts(callback) {
  const q = query(contactsRef, orderBy("category", "asc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] emergencyContacts listener error:", error.message);
  });
}

// =============================
// CRUD
// =============================

export async function addEmergencyContact(data) {
  return await addDoc(contactsRef, {
    name: data.name || "",
    phone: data.phone || "",
    altPhone: data.altPhone || "",
    category: data.category || "Other",
    address: data.address || "",
    notes: data.notes || "",
    is24x7: data.is24x7 || false,
    createdAt: serverTimestamp(),
  });
}

export async function updateEmergencyContact(id, data) {
  const updates = { updatedAt: serverTimestamp() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.altPhone !== undefined) updates.altPhone = data.altPhone;
  if (data.category !== undefined) updates.category = data.category;
  if (data.address !== undefined) updates.address = data.address;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.is24x7 !== undefined) updates.is24x7 = data.is24x7;

  return await updateDoc(doc(db, "emergencyContacts", id), updates);
}

export async function deleteEmergencyContact(id) {
  return await deleteDoc(doc(db, "emergencyContacts", id));
}

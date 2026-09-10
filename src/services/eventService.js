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

const eventRef = collection(db, "events");

// =============================
// Get Single Event by ID (for public share pages)
// =============================

export async function getEventById(id) {
  const snap = await getDoc(doc(db, "events", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// =============================
// Realtime Events (newest first)
// =============================

export function subscribeEvents(callback) {
  const q = query(eventRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] events listener error:", error.message);
  });
}

// =============================
// Add Event
// =============================

export async function addEvent(event) {
  return await addDoc(eventRef, {
    ...event,
    registrations: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Update Event
// =============================

export async function updateEvent(id, data) {
  return await updateDoc(doc(db, "events", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Register Resident for Event
// =============================

export async function registerForEvent(id, existingRegistrations, registration) {
  const updated = [
    ...existingRegistrations,
    {
      ...registration,
      registeredAt: new Date().toISOString(),
    },
  ];

  return await updateDoc(doc(db, "events", id), {
    registrations: updated,
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Unregister from Event
// =============================

export async function unregisterFromEvent(id, existingRegistrations, residentId) {
  const updated = existingRegistrations.filter(
    (r) => r.residentId !== residentId
  );

  return await updateDoc(doc(db, "events", id), {
    registrations: updated,
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Delete Event
// =============================

export async function deleteEvent(id) {
  return await deleteDoc(doc(db, "events", id));
}

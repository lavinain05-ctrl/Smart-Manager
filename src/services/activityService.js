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

const activitiesRef = collection(db, "activities");

const CATEGORIES = [
  "Cleaning Drive",
  "Tree Plantation",
  "Meeting",
  "Festival Celebration",
  "Social Activity",
  "Awareness Campaign",
  "Blood Donation",
  "Other",
];

// =============================
// Subscribe
// =============================

export function subscribeActivities(callback) {
  const q = query(activitiesRef, orderBy("date", "desc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] activities listener error:", error.message);
  });
}

// =============================
// CRUD
// =============================

export async function addActivity(data) {
  return await addDoc(activitiesRef, {
    title: data.title || "",
    description: data.description || "",
    category: data.category || "Other",
    date: data.date || "",
    time: data.time || "",
    location: data.location || "",
    organizer: data.organizer || "",
    status: data.status || "upcoming",
    highlights: data.highlights || "",
    createdAt: serverTimestamp(),
  });
}

export async function updateActivity(id, data) {
  const updates = { updatedAt: serverTimestamp() };

  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.category !== undefined) updates.category = data.category;
  if (data.date !== undefined) updates.date = data.date;
  if (data.time !== undefined) updates.time = data.time;
  if (data.location !== undefined) updates.location = data.location;
  if (data.organizer !== undefined) updates.organizer = data.organizer;
  if (data.status !== undefined) updates.status = data.status;
  if (data.highlights !== undefined) updates.highlights = data.highlights;

  return await updateDoc(doc(db, "activities", id), updates);
}

export async function deleteActivity(id) {
  return await deleteDoc(doc(db, "activities", id));
}

export { CATEGORIES as ACTIVITY_CATEGORIES };

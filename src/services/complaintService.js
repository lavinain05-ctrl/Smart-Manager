import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const complaintRef = collection(db, "complaints");

// =============================
// Realtime Complaints (newest first)
// =============================

export function subscribeComplaints(callback) {
  const q = query(complaintRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] complaints listener error:", error.message);
  });
}

// =============================
// Add Complaint
// =============================

export async function addComplaint(complaint) {
  return await addDoc(complaintRef, {
    ...complaint,
    status: "Pending",
    timeline: [
      {
        status: "Pending",
        note: "Complaint submitted",
        date: new Date().toISOString(),
      },
    ],
    comments: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Update Complaint
// =============================

export async function updateComplaint(id, data) {
  return await updateDoc(doc(db, "complaints", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Add Comment to Complaint
// =============================

export async function addCommentToComplaint(id, existingComments, comment) {
  const updatedComments = [
    ...existingComments,
    {
      ...comment,
      date: new Date().toISOString(),
    },
  ];

  return await updateDoc(doc(db, "complaints", id), {
    comments: updatedComments,
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Update Status with Timeline
// =============================

export async function updateComplaintStatus(id, existingTimeline, status, note) {
  const updatedTimeline = [
    ...existingTimeline,
    {
      status,
      note: note || `Status changed to ${status}`,
      date: new Date().toISOString(),
    },
  ];

  const updateData = {
    status,
    timeline: updatedTimeline,
    updatedAt: serverTimestamp(),
  };

  if (status === "Resolved") {
    updateData.resolvedAt = serverTimestamp();
  }

  return await updateDoc(doc(db, "complaints", id), updateData);
}

// =============================
// Delete Complaint
// =============================

export async function deleteComplaint(id) {
  return await deleteDoc(doc(db, "complaints", id));
}

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
import { notifyAdmin, createNotification } from "./notificationService";

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
  const docRef = await addDoc(complaintRef, {
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

  try {
    const isHelpdesk = complaint.category === "Helpdesk Inquiry";
    const loc = complaint.flat || complaint.flatNumber ? ` (Flat ${complaint.flat || complaint.flatNumber})` : "";
    await notifyAdmin({
      title: isHelpdesk ? "New Helpdesk Message 💬" : `New Complaint: ${complaint.category || "General"} ⚠️`,
      message: `${complaint.residentName || "Resident"}${loc}: ${complaint.description ? complaint.description.slice(0, 90) : "New issue submitted"}`,
      type: isHelpdesk ? "inquiry" : "complaint",
      link: "/admin/complaints",
    });
  } catch (notifErr) {
    console.warn("[Complaint] Admin notification warning:", notifErr.message);
  }

  return docRef;
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
    ...(existingComments || []),
    {
      ...comment,
      date: new Date().toISOString(),
    },
  ];

  await updateDoc(doc(db, "complaints", id), {
    comments: updatedComments,
    updatedAt: serverTimestamp(),
  });

  // If comment is from resident, notify admin
  if (comment.byRole === "resident") {
    try {
      await notifyAdmin({
        title: "New Message on Complaint 💬",
        message: `${comment.by || "Resident"}: ${comment.text ? comment.text.slice(0, 90) : "Replied on ticket"}`,
        type: "message",
        link: "/admin/complaints",
      });
    } catch (notifErr) {
      console.warn("[Complaint] Admin comment notification warning:", notifErr.message);
    }
  }
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

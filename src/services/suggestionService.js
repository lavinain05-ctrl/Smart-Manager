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

const suggestionsRef = collection(db, "suggestions");

export const SUGGESTION_CATEGORIES = [
  "Society Improvement",
  "Cleanliness & Greenery",
  "Security & Safety",
  "Amenities & Club",
  "Maintenance & Repairs",
  "Events & Celebrations",
  "Traffic & Parking",
  "Other",
];

export const SUGGESTION_STATUSES = [
  "Under Review",
  "Acknowledged",
  "Approved",
  "Implemented",
  "Closed",
];

export const SUGGESTION_STATUS_CONFIG = {
  "Under Review": {
    label: "Under Review",
    color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  },
  Acknowledged: {
    label: "Acknowledged",
    color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  },
  Approved: {
    label: "Approved",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  },
  Implemented: {
    label: "Implemented",
    color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
  },
  Closed: {
    label: "Closed",
    color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  },
};

// =============================
// Realtime Suggestions Listener
// =============================
export function subscribeSuggestions(callback) {
  const q = query(suggestionsRef, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
      );
    },
    (error) => {
      console.error("[Firestore] suggestions listener error:", error.message);
    }
  );
}

// =============================
// Submit a New Suggestion
// =============================
export async function addSuggestion(data) {
  const payload = {
    title: (data.title || "").trim(),
    category: data.category || "Society Improvement",
    description: (data.description || "").trim(),
    isAnonymous: Boolean(data.isAnonymous),
    residentId: data.isAnonymous ? "" : (data.residentId || ""),
    residentName: data.isAnonymous ? "Anonymous Resident" : (data.residentName || "Resident"),
    flatNumber: data.isAnonymous ? "" : (data.flatNumber || ""),
    mobile: data.isAnonymous ? "" : (data.mobile || ""),
    status: "Under Review",
    adminRemarks: "",
    adminRepliedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return await addDoc(suggestionsRef, payload);
}

// =============================
// Update Suggestion Status & Remarks
// =============================
export async function updateSuggestionStatus(id, status, adminRemarks = "") {
  const updateData = {
    status,
    adminRemarks: adminRemarks.trim(),
    updatedAt: serverTimestamp(),
  };

  if (adminRemarks.trim()) {
    updateData.adminRepliedAt = serverTimestamp();
  }

  return await updateDoc(doc(db, "suggestions", id), updateData);
}

// =============================
// Delete Suggestion
// =============================
export async function deleteSuggestion(id) {
  return await deleteDoc(doc(db, "suggestions", id));
}

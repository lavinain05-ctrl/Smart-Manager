import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const logsRef = collection(db, "activityLogs");

// =============================
// Log an action
// =============================

export async function logActivity({
  action,
  category,
  performedBy,
  performedByName,
  performedByRole,
  portal,
  details,
  targetId,
  targetName,
  extra = {},
}) {
  try {
    return await addDoc(logsRef, {
      action: action || "",
      category: category || "general",
      performedBy: performedBy || "",
      performedByName: performedByName || "System",
      performedByRole: performedByRole || "admin",
      portal: portal || "Admin Portal",
      details: details || "",
      targetId: targetId || "",
      targetName: targetName || "",
      createdAt: serverTimestamp(),
      clientTimestamp: new Date().toISOString(),
      ...extra,
    });
  } catch (err) {
    console.warn("[ActivityLog] Failed to record log:", err.message);
    return null;
  }
}

/**
 * Convenient helper to log work done by the logged-in user
 */
export async function logUserWork(user, action, category = "general", targetName = "", details = "") {
  if (!user) return null;
  const role = user.role || "user";
  let portal = "Admin Portal";
  if (role === "collector") portal = "Collector Portal";
  else if (role === "resident") portal = "Resident Portal";
  else if (role === "committee") portal = "Committee Portal";

  return await logActivity({
    action,
    category,
    performedBy: user.uid || "",
    performedByName: user.name || user.email || "User",
    performedByRole: role,
    portal,
    targetName,
    details,
  });
}

// =============================
// Subscribe (Admin — latest N)
// =============================

export function subscribeActivityLogs(callback, max = 250) {
  const q = query(logsRef, orderBy("createdAt", "desc"), limit(max));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] activityLogs listener error:", error.message);
  });
}

// =============================
// Category definitions
// =============================

export const LOG_CATEGORIES = {
  resident: { label: "Resident", color: "bg-blue-100 text-blue-700" },
  payment: { label: "Payment", color: "bg-green-100 text-green-700" },
  bill: { label: "Bill", color: "bg-yellow-100 text-yellow-700" },
  profile: { label: "Profile", color: "bg-purple-100 text-purple-700" },
  complaint: { label: "Complaint", color: "bg-red-100 text-red-700" },
  notice: { label: "Notice", color: "bg-indigo-100 text-indigo-700" },
  event: { label: "Event", color: "bg-sky-100 text-sky-700" },
  activity: { label: "Activity", color: "bg-emerald-100 text-emerald-700" },
  committee: { label: "Committee", color: "bg-orange-100 text-orange-700" },
  block: { label: "Block/Flat", color: "bg-gray-100 text-gray-700" },
  gc: { label: "Garbage Collection", color: "bg-lime-100 text-lime-700" },
  auth: { label: "Auth", color: "bg-rose-100 text-rose-700" },
  general: { label: "General", color: "bg-gray-100 text-gray-700" },
};

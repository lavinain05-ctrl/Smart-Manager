import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const requestsRef = collection(db, "profileUpdateRequests");

// All fields that can be requested for update
export const UPDATABLE_FIELDS = [
  { key: "Name", residentField: "owner", userField: "name" },
  { key: "Father/Husband Name", residentField: "fatherHusbandName", userField: null },
  { key: "Mobile Number", residentField: "mobile", userField: "phone" },
  { key: "Alternate Mobile", residentField: "alternateMobile", userField: null },
  { key: "Email", residentField: "email", userField: "email" },
  { key: "Flat Number", residentField: "flat", userField: "flat" },
  { key: "Block", residentField: "block", userField: "block" },
  { key: "Date of Birth", residentField: "dob", userField: null },
  { key: "Gender", residentField: "gender", userField: null },
  { key: "Occupation", residentField: "occupation", userField: null },
  { key: "Emergency Contact", residentField: "emergencyContact", userField: null },
];

/* ===============================
   Submit Profile Update Request
================================ */

export async function submitProfileUpdateRequest({
  userId,
  residentId,
  userName,
  userEmail,
  flat,
  block,
  changes,
}) {
  return await addDoc(requestsRef, {
    userId,
    residentId: residentId || "",
    userName,
    userEmail,
    flat: flat || "",
    block: block || "",
    changes,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

/* ===============================
   Subscribe All Requests (Admin)
================================ */

export function subscribeAllProfileRequests(callback) {
  const q = query(
    requestsRef,
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] allProfileRequests listener error:", error.message);
  });
}

/* ===============================
   Subscribe Pending (Admin badge)
================================ */

export function subscribePendingProfileRequests(callback) {
  const q = query(
    requestsRef,
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] pendingProfileRequests listener error:", error.message);
  });
}

/* ===============================
   Subscribe My Requests (Resident)
================================ */

export function subscribeMyProfileRequests(userId, callback) {
  const q = query(
    requestsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] myProfileRequests listener error:", error.message);
  });
}

/* ===============================
   Approve — applies changes to
   residents/{uid} and users/{uid}
================================ */

export async function approveProfileRequest(requestId, request) {
  const field = UPDATABLE_FIELDS.find((f) => f.key === request.changes?.field);
  const newValue = request.changes?.newValue;

  // Update residents document (try residentId first, then userId)
  const residentDocId = request.residentId || request.userId;
  if (field?.residentField && residentDocId) {
    try {
      await updateDoc(doc(db, "residents", residentDocId), {
        [field.residentField]: newValue,
      });
    } catch (err) {
      console.warn("[ProfileRequest] Could not update residents doc by id:", residentDocId, err.message);
    }
  }

  // Update users/{uid}
  if (request.userId) {
    try {
      const userUpdates = {};
      if (field?.userField) {
        userUpdates[field.userField] = newValue;
      }
      if (field?.key === "Email") {
        userUpdates.personalEmail = newValue;
        userUpdates.email = newValue;
      }
      if (Object.keys(userUpdates).length > 0) {
        await updateDoc(doc(db, "users", request.userId), userUpdates);
      }
    } catch (err) {
      console.warn("[ProfileRequest] Could not update users doc:", request.userId, err.message);
    }
  }

  // Mark request as approved
  await updateDoc(doc(db, "profileUpdateRequests", requestId), {
    status: "approved",
    processedAt: serverTimestamp(),
  });
}

/* ===============================
   Reject
================================ */

export async function rejectProfileRequest(requestId, reason) {
  await updateDoc(doc(db, "profileUpdateRequests", requestId), {
    status: "rejected",
    rejectionReason: reason || "",
    processedAt: serverTimestamp(),
  });
}

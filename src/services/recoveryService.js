import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const recoveryRef = collection(db, "recoveryRequests");

// =============================
// Request Types
// =============================

export const RECOVERY_REQUEST_TYPES = [
  { value: "forgot_password", label: "Forgot Password" },
  { value: "forgot_mobile", label: "Forgot Mobile Number" },
  { value: "forgot_both", label: "Forgot Both (Mobile & Password)" },
  { value: "login_problem", label: "Login Problem" },
  { value: "registration_problem", label: "Registration Problem" },
  { value: "payment_problem", label: "Payment Problem" },
  { value: "garbage_problem", label: "Garbage Collection Problem" },
  { value: "profile_problem", label: "Profile Problem" },
  { value: "other", label: "Other" },
];

// =============================
// Status Labels
// =============================

export const RECOVERY_STATUSES = ["pending", "verified", "rejected", "completed"];

export const STATUS_LABELS = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
  completed: "Completed",
};

// =============================
// Verify Resident Identity
// =============================
// Matches the submitted info using public authLookup or residents collection.

async function findMatchingResident({ mobile, name, blockId, block, floor, flatNumber }) {
  // 1. Check authLookup by mobile (publicly accessible before login)
  if (mobile && mobile.length === 10) {
    try {
      const lookupSnap = await getDoc(doc(db, "authLookup", mobile));
      if (lookupSnap.exists()) {
        const data = lookupSnap.data();
        return {
          residentId: data.uid || "",
          residentName: name || "",
          mobile,
          blockId: blockId || "",
          block: block || "",
          floor: floor || "",
          flatNumber: flatNumber || "",
        };
      }
    } catch (err) {
      console.warn("[Recovery] authLookup check error:", err.message);
    }
  }

  // 2. Try Firestore residents check (works if user is signed in or rules permit)
  try {
    const constraints = [];
    if (mobile) constraints.push(where("mobile", "==", mobile));
    if (blockId) constraints.push(where("blockId", "==", blockId));
    if (flatNumber) constraints.push(where("flatNumber", "==", flatNumber.toUpperCase()));

    if (constraints.length >= 1) {
      const q = query(collection(db, "residents"), ...constraints);
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        return {
          residentId: docSnap.id,
          residentName: data.owner || name || "",
          mobile: data.mobile || mobile || "",
          block: data.block || block || "",
          blockId: data.blockId || blockId || "",
          floor: data.floor || floor || "",
          flatNumber: data.flatNumber || data.flat || flatNumber || "",
        };
      }
    }
  } catch (error) {
    console.warn("[Recovery] Resident lookup failed (unauthenticated):", error.message);
  }

  // 3. If mobile is not provided (Forgot Mobile / Forgot Both / Contact Admin),
  // allow submission to Admin queue as long as flat/block or name is provided.
  if (!mobile && (flatNumber || name)) {
    return {
      residentId: "",
      residentName: name || "",
      mobile: mobile || "",
      blockId: blockId || "",
      block: block || "",
      floor: floor || "",
      flatNumber: flatNumber || "",
    };
  }

  return null;
}

// =============================
// Submit Recovery Request
// =============================

export async function submitRecoveryRequest({
  mobile,
  name,
  blockId,
  block,
  floor,
  flatNumber,
  requestType,
  description,
}) {
  // Normalize inputs
  const normalizedMobile = (mobile || "").replace(/\D/g, "").slice(0, 10);
  const normalizedFlat = (flatNumber || "").trim().toUpperCase();
  const normalizedName = (name || "").trim();
  const normalizedFloor = (floor || "").trim();
  const normalizedBlock = (block || "").trim();

  // Verify resident identity
  const match = await findMatchingResident({
    mobile: normalizedMobile || undefined,
    name: normalizedName,
    blockId,
    block: normalizedBlock,
    floor: normalizedFloor,
    flatNumber: normalizedFlat,
  });

  if (!match) {
    throw new Error(
      "Unable to verify your information. Please check your details or contact Admin."
    );
  }

  // Check for existing pending request for same resident
  try {
    const existingQuery = query(
      recoveryRef,
      where("residentId", "==", match.residentId),
      where("status", "==", "pending")
    );
    const existingSnap = await getDocs(existingQuery);
    if (!existingSnap.empty) {
      throw new Error(
        "You already have a pending recovery request. Please wait for Admin verification."
      );
    }
  } catch (error) {
    if (error.message.includes("pending recovery request")) throw error;
    // Permission error on read is expected for unauthenticated — proceed
  }

  // Create recovery request
  const docRef = await addDoc(recoveryRef, {
    residentId: match.residentId,
    residentName: match.residentName,
    mobile: match.mobile,
    blockId: match.blockId,
    block: normalizedBlock || match.block,
    floor: match.floor,
    flatNumber: match.flatNumber,
    requestType: requestType || "forgot_password",
    description: (description || "").trim(),
    status: "pending",
    adminNotes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

// =============================
// Admin: Subscribe All Recovery Requests
// =============================

export function subscribeRecoveryRequests(callback) {
  const q = query(recoveryRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] recoveryRequests listener error:", error.message);
  });
}

// =============================
// Resident: Subscribe Own Recovery Requests
// =============================

export function subscribeMyRecoveryRequests(residentId, callback) {
  const q = query(
    recoveryRef,
    where("residentId", "==", residentId),
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
    console.error("[Firestore] myRecoveryRequests listener error:", error.message);
  });
}

// =============================
// Admin: Update Recovery Request
// =============================

export async function updateRecoveryRequest(id, data) {
  return await updateDoc(doc(db, "recoveryRequests", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

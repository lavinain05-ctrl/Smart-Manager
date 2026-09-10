import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { logSpecialCollectionAction } from "./specialCollectionAuditService";
import { createNotification } from "./notificationService";

const collectionsRef = collection(db, "specialCollections");
const paymentsRef = collection(db, "specialCollectionPayments");
const utrRef = collection(db, "utrLookup");
const receiptsRef = collection(db, "receipts");

// ====================================================
// Campaign Types & Constants
// ====================================================

export const COLLECTION_TYPES = [
  { value: "Festival", label: "Festival Celebration" },
  { value: "Event", label: "Community Event / Cultural Program" },
  { value: "Emergency", label: "Emergency Contribution" },
  { value: "Community Fund", label: "Special Society Fund" },
  { value: "Facility", label: "Facility Maintenance / Common Work" },
  { value: "Charity", label: "Charity / Community Contribution" },
  { value: "Other", label: "Other RWA Purpose" },
];

export const CONTRIBUTION_TYPES = [
  { value: "fixed", label: "Fixed Amount (e.g. ₹500)" },
  { value: "custom", label: "Custom / Variable Amount (Contributor chooses)" },
  { value: "optional", label: "Optional Contribution (Min/Max limits)" },
];

export const TARGET_AUDIENCES = [
  { value: "all_residents", label: "All Residents" },
  { value: "committee_only", label: "Committee Members Only" },
  { value: "specific_residents", label: "Specific Residents" },
  { value: "public_open", label: "Public / External Contributors" },
];

export const REJECTION_REASONS = [
  "Wrong UTR",
  "Transaction Not Found in Bank / UPI",
  "Incorrect Amount",
  "Duplicate Transaction",
  "Payment Failed in Banking Network",
  "Other",
];

// ====================================================
// 1. Campaign Management (CRUD)
// ====================================================

/**
 * Create a new Special Collection Campaign
 */
export async function createSpecialCollection(data, adminUser) {
  const payload = {
    name: data.name.trim(),
    purpose: data.purpose.trim(),
    description: (data.description || "").trim(),
    collectionType: data.collectionType || "Festival",
    amountType: data.amountType || "fixed",
    fixedAmount: Number(data.fixedAmount || 0),
    minimumAmount: Number(data.minimumAmount || 0),
    maximumAmount: Number(data.maximumAmount || 0),
    targetAmount: Number(data.targetAmount || 0),
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    targetAudience: data.targetAudience || "all_residents",
    publicEnabled: data.publicEnabled === true || data.targetAudience === "public_open",

    // Payment Accounts Configured by Admin
    upiId: (data.upiId || "").trim(),
    upiName: (data.upiName || "D Block RWA Indraprastha").trim(),
    bankName: (data.bankName || "").trim(),
    accountName: (data.accountName || "").trim(),
    accountNumber: (data.accountNumber || "").trim(),
    ifsc: (data.ifsc || "").trim().toUpperCase(),
    branch: (data.branch || "").trim(),

    status: data.status || "active", // active, closed, archived, draft
    createdBy: adminUser?.uid || "",
    createdByName: adminUser?.name || "Admin",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collectionsRef, payload);

  await logSpecialCollectionAction({
    action: "SPECIAL_COLLECTION_CREATED",
    collectionId: docRef.id,
    actorUid: adminUser?.uid || "admin",
    actorRole: "admin",
    actorName: adminUser?.name || "Admin",
    remarks: `Created collection campaign: ${payload.name}`,
    metadata: { name: payload.name, targetAmount: payload.targetAmount },
  });

  try {
    await createNotification({
      userId: "all",
      title: `🎉 New Special Collection: ${payload.name}`,
      message: `Special society fund "${payload.name}" (${payload.collectionType}) has been launched. Target: ₹${payload.targetAmount || 0}. Open for contributions!`,
      type: "special_collection",
      link: "/resident/special-collections",
    });
  } catch (e) {
    console.warn("Could not dispatch special collection launch notification:", e);
  }

  return docRef.id;
}

/**
 * Update a Special Collection Campaign
 */
export async function updateSpecialCollection(id, data, adminUser) {
  const payload = {
    ...data,
    ifsc: (data.ifsc || "").toUpperCase(),
    publicEnabled: data.publicEnabled === true || data.targetAudience === "public_open",
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, "specialCollections", id), payload);

  await logSpecialCollectionAction({
    action: "SPECIAL_COLLECTION_UPDATED",
    collectionId: id,
    actorUid: adminUser?.uid || "admin",
    actorRole: "admin",
    actorName: adminUser?.name || "Admin",
    remarks: `Updated collection campaign: ${data.name || id}`,
  });
}

/**
 * Close a Special Collection Campaign (disallows new submissions)
 */
export async function closeSpecialCollection(id, adminUser) {
  await updateDoc(doc(db, "specialCollections", id), {
    status: "closed",
    closedAt: serverTimestamp(),
    closedBy: adminUser?.uid || "",
    updatedAt: serverTimestamp(),
  });

  await logSpecialCollectionAction({
    action: "COLLECTION_CLOSED",
    collectionId: id,
    actorUid: adminUser?.uid || "admin",
    actorRole: "admin",
    actorName: adminUser?.name || "Admin",
    remarks: "Closed collection campaign to new submissions",
  });
}

/**
 * Archive a Special Collection Campaign
 */
export async function archiveSpecialCollection(id, adminUser) {
  await updateDoc(doc(db, "specialCollections", id), {
    status: "archived",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Real-time listener for Special Collections
 */
export function subscribeSpecialCollections(callback) {
  const q = query(collectionsRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error("[SpecialCollection] Listener error:", err.message);
  });
}

/**
 * Fetch a single Special Collection by ID
 */
export async function getSpecialCollectionById(id) {
  if (!id) return null;
  const docSnap = await getDoc(doc(db, "specialCollections", id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

// ====================================================
// 2. Duplicate UTR Protection
// ====================================================

/**
 * Normalize a UTR string (uppercase, stripped of extra spaces/dashes)
 */
export function normalizeUtr(utr) {
  return (utr || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Check if a normalized UTR already exists in Firestore
 */
export async function checkUtrExists(utr) {
  const clean = normalizeUtr(utr);
  if (!clean) return false;

  try {
    const docSnap = await getDoc(doc(db, "utrLookup", clean));
    return docSnap.exists();
  } catch (err) {
    console.warn("[SpecialCollection] UTR lookup check error:", err.message);
    return false;
  }
}

// ====================================================
// 3. Payment Submissions & Lifecycle
// ====================================================

/**
 * Submit a payment for a Special Collection (Resident or External)
 * Sets status to 'pending' (Awaiting Admin Verification).
 */
export async function submitSpecialCollectionPayment(data, actorUser) {
  const cleanUtr = normalizeUtr(data.utr);
  if (!cleanUtr || cleanUtr.length < 6) {
    throw new Error("Please enter a valid Transaction / UTR number (at least 6 characters).");
  }

  // 1. Critical Duplicate UTR Protection
  const alreadyUsed = await checkUtrExists(cleanUtr);
  if (alreadyUsed) {
    throw new Error("This Transaction / UTR ID has already been submitted. Please check your transaction receipt.");
  }

  const isExternal = data.contributorType === "external" || !actorUser?.uid;
  const currentYear = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const referenceNumber = isExternal
    ? `EXT-SC-${currentYear}-${randomSuffix}`
    : "";

  const payload = {
    collectionId: data.collectionId,
    collectionName: data.collectionName || "Special Collection",
    purpose: data.purpose || "Contribution",
    contributorType: isExternal ? "external" : "resident",

    // Resident details (if resident)
    residentId: data.residentId || actorUser?.residentId || (isExternal ? "" : actorUser?.uid || ""),
    userId: actorUser?.uid || "",
    flatNumber: data.flatNumber || actorUser?.flat || actorUser?.flatNumber || "",
    block: data.block || actorUser?.block || "",

    // Contributor details
    contributorName: (data.contributorName || actorUser?.name || "Contributor").trim(),
    mobileNumber: (data.mobileNumber || actorUser?.phone || actorUser?.mobile || "").trim(),
    email: (data.email || actorUser?.email || "").trim(),

    amount: Number(data.amount || 0),
    utr: (data.utr || "").trim(),
    normalizedUtr: cleanUtr,
    paymentDate: data.paymentDate || new Date().toISOString().split("T")[0],
    paymentTime: data.paymentTime || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),

    referenceNumber,
    status: "pending", // ALWAYS pending verification by Admin

    submittedAt: serverTimestamp(),
    confirmedAt: null,
    confirmedBy: "",
    rejectedAt: null,
    rejectedBy: "",
    rejectionReason: "",
    adminRemarks: "",
    receiptNumber: "",
    receiptId: "",
  };

  // 2. Claim UTR in utrLookup atomically
  await setDoc(doc(db, "utrLookup", cleanUtr), {
    utr: cleanUtr,
    collectionId: data.collectionId,
    amount: payload.amount,
    claimedAt: serverTimestamp(),
    contributorName: payload.contributorName,
  });

  // 3. Write payment document
  const paymentDocRef = await addDoc(paymentsRef, payload);

  // 4. Log audit trail
  await logSpecialCollectionAction({
    action: "PAYMENT_SUBMITTED",
    collectionId: data.collectionId,
    paymentId: paymentDocRef.id,
    actorUid: actorUser?.uid || "external",
    actorRole: isExternal ? "external" : "resident",
    actorName: payload.contributorName,
    remarks: `Submitted UTR ${cleanUtr} for ₹${payload.amount}`,
    metadata: { amount: payload.amount, utr: cleanUtr, referenceNumber },
  });

  return {
    paymentId: paymentDocRef.id,
    referenceNumber,
    status: "pending",
  };
}

/**
 * Admin Confirms a Payment after verifying the transaction in the actual bank/UPI account.
 */
export async function confirmSpecialCollectionPayment(payment, adminUser) {
  if (!payment?.id) throw new Error("Invalid payment target.");

  const currentYear = new Date().getFullYear();
  const receiptSeq = Math.floor(100000 + Math.random() * 900000);
  const receiptNumber = `RWA-SC-${currentYear}-${receiptSeq}`;

  // 1. Create Receipt Document
  const receiptPayload = {
    receiptNumber,
    category: "special_collection",
    paymentId: payment.id,
    collectionId: payment.collectionId || "",
    collectionName: payment.collectionName || payment.campaignName || "Special Collection",
    purpose: payment.purpose || "Special Contribution",

    residentId: payment.residentId || "",
    userId: payment.userId || "",
    contributorType: payment.contributorType || "resident",
    contributorName: payment.contributorName || "Contributor",
    mobileNumber: payment.mobileNumber || payment.contributorMobile || "",
    flatNumber: payment.flatNumber || payment.contributorFlat || "",
    block: payment.block || "",

    amount: Number(payment.amount || 0),
    paymentMethod: payment.paymentMode || payment.paymentMethod || "UPI",
    utr: payment.utr || payment.utrNumber || "",
    paymentDate: payment.paymentDate || new Date().toISOString().split("T")[0],

    status: "confirmed",
    issuedAt: serverTimestamp(),
    issuedBy: adminUser?.uid || "admin",
    issuedByName: adminUser?.name || "Society Admin",
  };

  const receiptDocRef = await addDoc(receiptsRef, receiptPayload);

  // 2. Update Payment Record to CONFIRMED
  await updateDoc(doc(db, "specialCollectionPayments", payment.id), {
    status: "confirmed",
    confirmedAt: serverTimestamp(),
    confirmedBy: adminUser?.uid || "admin",
    confirmedByName: adminUser?.name || "Society Admin",
    receiptNumber,
    receiptId: receiptDocRef.id,
    updatedAt: serverTimestamp(),
  });

  // 3. Log Audit Record
  await logSpecialCollectionAction({
    action: "PAYMENT_CONFIRMED",
    collectionId: payment.collectionId,
    paymentId: payment.id,
    actorUid: adminUser?.uid || "admin",
    actorRole: "admin",
    actorName: adminUser?.name || "Admin",
    remarks: `Confirmed payment ₹${payment.amount} (UTR: ${payment.utr}). Issued Receipt: ${receiptNumber}`,
    metadata: { amount: payment.amount, receiptNumber },
  });

  // 4. Notify Contributor
  const targetUid = payment.userId || payment.residentId;
  if (targetUid) {
    try {
      await createNotification({
        userId: targetUid,
        title: "✅ Contribution Verified & Receipt Issued",
        message: `Your payment of ₹${payment.amount} for "${payment.collectionName || 'Special Collection'}" was confirmed. Official Receipt: ${receiptNumber}`,
        type: "special_collection",
        link: "/resident/special-collections",
      });
    } catch (e) {
      console.warn("Could not dispatch confirmation notification:", e);
    }
  }

  return {
    receiptNumber,
    receiptId: receiptDocRef.id,
  };
}

/**
 * Record a Cash or Direct Offline Payment for a Special Collection Campaign (Admin or Collector).
 * Immediately confirmed and generates an official receipt (RWA-SC-...).
 */
export async function recordOfflineSpecialCollectionPayment(data, actorUser) {
  if (!data.collectionId) throw new Error("Please select a valid collection campaign.");
  const amount = Number(data.amount || 0);
  if (!amount || amount <= 0) throw new Error("Please enter a valid contribution amount.");

  let resolvedCollectionName = data.collectionName || "";
  let resolvedPurpose = data.purpose || "";

  if (!resolvedCollectionName || resolvedCollectionName === "Special Collection") {
    try {
      const colSnap = await getDoc(doc(db, "specialCollections", data.collectionId));
      if (colSnap.exists()) {
        const cData = colSnap.data();
        resolvedCollectionName = cData.name || cData.title || cData.purpose || resolvedCollectionName;
        resolvedPurpose = cData.purpose || cData.name || resolvedPurpose;
      }
    } catch (e) {
      console.warn("Could not fetch campaign name:", e.message);
    }
  }

  const currentYear = new Date().getFullYear();
  const receiptSeq = Math.floor(100000 + Math.random() * 900000);
  const receiptNumber = `RWA-SC-${currentYear}-${receiptSeq}`;
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const isExternal = data.contributorType === "external";
  const referenceNumber = `OFFLINE-SC-${currentYear}-${randomSuffix}`;
  const paymentMethod = data.paymentMethod || "Cash";

  const paymentPayload = {
    collectionId: data.collectionId,
    collectionName: resolvedCollectionName || "Special Collection",
    purpose: resolvedPurpose || "Special Contribution",
    contributorType: isExternal ? "external" : "resident",

    residentId: data.residentId || "",
    userId: data.userId || (isExternal ? "" : data.residentId || ""),
    flatNumber: data.flatNumber || "",
    block: data.block || "",

    contributorName: (data.contributorName || "Contributor").trim(),
    mobileNumber: (data.mobileNumber || "").trim(),
    email: (data.email || "").trim(),

    amount,
    paymentMethod,
    utr: data.utr || (paymentMethod === "Cash" ? "CASH-OFFLINE" : `DIR-${randomSuffix}`),
    normalizedUtr: "",
    paymentDate: data.paymentDate || new Date().toISOString().split("T")[0],
    paymentTime: data.paymentTime || new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),

    referenceNumber,
    status: "confirmed", // Offline collections verified and confirmed on spot

    submittedAt: serverTimestamp(),
    confirmedAt: serverTimestamp(),
    confirmedBy: actorUser?.uid || "admin",
    confirmedByName: actorUser?.name || "Admin",
    collectorId: data.collectorId || (actorUser?.role === "collector" ? actorUser.uid : null),
    collectorName: data.collectorName || (actorUser?.role === "collector" ? actorUser.name : "Admin"),
    adminRemarks: (data.remarks || "").trim(),
    receiptNumber,
  };

  // 1. Generate Document References
  const paymentDocRef = doc(paymentsRef);
  const receiptDocRef = doc(receiptsRef);

  paymentPayload.receiptId = receiptDocRef.id;

  // 2. Prepare Receipt Document
  const receiptPayload = {
    receiptNumber,
    category: "special_collection",
    paymentId: paymentDocRef.id,
    collectionId: data.collectionId,
    collectionName: paymentPayload.collectionName,
    purpose: paymentPayload.purpose,

    residentId: paymentPayload.residentId,
    userId: paymentPayload.userId,
    contributorType: paymentPayload.contributorType,
    contributorName: paymentPayload.contributorName,
    mobileNumber: paymentPayload.mobileNumber,
    flatNumber: paymentPayload.flatNumber,
    block: paymentPayload.block,

    amount,
    paymentMethod,
    utr: paymentPayload.utr,
    paymentDate: paymentPayload.paymentDate,

    status: "confirmed",
    issuedAt: serverTimestamp(),
    issuedBy: actorUser?.uid || "admin",
    issuedByName: actorUser?.name || "Society Admin",
    collectorId: paymentPayload.collectorId,
    collectorName: paymentPayload.collectorName,
  };

  // 3. Write Payment Document
  await setDoc(paymentDocRef, paymentPayload);

  // 4. Write Receipt Document
  try {
    await setDoc(receiptDocRef, receiptPayload);
  } catch (receiptErr) {
    console.warn("[SpecialCollection] Failed to save receipt document:", receiptErr.message);
  }

  // 5. Log Audit (Non-blocking)
  try {
    await logSpecialCollectionAction({
      action: "OFFLINE_PAYMENT_RECORDED",
      collectionId: data.collectionId,
      paymentId: paymentDocRef.id,
      actorUid: actorUser?.uid || "admin",
      actorRole: actorUser?.role || "admin",
      actorName: actorUser?.name || "Admin",
      remarks: `Recorded ${paymentMethod} payment of ₹${amount} from ${paymentPayload.contributorName}. Issued Receipt: ${receiptNumber}`,
      metadata: { amount, paymentMethod, receiptNumber, contributorName: paymentPayload.contributorName },
    });
  } catch (auditErr) {
    console.warn("[SpecialCollection] Audit log error:", auditErr.message);
  }

  // 6. Notify Resident if linked (Non-blocking)
  const targetUid = paymentPayload.userId || paymentPayload.residentId;
  if (targetUid) {
    try {
      await createNotification({
        userId: targetUid,
        title: "✅ Contribution Received & Receipt Issued",
        message: `Your payment of ₹${amount} for "${paymentPayload.collectionName}" was recorded (${paymentMethod}). Official Receipt: ${receiptNumber}`,
        type: "special_collection",
        link: "/resident/special-collections",
      });
    } catch (e) {
      console.warn("Could not dispatch offline payment notification:", e);
    }
  }

  return {
    paymentId: paymentDocRef.id,
    receiptNumber,
    receiptId: receiptDocRef.id,
    collectionName: paymentPayload.collectionName,
    purpose: paymentPayload.purpose,
    amount,
    contributorName: paymentPayload.contributorName,
    contributorType: paymentPayload.contributorType === "external" ? "External Contributor" : "Resident",
    flatNumber: paymentPayload.flatNumber || "",
    block: paymentPayload.block || "",
    mobileNumber: paymentPayload.mobileNumber || "",
    paymentMethod,
    paymentDate: paymentPayload.paymentDate,
    collectorName: paymentPayload.collectorName,
    confirmedByName: actorUser?.name || "Collector",
    payment: { id: paymentDocRef.id, ...paymentPayload, receiptId: receiptDocRef.id },
  };
}

/**
 * Admin Rejects a Payment with a mandatory reason and remark.
 */
export async function rejectSpecialCollectionPayment(payment, reason, remark, adminUser) {
  if (!payment?.id) throw new Error("Invalid payment target.");
  if (!reason) throw new Error("Please select a valid rejection reason.");

  // 1. Update Payment Record to REJECTED
  await updateDoc(doc(db, "specialCollectionPayments", payment.id), {
    status: "rejected",
    rejectedAt: serverTimestamp(),
    rejectedBy: adminUser?.uid || "admin",
    rejectedByName: adminUser?.name || "Society Admin",
    rejectionReason: reason,
    adminRemarks: (remark || "").trim(),
    updatedAt: serverTimestamp(),
  });

  // 2. Release UTR lock so contributor can re-submit if it was a typo
  if (payment.normalizedUtr) {
    try {
      await deleteDoc(doc(db, "utrLookup", payment.normalizedUtr));
    } catch (e) {
      console.warn("Could not release UTR lock:", e.message);
    }
  }

  // 3. Log Audit Record
  await logSpecialCollectionAction({
    action: "PAYMENT_REJECTED",
    collectionId: payment.collectionId,
    paymentId: payment.id,
    actorUid: adminUser?.uid || "admin",
    actorRole: "admin",
    actorName: adminUser?.name || "Admin",
    remarks: `Rejected payment ₹${payment.amount}. Reason: ${reason}. Remarks: ${remark || "None"}`,
    metadata: { amount: payment.amount, reason, remark },
  });

  // 4. Notify Contributor
  const rejectTargetUid = payment.userId || payment.residentId;
  if (rejectTargetUid) {
    try {
      await createNotification({
        userId: rejectTargetUid,
        title: "⚠️ Contribution Verification Rejected",
        message: `Your payment of ₹${payment.amount} for "${payment.collectionName || 'Special Collection'}" could not be verified. Reason: ${reason}`,
        type: "warning",
        link: "/resident/special-collections",
      });
    } catch (e) {
      console.warn("Could not dispatch rejection notification:", e);
    }
  }
}

/**
 * Admin Refunds / Voids a previously confirmed payment.
 * Maintains full audit trail; does NOT delete the transaction record.
 */
export async function refundSpecialCollectionPayment(payment, refundReason, adminUser) {
  if (!payment?.id) throw new Error("Invalid payment target.");

  await updateDoc(doc(db, "specialCollectionPayments", payment.id), {
    status: "refunded",
    refundedAt: serverTimestamp(),
    refundedBy: adminUser?.uid || "admin",
    refundedByName: adminUser?.name || "Society Admin",
    refundReason: (refundReason || "Administrative Refund").trim(),
    updatedAt: serverTimestamp(),
  });

  await logSpecialCollectionAction({
    action: "PAYMENT_REFUNDED",
    collectionId: payment.collectionId,
    paymentId: payment.id,
    actorUid: adminUser?.uid || "admin",
    actorRole: "admin",
    actorName: adminUser?.name || "Admin",
    remarks: `Refunded payment ₹${payment.amount}. Reason: ${refundReason}`,
    metadata: { amount: payment.amount, refundReason },
  });
}

// ====================================================
// 4. Real-Time Listeners & Queries
// ====================================================

/**
 * Real-time listener for payments belonging to a specific collection
 */
export function subscribeCollectionPayments(collectionId, callback) {
  if (!collectionId) return () => {};
  const q = query(
    paymentsRef,
    where("collectionId", "==", collectionId),
    orderBy("submittedAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error("[SpecialCollection] Collection payments listener error:", err.message);
  });
}

/**
 * Real-time listener for all special collection payments (for Admin reports)
 */
export function subscribeAllSpecialPayments(callback) {
  const q = query(paymentsRef, orderBy("submittedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.error("[SpecialCollection] All payments listener error:", err.message);
  });
}

/**
 * Real-time listener for a resident's special collection payments.
 * Supports string residentId or an object with { residentIds, mobileNumbers, userIds }
 * to guarantee real-time sync when payments are recorded via cash, collector, admin, or portal.
 */
export function subscribeResidentSpecialPayments(target, callback) {
  if (!target) return () => {};

  let residentIds = [];
  let mobileNumbers = [];
  let userIds = [];

  if (typeof target === "string") {
    residentIds = [target];
  } else if (typeof target === "object") {
    if (Array.isArray(target.residentIds)) residentIds = target.residentIds.filter(Boolean);
    else if (target.residentId) residentIds = [target.residentId];

    if (Array.isArray(target.mobileNumbers)) mobileNumbers = target.mobileNumbers.filter(Boolean);
    else if (target.mobileNumber || target.phone || target.mobile) {
      mobileNumbers = [target.mobileNumber || target.phone || target.mobile];
    }

    if (Array.isArray(target.userIds)) userIds = target.userIds.filter(Boolean);
    else if (target.userId || target.uid) userIds = [target.userId || target.uid];
  }

  const idSet = new Set(residentIds.map((s) => String(s).trim()).filter(Boolean));
  const userSet = new Set(userIds.map((s) => String(s).trim()).filter(Boolean));
  const phoneSet = new Set();
  mobileNumbers.forEach((m) => {
    if (!m) return;
    const str = String(m).trim();
    phoneSet.add(str);
    const clean = str.replace(/\D/g, "");
    if (clean.length >= 10) phoneSet.add(clean.slice(-10));
  });

  const unsubs = [];
  const queryResults = new Map(); // queryKey -> Map of docId -> docData

  function dispatch() {
    const combinedMap = new Map();
    for (const subMap of queryResults.values()) {
      for (const [id, docData] of subMap.entries()) {
        combinedMap.set(id, docData);
      }
    }
    const list = Array.from(combinedMap.values());
    list.sort((a, b) => {
      const tsA = a.submittedAt?.toMillis
        ? a.submittedAt.toMillis()
        : new Date(a.submittedAt || a.paymentDate || 0).getTime();
      const tsB = b.submittedAt?.toMillis
        ? b.submittedAt.toMillis()
        : new Date(b.submittedAt || b.paymentDate || 0).getTime();
      return tsB - tsA;
    });
    callback(list);
  }

  // 1. Query by residentId
  idSet.forEach((rId) => {
    try {
      const key = `res_${rId}`;
      const q = query(paymentsRef, where("residentId", "==", rId));
      const unsub = onSnapshot(q, (snapshot) => {
        const subMap = new Map();
        snapshot.docs.forEach((d) => {
          subMap.set(d.id, { id: d.id, ...d.data() });
        });
        queryResults.set(key, subMap);
        dispatch();
      }, (err) => console.warn("[SpecialCollection] residentId listener warning:", err.message));
      unsubs.push(unsub);
    } catch (e) {
      console.warn("Could not attach residentId listener:", e);
    }
  });

  // 2. Query by userId
  userSet.forEach((uId) => {
    if (idSet.has(uId)) return;
    try {
      const key = `user_${uId}`;
      const q = query(paymentsRef, where("userId", "==", uId));
      const unsub = onSnapshot(q, (snapshot) => {
        const subMap = new Map();
        snapshot.docs.forEach((d) => {
          subMap.set(d.id, { id: d.id, ...d.data() });
        });
        queryResults.set(key, subMap);
        dispatch();
      }, (err) => console.warn("[SpecialCollection] userId listener warning:", err.message));
      unsubs.push(unsub);
    } catch (e) {
      console.warn("Could not attach userId listener:", e);
    }
  });

  // 3. Query by mobileNumber (matches cash/collector offline records)
  phoneSet.forEach((ph) => {
    try {
      const key = `phone_${ph}`;
      const q = query(paymentsRef, where("mobileNumber", "==", ph));
      const unsub = onSnapshot(q, (snapshot) => {
        const subMap = new Map();
        snapshot.docs.forEach((d) => {
          subMap.set(d.id, { id: d.id, ...d.data() });
        });
        queryResults.set(key, subMap);
        dispatch();
      }, (err) => console.warn("[SpecialCollection] mobile listener warning:", err.message));
      unsubs.push(unsub);
    } catch (e) {
      console.warn("Could not attach mobile listener:", e);
    }
  });

  return () => {
    unsubs.forEach((u) => u());
  };
}

/**
 * Secure Status Lookup for External Contributors
 * Requires Reference Number + Mobile Number matching for security.
 */
export async function getPaymentByReferenceAndPhone(referenceNumber, phone) {
  if (!referenceNumber || !phone) return null;

  const cleanRef = referenceNumber.trim();
  const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);

  const q = query(paymentsRef, where("referenceNumber", "==", cleanRef));
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const found = snap.docs[0].data();
  const targetPhone = (found.mobileNumber || "").replace(/\D/g, "").slice(-10);

  if (targetPhone !== cleanPhone) {
    throw new Error("The mobile number does not match this reference number.");
  }

  return { id: snap.docs[0].id, ...found };
}

export const getCampaignById = getSpecialCollectionById;

export async function submitSpecialContribution(data) {
  const res = await submitSpecialCollectionPayment({
    collectionId: data.campaignId,
    contributorType: data.isExternal ? "external" : "resident",
    contributorName: data.contributorName,
    mobileNumber: data.contributorMobile,
    email: data.contributorEmail,
    flatNumber: data.contributorFlat,
    amount: data.amount,
    utr: data.utrNumber,
    paymentMethod: data.paymentMode || "UPI",
    notes: data.notes
  });

  return {
    id: res.paymentId,
    referenceCode: res.referenceNumber,
    status: res.status
  };
}

export async function lookupExternalContributionStatus(campaignId, refNo, mobile) {
  let docs = [];
  const cleanRef = (refNo || "").trim();
  const cleanPhone = (mobile || "").trim().replace(/\D/g, "").slice(-10);

  if (cleanRef) {
    const q1 = query(paymentsRef, where("referenceNumber", "==", cleanRef));
    const s1 = await getDocs(q1);
    s1.forEach(d => docs.push({ id: d.id, ...d.data() }));
  }

  if (cleanPhone) {
    const q2 = query(paymentsRef, where("mobileNumber", "==", cleanPhone));
    const s2 = await getDocs(q2);
    s2.forEach(d => {
      if (!docs.some(existing => existing.id === d.id)) {
        docs.push({ id: d.id, ...d.data() });
      }
    });
  }

  if (campaignId) {
    docs = docs.filter(d => !d.collectionId || d.collectionId === campaignId);
  }

  return docs;
}

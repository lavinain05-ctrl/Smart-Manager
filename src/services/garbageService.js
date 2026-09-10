import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

// =============================================
// Collection References
// =============================================

const accountsRef   = collection(db, "garbageAccounts");
const billsRef      = collection(db, "garbageBills");
const collectionsRef = collection(db, "garbageCollections");
const collectorsRef = collection(db, "garbageCollectors");
const routesRef     = collection(db, "garbageRoutes");
const settingsRef   = collection(db, "garbageSettings");
const requestsRef   = collection(db, "garbageRequests");
const logsRef       = collection(db, "garbageCollectionLogs");
const reportsRef    = collection(db, "garbageReports");

// =============================================
// GARBAGE ACCOUNTS
// =============================================

export function subscribeGarbageAccounts(callback) {
  return onSnapshot(accountsRef, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] garbageAccounts listener error:", error.message);
  });
}

// Scoped to a specific resident for Resident / Family portal (1000x read reduction)
export function subscribeResidentGarbageAccounts(residentId, callback) {
  if (!residentId) return () => {};
  const q = query(accountsRef, where("residentId", "==", residentId));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] resident garbageAccounts listener error:", error.message);
  });
}

export async function addGarbageAccount(data) {
  if (!data.residentId || !data.residentId.trim()) {
    throw new Error("Cannot create garbage account without a valid Resident ID reference.");
  }

  // Prevent duplicate account for the same residentId
  const existing = await getGarbageAccountByResidentId(data.residentId);
  if (existing) {
    throw new Error("A garbage account already exists for this resident.");
  }

  return await addDoc(accountsRef, {
    residentId: data.residentId.trim(),
    monthlyCharge: Number(data.monthlyCharge || 0),
    collectorId: data.collectorId || "",
    status: data.status || "active",
    joinedDate: data.joinedDate || new Date().toISOString().split("T")[0],
    remarks: data.remarks || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function relinkGarbageAccount(accountId, newResidentId) {
  if (!newResidentId || !newResidentId.trim()) {
    throw new Error("A valid Resident ID is required to link this account.");
  }
  return await updateDoc(doc(db, "garbageAccounts", accountId), {
    residentId: newResidentId.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateGarbageAccount(id, data) {
  return await updateDoc(doc(db, "garbageAccounts", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGarbageAccount(id) {
  return await deleteDoc(doc(db, "garbageAccounts", id));
}

export async function getGarbageAccount(id) {
  const snap = await getDoc(doc(db, "garbageAccounts", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Helper to identify accounts whose residentId does not match any current resident in master.
 */
export function findOrphanGarbageAccounts(accounts = [], residents = []) {
  const residentIdSet = new Set((residents || []).map((r) => r.id));
  return (accounts || []).filter((acc) => !acc.residentId || !residentIdSet.has(acc.residentId));
}

/**
 * Find an existing garbage account for a resident (by residentId).
 * Returns the first matching account doc or null.
 * Used to prevent duplicate account creation.
 */
export async function getGarbageAccountByResidentId(residentId) {
  const q = query(accountsRef, where("residentId", "==", residentId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

// =============================================
// GARBAGE BILLS
// =============================================

export function subscribeGarbageBills(year, callback) {
  const q = query(
    billsRef,
    where("year", "==", Number(year)),
    orderBy("month", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] garbageBills listener error:", error.message);
  });
}

// Scoped to a specific resident for Resident / Family portal (1000x read reduction)
export function subscribeResidentGarbageBills(residentId, year, callback) {
  if (!residentId) return () => {};
  const q = query(
    billsRef,
    where("residentId", "==", residentId),
    where("year", "==", Number(year))
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] resident garbageBills listener error:", error.message);
  });
}

export async function addGarbageBill(data) {
  return await addDoc(billsRef, {
    ...data,
    year: Number(data.year),
    amount: Number(data.amount || 0),
    paidAmount: Number(data.paidAmount || 0),
    status: data.status || "Pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateGarbageBill(id, data) {
  return await updateDoc(doc(db, "garbageBills", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGarbageBill(id) {
  return await deleteDoc(doc(db, "garbageBills", id));
}

// Check if bill exists for account + month + year
export async function garbageBillExists(accountId, month, year) {
  const q = query(
    billsRef,
    where("accountId", "==", accountId),
    where("month", "==", month),
    where("year", "==", Number(year))
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

// =============================================
// BULK BILL GENERATION
// =============================================

export async function generateMonthlyGarbageBills(accounts, month, year, existingBills, residents = []) {
  const existingAccountIds = new Set(
    existingBills
      .filter((b) => b.month === month && Number(b.year) === Number(year))
      .map((b) => b.accountId)
  );

  // If residents list is provided, only bill accounts that belong to active participating residents
  const participatingResidentIds = residents && residents.length > 0
    ? new Set(
        residents
          .filter((r) => r.garbageStatus === "participating" && r.status !== "Inactive" && r.status !== "inactive")
          .map((r) => r.id)
      )
    : null;

  const accountsToBill = accounts.filter((acc) => {
    if (acc.status !== "active") return false;
    if (existingAccountIds.has(acc.id)) return false;
    if (participatingResidentIds && !participatingResidentIds.has(acc.residentId)) return false;
    return true;
  });

  if (accountsToBill.length === 0) {
    return { generated: 0, skipped: accounts.length };
  }

  // Firestore batches can hold 500 operations max.
  const BATCH_LIMIT = 400;
  let generated = 0;

  for (let i = 0; i < accountsToBill.length; i += BATCH_LIMIT) {
    const chunk = accountsToBill.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);

    chunk.forEach((acc) => {
      const ref = doc(billsRef);
      batch.set(ref, {
        accountId: acc.id,
        residentId: acc.residentId || "",
        month,
        year: Number(year),
        amount: Number(acc.monthlyCharge || 0),
        paidAmount: 0,
        status: "Pending",
        paymentDate: "",
        paymentMethod: "",
        collectedById: "",
        dueDate: `10 ${month} ${year}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    generated += chunk.length;
  }

  return {
    generated,
    skipped: accounts.length - accountsToBill.length,
  };
}

// =============================================
// GARBAGE COLLECTIONS (daily collection logs)
// =============================================

export function subscribeGarbageCollections(callback) {
  const q = query(collectionsRef, orderBy("collectedAt", "desc"), limit(500));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] garbageCollections listener error:", error.message);
  });
}

export function subscribeGarbageCollectionsByDate(date, callback) {
  const q = query(
    collectionsRef,
    where("date", "==", date),
    orderBy("collectedAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] garbageCollections date listener error:", error.message);
  });
}

export async function addGarbageCollection(data) {
  return await addDoc(collectionsRef, {
    ...data,
    collectedAt: serverTimestamp(),
  });
}

export async function updateGarbageCollection(id, data) {
  return await updateDoc(doc(db, "garbageCollections", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// =============================================
// GARBAGE COLLECTORS (assignments)
// =============================================

export function subscribeGarbageCollectors(callback) {
  return onSnapshot(collectorsRef, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] garbageCollectors listener error:", error.message);
  });
}

export async function addGarbageCollector(data) {
  return await addDoc(collectorsRef, {
    collectorId: data.collectorId || "",
    assignedBlocks: data.assignedBlocks || [],
    assignedRoute: data.assignedRoute || "",
    status: data.status || "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateGarbageCollector(id, data) {
  return await updateDoc(doc(db, "garbageCollectors", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGarbageCollector(id) {
  return await deleteDoc(doc(db, "garbageCollectors", id));
}

// =============================================
// GARBAGE ROUTES
// =============================================

export function subscribeGarbageRoutes(callback) {
  return onSnapshot(routesRef, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] garbageRoutes listener error:", error.message);
  });
}

export async function addGarbageRoute(data) {
  return await addDoc(routesRef, {
    ...data,
    blocks: data.blocks || [],
    status: data.status || "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateGarbageRoute(id, data) {
  return await updateDoc(doc(db, "garbageRoutes", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGarbageRoute(id) {
  return await deleteDoc(doc(db, "garbageRoutes", id));
}

// =============================================
// GARBAGE SETTINGS (singleton)
// =============================================

const SETTINGS_DOC_ID = "config";

export function subscribeGarbageSettings(callback) {
  const ref = doc(db, "garbageSettings", SETTINGS_DOC_ID);

  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    } else {
      callback({
        id: SETTINGS_DOC_ID,
        defaultCharge: 0,
        billDueDay: 10,
        collectionTime: "",
        enableNotifications: true,
      });
    }
  }, (error) => {
    console.error("[Firestore] garbageSettings listener error:", error.message);
  });
}

export async function saveGarbageSettings(data) {
  const ref = doc(db, "garbageSettings", SETTINGS_DOC_ID);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } else {
    return await setDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

// =============================================
// GARBAGE REQUESTS (opt-in / opt-out)
// =============================================

export function subscribeGarbageRequests(callback) {
  const q = query(requestsRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] garbageRequests listener error:", error.message);
  });
}

export async function addGarbageRequest(data) {
  return await addDoc(requestsRef, {
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function updateGarbageRequest(id, data) {
  return await updateDoc(doc(db, "garbageRequests", id), {
    ...data,
    processedAt: serverTimestamp(),
  });
}

export async function deleteGarbageRequest(id) {
  return await deleteDoc(doc(db, "garbageRequests", id));
}

// =============================================
// GARBAGE COLLECTION LOGS (audit trail)
// =============================================

export async function logGarbageActivity({
  action,
  category,
  performedBy,
  performedByName,
  details,
  targetId,
  targetName,
}) {
  return await addDoc(logsRef, {
    action: action || "",
    category: category || "garbage",
    performedBy: performedBy || "",
    performedByName: performedByName || "",
    details: details || "",
    targetId: targetId || "",
    targetName: targetName || "",
    createdAt: serverTimestamp(),
  });
}

export function subscribeGarbageLogs(callback, max = 100) {
  const q = query(logsRef, orderBy("createdAt", "desc"), limit(max));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] garbageCollectionLogs listener error:", error.message);
  });
}

// =============================================
// GARBAGE REPORTS
// =============================================

export function subscribeGarbageReports(callback) {
  const q = query(reportsRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }, (error) => {
    console.error("[Firestore] garbageReports listener error:", error.message);
  });
}

export async function addGarbageReport(data) {
  return await addDoc(reportsRef, {
    ...data,
    createdAt: serverTimestamp(),
  });
}

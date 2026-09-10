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
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const blocksRef = collection(db, "blocks");
const flatsRef = collection(db, "flats");

// =============================
// Blocks
// =============================

export function subscribeBlocks(callback) {
  const q = query(blocksRef, orderBy("name", "asc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] blocks listener error:", error.message);
  });
}

export async function addBlock(data) {
  return await addDoc(blocksRef, {
    name: data.name,
    description: data.description || "",
    totalFlats: Number(data.totalFlats) || 0,
    flatRange: data.flatRange || "",
    floors: Number(data.floors) || 0,
    status: data.status || "active",
    adminNotes: data.adminNotes || "",
    createdAt: serverTimestamp(),
  });
}

export async function updateBlock(id, data) {
  const updates = { updatedAt: serverTimestamp() };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.totalFlats !== undefined) updates.totalFlats = Number(data.totalFlats) || 0;
  if (data.flatRange !== undefined) updates.flatRange = data.flatRange;
  if (data.floors !== undefined) updates.floors = Number(data.floors) || 0;
  if (data.status !== undefined) updates.status = data.status;
  if (data.adminNotes !== undefined) updates.adminNotes = data.adminNotes;

  return await updateDoc(doc(db, "blocks", id), updates);
}

export async function deleteBlock(id) {
  return await deleteDoc(doc(db, "blocks", id));
}

// =============================
// Flats
// =============================

export function subscribeFlats(callback) {
  const q = query(flatsRef, orderBy("flatNumber", "asc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] flats listener error:", error.message);
  });
}

export async function addFlat(data) {
  return await addDoc(flatsRef, {
    flatNumber: data.flatNumber,
    blockId: data.blockId || "",
    blockName: data.blockName || "",
    floor: Number(data.floor) || 0,
    status: data.status || "vacant",
    residentId: data.residentId || "",
    createdAt: serverTimestamp(),
  });
}

export async function updateFlat(id, data) {
  const updates = { updatedAt: serverTimestamp() };

  if (data.flatNumber !== undefined) updates.flatNumber = data.flatNumber;
  if (data.blockId !== undefined) updates.blockId = data.blockId;
  if (data.blockName !== undefined) updates.blockName = data.blockName;
  if (data.floor !== undefined) updates.floor = Number(data.floor);
  if (data.status !== undefined) updates.status = data.status;
  if (data.residentId !== undefined) updates.residentId = data.residentId;

  return await updateDoc(doc(db, "flats", id), updates);
}

export async function deleteFlat(id) {
  return await deleteDoc(doc(db, "flats", id));
}

// =============================
// Link / Unlink resident to flat
// =============================

export async function linkResidentToFlat(flatId, residentId) {
  return await updateDoc(doc(db, "flats", flatId), {
    residentId,
    status: "occupied",
    updatedAt: serverTimestamp(),
  });
}

export async function unlinkResidentFromFlat(flatId) {
  return await updateDoc(doc(db, "flats", flatId), {
    residentId: "",
    status: "vacant",
    updatedAt: serverTimestamp(),
  });
}

// =============================
// Auto-generate flats for a block
// =============================

export async function generateFlatsForBlock(blockId, blockName, count, startNumber, floors) {
  const batch = writeBatch(db);
  const flatsPerFloor = floors > 0 ? Math.ceil(count / floors) : count;

  for (let i = 0; i < count; i++) {
    const floor = floors > 0 ? Math.floor(i / flatsPerFloor) + 1 : 1;
    const flatInFloor = (i % flatsPerFloor) + 1;
    const flatNumber = startNumber
      ? String(Number(startNumber) + i)
      : `${floor}${String(flatInFloor).padStart(2, "0")}`;

    const flatDocRef = doc(flatsRef);
    batch.set(flatDocRef, {
      flatNumber,
      blockId,
      blockName,
      floor,
      status: "vacant",
      residentId: "",
      createdAt: serverTimestamp(),
    });
  }

  return await batch.commit();
}

// =============================
// Check duplicate flat number
// =============================

export async function flatNumberExists(flatNumber, blockId, excludeId) {
  const q = query(
    flatsRef,
    where("flatNumber", "==", flatNumber),
    where("blockId", "==", blockId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.some((d) => d.id !== excludeId);
}

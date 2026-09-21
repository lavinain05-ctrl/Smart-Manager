import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { db, secondaryAuth } from "../firebase/firebase";
import {
  mobileToAuthEmail,
  normalizeMobile,
  validateMobile,
  writeAuthLookup,
  deleteAuthLookup,
} from "./authService";
import { deleteFirebaseAuthAccount } from "./accountDeletionService";

const residentRef = collection(db, "residents");

/* ===============================
   Residents — Existing
================================ */

export async function getResidents() {
  const snapshot = await getDocs(residentRef);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export function subscribeResidents(callback) {
  return onSnapshot(residentRef, (snapshot) => {
    const residents = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    callback(residents);
  }, (error) => {
    console.error("[Firestore] residents listener error:", error.message);
  });
}

// Creates a resident record AND a Firebase Auth account + users/{uid} role doc.
// The resident Firestore doc is stored with the auth uid as its ID so it can
// be looked up by the logged-in resident (canonical 1-to-1 ID mapping).
export async function addResidentWithAccount({
  flat,
  owner,
  mobile,
  block,
  blockId,
  floor,
  charge,
  email,
  password,
  familyMembers,
  remarks,
  garbageStatus,
  collectorId,
  collectorName,
  createdBy,
  createdById,
  createdByName,
}) {
  const cleanMobile = normalizeMobile(mobile);
  const mobileError = validateMobile(cleanMobile);
  if (mobileError) {
    throw new Error(mobileError);
  }

  if (!password || password.length < 6) {
    throw new Error("Portal password must be at least 6 characters.");
  }

  // Check duplicate in authLookup
  try {
    const lookupDoc = await getDoc(doc(db, "authLookup", cleanMobile));
    if (lookupDoc.exists()) {
      throw new Error("This mobile number is already registered.");
    }
  } catch (err) {
    if (err.message === "This mobile number is already registered.") throw err;
  }

  // Canonical pseudo-email for Firebase Auth
  const authEmail = mobileToAuthEmail(cleanMobile);

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      authEmail,
      password
    );
  } catch (authError) {
    if (authError.code === "auth/email-already-in-use") {
      throw new Error("This mobile number is already registered.");
    }
    if (authError.code === "auth/weak-password") {
      throw new Error("Portal password is too weak. Use at least 6 characters.");
    }
    throw authError;
  }

  const uid = credential.user.uid;

  const isParticipating = garbageStatus === "participating" ||
    createdBy === "Collector" ||
    Boolean(collectorId) ||
    (Number(charge) > 0 && garbageStatus !== "not_participating");

  const finalGarbageStatus = isParticipating ? "participating" : (garbageStatus || "not_participating");

  // Create the residents/{uid} doc (keyed by uid for canonical 1-to-1 linking)
  const residentDocRef = doc(db, "residents", uid);
  await setDoc(residentDocRef, {
    flat: (flat || "").toUpperCase(),
    flatNumber: (flat || "").toUpperCase(),
    owner,
    mobile: cleanMobile,
    block: block || "",
    blockId: blockId || "",
    floor: floor || "",
    charge: Number(charge) || 0,
    email: (email || "").trim(),
    familyMembers: familyMembers || "",
    remarks: remarks || "",
    status: "Active",
    garbageStatus: finalGarbageStatus,
    collectorId: collectorId || "",
    collectorName: collectorName || "",
    createdBy: createdBy || "",
    createdById: createdById || "",
    createdByName: createdByName || "",
    accessProvenance: {
      grantedByUid: createdById || "",
      grantedByName: createdByName || createdBy || "Administrator",
      grantedByRole: createdBy === "Collector" ? "collector" : createdBy?.toLowerCase()?.includes("committee") ? "committee" : "admin",
      grantedAt: new Date().toISOString(),
      channel: "manual_creation",
    },
    createdAt: serverTimestamp(),
    approvedAt: serverTimestamp(),
  });

  // Create users/{uid} role doc for login routing
  await setDoc(doc(db, "users", uid), {
    role: "resident",
    name: owner,
    phone: cleanMobile,
    email: (email || "").trim() || authEmail,
    flat: (flat || "").toUpperCase(),
    flatNumber: (flat || "").toUpperCase(),
    block: block || "",
    blockId: blockId || "",
    residentId: uid,
    status: "active",
    createdAt: serverTimestamp(),
  });

  // Write authLookup for fast, direct mobile login
  await writeAuthLookup(cleanMobile, authEmail, uid);

  // Sign out the secondary instance (admin's session untouched)
  await signOut(secondaryAuth);

  return uid;
}

export async function addResidentToFirestore(resident) {
  return await addDoc(residentRef, resident);
}

export async function updateResidentInFirestore(id, resident) {
  return await updateDoc(
    doc(db, "residents", id),
    resident
  );
}

export async function deleteResidentFromFirestore(id) {
  let residentData = null;
  // Fetch to see if there's a mobile to delete from authLookup
  try {
    const resDoc = await getDoc(doc(db, "residents", id));
    if (resDoc.exists()) {
      residentData = resDoc.data();
      if (residentData.mobile) {
        await deleteAuthLookup(residentData.mobile);
      }
      if (residentData.alternateMobile) {
        await deleteAuthLookup(residentData.alternateMobile);
      }
    }
  } catch (err) {
    console.warn("[deleteResident] authLookup cleanup error:", err.message);
  }

  // Also remove the users/{id} role doc to revoke login
  try {
    const uDoc = await getDoc(doc(db, "users", id));
    if (uDoc.exists()) {
      const uData = uDoc.data();
      if (uData.phone) await deleteAuthLookup(uData.phone);
    }
    await deleteDoc(doc(db, "users", id));
  } catch {
    // May not have a users doc if created without portal access
  }

  // Delete Firebase Auth account
  try {
    const phones = [residentData?.mobile, residentData?.alternateMobile].filter(Boolean);
    await deleteFirebaseAuthAccount({
      uid: id,
      phone: residentData?.mobile,
      email: residentData?.email,
      phones,
    });
  } catch (authErr) {
    console.warn("[deleteResident] Auth deletion error:", authErr.message);
  }

  // Synchronize garbageAccounts for this resident

  try {
    const accQ = query(collection(db, "garbageAccounts"), where("residentId", "==", id));
    const accSnap = await getDocs(accQ);
    for (const d of accSnap.docs) {
      // Check if account has any bills
      const billsQ = query(collection(db, "garbageBills"), where("accountId", "==", d.id));
      const billsSnap = await getDocs(billsQ);
      if (billsSnap.empty) {
        // No bills: safe to remove garbage account doc completely
        await deleteDoc(doc(db, "garbageAccounts", d.id));
      } else {
        // Has historical bills: set to inactive to preserve financial history
        await updateDoc(doc(db, "garbageAccounts", d.id), {
          status: "inactive",
          remarks: "Resident deleted - preserved for billing audit",
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    console.warn("[deleteResident] garbageAccounts cleanup error:", err.message);
  }

  return await deleteDoc(
    doc(db, "residents", id)
  );
}

/* ===============================
   Garbage Collection Status
================================ */

export async function updateGarbageStatus(residentId, status) {
  if (!residentId) return;

  const isNotParticipating =
    status === "not_participating" ||
    status === "inactive" ||
    status === "opted_out";

  // 1. Update canonical resident doc (charge is reset to 0 if not participating)
  const updatePayload = {
    garbageStatus: status,
    updatedAt: serverTimestamp(),
  };
  if (isNotParticipating) {
    updatePayload.charge = 0;
  }

  let canonicalDocId = residentId;
  const resDocRef = doc(db, "residents", residentId);
  const directSnap = await getDoc(resDocRef);

  if (directSnap.exists()) {
    if (!isNotParticipating && (!directSnap.data().charge || Number(directSnap.data().charge) <= 0)) {
      updatePayload.charge = 80;
    }
    await updateDoc(resDocRef, updatePayload);
  } else {
    // Try finding by userId or uid if residentId is an auth UID
    let foundDoc = null;
    const qUser = query(collection(db, "residents"), where("userId", "==", residentId));
    const snapUser = await getDocs(qUser);
    if (!snapUser.empty) {
      foundDoc = snapUser.docs[0];
    } else {
      const qUid = query(collection(db, "residents"), where("uid", "==", residentId));
      const snapUid = await getDocs(qUid);
      if (!snapUid.empty) {
        foundDoc = snapUid.docs[0];
      }
    }

    if (foundDoc) {
      canonicalDocId = foundDoc.id;
      if (!isNotParticipating && (!foundDoc.data().charge || Number(foundDoc.data().charge) <= 0)) {
        updatePayload.charge = 80;
      }
      await updateDoc(doc(db, "residents", canonicalDocId), updatePayload);
    }
  }

  // 2. Synchronize garbageAccounts collection
  try {
    const candidateIds = Array.from(new Set([residentId, canonicalDocId].filter(Boolean)));
    const accQ = query(collection(db, "garbageAccounts"), where("residentId", "in", candidateIds));
    const snap = await getDocs(accQ);
    const targetStatus = status === "participating" ? "active" : "inactive";

    if (!snap.empty) {
      for (const d of snap.docs) {
        await updateDoc(doc(db, "garbageAccounts", d.id), {
          status: targetStatus,
          updatedAt: serverTimestamp(),
        });
      }
    } else if (status === "participating") {
      // Auto-create account if resident opted in but has no account yet
      const resSnap = await getDoc(doc(db, "residents", canonicalDocId));
      const resData = resSnap.exists() ? resSnap.data() : {};
      await addDoc(collection(db, "garbageAccounts"), {
        residentId: canonicalDocId,
        monthlyCharge: Number(resData.charge || 80),
        collectorId: "",
        status: "active",
        joinedDate: new Date().toISOString().split("T")[0],
        remarks: "Auto-created on GC participation",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 3. If turning off participation, purge orphan payments and bills for this resident
    if (isNotParticipating) {
      try {
        const payQ = query(collection(db, "payments"), where("residentId", "==", residentId));
        const paySnap = await getDocs(payQ);
        for (const pd of paySnap.docs) {
          await deleteDoc(doc(db, "payments", pd.id));
        }

        const gbQ = query(collection(db, "garbageBills"), where("residentId", "==", residentId));
        const gbSnap = await getDocs(gbQ);
        for (const gd of gbSnap.docs) {
          await deleteDoc(doc(db, "garbageBills", gd.id));
        }

        const bQ = query(collection(db, "bills"), where("residentId", "==", residentId));
        const bSnap = await getDocs(bQ);
        for (const bd of bSnap.docs) {
          await deleteDoc(doc(db, "bills", bd.id));
        }
      } catch (cleanErr) {
        console.warn("[updateGarbageStatus] Could not clean orphan bills/payments:", cleanErr.message);
      }
    }
  } catch (err) {
    console.error("[updateGarbageStatus] Failed to sync garbageAccounts:", err);
  }
}

/* ===============================
   Family Member Accounts
================================ */

export async function addFamilyMemberAccount({
  parentResidentId,
  parentFlat,
  parentBlock,
  name,
  relation,
  phone,
  email,
  password,
  gender,
  age,
  emergencyContact,
  mustChangePassword,
}) {
  const cleanPhone = normalizeMobile(phone);
  const phoneError = validateMobile(cleanPhone);
  if (phoneError) {
    throw new Error(phoneError);
  }

  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  // Check duplicate in authLookup
  try {
    const lookupDoc = await getDoc(doc(db, "authLookup", cleanPhone));
    if (lookupDoc.exists()) {
      throw new Error("This mobile number is already registered.");
    }
  } catch (err) {
    if (err.message === "This mobile number is already registered.") throw err;
  }

  const authEmail = mobileToAuthEmail(cleanPhone);

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      authEmail,
      password
    );
  } catch (authError) {
    if (authError.code === "auth/email-already-in-use") {
      throw new Error("This mobile number is already registered.");
    }
    if (authError.code === "auth/weak-password") {
      throw new Error("Password is too weak. Use at least 6 characters.");
    }
    throw authError;
  }

  const uid = credential.user.uid;

  // Create users/{uid} role doc
  await setDoc(doc(db, "users", uid), {
    role: "family",
    name,
    phone: cleanPhone,
    email: (email || "").trim() || authEmail,
    relation: relation || "",
    parentResidentId: parentResidentId || "",
    flat: parentFlat || "",
    block: parentBlock || "",
    gender: gender || "",
    age: age || "",
    emergencyContact: Boolean(emergencyContact),
    mustChangePassword: Boolean(mustChangePassword),
    status: "active",
    createdAt: serverTimestamp(),
  });

  // Write mobile lookup
  await writeAuthLookup(cleanPhone, authEmail, uid);

  // Sign out secondary instance
  await signOut(secondaryAuth);

  return uid;
}

export async function updateFamilyMemberAccount(uid, updates) {
  if (!uid) throw new Error("Family member ID is required for update.");
  const userDocRef = doc(db, "users", uid);
  const oldSnap = await getDoc(userDocRef);
  const oldData = oldSnap.exists() ? oldSnap.data() : {};

  // If phone changed, update authLookup
  if (updates.phone && oldData.phone && updates.phone !== oldData.phone) {
    const cleanOld = normalizeMobile(oldData.phone);
    const cleanNew = normalizeMobile(updates.phone);
    await deleteAuthLookup(cleanOld);
    const newAuthEmail = mobileToAuthEmail(cleanNew);
    await writeAuthLookup(cleanNew, newAuthEmail, uid);
  }

  await updateDoc(userDocRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function removeFamilyMemberAccount(uid) {
  let memberPhone = null;
  let memberEmail = null;

  // Remove from authLookup if phone found
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const uData = userDoc.data();
      memberPhone = uData.phone || uData.mobile;
      memberEmail = uData.email;
      if (memberPhone) {
        await deleteAuthLookup(memberPhone);
      }
    }
  } catch (err) {
    console.warn("[removeFamilyMember] authLookup delete error:", err.message);
  }

  // Remove users/{uid} doc to revoke login
  try {
    await deleteDoc(doc(db, "users", uid));
  } catch {
    // Doc may not exist
  }

  // Delete Firebase Auth account
  try {
    await deleteFirebaseAuthAccount({
      uid,
      phone: memberPhone,
      email: memberEmail,
    });
  } catch (authErr) {
    console.warn("[removeFamilyMember] Auth delete error:", authErr.message);
  }
}


export function subscribeFamilyMembers(parentResidentId, callback) {
  const q = query(
    collection(db, "users"),
    where("role", "==", "family"),
    where("parentResidentId", "==", parentResidentId)
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] familyMembers listener error:", error.message);
  });
}

export function subscribeAllFamilyMembers(callback) {
  const q = query(
    collection(db, "users"),
    where("role", "==", "family")
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] allFamilyMembers listener error:", error.message);
  });
}
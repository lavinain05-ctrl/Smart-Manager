import {
  collection,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
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

const collectorRef = collection(db, "collectors");

export async function getCollectors() {
  const snapshot = await getDocs(collectorRef);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

// =============================
// Create Collector + Login Account
// =============================
//
// Creates the Firebase Auth account using Mobile Number + Password
// (via the secondary app instance, so the admin's session is untouched).
// Links users/{uid} and collectors/{uid} with matching uid.
export async function createCollectorAccount({
  name,
  mobile,
  area,
  vehicle,
  status,
  email,
  password,
  mustChangePassword = true,
  assignedModules = ["garbage"],
  assignedCampaigns = [],
}) {
  const cleanMobile = normalizeMobile(mobile);
  const mobileError = validateMobile(cleanMobile);
  if (mobileError) {
    throw new Error(mobileError);
  }

  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
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
      throw new Error("Password is too weak. Use at least 6 characters.");
    }
    throw authError;
  }

  const uid = credential.user.uid;

  // users/{uid} for role, permissions, and authentication
  await setDoc(doc(db, "users", uid), {
    role: "collector",
    name,
    phone: cleanMobile,
    email: (email || "").trim() || authEmail,
    area: area || "",
    vehicle: vehicle || "",
    status: status || "Active",
    mustChangePassword: mustChangePassword === true,
    assignedModules: Array.isArray(assignedModules) && assignedModules.length > 0 ? assignedModules : ["garbage"],
    assignedCampaigns: Array.isArray(assignedCampaigns) ? assignedCampaigns : [],
    createdAt: serverTimestamp(),
  });

  // collectors/{uid} for admin operations
  await setDoc(doc(db, "collectors", uid), {
    name,
    mobile: cleanMobile,
    area: area || "",
    vehicle: vehicle || "",
    status: status || "Active",
    email: (email || "").trim(),
    mustChangePassword: mustChangePassword === true,
    assignedModules: Array.isArray(assignedModules) && assignedModules.length > 0 ? assignedModules : ["garbage"],
    assignedCampaigns: Array.isArray(assignedCampaigns) ? assignedCampaigns : [],
    createdAt: serverTimestamp(),
  });

  // Write centralized auth lookup for mobile login
  await writeAuthLookup(cleanMobile, authEmail, uid);

  // Sign out secondary instance immediately
  await signOut(secondaryAuth);

  return uid;
}

export async function updateCollectorInFirestore(id, collector) {
  const cleanMobile = collector.mobile ? normalizeMobile(collector.mobile) : undefined;

  // Check if mobile changed or sync users/{id}
  try {
    const colDoc = await getDoc(doc(db, "collectors", id));
    if (colDoc.exists()) {
      const oldMobile = normalizeMobile(colDoc.data().mobile);
      if (cleanMobile && oldMobile && oldMobile !== cleanMobile) {
        await deleteAuthLookup(oldMobile);
        const authEmail = mobileToAuthEmail(cleanMobile);
        await writeAuthLookup(cleanMobile, authEmail, id);
      }
    }

    // Sync users/{id} with updated name, phone, modules, campaigns, area, vehicle, status
    await updateDoc(doc(db, "users", id), {
      ...(collector.name ? { name: collector.name } : {}),
      ...(cleanMobile ? { phone: cleanMobile } : {}),
      ...(collector.area !== undefined ? { area: collector.area } : {}),
      ...(collector.vehicle !== undefined ? { vehicle: collector.vehicle } : {}),
      ...(collector.status ? { status: collector.status } : {}),
      ...(collector.assignedModules !== undefined ? { assignedModules: collector.assignedModules } : {}),
      ...(collector.assignedCampaigns !== undefined ? { assignedCampaigns: collector.assignedCampaigns } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[updateCollector] users doc sync error:", err.message);
  }

  return await updateDoc(
    doc(db, "collectors", id),
    {
      ...collector,
      ...(cleanMobile ? { mobile: cleanMobile } : {}),
      updatedAt: serverTimestamp(),
    }
  );
}

export async function deleteCollectorFromFirestore(id) {
  let colData = null;
  try {
    const colDoc = await getDoc(doc(db, "collectors", id));
    if (colDoc.exists()) {
      colData = colDoc.data();
      if (colData.mobile) {
        await deleteAuthLookup(colData.mobile);
      }
    }
  } catch (err) {
    console.warn("[deleteCollector] authLookup cleanup error:", err.message);
  }

  try {
    const uDoc = await getDoc(doc(db, "users", id));
    if (uDoc.exists()) {
      const uData = uDoc.data();
      if (uData.phone) await deleteAuthLookup(uData.phone);
    }
    await deleteDoc(doc(db, "users", id));
  } catch {
    // doc may not exist
  }

  try {
    await deleteFirebaseAuthAccount({
      uid: id,
      phone: colData?.mobile,
      email: colData?.email,
    });
  } catch (authErr) {
    console.warn("[deleteCollector] Auth delete error:", authErr.message);
  }

  return await deleteDoc(
    doc(db, "collectors", id)
  );
}


export function subscribeCollectors(callback) {
  return onSnapshot(collectorRef, (snapshot) => {
    const collectors = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    callback(collectors);
  }, (error) => {
    console.error("[Firestore] collectors listener error:", error.message);
  });
}
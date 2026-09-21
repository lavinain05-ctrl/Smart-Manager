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
  status = "Active",
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

  const authEmail = mobileToAuthEmail(cleanMobile);

  // 1. Check duplicate in authLookup — with Self-Healing for orphaned records
  try {
    const lookupDoc = await getDoc(doc(db, "authLookup", cleanMobile));
    if (lookupDoc.exists()) {
      const existingData = lookupDoc.data();
      const existingUid = existingData.uid;

      // Check if this number belongs to an active resident or committee member
      let isLegitimateExistingUser = false;
      let existingRole = "user";

      if (existingUid) {
        try {
          const [uDoc, rDoc, commDoc] = await Promise.all([
            getDoc(doc(db, "users", existingUid)),
            getDoc(doc(db, "residents", existingUid)),
            getDoc(doc(db, "committee", existingUid)),
          ]);

          if (rDoc.exists()) {
            isLegitimateExistingUser = true;
            existingRole = "resident";
          } else if (commDoc.exists()) {
            isLegitimateExistingUser = true;
            existingRole = "committee member";
          } else if (uDoc.exists()) {
            const uData = uDoc.data();
            if (uData.role === "admin") {
              isLegitimateExistingUser = true;
              existingRole = "admin";
            } else if (uData.role === "collector") {
              // It's a collector profile — we will update/re-activate it below
              isLegitimateExistingUser = false;
            } else if (uData.status && uData.status.toLowerCase() !== "deleted") {
              isLegitimateExistingUser = true;
              existingRole = uData.role || "resident";
            }
          }
        } catch (checkErr) {
          console.warn("[createCollectorAccount] Existing profile check warning:", checkErr.message);
        }
      }

      if (isLegitimateExistingUser) {
        throw new Error(`This mobile number (${cleanMobile}) is already registered to an active ${existingRole}.`);
      }

      // If it's an orphaned lookup record (e.g. from manual Firebase Console deletion), clean it up!
      console.warn("[createCollectorAccount] Cleaning up orphaned authLookup for:", cleanMobile);
      await deleteDoc(doc(db, "authLookup", cleanMobile)).catch(() => {});
    }
  } catch (err) {
    if (err.message?.includes("already registered to an active")) {
      throw err;
    }
  }

  let uid = null;

  try {
    // 2. Create Firebase Auth user on secondaryAuth
    let credential = null;
    try {
      credential = await createUserWithEmailAndPassword(
        secondaryAuth,
        authEmail,
        password
      );
      uid = credential.user.uid;
    } catch (authError) {
      if (authError.code === "auth/email-already-in-use") {
        console.warn("[createCollectorAccount] Auth email already in use, attempting self-healing cleanup or password sync...");
        
        // Step A: Attempt to delete stale/orphaned Auth account via deleteFirebaseAuthAccount
        let deletedOldAuth = false;
        try {
          const delRes = await deleteFirebaseAuthAccount({
            phone: cleanMobile,
            email: authEmail,
          });
          if (delRes?.success) {
            deletedOldAuth = true;
            console.log("[createCollectorAccount] Old Auth account deleted. Retrying creation...");
            // Retry creation now that old auth is removed
            credential = await createUserWithEmailAndPassword(
              secondaryAuth,
              authEmail,
              password
            );
            uid = credential.user.uid;
          }
        } catch (delErr) {
          console.warn("[createCollectorAccount] Auto-delete of stale auth failed:", delErr.message);
        }

        // Step B: If delete wasn't possible, try signing in with the provided password to re-link
        if (!deletedOldAuth && !credential) {
          try {
            const signInRes = await signInWithEmailAndPassword(
              secondaryAuth,
              authEmail,
              password
            );
            uid = signInRes.user.uid;
            console.log("[createCollectorAccount] Successfully re-linked existing Auth account UID:", uid);
          } catch (signInErr) {
            console.warn("[createCollectorAccount] Sign-in with provided password failed:", signInErr.code);
            throw new Error(
              `This mobile number (${cleanMobile}) already has a login account in Firebase. ` +
              `If you previously deleted users in Firebase Console, please reset their password or remove the user from Firebase Auth.`
            );
          }
        }
      } else if (authError.code === "auth/weak-password") {
        throw new Error("Password is too weak. Use at least 6 characters.");
      } else {
        throw authError;
      }
    }

    if (!uid) {
      throw new Error("Failed to initialize collector authentication ID.");
    }

    // 3. Write users/{uid} for authentication, role, and module permissions
    await setDoc(doc(db, "users", uid), {
      role: "collector",
      name: name.trim(),
      phone: cleanMobile,
      email: (email || "").trim() || authEmail,
      area: area || "",
      vehicle: vehicle || "",
      status: status || "Active",
      mustChangePassword: mustChangePassword === true,
      assignedModules: Array.isArray(assignedModules) && assignedModules.length > 0 ? assignedModules : ["garbage"],
      assignedCampaigns: Array.isArray(assignedCampaigns) ? assignedCampaigns : [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // 4. Write collectors/{uid} for admin operations
    await setDoc(doc(db, "collectors", uid), {
      name: name.trim(),
      mobile: cleanMobile,
      area: area || "",
      vehicle: vehicle || "",
      status: status || "Active",
      email: (email || "").trim(),
      mustChangePassword: mustChangePassword === true,
      assignedModules: Array.isArray(assignedModules) && assignedModules.length > 0 ? assignedModules : ["garbage"],
      assignedCampaigns: Array.isArray(assignedCampaigns) ? assignedCampaigns : [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // 5. Write centralized auth lookup for mobile login
    await writeAuthLookup(cleanMobile, authEmail, uid);

    return uid;
  } finally {
    // 6. ALWAYS sign out secondary instance immediately in finally block
    try {
      await signOut(secondaryAuth);
    } catch {
      // secondary instance cleanup
    }
  }
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
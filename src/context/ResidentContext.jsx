import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";

import {
  subscribeResidents,
  addResidentToFirestore,
  addResidentWithAccount,
  updateResidentInFirestore,
  updateGarbageStatus,
} from "../services/residentService";

import {
  normalizeMobile,
  validateMobile,
  writeAuthLookup,
  deleteAuthLookup,
  mobileToAuthEmail,
} from "../services/authService";

import { db, secondaryAuth } from "../firebase/firebase";
import { deleteUserAccount } from "../services/accountDeletionService";
import { useAuth } from "./AuthContext";

const ResidentContext = createContext();

export function ResidentProvider({ children }) {
  const [residents, setResidents] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    // Only subscribe when user has an approved role (not pending)
    if (!user || user.role === "pending_registration" || user.status === "pending" || user.status === "rejected") {
      setResidents([]);
      return;
    }

    const unsubscribe = subscribeResidents((data) => {
      setResidents(data);

      // Self-heal and synchronize authLookup for loaded residents so password recovery works instantly
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((r) => {
          const clean = normalizeMobile(r.mobile);
          if (clean && clean.length === 10) {
            const em = (r.email || r.personalEmail || "").trim();
            const fl = r.flatNumber || r.flat || "";
            const ow = r.owner || r.name || "";
            writeAuthLookup(
              clean,
              mobileToAuthEmail(clean),
              r.id || r.uid,
              em,
              fl,
              ow
            ).catch(() => {});
          }
        });
      }
    });

    return () => unsubscribe();
  }, [user?.uid, user?.role, user?.status]);

  // Check for duplicate block + flat
  function isDuplicateFlat(block, flat, excludeId) {
    return residents.some(
      (r) =>
        r.id !== excludeId &&
        r.block?.toLowerCase() === (block || "").toLowerCase() &&
        (r.flatNumber || r.flat)?.toLowerCase() === (flat || "").toLowerCase()
    );
  }

  // Check for duplicate mobile
  function isDuplicateMobile(mobile, excludeId) {
    const clean = normalizeMobile(mobile);
    if (!clean) return false;
    return residents.some(
      (r) => r.id !== excludeId && normalizeMobile(r.mobile) === clean
    );
  }

  async function addResident(data) {
    try {
      const cleanMobile = normalizeMobile(data.mobile);
      const cleanPortalMobile = normalizeMobile(data.portalMobile || data.mobile);

      // Validate mobile format
      const mobError = validateMobile(cleanMobile);
      if (mobError) {
        toast.error(mobError);
        return false;
      }

      // Validate duplicates
      if (isDuplicateFlat(data.block, data.flat)) {
        toast.error(`Flat ${data.flat} in Block ${data.block} already exists.`);
        return false;
      }
      if (isDuplicateMobile(cleanMobile)) {
        toast.error(`Mobile number ${cleanMobile} is already registered.`);
        return false;
      }

      const isParticipating = data.garbageStatus === "participating" ||
        data.createdBy === "Collector" ||
        Boolean(data.collectorId) ||
        (Number(data.charge) > 0 && data.garbageStatus !== "not_participating");

      const finalGarbageStatus = isParticipating ? "participating" : (data.garbageStatus || "not_participating");

      // If portal login enabled + password provided, create with auth account
      if (data.enablePortalLogin && data.password) {
        const uid = await addResidentWithAccount({
          ...data,
          garbageStatus: finalGarbageStatus,
          mobile: cleanPortalMobile || cleanMobile,
          charge: Number(data.charge) || 0,
        });

        // Ensure garbageAccount is created if participating (prevent duplicate creation)
        if (isParticipating && uid) {
          try {
            const existingQ = query(
              collection(db, "garbageAccounts"),
              where("residentId", "==", uid)
            );
            const existingSnap = await getDocs(existingQ);

            if (existingSnap.empty) {
              await addDoc(collection(db, "garbageAccounts"), {
                residentId: uid,
                residentName: data.owner || "",
                flat: (data.flat || "").toUpperCase(),
                block: data.block || "",
                mobile: cleanMobile,
                monthlyCharge: Number(data.charge) || 0,
                collectorId: data.collectorId || "",
                collectorName: data.collectorName || "",
                status: "active",
                joinedDate: new Date().toISOString().split("T")[0],
                remarks: data.createdBy ? `Created by ${data.createdBy}` : "",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (gErr) {
            console.warn("Could not create garbageAccount:", gErr.message);
          }
        }


        toast.success("Resident Added with Portal Login");
      } else {
        // Standard Firestore record without portal login credentials
        const docData = {
          flat: (data.flat || "").toUpperCase(),
          flatNumber: (data.flat || "").toUpperCase(),
          owner: data.owner,
          mobile: cleanMobile,
          block: data.block,
          blockId: data.blockId || "",
          floor: data.floor || "",
          charge: Number(data.charge) || 0,
          email: (data.email || "").trim(),
          familyMembers: data.familyMembers || "",
          remarks: data.remarks || "",
          status: data.status || "Active",
          garbageStatus: finalGarbageStatus,
          createdAt: serverTimestamp(),
          approvedAt: serverTimestamp(),
        };

        // Collector metadata (if present)
        if (data.createdBy) docData.createdBy = data.createdBy;
        if (data.createdById) docData.createdById = data.createdById;
        if (data.createdByName) docData.createdByName = data.createdByName;
        if (data.collectorId) docData.collectorId = data.collectorId;
        if (data.collectorName) docData.collectorName = data.collectorName;

        const newDocRef = await addResidentToFirestore(docData);

        // Ensure garbageAccount is created if participating
        if (isParticipating && newDocRef?.id) {
          try {
            await addDoc(collection(db, "garbageAccounts"), {
              residentId: newDocRef.id,
              residentName: docData.owner || "",
              flat: docData.flat || "",
              block: docData.block || "",
              mobile: docData.mobile || "",
              monthlyCharge: Number(docData.charge) || 0,
              collectorId: data.collectorId || "",
              collectorName: data.collectorName || "",
              status: "active",
              joinedDate: new Date().toISOString().split("T")[0],
              remarks: data.createdBy ? `Created by ${data.createdBy}` : "",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (gErr) {
            console.warn("Could not create garbageAccount:", gErr.message);
          }
        }

        toast.success("Resident Added Successfully");
      }

      return true;
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to add resident");
      return false;
    }
  }

  async function updateResident(id, data) {
    try {
      const cleanMobile = normalizeMobile(data.mobile);
      const currentResident = residents.find((r) => r.id === id);
      const oldMobile = normalizeMobile(currentResident?.mobile || "");

      // Validate mobile format
      const mobError = validateMobile(cleanMobile);
      if (mobError) {
        toast.error(mobError);
        return false;
      }

      // Validate duplicates (exclude current)
      if (isDuplicateFlat(data.block, data.flat, id)) {
        toast.error(`Flat ${data.flat} in Block ${data.block} already exists.`);
        return false;
      }
      if (isDuplicateMobile(cleanMobile, id)) {
        toast.error(`Mobile number ${cleanMobile} is already registered.`);
        return false;
      }

      // Update resident document in Firestore
      await updateResidentInFirestore(id, {
        flat: (data.flat || "").toUpperCase(),
        flatNumber: (data.flat || "").toUpperCase(),
        owner: data.owner,
        mobile: cleanMobile,
        block: data.block,
        blockId: data.blockId || "",
        floor: data.floor || "",
        charge: Number(data.charge) || 0,
        email: (data.email || "").trim(),
        familyMembers: data.familyMembers || "",
        remarks: data.remarks || "",
        updatedAt: serverTimestamp(),
      });

      // Synchronize garbage participation if status or garbageStatus changed
      if (data.garbageStatus) {
        await updateGarbageStatus(id, data.garbageStatus);
      } else if (data.status === "Inactive" || data.status === "inactive") {
        await updateGarbageStatus(id, "not_participating");
      }

      // Synchronize mobile change with users doc and authLookup
      if (oldMobile && cleanMobile !== oldMobile) {
        await deleteAuthLookup(oldMobile);
      }

      // Check if user has an existing users/{id} role doc or if portal login was newly enabled
      const userDocRef = doc(db, "users", id);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const uData = userDocSnap.data();
        const authEmail = uData.email || mobileToAuthEmail(cleanMobile);
        await updateDoc(userDocRef, {
          name: data.owner,
          phone: cleanMobile,
          flat: (data.flat || "").toUpperCase(),
          flatNumber: (data.flat || "").toUpperCase(),
          block: data.block,
          blockId: data.blockId || "",
          updatedAt: serverTimestamp(),
        });
        await writeAuthLookup(cleanMobile, authEmail, id, data.email, data.flat, data.owner);
      } else if (data.enablePortalLogin && data.password) {
        // Enabling portal login for an existing resident who didn't have one
        const authEmail = mobileToAuthEmail(cleanMobile);
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, data.password);
          const newUid = cred.user.uid;
          await signOut(secondaryAuth);

          await setDoc(doc(db, "users", id), {
            role: "resident",
            name: data.owner,
            phone: cleanMobile,
            email: (data.email || "").trim() || authEmail,
            flat: (data.flat || "").toUpperCase(),
            flatNumber: (data.flat || "").toUpperCase(),
            block: data.block,
            blockId: data.blockId || "",
            residentId: id,
            status: "active",
            createdAt: serverTimestamp(),
          });
          await writeAuthLookup(cleanMobile, authEmail, id, data.email, data.flat, data.owner);
          toast.success("Portal login enabled for resident");
        } catch (credErr) {
          console.warn("[updateResident] Could not create portal auth:", credErr.message);
        }
      }

      toast.success("Resident Updated Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to update resident");
      return false;
    }
  }

  async function deleteResident(id, options = {}) {
    try {
      const resident = residents.find((r) => r.id === id);
      const results = await deleteUserAccount({
        userId: id,
        userName: resident?.owner || "Unknown",
        userPhone: resident?.mobile || "",
        userEmail: resident?.email || "",
        userRole: "resident",
        userFlat: resident?.flat,
        userBlock: resident?.block,
        familyAction: options.familyAction || "delete",
        deletionReason: options.reason || "",
        adminName: options.adminName || "Admin",
        adminUid: options.adminUid || "",
      });

      if (results.success) {
        toast.success("Account, registered phone, and login details deleted from Firebase");
      } else {
        toast.error("Deletion completed with errors");
      }

      return results;
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete account");
      return { success: false, errors: [error.message] };
    }
  }


  return (
    <ResidentContext.Provider
      value={{
        residents,
        addResident,
        updateResident,
        deleteResident,
      }}
    >
      {children}
    </ResidentContext.Provider>
  );
}

export function useResidents() {
  return useContext(ResidentContext);
}
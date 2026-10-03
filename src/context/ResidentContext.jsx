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
import {
  normalizePlotNumber,
  normalizeFloor,
  normalizeUnitNumber,
  generatePropertyId,
  formatPropertyDisplay,
} from "../services/propertyService";

const ResidentContext = createContext();

export function ResidentProvider({ children }) {
  const [residents, setResidents] = useState(() => {
    try {
      const cached = sessionStorage.getItem("rwa_cached_residents");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem("rwa_cached_residents");
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });
  const { user } = useAuth();

  useEffect(() => {
    // Only subscribe when user has an approved role (not pending)
    if (!user || user.role === "pending_registration" || user.status === "pending" || user.status === "rejected") {
      setResidents([]);
      setLoading(false);
      try {
        sessionStorage.removeItem("rwa_cached_residents");
      } catch {}
      return;
    }

    const unsubscribe = subscribeResidents((data) => {
      setResidents(data || []);
      setLoading(false);
      try {
        sessionStorage.setItem("rwa_cached_residents", JSON.stringify(data || []));
      } catch {}
    });

    return () => unsubscribe();
  }, [user?.uid, user?.role, user?.status]);

  // Canonical Property Duplicate Validation:
  // Evaluates block, plot, floor, unit according to Phase 3 & Phase 12 requirements.
  // Respects that Owners and Tenants can share the same flat/property without error.
  function checkResidentPropertyDuplicate({
    blockId,
    block,
    plotNumber,
    flat,
    floor,
    unitNumber,
    personType = "OWNER",
    excludeId = null,
  }) {
    const normPlot = normalizePlotNumber(plotNumber || flat || "");
    const floorObj = normalizeFloor(floor);
    const normUnit = normalizeUnitNumber(unitNumber || "");
    const targetPersonType = (personType || "OWNER").toUpperCase();

    if (!normPlot) return { isDuplicate: false };

    // Find other residents on the exact same block + plot + floor
    const sameFloorResidents = residents.filter((r) => {
      if (r.id === excludeId) return false;
      const rBlockId = r.blockId || "";
      const rBlockName = (r.block || "").toLowerCase();
      const blockMatches = (blockId && rBlockId === blockId) ||
        (block && rBlockName === (block || "").toLowerCase());
      if (!blockMatches) return false;

      const rPlot = normalizePlotNumber(r.plotNumber || r.flat || r.flatNumber || "");
      if (rPlot !== normPlot) return false;

      const rFloor = normalizeFloor(r.floor).code;
      return rFloor === floorObj.code;
    });

    if (sameFloorResidents.length === 0) {
      return { isDuplicate: false };
    }

    // If target has NO unit number:
    if (!normUnit) {
      const existingSingleUnitRes = sameFloorResidents.find((r) => {
        const rUnit = normalizeUnitNumber(r.unitNumber);
        return !rUnit;
      });

      if (existingSingleUnitRes) {
        const existingPersonType = (existingSingleUnitRes.personType || "OWNER").toUpperCase();
        const isRentalOrFamily = (t) => t === "TENANT" || t === "RENTED" || t === "FAMILY_MEMBER";
        // Allow Owner and Rented/Tenant or Family sharing the same property
        if (targetPersonType !== existingPersonType && (isRentalOrFamily(targetPersonType) || isRentalOrFamily(existingPersonType))) {
          return { isDuplicate: false, sharedProperty: true };
        }
        return {
          isDuplicate: true,
          message: "This plot and floor already have a registered property without a flat number. Please select the existing property or enter the correct flat number.",
        };
      }

      // If existing residents have unit numbers, blank unit on multi-unit floor is rejected
      return {
        isDuplicate: true,
        message: "This floor has multiple registered flats. Please enter a specific flat number (e.g. Flat 1, Flat 2).",
      };
    }

    // Target HAS a unit number:
    const matchingUnitRes = sameFloorResidents.find((r) => {
      return normalizeUnitNumber(r.unitNumber) === normUnit;
    });

    if (matchingUnitRes) {
      const existingPersonType = (matchingUnitRes.personType || "OWNER").toUpperCase();
      const isRentalOrFamily = (t) => t === "TENANT" || t === "RENTED" || t === "FAMILY_MEMBER";
      // Allow Owner and Rented/Tenant or Family sharing the same unit
      if (targetPersonType !== existingPersonType && (isRentalOrFamily(targetPersonType) || isRentalOrFamily(existingPersonType))) {
        return { isDuplicate: false, sharedProperty: true };
      }

      const displayBlock = block || matchingUnitRes.block || "this block";
      return {
        isDuplicate: true,
        message: `This property is already registered: Block ${displayBlock}, Plot ${normPlot}, ${floorObj.label}, Unit ${normUnit}. Please select the existing property or contact the RWA admin.`,
      };
    }

    return { isDuplicate: false };
  }

  // Backward compatibility wrapper
  function isDuplicateFlat(block, flat, excludeId) {
    const check = checkResidentPropertyDuplicate({
      block,
      flat,
      excludeId,
    });
    return check.isDuplicate;
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

      // Validate property duplicates with canonical identity
      const propCheck = checkResidentPropertyDuplicate({
        blockId: data.blockId,
        block: data.block,
        plotNumber: data.plotNumber || data.flat,
        flat: data.flat,
        floor: data.floor,
        unitNumber: data.unitNumber,
        personType: data.personType || "OWNER",
      });
      if (propCheck.isDuplicate) {
        toast.error(propCheck.message);
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
        const normPlot = normalizePlotNumber(data.plotNumber || data.flat);
        const floorObj = normalizeFloor(data.floor);
        const normUnit = normalizeUnitNumber(data.unitNumber || "");
        const displayFlat = normUnit ? `${normPlot}-${normUnit}` : normPlot;
        const normPersonType = (data.personType || "OWNER").toUpperCase();
        const canonicalPropertyId = data.propertyId || (data.blockId && normPlot ? generatePropertyId({
          blockId: data.blockId,
          plotNumber: normPlot,
          floor: floorObj.code,
          unitNumber: normUnit,
        }) : "");

        const docData = {
          flat: (displayFlat || data.flat || "").toUpperCase(),
          flatNumber: (displayFlat || data.flat || "").toUpperCase(),
          plotNumber: normPlot || (data.flat || "").toUpperCase(),
          floor: floorObj.label || data.floor || "Ground Floor",
          floorCode: floorObj.code,
          unitNumber: normUnit,
          personType: normPersonType,
          propertyId: canonicalPropertyId,
          owner: data.owner || data.name || "",
          name: data.owner || data.name || "",
          mobile: cleanMobile,
          block: data.block || "",
          blockId: data.blockId || "",
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
      const propCheck = checkResidentPropertyDuplicate({
        blockId: data.blockId,
        block: data.block,
        plotNumber: data.plotNumber || data.flat,
        flat: data.flat,
        floor: data.floor,
        unitNumber: data.unitNumber,
        personType: data.personType || currentResident?.personType || "OWNER",
        excludeId: id,
      });
      if (propCheck.isDuplicate) {
        toast.error(propCheck.message);
        return false;
      }
      if (isDuplicateMobile(cleanMobile, id)) {
        toast.error(`Mobile number ${cleanMobile} is already registered.`);
        return false;
      }

      const normPlot = normalizePlotNumber(data.plotNumber || data.flat || "");
      const floorObj = normalizeFloor(data.floor);
      const normUnit = normalizeUnitNumber(data.unitNumber || "");
      const normPersonType = (data.personType || currentResident?.personType || "OWNER").toUpperCase();
      const displayFlat = normUnit ? `${normPlot}-${normUnit}` : normPlot || (data.flat || "").toUpperCase();

      const canonicalPropertyId = data.propertyId || currentResident?.propertyId || (data.blockId && normPlot ? generatePropertyId({
        blockId: data.blockId,
        plotNumber: normPlot,
        floor: floorObj.code,
        unitNumber: normUnit,
      }) : "");

      // Update resident document in Firestore
      await updateResidentInFirestore(id, {
        propertyId: canonicalPropertyId,
        plotNumber: normPlot,
        floor: floorObj.label,
        floorCode: floorObj.code,
        unitNumber: normUnit,
        personType: normPersonType,
        flat: displayFlat,
        flatNumber: displayFlat,
        owner: data.owner,
        mobile: cleanMobile,
        block: data.block,
        blockId: data.blockId || "",
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
        loading,
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
  const ctx = useContext(ResidentContext);
  return ctx || {
    residents: [],
    loading: false,
    addResident: async () => {},
    updateResident: async () => {},
    deleteResident: async () => {},
  };
}
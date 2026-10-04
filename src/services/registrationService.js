import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  writeBatch,
  updateDoc,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
} from "firebase/auth";

import { auth, db, checkRegistrationAvailabilityFn } from "../firebase/firebase";
import {
  mobileToAuthEmail,
  writeAuthLookup,
  normalizeMobile,
  validateMobile,
} from "./authService";
import {
  addGarbageAccount,
  getGarbageAccountByResidentId,
} from "./garbageService";
import { linkResidentToFlat } from "./blockFlatService";
import { logActivity } from "./activityLogService";
import {
  generatePropertyId,
  normalizeFloor,
  normalizePlotNumber,
  normalizeUnitNumber,
  createProperty,
  linkOccupantToProperty,
  formatPropertyDisplay,
} from "./propertyService";
import { notifyAdmin } from "./notificationService";

const requestsRef = collection(db, "registrationRequests");

// =============================
// Flat Number Format Validation
// =============================
// Accepts any alphanumeric string with optional separators
// e.g. A101, B-201, D 571, 101, 12A, B/202
// Rejects: empty string, only spaces, special-only strings

const FLAT_NUMBER_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s\-./]*$/;

/**
 * Validate flat number format.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateFlatNumber(flat) {
  const trimmed = (flat || "").trim();
  if (!trimmed) {
    return "Please enter your flat number.";
  }
  if (!FLAT_NUMBER_REGEX.test(trimmed)) {
    return "Flat number must start with a letter or number (e.g. A101, B-201, 571).";
  }
  return null; // valid
}

/**
 * Normalize flat number: trim + uppercase.
 * e.g. " a101 " → "A101"
 */
export function normalizeFlatNumber(flat) {
  return (flat || "").trim().toUpperCase();
}

// =============================
// Mobile Number Validation (re-exported from authService)
// =============================

export { normalizeMobile, validateMobile } from "./authService";

// =============================
// Pre-Registration Availability Check
// =============================
// Calls the Cloud Function to perform server-side duplicate detection
// BEFORE creating a Firebase Auth account.

/**
 * Check if mobile + block + flat combination is available for registration.
 *
 * Returns: { available: true } or { available: false, reason: string }
 * Reason codes: "mobile_taken", "mobile_pending", "flat_occupied", "flat_pending"
 *
 * This call does NOT require authentication — it runs server-side
 * and never exposes existing user data.
 */
export async function checkAvailability(mobile, blockId, flatNumber, floor) {
  try {
    const result = await checkRegistrationAvailabilityFn({
      mobile,
      blockId,
      flatNumber,
      floor: floor || "",
    });
    return result.data;
  } catch (error) {
    // If the Cloud Function is not deployed yet, fall back gracefully.
    // Log the error but don't block registration entirely.
    console.error("[checkAvailability] Cloud Function error:", error.message);

    // If it's a functions-not-found or unauthenticated error, it means
    // the function hasn't been deployed yet. Let registration proceed
    // and rely on Firebase Auth's built-in email-in-use check.
    if (
      error.code === "functions/not-found" ||
      error.code === "functions/unavailable" ||
      error.message?.includes("not found")
    ) {
      console.warn("[checkAvailability] Cloud Function not deployed — skipping pre-check");
      return { available: true, fallback: true };
    }

    // For explicit validation errors from the function, rethrow
    if (error.code === "functions/invalid-argument") {
      throw error;
    }

    // For other errors, let the registration proceed with client-side checks
    console.warn("[checkAvailability] Falling back to client-side checks");
    return { available: true, fallback: true };
  }
}

/**
 * Map availability reason codes to user-facing error messages.
 */
export function getAvailabilityErrorMessage(reason) {
  switch (reason) {
    case "mobile_taken":
    case "mobile_pending":
      return "This mobile number is already registered.";
    case "flat_occupied":
      return "This flat is already registered for this floor.";
    case "flat_pending":
      return "This flat on this floor already has a pending registration.";
    default:
      return "This registration cannot be completed. Please contact the admin.";
  }
}

// =============================
// Self-Register — Full Validation Flow
// =============================
// Validation order:
// 1. Validate mobile format
// 2. Normalize mobile
// 3. Validate flat format
// 4. Normalize flat
// 5. Validate block selection
// 6. Check availability (Cloud Function)
// 7. Create Firebase Auth account
// 8. Write registrationRequests doc

export async function submitRegistration({
  name,
  fatherHusbandName,
  plotNumber,
  floor,
  unitNumber,
  flat,
  block,
  blockId,
  personType = "OWNER",
  propertyId = "",
  mobile,
  alternateMobile,
  email,
  password,
  dob,
  gender,
  occupation,
  emergencyContact,
  garbageParticipation,
}) {
  // --- Step 1: Validate mobile format ---
  const mobileError = validateMobile(mobile);
  if (mobileError) {
    throw new Error(mobileError);
  }

  // --- Step 2: Normalize mobile ---
  const normalizedMobile = normalizeMobile(mobile);

  // --- Step 3: Validate block selection ---
  if (!blockId) {
    throw new Error("Please select a block.");
  }

  // --- Step 4: Validate plot number ---
  const resolvedPlot = (plotNumber || flat || "").trim();
  if (!resolvedPlot) {
    throw new Error("Please enter your plot number.");
  }
  const normalizedPlot = normalizePlotNumber(resolvedPlot);

  // --- Step 5: Validate floor ---
  const normalizedFloorObj = normalizeFloor(floor);
  if (!floor) {
    throw new Error("Please select or enter the floor number.");
  }

  // --- Step 6: Normalize unit number ---
  const normalizedUnit = normalizeUnitNumber(unitNumber || "");

  // Legacy flat string for backward compatibility
  const normalizedFlatDisplay = normalizedUnit
    ? `${normalizedPlot}-${normalizedUnit}`
    : normalizedPlot;

  // Canonical property identity
  const canonicalPropertyId = propertyId || generatePropertyId({
    blockId,
    plotNumber: normalizedPlot,
    floor: normalizedFloorObj.code,
    unitNumber: normalizedUnit,
  });

  // --- Step 7: Check availability via Cloud Function (with graceful Spark fallback) ---
  const availability = await checkAvailability(normalizedMobile, blockId, normalizedFlatDisplay, normalizedFloorObj.label);

  if (!availability.available) {
    throw new Error(getAvailabilityErrorMessage(availability.reason));
  }

  // --- Step 8: Validate optional email ---
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  // --- Step 8b: Validate garbage participation choice (compulsory) ---
  if (!garbageParticipation || (garbageParticipation !== "participating" && garbageParticipation !== "not_participating")) {
    throw new Error("Please select your choice for the Garbage Collection Service.");
  }

  // --- Step 9: Create Firebase Auth account using pseudo-email from Mobile ---
  const authEmail = mobileToAuthEmail(normalizedMobile);
  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, authEmail, password);
  } catch (authError) {
    if (authError.code === "auth/email-already-in-use") {
      throw new Error("This mobile number is already registered. Please login or contact Admin.");
    }
    if (authError.code === "auth/weak-password") {
      throw new Error("Password is too weak. Use at least 6 characters.");
    }
    throw authError;
  }

  const uid = credential.user.uid;

  // --- Step 10: Write registration request doc ---
  try {
    await setDoc(doc(db, "registrationRequests", uid), {
      uid,
      name: (name || "").trim(),
      fatherHusbandName: (fatherHusbandName || "").trim(),
      email: normalizedEmail,
      mobile: normalizedMobile,
      alternateMobile: alternateMobile || "",
      // Canonical Property Identity fields
      propertyId: canonicalPropertyId,
      plotNumber: normalizedPlot,
      floor: normalizedFloorObj.label,
      floorCode: normalizedFloorObj.code,
      unitNumber: normalizedUnit,
      personType: (personType || "OWNER").toUpperCase(),
      // Legacy fields for backward compatibility
      flat: normalizedFlatDisplay,
      flatNumber: normalizedFlatDisplay,
      block: block || "",
      blockId: blockId || "",
      dob: dob || "",
      gender: gender || "",
      occupation: (occupation || "").trim(),
      emergencyContact: emergencyContact || "",
      garbageParticipation: garbageParticipation || "not_participating",
      status: "pending",
      registeredAt: serverTimestamp(),
    });

    // --- Step 11: Write mobile→auth email lookup for login ---
    await writeAuthLookup(normalizedMobile, authEmail, uid, normalizedEmail);

    // --- Step 12: Active Notification for Admin ---
    try {
      await notifyAdmin({
        title: "New Resident Registration 👤",
        message: `${name?.trim() || "New resident"} has submitted a registration for Flat ${normalizedFlatDisplay || flat || "—"} (${block || "—"}).`,
        type: "registration",
        link: "/admin/registrations",
      });
    } catch (notifErr) {
      console.warn("[Registration] Admin notification warning:", notifErr.message);
    }

    return uid;
  } catch (firestoreError) {
    // Firestore write failed — clean up orphaned auth account
    console.error("[Registration] Firestore write failed:", firestoreError.message);
    try {
      await credential.user.delete();
    } catch {
      // Auth cleanup failed — admin will handle
    }
    throw firestoreError;
  }
}

/**
 * Collector-created registration request (Phase 5C):
 * Collectors visiting the field submit a registration request for admin review.
 * Does NOT auto-approve.
 */
export async function submitCollectorRegistrationRequest({
  name,
  fatherHusbandName = "",
  plotNumber,
  floor,
  unitNumber = "",
  block,
  blockId,
  personType = "OWNER",
  propertyId = "",
  mobile,
  alternateMobile = "",
  email = "",
  remarks = "",
  garbageParticipation = "participating",
  collectorId = "",
  collectorName = "",
}) {
  const cleanMobile = normalizeMobile(mobile);
  const mobileError = validateMobile(cleanMobile);
  if (mobileError) throw new Error(mobileError);

  if (!blockId) throw new Error("Please select a block.");
  const normPlot = normalizePlotNumber(plotNumber);
  if (!normPlot) throw new Error("Please enter the plot number.");

  const floorObj = normalizeFloor(floor);
  const normUnit = normalizeUnitNumber(unitNumber);
  const displayFlat = normUnit ? `${normPlot}-${normUnit}` : normPlot;

  const canonicalPropertyId = propertyId || generatePropertyId({
    blockId,
    plotNumber: normPlot,
    floor: floorObj.code,
    unitNumber: normUnit,
  });

  const requestRef = await addDoc(requestsRef, {
    name: (name || "").trim(),
    fatherHusbandName: (fatherHusbandName || "").trim(),
    mobile: cleanMobile,
    alternateMobile: alternateMobile || "",
    email: (email || "").trim().toLowerCase(),
    propertyId: canonicalPropertyId,
    plotNumber: normPlot,
    floor: floorObj.label,
    floorCode: floorObj.code,
    unitNumber: normUnit,
    personType: (personType || "OWNER").toUpperCase(),
    flat: displayFlat,
    flatNumber: displayFlat,
    block: block || "",
    blockId: blockId || "",
    garbageParticipation: garbageParticipation || "participating",
    remarks: remarks || "",
    submittedByRole: "collector",
    collectorId: collectorId || "",
    collectorName: collectorName || "",
    status: "pending",
    registeredAt: serverTimestamp(),
  });

  try {
    await notifyAdmin({
      title: "New Registration (by Collector) 👤",
      message: `${collectorName || "Collector"} submitted registration for ${name?.trim() || "Resident"} (Flat ${displayFlat}).`,
      type: "registration",
      link: "/admin/registrations",
    });
  } catch (notifErr) {
    console.warn("[Registration] Admin notification warning:", notifErr.message);
  }

  return requestRef.id;
}

// =============================
// Admin: Subscribe all registration requests
// =============================

export function subscribeRegistrationRequests(callback) {
  const q = query(requestsRef, orderBy("registeredAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] registrationRequests listener error:", error.message);
  });
}

// =============================
// Admin: Subscribe pending only
// =============================

export function subscribePendingRegistrations(callback) {
  const q = query(
    requestsRef,
    where("status", "==", "pending"),
    orderBy("registeredAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  }, (error) => {
    console.error("[Firestore] pendingRegistrations listener error:", error.message);
  });
}

// =============================
// Admin: Approve Registration
// Creates users/{uid} + residents/{uid}
// =============================

export async function approveRegistration(requestId, request, charge, overrides = {}, approverInfo = null) {
  const uid = request.uid || requestId;
  const cleanMobile = normalizeMobile(request.mobile);
  const authEmail = mobileToAuthEmail(cleanMobile);

  // Use overrides if admin changed details during approval
  const finalBlock = overrides.block || request.block || "";
  const finalBlockId = overrides.blockId || request.blockId || "";
  const finalPlot = normalizePlotNumber(overrides.plotNumber || request.plotNumber || request.flat || "");
  const finalFloorObj = normalizeFloor(overrides.floor || request.floor || "");
  const finalUnit = normalizeUnitNumber(overrides.unitNumber !== undefined ? overrides.unitNumber : (request.unitNumber || ""));
  const finalPersonType = (overrides.personType || request.personType || "OWNER").toUpperCase();

  const finalDisplayFlat = finalUnit
    ? `${finalPlot}-${finalUnit}`
    : finalPlot || (request.flat || "").toUpperCase();

  const finalFlat = overrides.flat || finalDisplayFlat;

  // Canonical property identity
  const canonicalPropertyId = overrides.propertyId || generatePropertyId({
    blockId: finalBlockId,
    plotNumber: finalPlot,
    floor: finalFloorObj.code,
    unitNumber: finalUnit,
  });

  // Ensure property exists or create atomically
  try {
    const propRef = doc(db, "properties", canonicalPropertyId);
    const propSnap = await getDoc(propRef);
    if (!propSnap.exists()) {
      await createProperty({
        blockId: finalBlockId,
        blockName: finalBlock,
        plotNumber: finalPlot,
        floor: finalFloorObj.label,
        unitNumber: finalUnit,
        occupancyStatus: finalPersonType === "TENANT" ? "TENANT_OCCUPIED" : "OWNER_OCCUPIED",
        ownerResidentId: finalPersonType === "OWNER" ? uid : "",
        ownerName: finalPersonType === "OWNER" ? (request.name || "") : "",
        currentOccupantResidentId: uid,
        currentOccupantName: request.name || "",
        occupantType: finalPersonType,
        createdBy: approverInfo?.name || "Admin",
        createdById: approverInfo?.uid || "",
      });
    } else {
      await linkOccupantToProperty({
        propertyId: canonicalPropertyId,
        residentId: uid,
        residentName: request.name || "",
        personType: finalPersonType,
        recordedBy: approverInfo?.name || "Admin",
      });
    }
  } catch (propErr) {
    console.warn("[approveRegistration] Property resolution note:", propErr.message);
  }

  // Garbage status from registration choice or admin override
  const gcChoice = overrides.garbageParticipation || request.garbageParticipation || "not_participating";
  const gcStatus = gcChoice === "participating"
    ? "participating"
    : "not_participating";

  // Provenance / Access Tracking
  const provenance = approverInfo ? {
    grantedByUid: approverInfo.uid || "",
    grantedByName: approverInfo.name || "Administrator",
    grantedByRole: approverInfo.role || "admin",
    grantedByDesignation: approverInfo.designation || "",
    grantedAt: new Date().toISOString(),
    channel: "registration_approval",
  } : {
    grantedByName: "Administrator",
    grantedByRole: "admin",
    grantedAt: new Date().toISOString(),
    channel: "registration_approval",
  };

  const batch = writeBatch(db);

  // Create official users/{uid} doc
  batch.set(doc(db, "users", uid), {
    role: "resident",
    name: request.name || "",
    email: (request.email || "").trim() || authEmail,
    phone: cleanMobile,
    mobile: cleanMobile,
    propertyId: canonicalPropertyId,
    plotNumber: finalPlot,
    floor: finalFloorObj.label,
    floorCode: finalFloorObj.code,
    unitNumber: finalUnit,
    personType: finalPersonType,
    flat: finalDisplayFlat,
    flatNumber: finalDisplayFlat,
    block: finalBlock,
    blockId: finalBlockId,
    residentId: uid,
    status: "active",
    accessProvenance: provenance,
    approvedAt: serverTimestamp(),
  });

  // Create official residents/{uid} doc
  batch.set(doc(db, "residents", uid), {
    propertyId: canonicalPropertyId,
    plotNumber: finalPlot,
    floor: finalFloorObj.label,
    floorCode: finalFloorObj.code,
    unitNumber: finalUnit,
    personType: finalPersonType,
    flat: finalDisplayFlat,
    flatNumber: finalDisplayFlat,
    owner: request.name || "",
    mobile: cleanMobile,
    block: finalBlock,
    blockId: finalBlockId,
    charge: charge ? Number(charge) : 0,
    email: (request.email || "").trim(),
    fatherHusbandName: request.fatherHusbandName || "",
    alternateMobile: request.alternateMobile || "",
    dob: request.dob || "",
    gender: request.gender || "",
    occupation: request.occupation || "",
    emergencyContact: request.emergencyContact || "",
    familyMembers: [],
    status: "Active",
    garbageStatus: gcStatus,
    garbageParticipation: gcChoice,
    garbageJoinedAt: gcStatus === "participating" ? serverTimestamp() : null,
    garbageJoinedMonth: gcStatus === "participating" ? new Date().toLocaleString("default", { month: "long" }) : null,
    garbageJoinedYear: gcStatus === "participating" ? new Date().getFullYear() : null,
    createdAt: request.createdAt || serverTimestamp(),
    remarks: "",
    accessProvenance: provenance,
    approvedAt: serverTimestamp(),
  });

  // Mark request as approved and synchronize overridden details
  batch.update(doc(db, "registrationRequests", requestId), {
    status: "approved",
    propertyId: canonicalPropertyId,
    plotNumber: finalPlot,
    floor: finalFloorObj.label,
    floorCode: finalFloorObj.code,
    unitNumber: finalUnit,
    flat: finalDisplayFlat,
    flatNumber: finalDisplayFlat,
    block: finalBlock,
    blockId: finalBlockId,
    personType: finalPersonType,
    approvedBy: provenance,
    approvedAt: serverTimestamp(),
  });

  await batch.commit();

  // Confirm authLookup mapping
  await writeAuthLookup(cleanMobile, authEmail, uid, (request.email || "").trim());

  // ── Post-commit: Auto-create garbage account if participating ──
  if (gcStatus === "participating") {
    try {
      const existingAccount = await getGarbageAccountByResidentId(uid);
      if (!existingAccount) {
        let defaultCharge = charge ? Number(charge) : 0;
        try {
          const settingsSnap = await getDocs(
            query(collection(db, "garbageSettings"))
          );
          if (!settingsSnap.empty) {
            const settingsData = settingsSnap.docs[0].data();
            if (settingsData.defaultCharge) {
              defaultCharge = Number(settingsData.defaultCharge);
            }
          }
        } catch {
          // Settings not available — use resident charge
        }

        await addGarbageAccount({
          residentId: uid,
          propertyId: canonicalPropertyId,
          monthlyCharge: defaultCharge,
          collectorId: "",
          status: "active",
        });
        console.log("[Registration] Auto-created garbage account for", uid);
      }
    } catch (gcError) {
      console.error("[Registration] Failed to auto-create garbage account:", gcError.message);
    }
  }

  // ── Post-commit: Auto-link resident to flat in flats collection ──
  if (finalBlockId && finalFlat) {
    try {
      const flatsQuery = query(
        collection(db, "flats"),
        where("blockId", "==", finalBlockId),
        where("flatNumber", "==", finalFlat)
      );
      const flatsSnap = await getDocs(flatsQuery);
      if (!flatsSnap.empty) {
        const flatDoc = flatsSnap.docs[0];
        // Only link if flat is not already occupied by someone else
        const flatData = flatDoc.data();
        if (!flatData.residentId || flatData.residentId === uid) {
          await linkResidentToFlat(flatDoc.id, uid);
          console.log("[Registration] Auto-linked resident to flat", flatDoc.id);
        }
      }
    } catch (flatError) {
      console.error("[Registration] Failed to auto-link flat:", flatError.message);
    }
  }
}

// =============================
// Admin: Reject Registration
// Keeps the document in registrationRequests with status: "rejected"
// so it is visible in the Rejected tab/file and informs the resident
// =============================

export async function rejectRegistration(requestId, requestData, reason, approverInfo = null) {
  const targetId = requestId || requestData?.id || requestData?.uid;
  if (!targetId) {
    throw new Error("Missing registration request ID.");
  }
  const finalReason = reason?.trim() || "Registration rejected by admin";

  // 1. Update registrationRequests document with status: "rejected"
  await setDoc(
    doc(db, "registrationRequests", targetId),
    {
      status: "rejected",
      rejectionReason: finalReason,
      rejectedAt: serverTimestamp(),
      rejectedBy: approverInfo ? {
        uid: approverInfo.uid || "",
        name: approverInfo.name || "Administrator",
        role: approverInfo.role || "admin",
        at: new Date().toISOString(),
      } : {
        name: "Administrator",
        role: "admin",
        at: new Date().toISOString(),
      },
    },
    { merge: true }
  );

  // 2. Update users/{targetId} status if document exists
  try {
    const userDocRef = doc(db, "users", targetId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      await updateDoc(userDocRef, {
        status: "rejected",
        rejectionReason: finalReason,
        rejectedAt: serverTimestamp(),
      });
    }
  } catch (userErr) {
    console.warn("[Registration] user doc update warning:", userErr.message);
  }

  // 3. Send notification to the user
  try {
    await addDoc(collection(db, "notifications"), {
      userId: targetId,
      title: "Registration Rejected ❌",
      message: `Your registration request was rejected. Reason: ${finalReason}`,
      type: "registration_rejected",
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (notifErr) {
    console.warn("[Registration] notification warning:", notifErr.message);
  }

  // 4. Activity Log
  try {
    await logActivity({
      action: `Rejected registration for ${requestData?.name || targetId}`,
      category: "auth",
      performedBy: "admin",
      performedByName: approverInfo?.name || "Admin",
      targetId,
      targetName: requestData?.name || "Unknown",
      details: `Reason: ${finalReason}. Flat: ${requestData?.flat || "—"}, Block: ${requestData?.block || "—"}`,
    });
  } catch (e) {
    console.warn("[Registration] Activity log error:", e.message);
  }

  return { success: true };
}

export { rejectAndDeleteRegistration } from "./accountDeletionService";

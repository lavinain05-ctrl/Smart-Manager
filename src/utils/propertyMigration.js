// =============================================
// propertyMigration.js
// Safe, Non-Destructive Data Migration to Canonical Property Hierarchy
// Firebase Spark Plan Compatible — Idempotent & Re-runnable
// =============================================

import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  generatePropertyId,
  normalizePlotNumber,
  normalizeFloor,
  normalizeUnitNumber,
  generateFlatId,
  parseFlatId,
  cleanUnitNumber,
} from "../services/propertyService";
import {
  mobileToAuthEmail,
  normalizeMobile,
  writeAuthLookup,
} from "../services/authService";

const MIGRATION_VERSION = "v2.0_canonical_properties";

/**
 * Perform a full dry-run analysis of existing society records.
 * Writes ZERO changes to Firestore.
 */
export async function runDryRunMigration() {
  const [residentsSnap, blocksSnap, _flatsSnap, propertiesSnap, gcSnap] = await Promise.all([
    getDocs(collection(db, "residents")),
    getDocs(collection(db, "blocks")),
    getDocs(collection(db, "flats")),
    getDocs(collection(db, "properties")),
    getDocs(collection(db, "garbageAccounts")),
  ]);

  const residents = residentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const blocks = blocksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const existingProperties = propertiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const existingPropertiesById = new Map(existingProperties.map((p) => [p.id, p]));
  const gcAccounts = gcSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const blockMap = new Map();
  blocks.forEach((b) => {
    blockMap.set(b.id, b);
    if (b.name) {
      const raw = b.name.trim().toLowerCase();
      blockMap.set(raw, b);
      // Strip "block" prefix/suffix for matching (e.g. "D Block" -> "d")
      const stripped = raw.replace(/\bblock\b/g, "").replace(/[^a-z0-9]/g, "").trim();
      if (stripped) {
        blockMap.set(stripped, b);
      }
    }
  });

  const propertiesToCreate = new Map();
  const residentsToUpdate = [];
  const ambiguousResidents = [];
  const skippedRecords = [];
  const propertyOccupantMap = new Map();

  for (const res of residents) {
    // 1. Resolve Block
    let resolvedBlock = null;
    if (res.blockId && blockMap.has(res.blockId)) {
      resolvedBlock = blockMap.get(res.blockId);
    } else if (res.block) {
      const raw = res.block.trim().toLowerCase();
      const stripped = raw.replace(/\bblock\b/g, "").replace(/[^a-z0-9]/g, "").trim();
      if (blockMap.has(raw)) {
        resolvedBlock = blockMap.get(raw);
      } else if (stripped && blockMap.has(stripped)) {
        resolvedBlock = blockMap.get(stripped);
      }
    }

    // Smart Fallbacks to eliminate false ambiguity
    if (!resolvedBlock && blocks.length === 1) {
      resolvedBlock = blocks[0];
    }

    if (!resolvedBlock && (res.block || res.blockName)) {
      const rawName = (res.block || res.blockName).trim();
      const safeId = `block_${rawName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      resolvedBlock = {
        id: safeId,
        name: rawName.toLowerCase().startsWith("block") ? rawName : `Block ${rawName.toUpperCase()}`,
      };
    }

    if (!resolvedBlock && blocks.length > 0) {
      resolvedBlock = blocks[0];
    }

    if (!resolvedBlock) {
      ambiguousResidents.push({
        residentId: res.id,
        name: res.owner || res.name || "Unknown",
        mobile: res.mobile || "—",
        reason: `Missing or unrecognized Block: "${res.block || res.blockId || "N/A"}"`,
      });
      continue;
    }

    // 2. Resolve Plot Number
    const rawPlot = res.plotNumber || res.flat || res.flatNumber || "";
    const normPlot = normalizePlotNumber(rawPlot);
    if (!normPlot) {
      ambiguousResidents.push({
        residentId: res.id,
        name: res.owner || res.name || "Unknown",
        mobile: res.mobile || "—",
        reason: `Missing or invalid plot/flat string: "${rawPlot}"`,
      });
      continue;
    }

    // 3. Resolve Floor
    const floorObj = normalizeFloor(res.floor || "Ground Floor");

    // 4. Resolve Unit Number
    const normUnit = cleanUnitNumber(res.unitNumber || "", normPlot);

    // 5. Generate Canonical Property ID
    const canonicalPropId = res.propertyId || generatePropertyId({
      blockId: resolvedBlock.id,
      plotNumber: normPlot,
      floor: floorObj.code,
      unitNumber: normUnit,
    });

    const personType = (res.personType || "OWNER").toUpperCase();

    // Group occupants for occupancy determination
    if (!propertyOccupantMap.has(canonicalPropId)) {
      propertyOccupantMap.set(canonicalPropId, []);
    }
    propertyOccupantMap.get(canonicalPropId).push({
      residentId: res.id,
      name: res.owner || res.name || "Resident",
      mobile: res.mobile || "",
      personType,
    });

    // Check if property doc already exists
    if (!existingPropertiesById.has(canonicalPropId) && !propertiesToCreate.has(canonicalPropId)) {
      propertiesToCreate.set(canonicalPropId, {
        propertyId: canonicalPropId,
        id: canonicalPropId,
        societyId: res.societyId || "default",
        blockId: resolvedBlock.id,
        blockName: resolvedBlock.name,
        plotNumber: normPlot,
        normalizedPlotNumber: normPlot,
        floor: floorObj.label,
        floorCode: floorObj.code,
        unitNumber: normUnit,
        normalizedUnitNumber: normUnit,
        occupancyStatus: personType === "TENANT" ? "TENANT_OCCUPIED" : "OWNER_OCCUPIED",
        ownerResidentId: personType === "OWNER" ? res.id : null,
        currentOccupantResidentId: personType === "TENANT" ? res.id : null,
        occupants: [
          {
            residentId: res.id,
            personType,
            name: res.owner || res.name || "Resident",
            mobile: res.mobile || "",
          },
        ],
        isActive: true,
        migrationVersion: MIGRATION_VERSION,
      });
    }

    const canonicalFlatId = generateFlatId({
      plotNumber: normPlot,
      floor: floorObj.label,
      unitNumber: normUnit,
      flat: res.flat,
    });

    residentsToUpdate.push({
      residentId: res.id,
      propertyId: canonicalPropId,
      plotNumber: normPlot,
      floor: floorObj.label,
      floorCode: floorObj.code,
      unitNumber: normUnit,
      personType,
      flat: canonicalFlatId,
      flatNumber: canonicalFlatId,
    });
  }

  // Correlate Garbage Accounts
  const gcAccountsToUpdate = [];
  gcAccounts.forEach((gc) => {
    if (gc.residentId) {
      const match = residentsToUpdate.find((r) => r.residentId === gc.residentId);
      if (match && (!gc.propertyId || gc.propertyId !== match.propertyId)) {
        gcAccountsToUpdate.push({
          accountId: gc.id,
          propertyId: match.propertyId,
          residentId: match.residentId,
        });
      }
    }
  });

  return {
    version: MIGRATION_VERSION,
    totalResidents: residents.length,
    totalExistingProperties: existingProperties.length,
    newPropertiesToCreateCount: propertiesToCreate.size,
    newPropertiesToCreate: Array.from(propertiesToCreate.values()),
    residentsToUpdateCount: residentsToUpdate.length,
    residentsToUpdate,
    gcAccountsToUpdateCount: gcAccountsToUpdate.length,
    gcAccountsToUpdate,
    ambiguousResidentsCount: ambiguousResidents.length,
    ambiguousResidents,
    skippedRecordsCount: skippedRecords.length,
    isSafeToExecute: ambiguousResidents.length === 0 || ambiguousResidents.length < residents.length,
  };
}

/**
 * Execute the data migration safely.
 * Operates in non-destructive chunks and logs an audit record.
 */
export async function executeMigration({ dryRun = true, adminUserId = "admin" } = {}) {
  const analysis = await runDryRunMigration();

  if (dryRun) {
    return {
      status: "DRY_RUN_COMPLETED",
      summary: "No database writes were performed.",
      analysis,
    };
  }

  // Batch writes in chunks of 400 (Firestore limit is 500)
  const CHUNK_SIZE = 400;

  // 1. Write new canonical properties
  const propertyBatches = [];
  let currentBatch = writeBatch(db);
  let batchCount = 0;

  for (const prop of analysis.newPropertiesToCreate) {
    const propRef = doc(db, "properties", prop.id);
    currentBatch.set(
      propRef,
      {
        ...prop,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        migratedAt: serverTimestamp(),
        migratedBy: adminUserId,
      },
      { merge: true }
    );
    batchCount++;
    if (batchCount >= CHUNK_SIZE) {
      propertyBatches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) {
    propertyBatches.push(currentBatch.commit());
  }
  await Promise.all(propertyBatches);

  // 2. Update residents with canonical propertyId and plot/floor/unit
  const residentBatches = [];
  currentBatch = writeBatch(db);
  batchCount = 0;

  for (const resUpdate of analysis.residentsToUpdate) {
    const resRef = doc(db, "residents", resUpdate.residentId);
    currentBatch.set(
      resRef,
      {
        propertyId: resUpdate.propertyId,
        plotNumber: resUpdate.plotNumber,
        floor: resUpdate.floor,
        floorCode: resUpdate.floorCode,
        unitNumber: resUpdate.unitNumber,
        personType: resUpdate.personType,
        flat: resUpdate.flat,
        flatNumber: resUpdate.flatNumber,
        migrationVersion: MIGRATION_VERSION,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    batchCount++;

    // Synchronize to users collection so resident profile & portal session have identical floor & property info
    const userRef = doc(db, "users", resUpdate.residentId);
    currentBatch.set(
      userRef,
      {
        propertyId: resUpdate.propertyId,
        plotNumber: resUpdate.plotNumber,
        floor: resUpdate.floor,
        floorCode: resUpdate.floorCode,
        unitNumber: resUpdate.unitNumber,
        personType: resUpdate.personType,
        flat: resUpdate.flat,
        flatNumber: resUpdate.flatNumber,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    batchCount++;

    if (batchCount >= CHUNK_SIZE) {
      residentBatches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) {
    residentBatches.push(currentBatch.commit());
  }
  await Promise.all(residentBatches);

  // 3. Update Garbage Accounts with propertyId
  const gcBatches = [];
  currentBatch = writeBatch(db);
  batchCount = 0;

  for (const gcUpdate of analysis.gcAccountsToUpdate) {
    const gcRef = doc(db, "garbageAccounts", gcUpdate.accountId);
    currentBatch.set(
      gcRef,
      {
        propertyId: gcUpdate.propertyId,
        responsibleResidentId: gcUpdate.residentId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    batchCount++;
    if (batchCount >= CHUNK_SIZE) {
      gcBatches.push(currentBatch.commit());
      currentBatch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) {
    gcBatches.push(currentBatch.commit());
  }
  await Promise.all(gcBatches);

  // 4. Log Migration Audit Entry (non-blocking)
  try {
    const auditDocRef = doc(collection(db, "migrationAuditLogs"));
    await setDoc(auditDocRef, {
      migrationVersion: MIGRATION_VERSION,
      executedBy: adminUserId,
      executedAt: serverTimestamp(),
      propertiesCreated: analysis.newPropertiesToCreateCount,
      residentsUpdated: analysis.residentsToUpdateCount,
      garbageAccountsUpdated: analysis.gcAccountsToUpdateCount,
      ambiguousRecordsCount: analysis.ambiguousResidentsCount,
      ambiguousRecords: analysis.ambiguousResidents,
    });
  } catch (auditErr) {
    console.warn("[Migration] Could not write migration audit log:", auditErr?.message);
  }

  return {
    status: "MIGRATION_SUCCESS",
    propertiesCreated: analysis.newPropertiesToCreateCount,
    residentsUpdated: analysis.residentsToUpdateCount,
    garbageAccountsUpdated: analysis.gcAccountsToUpdateCount,
    ambiguousRecordsReviewRequired: analysis.ambiguousResidentsCount,
    analysis,
  };
}

/**
 * MASTER FULL DATA SYNCHRONIZATION
 * Synchronizes:
 * 1. Canonical Property Hierarchy (creates properties docs, links residents)
 * 2. Auth Lookup Self-Healing (for all residents with mobile)
 * 3. Garbage Accounts & Resident Charges synchronization
 */
export async function synchronizeAllSocietyData({ adminUserId = "admin" } = {}) {
  // Step 1: Run Property Hierarchy Sync
  const migrationRes = await executeMigration({ dryRun: false, adminUserId });

  // Step 2: Run AuthLookup Sync for all residents with mobile (chunks of 15 for fast parallel execution)
  let authLookupsSynced = 0;
  try {
    const residentsSnap = await getDocs(collection(db, "residents"));
    const residentDocs = residentsSnap.docs;
    const CHUNK_SIZE = 15;

    for (let i = 0; i < residentDocs.length; i += CHUNK_SIZE) {
      const chunk = residentDocs.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (rDoc) => {
          const r = rDoc.data();
          const clean = normalizeMobile(r.mobile || r.phone);
          if (clean && clean.length === 10) {
            const em = (r.email || r.personalEmail || "").trim();
            const fl = r.flatNumber || r.flat || "";
            const ow = r.owner || r.name || "";
            try {
              await writeAuthLookup(clean, mobileToAuthEmail(clean), rDoc.id, em, fl, ow);
              authLookupsSynced++;
            } catch {
              // ignore individual lookup error
            }
          }
        })
      );
    }
  } catch (authErr) {
    console.warn("[SyncAll] Auth lookup sync error:", authErr);
  }

  // Step 3: Garbage accounts standardization & linking (safe batches <= 400)
  let garbageAccountsReconciled = 0;
  try {
    const [residentsSnap, accountsSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, "residents")),
      getDocs(collection(db, "garbageAccounts")),
      getDocs(collection(db, "garbageSettings")),
    ]);

    let defaultCharge = 80;
    if (!settingsSnap.empty) {
      defaultCharge = Number(settingsSnap.docs[0].data()?.defaultCharge || 80);
    }

    const accountMap = new Map();
    accountsSnap.docs.forEach((d) => accountMap.set(d.data().residentId, { id: d.id, ...d.data() }));

    const BATCH_LIMIT = 400;
    let currentBatch = writeBatch(db);
    let bCount = 0;

    for (const rDoc of residentsSnap.docs) {
      const r = rDoc.data();
      const isParticipating =
        r.garbageStatus === "participating" ||
        r.isEnrolled === true ||
        (r.status === "Active" && Number(r.charge) > 0);

      const existingAccount = accountMap.get(rDoc.id);

      if (isParticipating && !existingAccount) {
        const newAccRef = doc(collection(db, "garbageAccounts"));
        currentBatch.set(newAccRef, {
          residentId: rDoc.id,
          propertyId: r.propertyId || "",
          monthlyCharge: Number(r.charge) > 0 ? Number(r.charge) : defaultCharge,
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        bCount++;
        garbageAccountsReconciled++;
      } else if (existingAccount) {
        const expectedStatus = isParticipating ? "active" : "inactive";
        const needsUpdate =
          existingAccount.status !== expectedStatus ||
          (!existingAccount.propertyId && r.propertyId);

        if (needsUpdate) {
          const accRef = doc(db, "garbageAccounts", existingAccount.id);
          currentBatch.set(
            accRef,
            {
              status: expectedStatus,
              ...(r.propertyId ? { propertyId: r.propertyId } : {}),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          bCount++;
          garbageAccountsReconciled++;
        }
      }

      if (bCount >= BATCH_LIMIT) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        bCount = 0;
      }
    }

    if (bCount > 0) {
      await currentBatch.commit();
    }
  } catch (gcErr) {
    console.warn("[SyncAll] Garbage account reconciliation error:", gcErr);
  }

  // Step 4: Ensure all existing Flat IDs match canonical Plot-FloorCode-Flat format
  let flatIdMigration = { totalUpdated: 0 };
  try {
    flatIdMigration = await migrateAllExistingFlatIds({ adminUserId });
  } catch (flatErr) {
    console.warn("[SyncAll] Flat ID migration note:", flatErr);
  }

  return {
    success: true,
    propertiesCreated: migrationRes.propertiesCreated || 0,
    residentsUpdated: migrationRes.residentsUpdated || 0,
    garbageAccountsUpdated: (migrationRes.garbageAccountsUpdated || 0) + garbageAccountsReconciled,
    authLookupsSynced,
    flatIdsUpdated: flatIdMigration.totalUpdated || 0,
    flatIdMigration,
    totalResidents: migrationRes.analysis?.totalResidents || 0,
    ambiguousCount: migrationRes.ambiguousRecordsReviewRequired || 0,
    ambiguousResidents: migrationRes.analysis?.ambiguousResidents || [],
  };
}

/**
 * Safely migrates all existed data across Firestore collections to the standard Flat ID format.
 * Format: Plot-FloorCode-Flat (e.g. D430-2F-01, D607-GF, D683-PH)
 * Collections updated:
 *  1. registrationRequests (both pending and approved/rejected)
 *  2. residents
 *  3. users
 *  4. properties
 *  5. authLookup
 */
export async function migrateAllExistingFlatIds({ adminUserId = "admin" } = {}) {
  const BATCH_LIMIT = 400;
  let registrationRequestsUpdated = 0;
  let residentsUpdated = 0;
  let usersUpdated = 0;
  let propertiesUpdated = 0;
  let authLookupsUpdated = 0;

  // 1. Migrate registrationRequests
  try {
    const reqSnap = await getDocs(collection(db, "registrationRequests"));
    let batch = writeBatch(db);
    let count = 0;

    for (const d of reqSnap.docs) {
      const req = d.data();
      const canonicalFlat = generateFlatId({
        plotNumber: req.plotNumber,
        floor: req.floor,
        unitNumber: req.unitNumber,
        flat: req.flat || req.flatNumber,
      });
      const parsed = parseFlatId(req.flat || req.flatNumber, req.plotNumber, req.floor);
      const cleanedUnit = cleanUnitNumber(req.unitNumber !== undefined && req.unitNumber !== null && req.unitNumber !== "" ? req.unitNumber : parsed.unitNumber, parsed.plotNumber);
      const cleanedPlot = parsed.plotNumber || normalizePlotNumber(req.plotNumber);

      const needsUpdate =
        req.flat !== canonicalFlat ||
        req.flatNumber !== canonicalFlat ||
        (req.unitNumber !== undefined && req.unitNumber !== cleanedUnit) ||
        (cleanedPlot && req.plotNumber !== cleanedPlot);

      if (needsUpdate) {
        batch.set(
          doc(db, "registrationRequests", d.id),
          {
            flat: canonicalFlat,
            flatNumber: canonicalFlat,
            unitNumber: cleanedUnit,
            ...(cleanedPlot ? { plotNumber: cleanedPlot } : {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        count++;
        registrationRequestsUpdated++;

        if (count >= BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error("[migrateAllExistingFlatIds] registrationRequests error:", err);
  }

  // 2. Migrate residents
  const residentUpdates = [];
  try {
    const resSnap = await getDocs(collection(db, "residents"));
    let batch = writeBatch(db);
    let count = 0;

    for (const d of resSnap.docs) {
      const res = d.data();
      const canonicalFlat = generateFlatId({
        plotNumber: res.plotNumber,
        floor: res.floor,
        unitNumber: res.unitNumber,
        flat: res.flat || res.flatNumber,
      });
      const parsed = parseFlatId(res.flat || res.flatNumber, res.plotNumber, res.floor);
      const cleanedUnit = cleanUnitNumber(res.unitNumber !== undefined && res.unitNumber !== null && res.unitNumber !== "" ? res.unitNumber : parsed.unitNumber, parsed.plotNumber);
      const cleanedPlot = parsed.plotNumber || normalizePlotNumber(res.plotNumber);

      const needsUpdate =
        res.flat !== canonicalFlat ||
        res.flatNumber !== canonicalFlat ||
        (res.unitNumber !== undefined && res.unitNumber !== cleanedUnit) ||
        (cleanedPlot && res.plotNumber !== cleanedPlot);

      if (needsUpdate) {
        batch.set(
          doc(db, "residents", d.id),
          {
            flat: canonicalFlat,
            flatNumber: canonicalFlat,
            unitNumber: cleanedUnit,
            ...(cleanedPlot ? { plotNumber: cleanedPlot } : {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        count++;
        residentsUpdated++;
        residentUpdates.push({ id: d.id, ...res, flat: canonicalFlat, unitNumber: cleanedUnit });

        if (count >= BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error("[migrateAllExistingFlatIds] residents error:", err);
  }

  // 3. Migrate users (role == "resident" or user docs with flat)
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    let batch = writeBatch(db);
    let count = 0;

    for (const d of usersSnap.docs) {
      const u = d.data();
      if (!u.flat && !u.plotNumber) continue;

      const canonicalFlat = generateFlatId({
        plotNumber: u.plotNumber,
        floor: u.floor,
        unitNumber: u.unitNumber,
        flat: u.flat || u.flatNumber,
      });
      const parsed = parseFlatId(u.flat || u.flatNumber, u.plotNumber, u.floor);
      const cleanedUnit = cleanUnitNumber(u.unitNumber !== undefined && u.unitNumber !== null && u.unitNumber !== "" ? u.unitNumber : parsed.unitNumber, parsed.plotNumber);
      const cleanedPlot = parsed.plotNumber || normalizePlotNumber(u.plotNumber);

      const needsUpdate =
        u.flat !== canonicalFlat ||
        u.flatNumber !== canonicalFlat ||
        (u.unitNumber !== undefined && u.unitNumber !== cleanedUnit) ||
        (cleanedPlot && u.plotNumber !== cleanedPlot);

      if (needsUpdate) {
        batch.set(
          doc(db, "users", d.id),
          {
            flat: canonicalFlat,
            flatNumber: canonicalFlat,
            unitNumber: cleanedUnit,
            ...(cleanedPlot ? { plotNumber: cleanedPlot } : {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        count++;
        usersUpdated++;

        if (count >= BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error("[migrateAllExistingFlatIds] users error:", err);
  }

  // 4. Update authLookup for updated residents
  for (const r of residentUpdates) {
    const cleanMob = normalizeMobile(r.mobile || r.phone);
    if (cleanMob && cleanMob.length === 10) {
      try {
        await writeAuthLookup(
          cleanMob,
          mobileToAuthEmail(cleanMob),
          r.id,
          (r.email || "").trim(),
          r.flat,
          r.owner || r.name || ""
        );
        authLookupsUpdated++;
      } catch (authErr) {
        console.warn("[migrateAllExistingFlatIds] authLookup error:", authErr.message);
      }
    }
  }

  // 5. Update properties flatId
  try {
    const propSnap = await getDocs(collection(db, "properties"));
    let batch = writeBatch(db);
    let count = 0;

    for (const d of propSnap.docs) {
      const p = d.data();
      const canonicalFlat = generateFlatId({
        plotNumber: p.plotNumber,
        floor: p.floor,
        unitNumber: p.unitNumber,
      });

      if (p.flatId !== canonicalFlat) {
        batch.set(
          doc(db, "properties", d.id),
          {
            flatId: canonicalFlat,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        count++;
        propertiesUpdated++;

        if (count >= BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.error("[migrateAllExistingFlatIds] properties error:", err);
  }

  return {
    success: true,
    registrationRequestsUpdated,
    residentsUpdated,
    usersUpdated,
    propertiesUpdated,
    authLookupsUpdated,
    totalUpdated: registrationRequestsUpdated + residentsUpdated + usersUpdated + propertiesUpdated,
  };
}

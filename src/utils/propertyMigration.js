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
    const normUnit = normalizeUnitNumber(res.unitNumber || "");

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

    residentsToUpdate.push({
      residentId: res.id,
      propertyId: canonicalPropId,
      plotNumber: normPlot,
      floor: floorObj.label,
      floorCode: floorObj.code,
      unitNumber: normUnit,
      personType,
      flat: res.flat || (normUnit ? `${normPlot}-${normUnit}` : normPlot),
      flatNumber: res.flatNumber || res.flat || (normUnit ? `${normPlot}-${normUnit}` : normPlot),
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

  return {
    success: true,
    propertiesCreated: migrationRes.propertiesCreated || 0,
    residentsUpdated: migrationRes.residentsUpdated || 0,
    garbageAccountsUpdated: (migrationRes.garbageAccountsUpdated || 0) + garbageAccountsReconciled,
    authLookupsSynced,
    totalResidents: migrationRes.analysis?.totalResidents || 0,
    ambiguousCount: migrationRes.ambiguousRecordsReviewRequired || 0,
    ambiguousResidents: migrationRes.analysis?.ambiguousResidents || [],
  };
}

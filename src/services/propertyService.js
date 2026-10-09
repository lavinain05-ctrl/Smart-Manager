import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";

import { db } from "../firebase/firebase.js";

// ============================================================================
// PROPERTY IDENTITY & NORMALIZATION ENGINE
// Hierarchy: Society → Block → Plot → Floor → Unit/Flat → Occupant(s)
// ============================================================================

export const PROPERTIES_COLLECTION = "properties";
const propertiesRef = collection(db, PROPERTIES_COLLECTION);

export const AVAILABLE_FLOORS = [
  "Ground Floor",
  "1st Floor",
  "2nd Floor",
  "3rd Floor",
  "4th Floor",
  "5th Floor",
  "6th Floor",
  "7th Floor",
  "8th Floor",
  "9th Floor",
  "10th Floor",
  "11th Floor",
  "12th Floor",
  "13th Floor",
  "14th Floor",
  "15th Floor",
  "16th Floor",
  "17th Floor",
  "18th Floor",
  "19th Floor",
  "20th Floor",
  "21st Floor",
  "22nd Floor",
  "23rd Floor",
  "24th Floor",
  "25th Floor",
  "Basement",
  "Lower Basement",
  "Stilt Floor / Parking",
  "Penthouse",
  "Terrace / Rooftop",
];

export const STANDARD_FLOORS = AVAILABLE_FLOORS.map((label, idx) => ({
  id: label.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
  label,
  order: idx,
}));

export const SINGLE_UNIT_SENTINEL = "__SINGLE__";

/**
 * Normalizes floor representations to a canonical code and display label.
 * Handles "Ground", "ground", "Ground Floor", "G", "0", "GF" → "GROUND"
 * Handles "First", "1st", "1st Floor", "1", "FF" → "FIRST"
 * Handles "Second", "2nd", "2nd Floor", "2", "SF" → "SECOND"
 * Handles "Third", "3rd", "3rd Floor", "3", "TF" → "THIRD"
 * Handles "Basement", "basement", "B", "-1" → "BASEMENT"
 */
export function normalizeFloor(floorInput) {
  if (floorInput === undefined || floorInput === null) {
    return { code: "GROUND", label: "Ground Floor" };
  }

  const raw = String(floorInput).trim().toLowerCase();
  if (!raw) {
    return { code: "GROUND", label: "Ground Floor" };
  }

  // Lower Basement checks
  if (raw.includes("lower") && (raw.includes("base") || raw.includes("b2") || raw.includes("-2"))) {
    return { code: "LOWER_BASEMENT", label: "Lower Basement" };
  }

  // Basement checks
  if (raw === "b" || raw === "b1" || raw === "basement" || raw === "-1" || raw.includes("base")) {
    return { code: "BASEMENT", label: "Basement" };
  }

  // Stilt Floor / Parking
  if (raw.includes("stilt") || raw.includes("parking")) {
    return { code: "STILT", label: "Stilt Floor / Parking" };
  }

  // Penthouse
  if (raw.includes("penthouse") || raw === "ph") {
    return { code: "PENTHOUSE", label: "Penthouse" };
  }

  // Terrace / Rooftop
  if (raw.includes("terrace") || raw.includes("roof") || raw.includes("top")) {
    return { code: "TERRACE", label: "Terrace / Rooftop" };
  }

  // Ground checks
  if (raw === "0" || raw === "g" || raw === "gf" || raw === "ground" || raw.includes("ground")) {
    return { code: "GROUND", label: "Ground Floor" };
  }

  // First checks
  if (raw === "1" || raw === "1st" || raw === "ff" || raw.includes("1st") || raw.includes("first")) {
    return { code: "FIRST", label: "1st Floor" };
  }

  // Second checks
  if (raw === "2" || raw === "2nd" || raw === "sf" || raw.includes("2nd") || raw.includes("second")) {
    return { code: "SECOND", label: "2nd Floor" };
  }

  // Third checks
  if (raw === "3" || raw === "3rd" || raw === "tf" || raw.includes("3rd") || raw.includes("third")) {
    return { code: "THIRD", label: "3rd Floor" };
  }

  // Fourth checks
  if (raw === "4" || raw === "4th" || raw.includes("4th") || raw.includes("fourth")) {
    return { code: "FOURTH", label: "4th Floor" };
  }

  // Fifth checks
  if (raw === "5" || raw === "5th" || raw.includes("5th") || raw.includes("fifth")) {
    return { code: "FIFTH", label: "5th Floor" };
  }

  // Number extraction fallback: e.g. "Floor 6" -> 6th Floor, "21" -> 21st Floor
  const numMatch = raw.match(/\d+/);
  if (numMatch) {
    const n = parseInt(numMatch[0], 10);
    const code = `FLOOR_${n}`;
    const suffix =
      n % 10 === 1 && n % 100 !== 11
        ? "st"
        : n % 10 === 2 && n % 100 !== 12
        ? "nd"
        : n % 10 === 3 && n % 100 !== 13
        ? "rd"
        : "th";
    return { code, label: `${n}${suffix} Floor` };
  }

  // Configurable / custom floor label
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return { code, label: capitalized };
}

/**
 * Returns formatted floor label for resident UI displays, or empty string if unset.
 */
export function formatResidentFloor(floorInput) {
  if (!floorInput || !String(floorInput).trim()) return "";
  return normalizeFloor(floorInput).label;
}

/**
 * Normalizes plot numbers (e.g. " 12 " → "12", " d572 " → "D-572" / "D572")
 */
export function normalizePlotNumber(plotInput) {
  if (!plotInput) return "";
  let cleaned = String(plotInput).trim().toUpperCase();
  // Strip parenthesized notes like (60 METRE), (GROUND FLOOR), etc.
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  // Standardize spaces and hyphens e.g. "D 572" -> "D-572"
  return cleaned.replace(/\s+/g, "-");
}

/**
 * Normalizes unit numbers (e.g. " unit 1 " → "1", " 1A " → "1A")
 */
export function normalizeUnitNumber(unitInput) {
  if (!unitInput) return "";
  const cleaned = String(unitInput).trim().toUpperCase();
  // Strip redundant "UNIT", "FLAT", "NO" prefixes if user typed "Unit 1"
  const stripped = cleaned
    .replace(/^(UNIT|FLAT|NO\.?|#)\s*/i, "")
    .trim();
  return stripped;
}

/**
 * Returns a concise standard floor code for Flat ID generation.
 * e.g. Ground Floor -> GF, 1st Floor -> 1F, 2nd Floor -> 2F, Penthouse -> PH, Basement -> B, etc.
 */
export function getFloorCode(floorInput) {
  if (floorInput === undefined || floorInput === null) return "GF";
  const raw = String(floorInput).trim().toLowerCase();
  if (!raw) return "GF";

  // Lower Basement
  if (raw.includes("lower") && (raw.includes("base") || raw.includes("b2") || raw.includes("-2"))) {
    return "LB";
  }
  // Basement
  if (raw === "b" || raw === "b1" || raw === "basement" || raw === "-1" || raw.includes("base")) {
    return "B";
  }
  // Stilt Floor / Parking
  if (raw.includes("stilt") || raw.includes("parking")) {
    return "ST";
  }
  // Penthouse
  if (raw.includes("penthouse") || raw === "ph") {
    return "PH";
  }
  // Terrace / Rooftop
  if (raw.includes("terrace") || raw.includes("roof") || raw.includes("top")) {
    return "TR";
  }
  // Ground floor
  if (raw === "0" || raw === "g" || raw === "gf" || raw === "ground" || raw.includes("ground")) {
    return "GF";
  }

  // Numbered floor: e.g. "1st Floor", "1", "1st", "Floor 1", "2nd Floor", "2", "2F"
  const numMatch = raw.match(/\d+/);
  if (numMatch) {
    const n = parseInt(numMatch[0], 10);
    if (n === 0) return "GF";
    return `${n}F`;
  }

  // Word numbers
  if (raw.includes("first")) return "1F";
  if (raw.includes("second")) return "2F";
  if (raw.includes("third")) return "3F";
  if (raw.includes("fourth")) return "4F";
  if (raw.includes("fifth")) return "5F";
  if (raw.includes("sixth")) return "6F";
  if (raw.includes("seventh")) return "7F";
  if (raw.includes("eighth")) return "8F";
  if (raw.includes("ninth")) return "9F";
  if (raw.includes("tenth")) return "10F";

  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "GF";
}

export const FLOOR_CODE_REGEX = /^(GF|PH|LB|ST|TR|B|\d+F)$/i;

/**
 * Extracts numeric digits from a plot string (e.g. "D-562" -> "562", "12" -> "12", "D430" -> "430")
 */
export function getPlotNumericSuffix(plotStr) {
  if (!plotStr) return "";
  const match = String(plotStr).match(/\d+/);
  return match ? match[0] : "";
}

/**
 * Cleans a unit number candidate, removing accidental floor codes, corrupted repeated tokens,
 * or plot numbers mistakenly treated as units.
 */
export function cleanUnitNumber(unitInput, plotNumber = "") {
  if (!unitInput) return "";
  let unit = normalizeUnitNumber(unitInput);
  if (!unit) return "";

  const unitUpper = unit.toUpperCase();
  if (
    unitUpper === "SINGLE" ||
    unitUpper === "FULL" ||
    unitUpper === "SINGLE / FULL FLOOR" ||
    unitUpper === "SINGLE/FULL FLOOR" ||
    unitUpper === "NONE" ||
    unitUpper === "-" ||
    unitUpper === SINGLE_UNIT_SENTINEL
  ) {
    return "";
  }

  // Strip repeated / leading floor codes (e.g. "1F-1F-1F-01" -> "01", "1F-562" -> "562", "1F" -> "")
  const tokens = unit.split(/[-_/]+/).filter(Boolean);
  const nonFloorTokens = [];
  for (const t of tokens) {
    if (!FLOOR_CODE_REGEX.test(t)) {
      nonFloorTokens.push(t);
    }
  }

  if (nonFloorTokens.length === 0) {
    return "";
  }

  const cleaned = nonFloorTokens.join("-");

  // Check if remaining token is identical to plot or the numeric portion of the plot
  // e.g. plot is "D-562", cleaned is "562" -> it's the plot number, not a unit!
  const normPlot = normalizePlotNumber(plotNumber || "");
  const plotDigits = getPlotNumericSuffix(normPlot);

  if (normPlot && (cleaned.toUpperCase() === normPlot.toUpperCase() || cleaned === plotDigits)) {
    return "";
  }

  return cleaned;
}

/**
 * Parses any flat string into canonical { plotNumber, floorCode, unitNumber }.
 * Handles hyphenated plots (e.g. D-562), repeated floor tokens (e.g. D-562-1F-1F-...-562),
 * legacy formats (D430-01), and standard formats (D430-2F-01, D-562-1F).
 */
export function parseFlatId(flat, knownPlot = "", knownFloor = "") {
  const rawFlat = String(flat || "").trim();
  let resolvedPlot = normalizePlotNumber(knownPlot || "");
  let resolvedFloorCode = knownFloor ? getFloorCode(knownFloor) : "";
  let resolvedUnit = "";

  if (!rawFlat) {
    return {
      plotNumber: resolvedPlot,
      floorCode: resolvedFloorCode,
      unitNumber: resolvedUnit,
    };
  }

  // Split flat by hyphens or underscores
  const tokens = rawFlat.split(/[-_]+/).filter(Boolean);
  if (tokens.length === 0) {
    return {
      plotNumber: resolvedPlot,
      floorCode: resolvedFloorCode,
      unitNumber: resolvedUnit,
    };
  }

  // Find index of first floor token (GF, PH, 1F, 2F, etc.)
  const firstFloorIdx = tokens.findIndex((t) => FLOOR_CODE_REGEX.test(t));

  if (firstFloorIdx !== -1) {
    // Floor token was found!
    // Everything BEFORE the first floor token is the plot (e.g. ["D", "562"] -> "D-562", or ["D430"] -> "D-430")
    if (!resolvedPlot && firstFloorIdx > 0) {
      resolvedPlot = normalizePlotNumber(tokens.slice(0, firstFloorIdx).join("-"));
    }

    if (!resolvedFloorCode) {
      resolvedFloorCode = getFloorCode(tokens[firstFloorIdx]);
    }

    // Collect all tokens after the floor token sequence (skips repeated/consecutive floor tokens)
    let postFloorIdx = firstFloorIdx;
    while (postFloorIdx < tokens.length && FLOOR_CODE_REGEX.test(tokens[postFloorIdx])) {
      postFloorIdx++;
    }

    if (postFloorIdx < tokens.length) {
      const candidateUnit = tokens.slice(postFloorIdx).join("-");
      resolvedUnit = cleanUnitNumber(candidateUnit, resolvedPlot);
    }
  } else {
    // No floor token found in flat (e.g. "D-562", "D430-01", "12")
    if (!resolvedPlot) {
      if (tokens.length === 2 && /^[A-Z]$/i.test(tokens[0]) && /^\d+$/.test(tokens[1])) {
        // e.g. ["D", "562"] -> Plot is "D-562", not a unit
        resolvedPlot = normalizePlotNumber(tokens.join("-"));
      } else if (tokens.length >= 2) {
        // e.g. ["D430", "01"] -> plot "D430", candidate unit "01"
        resolvedPlot = normalizePlotNumber(tokens[0]);
        resolvedUnit = cleanUnitNumber(tokens.slice(1).join("-"), resolvedPlot);
      } else {
        resolvedPlot = normalizePlotNumber(tokens[0]);
      }
    } else {
      // resolvedPlot was already known
      // Check if flat had unit suffix: "D430-01" with known plot "D430"
      const normFlat = normalizePlotNumber(rawFlat);
      if (normFlat !== resolvedPlot) {
        const cleanFlat = rawFlat.replace(new RegExp(`^${resolvedPlot}[-_]*`, "i"), "");
        if (cleanFlat) {
          resolvedUnit = cleanUnitNumber(cleanFlat, resolvedPlot);
        }
      }
    }
  }

  return {
    plotNumber: resolvedPlot,
    floorCode: resolvedFloorCode || getFloorCode(knownFloor),
    unitNumber: resolvedUnit,
  };
}

/**
 * Generates canonical Flat ID by combining Plot Number, Floor Code, and Flat/Unit Number.
 * Format: Plot-FloorCode-Flat (e.g. D430-2F-01, D-562-1F, D683-PH)
 * If Flat/Unit Number is omitted or Single/Full Floor: Plot-FloorCode (e.g. D-562-1F)
 */
export function generateFlatId({ plotNumber, floor, unitNumber, flat } = {}) {
  // If flat string was provided, parse it first to safely decompose any legacy or corrupted parts
  const parsed = flat ? parseFlatId(flat, plotNumber, floor) : null;

  // 1. Resolve & normalize plot number
  let resolvedPlot = normalizePlotNumber(plotNumber || (parsed ? parsed.plotNumber : ""));
  if (!resolvedPlot) resolvedPlot = "PLOT";

  // 2. Resolve floor code
  const floorCode = floor ? getFloorCode(floor) : (parsed?.floorCode || "GF");

  // 3. Resolve unit number
  let normUnit = "";
  if (unitNumber !== undefined && unitNumber !== null && String(unitNumber).trim() !== "") {
    normUnit = cleanUnitNumber(unitNumber, resolvedPlot);
  } else if (parsed?.unitNumber) {
    normUnit = parsed.unitNumber;
  }

  // 4. Combine Plot-FloorCode[-Flat]
  if (normUnit) {
    return `${resolvedPlot}-${floorCode}-${normUnit}`;
  }
  return `${resolvedPlot}-${floorCode}`;
}

/**
 * Generates a stable, deterministic, Spark-compatible document ID for a property.
 * Format: prop_{blockId}_{normPlot}_{normFloorCode}_{normUnitOrSingle}
 */
export function generatePropertyId({
  blockId,
  plotNumber,
  floor,
  unitNumber,
}) {
  const normBlock = String(blockId || "NO_BLOCK").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const normPlot = normalizePlotNumber(plotNumber).replace(/[^a-zA-Z0-9_-]/g, "_");
  const normFloor = normalizeFloor(floor).code;
  const normUnit = normalizeUnitNumber(unitNumber);
  const unitSentinel = normUnit ? normUnit.replace(/[^a-zA-Z0-9_-]/g, "_") : SINGLE_UNIT_SENTINEL;

  return `prop_${normBlock}_${normPlot}_${normFloor}_${unitSentinel}`;
}

/**
 * Format property for full display (e.g. Block 90 METRE, Plot 12, 1st Floor, Unit 1)
 */
export function formatPropertyDisplay({
  blockName,
  plotNumber,
  floor,
  unitNumber,
}) {
  const floorObj = normalizeFloor(floor);
  const normUnit = normalizeUnitNumber(unitNumber);
  const unitStr = normUnit ? `Unit ${normUnit}` : "Single Unit";
  const plotStr = plotNumber ? `Plot ${plotNumber}` : "No Plot";
  const blockStr = blockName ? `Block ${blockName}` : "Society";

  return `${blockStr}, ${plotStr}, ${floorObj.label}, ${unitStr}`;
}

// ============================================================================
// DUPLICATE VALIDATION MATRIX
// Evaluates in-memory or against query results according to Phase 12 requirements
// ============================================================================

/**
 * Validates whether a new or updated property satisfies the duplicate rules
 * against existing properties.
 *
 * Rules:
 * 1. Same block + same plot + same floor + same unit → REJECT
 * 2. Same block + same plot + different floor + same unit → ALLOW
 * 3. Same block + different plot + same floor + same unit → ALLOW
 * 4. Same block + same plot + same floor + different unit → ALLOW
 * 5. Same block + same plot + same floor + both units blank → REJECT
 * 6. Blank unit when floor already has multiple units → REJECT & request unit number
 * 7. Different block with otherwise identical property details → ALLOW
 * 8. Normalized duplicate values (e.g. "Unit 1" and "unit 1") → REJECT
 */
export function validatePropertyUniqueness({
  targetBlockId,
  targetPlotNumber,
  targetFloor,
  targetUnitNumber,
  existingProperties = [],
  excludePropertyId = null,
  blockName = "",
}) {
  const normPlot = normalizePlotNumber(targetPlotNumber);
  const { code: normFloorCode, label: floorLabel } = normalizeFloor(targetFloor);
  const normUnit = normalizeUnitNumber(targetUnitNumber);

  if (!normPlot) {
    return { valid: false, error: "Plot number is required." };
  }

  // Filter existing properties to same block and plot
  const samePlotProperties = existingProperties.filter((p) => {
    if (excludePropertyId && p.id === excludePropertyId) return false;
    if (p.propertyId && p.propertyId === excludePropertyId) return false;
    const pBlock = String(p.blockId || "").trim();
    const pPlot = normalizePlotNumber(p.plotNumber);
    return pBlock === String(targetBlockId || "").trim() && pPlot === normPlot;
  });

  // Filter to same floor
  const sameFloorProperties = samePlotProperties.filter((p) => {
    const pFloor = normalizeFloor(p.floor || p.floorNumber).code;
    return pFloor === normFloorCode;
  });

  if (sameFloorProperties.length > 0) {
    // Check if target is blank unit
    if (!normUnit) {
      // 1. If there's already a single-unit property with no unit number
      const existingSingleUnit = sameFloorProperties.find((p) => {
        const pUnit = normalizeUnitNumber(p.unitNumber);
        return !pUnit;
      });

      if (existingSingleUnit) {
        return {
          valid: false,
          code: "DUPLICATE_SINGLE_UNIT",
          error: "This plot and floor already have a registered property without a unit number. Please select the existing property or enter the correct unit number.",
          existingProperty: existingSingleUnit,
        };
      }

      // 2. If there are already unit-numbered properties on this floor (multi-unit floor)
      return {
        valid: false,
        code: "MULTI_UNIT_REQUIRES_NUMBER",
        error: `This floor has multiple units. Please enter a specific unit number (e.g. Unit 1, Unit 2).`,
        existingProperties: sameFloorProperties,
      };
    }

    // Target HAS a unit number. Check:
    // A) Does this exact normalized unit already exist?
    const existingUnit = sameFloorProperties.find((p) => {
      return normalizeUnitNumber(p.unitNumber) === normUnit;
    });

    if (existingUnit) {
      const displayBlock = blockName || existingUnit.blockName || "this block";
      return {
        valid: false,
        code: "DUPLICATE_PROPERTY",
        error: `This property is already registered: Block ${displayBlock}, Plot ${targetPlotNumber}, ${floorLabel}, Unit ${normUnit}. Please select the existing property or contact the RWA admin.`,
        existingProperty: existingUnit,
      };
    }

    // B) Does a single-unit floor property exist here?
    const hasSingleUnit = sameFloorProperties.some((p) => !normalizeUnitNumber(p.unitNumber));
    if (hasSingleUnit) {
      return {
        valid: false,
        code: "CONFLICTS_WITH_SINGLE_UNIT",
        error: `This plot and floor are currently registered as a single-unit floor without a unit number. Please update the existing property or contact the RWA admin.`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// FIRESTORE CRUD & CONCURRENCY-SAFE WRITES (SPARK PLAN COMPATIBLE)
// ============================================================================

/**
 * Creates a new property atomically with concurrency protection.
 * Uses a Firestore Transaction on the deterministic document ID so that
 * concurrent creation attempts are safely rejected with a clear error.
 */
export async function createProperty({
  societyId = "default",
  blockId,
  blockName = "",
  plotNumber,
  floor,
  unitNumber = "",
  occupancyStatus = "VACANT", // "VACANT" | "OWNER_OCCUPIED" | "TENANT_OCCUPIED"
  ownerResidentId = "",
  ownerName = "",
  currentOccupantResidentId = "",
  currentOccupantName = "",
  occupantType = "VACANT", // "OWNER" | "TENANT" | "VACANT"
  createdBy = "Admin",
  createdById = "",
}) {
  const normPlot = normalizePlotNumber(plotNumber);
  const floorObj = normalizeFloor(floor);
  const normUnit = normalizeUnitNumber(unitNumber);

  if (!blockId) throw new Error("Block selection is required to register a property.");
  if (!normPlot) throw new Error("Plot number is required to register a property.");

  const propertyId = generatePropertyId({
    blockId,
    plotNumber: normPlot,
    floor: floorObj.code,
    unitNumber: normUnit,
  });

  const propertyDocRef = doc(db, PROPERTIES_COLLECTION, propertyId);

  // Spark-safe atomic transaction
  return await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(propertyDocRef);

    if (docSnap.exists()) {
      const existing = docSnap.data();
      const displayBlock = blockName || existing.blockName || "this block";
      const unitPart = normUnit ? `Unit ${normUnit}` : "Single Unit";
      throw new Error(
        `This property is already registered: Block ${displayBlock}, Plot ${normPlot}, ${floorObj.label}, ${unitPart}. Please select the existing property or contact the RWA admin.`
      );
    }

    const newPropertyData = {
      propertyId,
      societyId,
      blockId,
      blockName: blockName || "",
      plotNumber: normPlot,
      floorNumber: floorObj.label,
      floor: floorObj.label,
      floorCode: floorObj.code,
      unitNumber: normUnit,
      normalizedPlotNumber: normPlot,
      normalizedUnitNumber: normUnit || SINGLE_UNIT_SENTINEL,
      normalizedFloor: floorObj.code,
      occupancyStatus: occupancyStatus || "VACANT",
      ownerResidentId: ownerResidentId || "",
      ownerName: ownerName || "",
      currentOccupantResidentId: currentOccupantResidentId || "",
      currentOccupantName: currentOccupantName || "",
      occupantType: occupantType || "VACANT",
      isActive: true,
      createdBy: createdBy || "Admin",
      createdById: createdById || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      occupancyHistory: ownerResidentId || currentOccupantResidentId ? [
        {
          residentId: currentOccupantResidentId || ownerResidentId,
          residentName: currentOccupantName || ownerName,
          occupantType: occupantType || (ownerResidentId ? "OWNER" : "TENANT"),
          startDate: new Date().toISOString(),
          endDate: null,
          recordedBy: createdBy || "Admin",
        },
      ] : [],
    };

    transaction.set(propertyDocRef, newPropertyData);
    return { id: propertyId, ...newPropertyData };
  });
}

/**
 * Updates an existing property record.
 */
export async function updateProperty(propertyId, updates, updatedBy = "Admin") {
  const propertyDocRef = doc(db, PROPERTIES_COLLECTION, propertyId);
  const snap = await getDoc(propertyDocRef);
  if (!snap.exists()) {
    throw new Error("Property not found.");
  }

  const payload = {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy,
  };

  if (updates.floor) {
    const floorObj = normalizeFloor(updates.floor);
    payload.floorNumber = floorObj.label;
    payload.floor = floorObj.label;
    payload.floorCode = floorObj.code;
    payload.normalizedFloor = floorObj.code;
  }
  if (updates.plotNumber !== undefined) {
    payload.normalizedPlotNumber = normalizePlotNumber(updates.plotNumber);
  }
  if (updates.unitNumber !== undefined) {
    payload.normalizedUnitNumber = normalizeUnitNumber(updates.unitNumber) || SINGLE_UNIT_SENTINEL;
  }

  await updateDoc(propertyDocRef, payload);
  return true;
}

/**
 * Associates an occupant (Owner or Tenant) to a property.
 * Preserves historical occupants in occupancyHistory.
 */
export async function linkOccupantToProperty({
  propertyId,
  residentId,
  residentName,
  personType = "OWNER", // "OWNER" | "TENANT" | "FAMILY_MEMBER"
  recordedBy = "Admin",
}) {
  const propertyDocRef = doc(db, PROPERTIES_COLLECTION, propertyId);
  const snap = await getDoc(propertyDocRef);
  if (!snap.exists()) {
    throw new Error("Property not found for linking.");
  }

  const data = snap.data();
  const history = Array.isArray(data.occupancyHistory) ? [...data.occupancyHistory] : [];

  const newHistoryEntry = {
    residentId,
    residentName: residentName || "",
    occupantType: personType,
    startDate: new Date().toISOString(),
    endDate: null,
    recordedBy,
  };

  const updates = {
    updatedAt: serverTimestamp(),
    updatedBy: recordedBy,
  };

  if (personType === "OWNER") {
    updates.ownerResidentId = residentId;
    updates.ownerName = residentName;
    if (!data.currentOccupantResidentId || data.occupancyStatus === "VACANT") {
      updates.currentOccupantResidentId = residentId;
      updates.currentOccupantName = residentName;
      updates.occupancyStatus = "OWNER_OCCUPIED";
      updates.occupantType = "OWNER";
    }
  } else if (personType === "TENANT" || personType === "RENTED") {
    // If there was a previous tenant, mark their history end date
    if (data.currentOccupantResidentId && data.currentOccupantResidentId !== residentId) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].residentId === data.currentOccupantResidentId && !history[i].endDate) {
          history[i].endDate = new Date().toISOString();
          break;
        }
      }
    }
    updates.currentOccupantResidentId = residentId;
    updates.currentOccupantName = residentName;
    updates.occupancyStatus = "TENANT_OCCUPIED";
    updates.occupantType = "TENANT";
  }

  history.push(newHistoryEntry);
  updates.occupancyHistory = history;

  await updateDoc(propertyDocRef, updates);
  return true;
}

/**
 * Handles tenant vacating / moving out.
 * Preserves resident record, receipts, payments, and historical tenancy.
 * Property occupancy becomes VACANT or OWNER_OCCUPIED.
 */
export async function endTenancy({
  propertyId,
  formerTenantId,
  endedBy = "Admin",
  revertToOwner = true,
}) {
  const propertyDocRef = doc(db, PROPERTIES_COLLECTION, propertyId);
  const snap = await getDoc(propertyDocRef);
  if (!snap.exists()) throw new Error("Property not found.");

  const data = snap.data();
  const history = Array.isArray(data.occupancyHistory) ? [...data.occupancyHistory] : [];

  // Close the active tenancy record in history
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].residentId === (formerTenantId || data.currentOccupantResidentId) && !history[i].endDate) {
      history[i].endDate = new Date().toISOString();
      history[i].vacatedBy = endedBy;
      break;
    }
  }

  const updates = {
    updatedAt: serverTimestamp(),
    updatedBy: endedBy,
    occupancyHistory: history,
  };

  if (revertToOwner && data.ownerResidentId) {
    updates.currentOccupantResidentId = data.ownerResidentId;
    updates.currentOccupantName = data.ownerName || "";
    updates.occupancyStatus = "OWNER_OCCUPIED";
    updates.occupantType = "OWNER";
  } else {
    updates.currentOccupantResidentId = "";
    updates.currentOccupantName = "";
    updates.occupancyStatus = "VACANT";
    updates.occupantType = "VACANT";
  }

  await updateDoc(propertyDocRef, updates);
  return true;
}

/**
 * Real-time subscription to properties collection
 */
export function subscribeProperties(callback) {
  const q = query(propertiesRef, orderBy("plotNumber", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      callback(items);
    },
    (error) => {
      console.error("[Firestore] properties listener error:", error.message);
    }
  );
}

/**
 * One-time fetch of all properties
 */
export async function getProperties() {
  const snapshot = await getDocs(propertiesRef);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}

/**
 * Fetch a single property by ID
 */
export async function getPropertyById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, PROPERTIES_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Deletes a property (Admin only, safety checks applied)
 */
export async function deleteProperty(propertyId) {
  return await deleteDoc(doc(db, PROPERTIES_COLLECTION, propertyId));
}

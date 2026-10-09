/**
 * Comprehensive Unit Test Suite for Property Identity & Validation Matrix
 * Run via: node src/tests/propertyIdentity.test.js
 */
/* global process */

import {
  normalizeFloor,
  normalizePlotNumber,
  normalizeUnitNumber,
  generatePropertyId,
  validatePropertyUniqueness,
  getFloorCode,
  generateFlatId,
  parseFlatId,
} from "../services/propertyService.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("=================================================");
console.log("RUNNING PHASE 12 — PROPERTY IDENTITY UNIT TESTS");
console.log("=================================================\n");

// ── Test 1: Floor Normalization ──
console.log("1. Floor Normalization Tests:");
assert(normalizeFloor("Ground").code === "GROUND", "Ground -> GROUND");
assert(normalizeFloor("ground").code === "GROUND", "ground -> GROUND");
assert(normalizeFloor("Ground Floor").code === "GROUND", "Ground Floor -> GROUND");
assert(normalizeFloor("0").code === "GROUND", "0 -> GROUND");
assert(normalizeFloor("GF").code === "GROUND", "GF -> GROUND");
assert(normalizeFloor("1st Floor").code === "FIRST", "1st Floor -> FIRST");
assert(normalizeFloor("first").code === "FIRST", "first -> FIRST");
assert(normalizeFloor("1").code === "FIRST", "1 -> FIRST");
assert(normalizeFloor("2nd Floor").code === "SECOND", "2nd Floor -> SECOND");
assert(normalizeFloor("3rd Floor").code === "THIRD", "3rd Floor -> THIRD");
assert(normalizeFloor("Basement").code === "BASEMENT", "Basement -> BASEMENT");
assert(normalizeFloor("B").code === "BASEMENT", "B -> BASEMENT");

// ── Test 2: Plot & Unit Normalization ──
console.log("\n2. Plot & Unit Normalization Tests:");
assert(normalizePlotNumber(" 12 ") === "12", "Trims plot number");
assert(normalizePlotNumber("d 572") === "D-572", "Normalizes 'd 572' to 'D-572'");
assert(normalizeUnitNumber(" Unit 1 ") === "1", "Strips 'Unit' prefix from ' Unit 1 '");
assert(normalizeUnitNumber("flat 2A") === "2A", "Strips 'flat' prefix from 'flat 2A'");
assert(normalizeUnitNumber("") === "", "Empty unit returns empty string");

// ── Test 3: Deterministic Property ID ──
console.log("\n3. Deterministic Property ID Generation:");
const id1 = generatePropertyId({ blockId: "block_90m", plotNumber: "12", floor: "Ground", unitNumber: "1" });
const id2 = generatePropertyId({ blockId: "block_90m", plotNumber: "12", floor: "ground floor", unitNumber: "Unit 1" });
assert(id1 === id2, "Normalized identical inputs yield identical propertyId");
assert(id1.includes("block_90m_12_GROUND_1"), "ID format contains expected elements");

// ── Test 4: Phase 12 Validation Matrix ──
console.log("\n4. Phase 12 Validation Matrix Tests:");

const mockExistingProperties = [
  {
    id: "prop_1",
    propertyId: "prop_1",
    blockId: "block_90m",
    blockName: "90 METRE",
    plotNumber: "12",
    floor: "Ground Floor",
    floorCode: "GROUND",
    unitNumber: "1",
  },
  {
    id: "prop_2",
    propertyId: "prop_2",
    blockId: "block_90m",
    blockName: "90 METRE",
    plotNumber: "12",
    floor: "Ground Floor",
    floorCode: "GROUND",
    unitNumber: "2",
  },
  {
    id: "prop_3",
    propertyId: "prop_3",
    blockId: "block_90m",
    blockName: "90 METRE",
    plotNumber: "15",
    floor: "Ground Floor",
    floorCode: "GROUND",
    unitNumber: "", // Single-unit floor
  },
];

// Matrix Rule 1: Same block + same plot + same floor + same unit -> REJECT
const res1 = validatePropertyUniqueness({
  targetBlockId: "block_90m",
  targetPlotNumber: "12",
  targetFloor: "Ground",
  targetUnitNumber: "1",
  existingProperties: mockExistingProperties,
});
assert(!res1.valid && res1.code === "DUPLICATE_PROPERTY", "Rule 1: Same block, plot, floor, unit is rejected as duplicate");

// Matrix Rule 2: Same block + same plot + different floor + same unit -> ALLOW
const res2 = validatePropertyUniqueness({
  targetBlockId: "block_90m",
  targetPlotNumber: "12",
  targetFloor: "1st Floor",
  targetUnitNumber: "1",
  existingProperties: mockExistingProperties,
});
assert(res2.valid, "Rule 2: Same block, same plot, DIFFERENT floor, same unit is ALLOWED");

// Matrix Rule 3: Same block + different plot + same floor + same unit -> ALLOW
const res3 = validatePropertyUniqueness({
  targetBlockId: "block_90m",
  targetPlotNumber: "14",
  targetFloor: "Ground Floor",
  targetUnitNumber: "1",
  existingProperties: mockExistingProperties,
});
assert(res3.valid, "Rule 3: Same block, DIFFERENT plot, same floor, same unit is ALLOWED");

// Matrix Rule 4: Same block + same plot + same floor + different unit -> ALLOW
const res4 = validatePropertyUniqueness({
  targetBlockId: "block_90m",
  targetPlotNumber: "12",
  targetFloor: "Ground Floor",
  targetUnitNumber: "3",
  existingProperties: mockExistingProperties,
});
assert(res4.valid, "Rule 4: Same block, same plot, same floor, DIFFERENT unit is ALLOWED");

// Matrix Rule 5: Same block + same plot + same floor + both units blank -> REJECT
const res5 = validatePropertyUniqueness({
  targetBlockId: "block_90m",
  targetPlotNumber: "15",
  targetFloor: "Ground Floor",
  targetUnitNumber: "",
  existingProperties: mockExistingProperties,
});
assert(!res5.valid && res5.code === "DUPLICATE_SINGLE_UNIT", "Rule 5: Both units blank on same plot+floor is rejected");

// Matrix Rule 6: Blank unit when floor already has multiple units -> REJECT and request unit number
const res6 = validatePropertyUniqueness({
  targetBlockId: "block_90m",
  targetPlotNumber: "12",
  targetFloor: "Ground Floor",
  targetUnitNumber: "",
  existingProperties: mockExistingProperties,
});
assert(!res6.valid && res6.code === "MULTI_UNIT_REQUIRES_NUMBER", "Rule 6: Blank unit on multi-unit floor is rejected with request for unit number");

// Matrix Rule 7: Different block with otherwise identical property details -> ALLOW
const res7 = validatePropertyUniqueness({
  targetBlockId: "block_60m",
  targetPlotNumber: "12",
  targetFloor: "Ground Floor",
  targetUnitNumber: "1",
  existingProperties: mockExistingProperties,
});
assert(res7.valid, "Rule 7: Different block with otherwise identical details is ALLOWED");

// Matrix Rule 8: Normalized duplicate values such as "Unit 1" and "unit 1" -> REJECT
const res8 = validatePropertyUniqueness({
  targetBlockId: "block_90m",
  targetPlotNumber: "12",
  targetFloor: "GROUND",
  targetUnitNumber: "unit 1",
  existingProperties: mockExistingProperties,
});
assert(!res8.valid && res8.code === "DUPLICATE_PROPERTY", "Rule 8: 'unit 1' duplicate against '1' is REJECTED");

console.log("\n5. Flat ID Generation Tests (Plot-FloorCode-Flat):");
assert(getFloorCode("Ground Floor") === "GF", "Ground Floor -> GF");
assert(getFloorCode("ground") === "GF", "ground -> GF");
assert(getFloorCode("1st Floor") === "1F", "1st Floor -> 1F");
assert(getFloorCode("2nd Floor") === "2F", "2nd Floor -> 2F");
assert(getFloorCode("3rd Floor") === "3F", "3rd Floor -> 3F");
assert(getFloorCode("Penthouse") === "PH", "Penthouse -> PH");
assert(getFloorCode("Basement") === "B", "Basement -> B");
assert(getFloorCode("Lower Basement") === "LB", "Lower Basement -> LB");
assert(getFloorCode("Stilt Floor / Parking") === "ST", "Stilt Floor / Parking -> ST");
assert(getFloorCode("Terrace / Rooftop") === "TR", "Terrace / Rooftop -> TR");

// Test combination cases
assert(
  generateFlatId({ plotNumber: "D430", floor: "2nd Floor", unitNumber: "01" }) === "D430-2F-01",
  "D430 + 2nd Floor + 01 -> D430-2F-01"
);
assert(
  generateFlatId({ plotNumber: "D607", floor: "Ground Floor", unitNumber: "Single / Full Floor" }) === "D607-GF",
  "D607 + Ground Floor + Single/Full Floor -> D607-GF"
);
assert(
  generateFlatId({ plotNumber: "D683", floor: "Penthouse", unitNumber: "" }) === "D683-PH",
  "D683 + Penthouse + empty unit -> D683-PH"
);
assert(
  generateFlatId({ plotNumber: "D389", floor: "3rd Floor", unitNumber: "3" }) === "D389-3F-3",
  "D389 + 3rd Floor + 3 -> D389-3F-3"
);
assert(
  generateFlatId({ plotNumber: "12", floor: "1st Floor", unitNumber: "Unit 1" }) === "12-1F-1",
  "12 + 1st Floor + Unit 1 -> 12-1F-1"
);
assert(
  generateFlatId({ flat: "D430-01", floor: "2nd Floor" }) === "D430-2F-01",
  "Resolves unit from legacy flat D430-01"
);

// Hyphenated plot tests (e.g. D-562, D-607) & Corrupted Flat ID Healing
assert(
  generateFlatId({ plotNumber: "D-562", floor: "1st Floor" }) === "D-562-1F",
  "D-562 + 1st Floor (no unit) -> D-562-1F"
);
assert(
  generateFlatId({ plotNumber: "D-562", floor: "1st Floor", unitNumber: "1" }) === "D-562-1F-1",
  "D-562 + 1st Floor + Unit 1 -> D-562-1F-1"
);
assert(
  generateFlatId({ plotNumber: "D-562", floor: "1st Floor", flat: "D-562-1F-1F-1F-1F-1F-1F-1F-1F-1F-1F-1F-1F-1F-1F-1F-562" }) === "D-562-1F",
  "Recovers clean D-562-1F from corrupt repeated '-1F' and plot suffix flat string"
);
assert(
  generateFlatId({ plotNumber: "D-562", floor: "1st Floor", unitNumber: "1F-1F-1F-562" }) === "D-562-1F",
  "Cleans corrupt unitNumber containing repeated floor codes and plot suffix"
);
assert(
  generateFlatId({ plotNumber: "D-562", floor: "1st Floor", unitNumber: "562" }) === "D-562-1F",
  "Ignores mistaken unitNumber that matches plot numeric digits"
);

// Idempotence test across multiple cycles
const c1 = generateFlatId({ plotNumber: "D-562", floor: "1st Floor", flat: "D-562" });
const c2 = generateFlatId({ plotNumber: "D-562", floor: "1st Floor", flat: c1 });
const c3 = generateFlatId({ plotNumber: "D-562", floor: "1st Floor", flat: c2 });
assert(
  c1 === "D-562-1F" && c2 === "D-562-1F" && c3 === "D-562-1F",
  "Flat ID generation is strictly idempotent across repeated cycles"
);

const parsedCorrupt = parseFlatId("D-562-1F-1F-1F-1F-562");
assert(
  parsedCorrupt.plotNumber === "D-562" && parsedCorrupt.floorCode === "1F" && parsedCorrupt.unitNumber === "",
  "parseFlatId decomposes corrupt flat string into plot 'D-562', floor '1F', unit ''"
);

const parsedNormal = parseFlatId("D-562-1F-02");
assert(
  parsedNormal.plotNumber === "D-562" && parsedNormal.floorCode === "1F" && parsedNormal.unitNumber === "02",
  "parseFlatId correctly extracts unit '02' from 'D-562-1F-02'"
);

console.log("\n=================================================");
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL PROPERTY IDENTITY MATRIX TESTS PASSED!\n");
}

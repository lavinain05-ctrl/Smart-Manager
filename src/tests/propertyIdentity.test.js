/**
 * Comprehensive Unit Test Suite for Property Identity & Validation Matrix
 * Run via: node src/tests/propertyIdentity.test.js
 */

import {
  normalizeFloor,
  normalizePlotNumber,
  normalizeUnitNumber,
  generatePropertyId,
  validatePropertyUniqueness,
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

console.log("\n=================================================");
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL PROPERTY IDENTITY MATRIX TESTS PASSED!\n");
}

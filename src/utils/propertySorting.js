// ============================================================================
// propertySorting.js
// Universal 3-tier ascending sorting engine for Plots, Floors, and Units
// Hierarchy: Block Prefix -> Numeric Plot -> Floor Level -> Unit / Portion
// ============================================================================

/**
 * Normalizes floor strings into numeric rank for comparison:
 * Lower Basement (-2) < Basement (-1) < Stilt (-0.5) < Ground (0) < 1F (1) < 2F (2) < 3F (3) ...
 */
export function extractFloorLevel(floorStr = "", flatStr = "") {
  const combined = `${floorStr || ""} ${flatStr || ""}`.toLowerCase();

  if (combined.includes("lower") && (combined.includes("base") || combined.includes("-2") || combined.includes("b2"))) {
    return -2;
  }
  if (combined.includes("base") || combined.includes("-1") || /\bb1?\b/.test(combined)) {
    return -1;
  }
  if (combined.includes("stilt") || combined.includes("parking")) {
    return -0.5;
  }
  if (combined.includes("ground") || combined.includes("gf") || combined.includes("g-f") || /\b0\s*f\b/.test(combined)) {
    return 0;
  }
  if (combined.includes("penthouse") || combined.includes("terrace") || combined.includes("roof") || combined.includes("ph")) {
    return 999;
  }

  // Look for floor numbers e.g. "1st", "1F", "2nd Floor", "-3F", "4F"
  const m =
    combined.match(/(?:^|[\s\-_/])(\d+)(?:st|nd|rd|th)?\s*(?:f|floor)?(?:$|[\s\-_/])/i) ||
    combined.match(/(\d+)\s*f\b/i);
  if (m) {
    return parseInt(m[1], 10);
  }

  if (combined.includes("first") || combined.includes("ff")) return 1;
  if (combined.includes("second") || combined.includes("sf")) return 2;
  if (combined.includes("third") || combined.includes("tf")) return 3;
  if (combined.includes("fourth")) return 4;
  if (combined.includes("fifth")) return 5;
  if (combined.includes("sixth")) return 6;

  // Default to Ground Floor (0) if floor is unspecified
  return 0;
}

/**
 * Decomposes a resident or flat object into comparable parts:
 * - prefix: e.g. "D" from "D571"
 * - plotNum: e.g. 571 from "D571 1F 1"
 * - floorLevel: e.g. 1 from "1st Floor" or "1F"
 * - unitNum: e.g. 1 from "D571 1F 1" or "D413-3F-1"
 */
export function parsePropertyComponents(item = {}) {
  if (typeof item === "string") {
    item = { flat: item };
  }

  const rawFlat = String(item?.flat || item?.flatNumber || item?.plotNumber || "").trim();
  const rawFloor = String(item?.floor || "").trim();
  const rawUnit = String(item?.unitNumber || item?.flatNumberSuffix || "").trim();
  const rawPlot = String(item?.plotNumber || "").trim();

  let prefix = "";
  let plotNum = 0;
  let remainingAfterPlot = rawFlat;

  // 1. Try explicit plotNumber if provided
  if (rawPlot) {
    const pm = rawPlot.match(/^([A-Za-z\s_-]*?)(\d+)/);
    if (pm) {
      prefix = (pm[1] || "").toUpperCase().replace(/[^A-Z]/g, "");
      plotNum = parseInt(pm[2], 10);
    }
  }

  // 2. Extract plot number and prefix from rawFlat (e.g. "D571 1F 1", "D-571", "D709-GF")
  if (!plotNum) {
    const fm = rawFlat.match(/^([A-Za-z\s_-]*?)(\d+)/);
    if (fm) {
      prefix = (fm[1] || "").toUpperCase().replace(/[^A-Z]/g, "");
      plotNum = parseInt(fm[2], 10);
      remainingAfterPlot = rawFlat.slice(fm[0].length).trim();
    }
  }

  // 3. Extract Floor level
  const floorLevel = extractFloorLevel(rawFloor, remainingAfterPlot);

  // 4. Extract Unit number / portion
  let unitNum = 0;
  if (rawUnit) {
    const um = rawUnit.match(/\d+/);
    if (um) unitNum = parseInt(um[0], 10);
  } else {
    const trailingUnit = remainingAfterPlot.match(/[-_\s/](\d+)\s*$/);
    if (trailingUnit) {
      unitNum = parseInt(trailingUnit[1], 10);
    }
  }

  return {
    prefix,
    plotNum,
    floorLevel,
    unitNum,
    rawFlat,
  };
}

/**
 * Universal 3-tier comparator for residents, flats, and accounts:
 * 1. Prefix (A-Z)
 * 2. Plot Number (numeric ascending: 382 < 413 < 571 < 572 < 709)
 * 3. Floor Level (ascending: Ground < 1st Floor < 2nd Floor < 3rd Floor)
 * 4. Unit / Portion (ascending: Unit 1 < Unit 2)
 */
export function compareResidentsByPlotAndFloor(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const aComp = parsePropertyComponents(a);
  const bComp = parsePropertyComponents(b);

  // 1. Compare Block Prefix (e.g. "A" vs "D")
  if (aComp.prefix !== bComp.prefix) {
    const pCmp = aComp.prefix.localeCompare(bComp.prefix);
    if (pCmp !== 0) return pCmp;
  }

  // 2. Compare Numeric Plot (e.g. 382 < 413 < 571 < 572 < 709)
  if (aComp.plotNum !== bComp.plotNum) {
    if (aComp.plotNum === 0) return 1;
    if (bComp.plotNum === 0) return -1;
    return aComp.plotNum - bComp.plotNum;
  }

  // 3. Within same Plot: Compare Floor Level (e.g. GF (0) < 1F (1) < 2F (2) < 3F (3))
  if (aComp.floorLevel !== bComp.floorLevel) {
    return aComp.floorLevel - bComp.floorLevel;
  }

  // 4. Within same Floor: Compare Unit Number (e.g. Unit 1 < Unit 2)
  if (aComp.unitNum !== bComp.unitNum) {
    return aComp.unitNum - bComp.unitNum;
  }

  // 5. Fallback natural alphanumeric sort
  return aComp.rawFlat.localeCompare(bComp.rawFlat, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Sorts any list of residents/flats in ascending Plot -> Floor -> Unit order.
 * Returns a new sorted array without mutating the original.
 */
export function sortResidentsByPlotAndFloor(list = []) {
  if (!Array.isArray(list)) return [];
  return [...list].sort(compareResidentsByPlotAndFloor);
}

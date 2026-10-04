/**
 * Billing Cycle Configuration & Utilities
 * Official collection launched starting September 2026.
 * Months prior to September 2026 are not involved in billing, collections, or dues.
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const COLLECTION_START_YEAR = 2026;
export const COLLECTION_START_MONTH = "September";
export const COLLECTION_START_MONTH_INDEX = 8; // September (0-indexed)

/**
 * Checks whether a given month and year precedes the official collection launch date (September 2026).
 * Returns true if the period is before September 2026.
 */
export function isPriorToCollectionStart(month, year) {
  const y = Number(year);
  if (!y || y < COLLECTION_START_YEAR) return true;
  if (y > COLLECTION_START_YEAR) return false;
  const mIndex = typeof month === "number" ? month : MONTH_NAMES.indexOf(month);
  if (mIndex === -1) return false;
  return mIndex < COLLECTION_START_MONTH_INDEX;
}

/**
 * Returns available billing years starting from 2026 (no previous years).
 */
export function getAvailableBillingYears(futureYears = 3) {
  const currentYear = new Date().getFullYear();
  const maxYear = Math.max(currentYear + futureYears, COLLECTION_START_YEAR + futureYears);
  const years = [];
  for (let y = COLLECTION_START_YEAR; y <= maxYear; y++) {
    years.push(y);
  }
  return years;
}

/**
 * Returns available billing months for a given year.
 * For 2026, only returns September, October, November, December.
 * For subsequent years (2027+), returns all 12 months.
 */
export function getAvailableBillingMonths(year) {
  const y = Number(year);
  if (y < COLLECTION_START_YEAR) return [];
  if (y === COLLECTION_START_YEAR) {
    return MONTH_NAMES.slice(COLLECTION_START_MONTH_INDEX);
  }
  return [...MONTH_NAMES];
}

/**
 * Safely parses any date value (Firestore Timestamp, ISO string, Date object, or numeric timestamp)
 * into a JavaScript Date object. Returns null if invalid or undefined.
 */
export function parseDateSafely(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val.toDate === "function") {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {
      // fallback
    }
  }
  if (typeof val === "object" && typeof val.seconds === "number") {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Returns { month, year, monthIndex } representing the starting billing period for a resident.
 * 
 * Rules:
 * 1. Global baseline: September 2026 (no collection or bills prior to this).
 * 2. Resident registration month: If registered after September 2026, billing starts from their registration month.
 * 3. Garbage participation month: If opted into garbage after registration, billing starts from when participation began.
 * 
 * Whichever of these dates is latest will be the resident's official collection & billing start.
 */
export function getResidentBillingStart(resident) {
  let startYear = COLLECTION_START_YEAR;
  let startMonthIndex = COLLECTION_START_MONTH_INDEX;

  if (!resident) {
    return {
      month: MONTH_NAMES[startMonthIndex],
      year: startYear,
      monthIndex: startMonthIndex,
    };
  }

  // 1. Check resident registration date
  const regDate =
    parseDateSafely(resident.createdAt) ||
    parseDateSafely(resident.approvedAt) ||
    parseDateSafely(resident.registrationDate) ||
    parseDateSafely(resident.date);

  if (regDate) {
    const regY = regDate.getFullYear();
    const regM = regDate.getMonth();
    if (regY > startYear || (regY === startYear && regM > startMonthIndex)) {
      startYear = regY;
      startMonthIndex = regM;
    }
  }

  // 2. Check garbage participation start date
  if (resident.garbageJoinedYear && resident.garbageJoinedMonth) {
    const gjY = Number(resident.garbageJoinedYear);
    const gjM = MONTH_NAMES.indexOf(resident.garbageJoinedMonth);
    if (gjY && gjM !== -1) {
      if (gjY > startYear || (gjY === startYear && gjM > startMonthIndex)) {
        startYear = gjY;
        startMonthIndex = gjM;
      }
    }
  } else {
    const gcDate =
      parseDateSafely(resident.garbageJoinedAt) ||
      parseDateSafely(resident.garbageParticipationDate) ||
      parseDateSafely(resident.garbageStartDate) ||
      parseDateSafely(resident.gcStartedAt);

    if (gcDate) {
      const gcY = gcDate.getFullYear();
      const gcM = gcDate.getMonth();
      if (gcY > startYear || (gcY === startYear && gcM > startMonthIndex)) {
        startYear = gcY;
        startMonthIndex = gcM;
      }
    }
  }

  return {
    month: MONTH_NAMES[startMonthIndex],
    year: startYear,
    monthIndex: startMonthIndex,
  };
}

/**
 * Checks whether a given (month, year) is prior to when the resident's collection & billing begins.
 * Returns true if prior (i.e. the resident is NOT responsible for bills, dues, or collections in that period).
 */
export function isPriorToResidentBillingStart(resident, month, year) {
  // Always prior if before society launch (Sep 2026)
  if (isPriorToCollectionStart(month, year)) return true;
  if (!resident) return false;

  const start = getResidentBillingStart(resident);
  const targetYear = Number(year);
  if (!targetYear || targetYear < start.year) return true;
  if (targetYear > start.year) return false;

  const targetMonthIndex = typeof month === "number" ? month : MONTH_NAMES.indexOf(month);
  if (targetMonthIndex === -1) return false;

  return targetMonthIndex < start.monthIndex;
}

/**
 * Returns available billing months for a resident for a given year.
 */
export function getAvailableBillingMonthsForResident(resident, year) {
  const y = Number(year);
  const start = getResidentBillingStart(resident);
  if (!y || y < start.year) return [];
  if (y === start.year) {
    return MONTH_NAMES.slice(start.monthIndex);
  }
  return [...MONTH_NAMES];
}


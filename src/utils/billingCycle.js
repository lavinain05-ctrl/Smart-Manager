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
 * Returns the last calendar day (e.g. 28, 29, 30, 31) of a given month and year.
 */
export function getLastDateOfMonth(month, year) {
  const y = Number(year) || new Date().getFullYear();
  const mIndex = typeof month === "number" ? month : MONTH_NAMES.indexOf(month);
  if (mIndex === -1) return 30;
  // Day 0 of the following month is the last day of the target month
  return new Date(y, mIndex + 1, 0).getDate();
}

/**
 * Returns the formatted due date for a given billing month and year (e.g., "30 September 2026", "31 October 2026").
 * Due date is strictly the last date of that billing month.
 */
export function formatDueDate(month, year) {
  const y = Number(year) || new Date().getFullYear();
  let mName = month;
  let mIndex = -1;
  if (typeof month === "number") {
    mIndex = month;
    mName = MONTH_NAMES[month] || "September";
  } else {
    mIndex = MONTH_NAMES.indexOf(month);
  }
  const lastDay = mIndex !== -1 ? new Date(y, mIndex + 1, 0).getDate() : 30;
  return `${lastDay} ${mName || "September"} ${y}`;
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
  let startMonthIndex = COLLECTION_START_MONTH_INDEX; // September 2026 (0-indexed 8)

  if (!resident) {
    return {
      month: MONTH_NAMES[startMonthIndex],
      year: startYear,
      monthIndex: startMonthIndex,
    };
  }

  // Official society collection started from September 2026.
  // All residents registered in 2026 participate from September 2026.
  // Only if registration/garbage joining is explicitly in a future calendar year (e.g. 2027+)
  // does billing start in that future year.
  const regDate =
    parseDateSafely(resident.garbageJoinedAt) ||
    parseDateSafely(resident.createdAt) ||
    parseDateSafely(resident.approvedAt);

  if (regDate && regDate.getFullYear() > COLLECTION_START_YEAR) {
    startYear = regDate.getFullYear();
    startMonthIndex = regDate.getMonth();
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

/**
 * Returns all billing cycles from the resident's start (or society start Sep 2026)
 * up to the current calendar month & year.
 */
export function getElapsedBillingCycles(resident = null) {
  const now = new Date();
  const currentY = now.getFullYear();
  const currentMIdx = now.getMonth();

  const start = resident ? getResidentBillingStart(resident) : {
    year: COLLECTION_START_YEAR,
    month: COLLECTION_START_MONTH,
    monthIndex: COLLECTION_START_MONTH_INDEX,
  };

  const cycles = [];
  let y = start.year;
  let m = start.monthIndex;

  while (y < currentY || (y === currentY && m <= currentMIdx)) {
    const mName = MONTH_NAMES[m];
    const dueDateStr = formatDueDate(mName, y);
    const parsedDue = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const isPastDueDate = parsedDue < now;
    cycles.push({
      month: mName,
      year: y,
      monthIndex: m,
      dueDate: dueDateStr,
      isOverdue: isPastDueDate,
    });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }

  return cycles;
}

/**
 * Resolves all unpaid / pending billing cycles for a resident across all elapsed periods.
 * Accurately lists all months (e.g. "September 2026 & October 2026"), calculates total dues,
 * and sets canonical due dates to the last day of each month.
 */
export function getResidentPendingBillingCycles({
  resident,
  payments = [],
  bills = [],
  garbageBills = [],
  monthlyCharge = 80,
}) {
  const elapsed = getElapsedBillingCycles(resident);
  const now = new Date();

  const isCovered = (m, y) => {
    const yNum = Number(y);
    const hasPay = payments.some((p) => {
      if (p.month === m && Number(p.year) === yNum) return true;
      if (p.isAdvance && Array.isArray(p.coveredMonths)) {
        return p.coveredMonths.some((cm) => cm.month === m && Number(cm.year) === yNum);
      }
      return false;
    });
    if (hasPay) return true;

    const hasPaidBill = [...bills, ...garbageBills].some((b) => {
      const bM = b.month;
      const bY = Number(b.year);
      const isPaid = b.status === "Paid" || b.status === "paid" || b.status === "Exempted" || b.displayStatus === "Paid";
      return bM === m && bY === yNum && isPaid;
    });
    return hasPaidBill;
  };

  const charge = Number(resident?.charge || monthlyCharge || 80);

  const unpaidCycles = [];
  elapsed.forEach((c) => {
    if (!isCovered(c.month, c.year)) {
      unpaidCycles.push({
        ...c,
        amount: charge,
        status: c.isOverdue ? "Overdue" : "Pending",
      });
    }
  });

  const pendingCount = unpaidCycles.length;
  const isAllPaid = pendingCount === 0;
  const totalDueAmount = unpaidCycles.reduce((sum, c) => sum + c.amount, 0);

  // Month names label
  let monthsLabel = "";
  if (pendingCount === 1) {
    monthsLabel = `${unpaidCycles[0].month} ${unpaidCycles[0].year}`;
  } else if (pendingCount === 2) {
    monthsLabel = `${unpaidCycles[0].month} ${unpaidCycles[0].year} & ${unpaidCycles[1].month} ${unpaidCycles[1].year}`;
  } else if (pendingCount > 2) {
    const leading = unpaidCycles.slice(0, -1).map((c) => `${c.month} ${c.year}`).join(", ");
    const trailing = `${unpaidCycles[unpaidCycles.length - 1].month} ${unpaidCycles[unpaidCycles.length - 1].year}`;
    monthsLabel = `${leading} & ${trailing}`;
  }

  const hasOverdue = unpaidCycles.some((c) => c.isOverdue);
  const currentMonthName = MONTH_NAMES[now.getMonth()];
  const currentYearNum = now.getFullYear();
  const currentCycle = unpaidCycles.find((c) => c.month === currentMonthName && c.year === currentYearNum) || unpaidCycles[unpaidCycles.length - 1];
  const primaryDueDate = currentCycle ? currentCycle.dueDate : formatDueDate(currentMonthName, currentYearNum);

  return {
    unpaidCycles,
    pendingCount,
    isAllPaid,
    totalDueAmount,
    monthsLabel,
    hasOverdue,
    primaryDueDate,
    monthlyCharge: charge,
  };
}


/**
 * collectorHelper.js
 * Centralized helpers for collector matching, date normalization,
 * and synchronized reporting across Admin, Committee, and Collector portals.
 */

/**
 * Format a Date object to local YYYY-MM-DD string without UTC shift.
 */
export function getLocalTodayYMD() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object to local DD/MM/YYYY or D/M/YYYY string.
 */
export function getLocalTodayEN() {
  const d = new Date();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/**
 * Parse any date representation (DD/MM/YYYY, YYYY-MM-DD, ISO string, Date, Timestamp) safely into a local Date.
 */
export function parseDateSafe(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (val?.toDate && typeof val.toDate === "function") {
    try {
      return val.toDate();
    } catch {
      return null;
    }
  }
  if (typeof val === "string") {
    const s = val.trim();
    // DD/MM/YYYY or D/M/YYYY
    if (s.includes("/")) {
      const parts = s.split("/").map(Number);
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    // YYYY-MM-DD
    if (s.includes("-")) {
      const parts = s.split("-").map(Number);
      if (parts.length === 3 && parts[0] > 1000) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Checks if two date strings or Date objects represent the exact same calendar day.
 */
export function isSameDate(date1, date2) {
  if (!date1 || !date2) return false;
  if (date1 === date2) return true;

  const d1 = parseDateSafe(date1);
  const d2 = parseDateSafe(date2);
  if (!d1 || !d2) return false;

  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Matches a payment to a collector (regular collector or committee member collector).
 * Handles:
 * - collectorId === collector.id or collector.uid
 * - Name matching (exact or case-insensitive)
 * - Substring matching (e.g. "MANSI NAIN (Executive Member)" containing "MANSI NAIN")
 * - Strip designation suffix (e.g. "MANSI NAIN (Executive Member)" -> "MANSI NAIN")
 */
export function matchesCollector(payment, collector) {
  if (!payment || !collector) return false;

  const cId = collector.id || collector.uid;

  // Handle Society Admin / Office matches
  if (cId === "admin_office" || collector.isAdmin) {
    const pCollector = (payment.collector || "").trim().toLowerCase();
    const pCollectorName = (payment.collectorName || "").trim().toLowerCase();
    const pId = String(payment.collectorId || "").trim().toLowerCase();
    const isExplicitAdmin =
      pCollector === "admin" ||
      pCollectorName === "admin" ||
      pCollector.includes("admin") ||
      pCollectorName.includes("admin") ||
      pId === "admin" ||
      payment.confirmedByName === "Admin";
    const hasNoCollector = !pCollector && !pCollectorName && !payment.collectorId;
    return isExplicitAdmin || hasNoCollector;
  }

  if (
    cId &&
    payment.collectorId &&
    (payment.collectorId === cId ||
      payment.collectorId === collector.uid ||
      payment.collectorId === collector.id)
  ) {
    return true;
  }

  const cName = (collector.name || "").trim().toLowerCase();
  if (!cName) return false;

  const pCollector = (payment.collector || "").trim().toLowerCase();
  const pCollectorName = (payment.collectorName || "").trim().toLowerCase();

  // Exact matches
  if (pCollector === cName || pCollectorName === cName) return true;

  // Suffix strip: "MANSI NAIN (Executive Member)" -> "mansi nain"
  const cleanPCollector = pCollector.replace(/\s*\([^)]*\)/g, "").trim();
  if (cleanPCollector && cleanPCollector === cName) return true;

  const cleanPCollectorName = pCollectorName.replace(/\s*\([^)]*\)/g, "").trim();
  if (cleanPCollectorName && cleanPCollectorName === cName) return true;

  // Substring inclusion
  if (pCollector && pCollector.includes(cName)) return true;
  if (pCollectorName && pCollectorName.includes(cName)) return true;

  return false;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Get a local Date object from any payment document.
 */
export function getPaymentDateObj(p) {
  if (!p) return null;
  return (
    parseDateSafe(p.paymentDate) ||
    parseDateSafe(p.date) ||
    (p.submittedAt?.toDate ? p.submittedAt.toDate() : null) ||
    (p.createdAt?.toDate ? p.createdAt.toDate() : null) ||
    (p.timestamp?.toDate ? p.timestamp.toDate() : null) ||
    (p.createdAt ? new Date(p.createdAt) : null)
  );
}

/**
 * Check if a payment occurred in the given month and year.
 */
export function isPaymentInMonthYear(p, monthName, yearNum) {
  if (!p) return false;
  const targetYear = Number(yearNum);
  const targetMonthIdx = MONTH_NAMES.indexOf(monthName);

  // 1. Check explicit fields
  if (p.year && Number(p.year) === targetYear) {
    if (p.month === monthName) return true;
    if (typeof p.month === "string" && p.month.toLowerCase() === monthName.toLowerCase()) return true;
    if (targetMonthIdx !== -1 && Number(p.month) === targetMonthIdx + 1) return true;
  }

  // 2. Check Date object
  const d = getPaymentDateObj(p);
  if (!d) return false;

  return d.getMonth() === targetMonthIdx && d.getFullYear() === targetYear;
}

/**
 * Check if a payment occurred in the given year.
 */
export function isPaymentInYear(p, yearNum) {
  if (!p) return false;
  const targetYear = Number(yearNum);

  if (p.year && Number(p.year) === targetYear) return true;

  const d = getPaymentDateObj(p);
  if (!d) return false;
  return d.getFullYear() === targetYear;
}

/**
 * Check if a payment occurred on a specific date (today, custom date).
 */
export function isPaymentOnDate(p, targetDate) {
  if (!p || !targetDate) return false;
  if (p.paymentDate && isSameDate(p.paymentDate, targetDate)) return true;

  const d = getPaymentDateObj(p);
  if (!d) return false;
  return isSameDate(d, targetDate);
}

/**
 * Check if a special collection payment is an actual confirmed collected payment.
 * Excludes unverified/pending requests, rejected, and refunded transactions.
 */
export function isValidConfirmedSpecialPayment(p) {
  if (!p) return false;
  const st = (p.status || "").toLowerCase();
  if (st === "pending" || st === "rejected" || st === "refunded") return false;
  
  if (st) {
    return st === "confirmed" || st === "completed" || st === "approved";
  }
  
  return Boolean(p.receiptNumber || p.collectorId || p.collectorName);
}

/**
 * Normalizes payment method across different variations (Cash, UPI, Bank Transfer).
 */
export function normalizePaymentMethod(p) {
  if (!p) return "Cash";
  const m = (p.paymentMethod || p.paymentMode || p.method || p.mode || "").trim().toLowerCase();
  if (m === "cash") return "Cash";
  if (m === "upi" || m.includes("upi") || (p.utr && p.utr !== "CASH-OFFLINE")) return "UPI";
  if (
    m.includes("bank") ||
    m.includes("transfer") ||
    m.includes("neft") ||
    m.includes("rtgs") ||
    m.includes("cheque") ||
    m.includes("online")
  ) {
    return "Bank Transfer";
  }
  return "Cash";
}

/**
 * Check if a payment occurred on a custom single date or within a custom date range.
 */
export function isPaymentInCustomDate(p, mode, singleDate, fromDate, toDate) {
  if (!p) return false;
  const d = getPaymentDateObj(p);
  if (!d) return false;

  if (mode === "range") {
    const from = parseDateSafe(fromDate);
    const to = parseDateSafe(toDate);
    if (!from && !to) return true;
    if (from && to) {
      const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0);
      const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
      return d >= start && d <= end;
    }
    if (from) {
      const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0);
      return d >= start;
    }
    if (to) {
      const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
      return d <= end;
    }
    return true;
  }

  // Single date mode
  return isSameDate(d, singleDate);
}


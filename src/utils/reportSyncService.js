// ============================================================================
// reportSyncService.js
// Single Source of Truth for Synchronized Block-Wise Reporting & Printing
// Reconciles residents, bills, garbageBills, and payments without discrepancies.
// ============================================================================

import { isGcParticipating } from "../services/statisticsService";

/**
 * Natural alphanumeric sort for flat numbers (e.g., "1", "2", "10", "101", "102A")
 */
export function compareFlatNumbers(aFlat = "", bFlat = "") {
  return String(aFlat).localeCompare(String(bFlat), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Natural sort for block names (e.g., "Block A", "Block B", "Tower 1", "Tower 2")
 */
export function compareBlockNames(aBlock = "", bBlock = "") {
  return String(aBlock).localeCompare(String(bBlock), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Clean 10-digit mobile number for cross-entity matching
 */
function cleanMobile(raw = "") {
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Normalizes Block name (e.g., "A" -> "Block A" or preserves existing label)
 */
export function normalizeBlockName(rawBlock) {
  if (!rawBlock || !String(rawBlock).trim()) return "General / Unassigned";
  const trimmed = String(rawBlock).trim();
  if (/^[A-Z0-9]$/i.test(trimmed)) {
    return `Block ${trimmed.toUpperCase()}`;
  }
  return trimmed;
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 1. SYNCHRONIZE BLOCK-WISE RESIDENT DIRECTORY & PAYMENT STATUS
 * ═════════════════════════════════════════════════════════════════════════════
 * Resolves each resident flat, cross-references monthly bills and payments,
 * groups by Block, and computes exact block subtotals and grand totals.
 */
export function syncBlockWiseResidents({
  residents = [],
  blocks = [],
  bills = [],
  garbageBills = [],
  payments = [],
  month = new Date().toLocaleString("default", { month: "long" }),
  year = new Date().getFullYear(),
}) {
  const targetYearNum = Number(year);

  // 1. Index payments for target month & year
  // Keyed by residentId and by clean 10-digit mobile
  const paymentsByResId = new Map();
  const paymentsByPhone = new Map();
  const paymentsByFlat = new Map();

  payments.forEach((p) => {
    if (p.month === month && Number(p.year) === targetYearNum) {
      if (p.residentId) paymentsByResId.set(p.residentId, p);
      if (p.mobile) {
        const phone = cleanMobile(p.mobile);
        if (phone) paymentsByPhone.set(phone, p);
      }
      if (p.flat) {
        const key = `${normalizeBlockName(p.block)}||${String(p.flat).trim().toUpperCase()}`;
        paymentsByFlat.set(key, p);
      }
    }
  });

  // 2. Index garbage bills & bills for target month & year
  const billsByResId = new Map();
  bills.forEach((b) => {
    if (b.month === month && Number(b.year) === targetYearNum) {
      if (b.residentId) billsByResId.set(b.residentId, b);
    }
  });

  const gbByResId = new Map();
  garbageBills.forEach((g) => {
    if (g.month === month && Number(g.year) === targetYearNum) {
      if (g.residentId) gbByResId.set(g.residentId, g);
    }
  });

  // 3. Process each resident
  const blockMap = new Map();

  // Initialize blocks from configured blocks if available
  blocks.forEach((b) => {
    const bName = normalizeBlockName(b.name || b.id);
    if (!blockMap.has(bName)) {
      blockMap.set(bName, {
        blockName: bName,
        residents: [],
        totalFlats: 0,
        activeCount: 0,
        inactiveCount: 0,
        gcEnrolledCount: 0,
        paidCount: 0,
        pendingCount: 0,
        expectedAmount: 0,
        collectedAmount: 0,
        pendingAmount: 0,
      });
    }
  });

  residents.forEach((r) => {
    const rawBlock = r.block || r.blockName || "";
    const bName = normalizeBlockName(rawBlock);

    if (!blockMap.has(bName)) {
      blockMap.set(bName, {
        blockName: bName,
        residents: [],
        totalFlats: 0,
        activeCount: 0,
        inactiveCount: 0,
        gcEnrolledCount: 0,
        paidCount: 0,
        pendingCount: 0,
        expectedAmount: 0,
        collectedAmount: 0,
        pendingAmount: 0,
      });
    }

    const blockEntry = blockMap.get(bName);
    const isActive = r.status !== "Inactive" && r.status !== "inactive";
    const isEnrolled = isGcParticipating(r);
    const monthlyCharge = Number(r.charge || 80);

    // Cross-match payment
    const phone = cleanMobile(r.mobile || r.phone);
    const flatKey = `${bName}||${String(r.flat || "").trim().toUpperCase()}`;
    const payment =
      paymentsByResId.get(r.id) ||
      (phone ? paymentsByPhone.get(phone) : null) ||
      paymentsByFlat.get(flatKey) ||
      null;

    const bill = billsByResId.get(r.id) || null;
    const gb = gbByResId.get(r.id) || null;

    // Authoritative paid determination
    const isPaid = Boolean(
      payment ||
      bill?.status === "Paid" ||
      bill?.status === "Exempted" ||
      gb?.status === "Paid" ||
      gb?.status === "Exempted"
    );

    let displayStatus = "Pending";
    if (isPaid) {
      displayStatus = bill?.status === "Exempted" || payment?.paymentMethod === "Exempted" ? "Exempted" : "Paid";
    } else if (bill?.status === "Overdue" || (bill?.dueDate && new Date(bill.dueDate) < new Date())) {
      displayStatus = "Overdue";
    }

    const paidAmount = isPaid
      ? Number(payment?.amount || bill?.paidAmount || bill?.amount || gb?.paidAmount || gb?.amount || monthlyCharge)
      : 0;

    const expectedFee = isEnrolled ? monthlyCharge : 0;
    const pendingDue = isPaid ? 0 : expectedFee;

    const receiptNo =
      payment?.receiptNumber ||
      payment?.receiptNo ||
      payment?.paymentId ||
      bill?.paymentId ||
      (isPaid ? "REC-CONFIRMED" : "—");

    const paymentDate = payment?.paymentDate || bill?.paymentDate || (isPaid ? "Recorded" : "—");
    const paymentMode = payment?.paymentMethod || payment?.paymentMode || bill?.paymentMethod || (isPaid ? "Direct" : "—");
    const collector = payment?.collector || payment?.collectorName || r.collectorName || "—";

    const residentRecord = {
      id: r.id,
      flat: r.flat || "—",
      owner: r.owner || r.name || "Resident",
      mobile: r.mobile || r.phone || "—",
      email: r.email || "—",
      block: bName,
      status: isActive ? "Active" : "Inactive",
      isEnrolled,
      garbageService: isEnrolled ? "Enrolled" : "Opted Out",
      monthlyCharge,
      currentMonthStatus: displayStatus,
      isPaid,
      paidAmount,
      pendingDue,
      receiptNo,
      paymentDate,
      paymentMode,
      collector,
      assignedCollector: r.collectorName || "—",
    };

    blockEntry.residents.push(residentRecord);
    blockEntry.totalFlats += 1;
    if (isActive) blockEntry.activeCount += 1;
    else blockEntry.inactiveCount += 1;
    if (isEnrolled) blockEntry.gcEnrolledCount += 1;
    if (isPaid) {
      blockEntry.paidCount += 1;
      blockEntry.collectedAmount += paidAmount;
    } else {
      blockEntry.pendingCount += 1;
      blockEntry.pendingAmount += pendingDue;
    }
    blockEntry.expectedAmount += expectedFee;
  });

  // Sort residents in each block by flat number
  const blocksArray = Array.from(blockMap.values())
    .filter((b) => b.residents.length > 0) // only include blocks that have flats
    .sort((a, b) => compareBlockNames(a.blockName, b.blockName));

  blocksArray.forEach((b) => {
    b.residents.sort((a, b) => compareFlatNumbers(a.flat, b.flat));
    b.collectionRate = b.expectedAmount > 0
      ? Math.round((b.collectedAmount / b.expectedAmount) * 100)
      : (b.paidCount > 0 ? 100 : 0);
  });

  // Calculate Grand Totals across all blocks
  const grandTotals = blocksArray.reduce(
    (acc, b) => {
      acc.totalBlocks += 1;
      acc.totalFlats += b.totalFlats;
      acc.activeCount += b.activeCount;
      acc.inactiveCount += b.inactiveCount;
      acc.gcEnrolledCount += b.gcEnrolledCount;
      acc.paidCount += b.paidCount;
      acc.pendingCount += b.pendingCount;
      acc.expectedAmount += b.expectedAmount;
      acc.collectedAmount += b.collectedAmount;
      acc.pendingAmount += b.pendingAmount;
      return acc;
    },
    {
      totalBlocks: 0,
      totalFlats: 0,
      activeCount: 0,
      inactiveCount: 0,
      gcEnrolledCount: 0,
      paidCount: 0,
      pendingCount: 0,
      expectedAmount: 0,
      collectedAmount: 0,
      pendingAmount: 0,
    }
  );

  grandTotals.collectionRate = grandTotals.expectedAmount > 0
    ? Math.round((grandTotals.collectedAmount / grandTotals.expectedAmount) * 100)
    : (grandTotals.paidCount > 0 ? 100 : 0);

  return {
    blocks: blocksArray,
    grandTotals,
    billingMonth: month,
    billingYear: targetYearNum,
    generatedAt: new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  };
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 2. SYNCHRONIZE BLOCK-WISE MONTHLY PAYMENT BILLS REGISTER
 * ═════════════════════════════════════════════════════════════════════════════
 * Reconciles every monthly bill against payments, groups by Block,
 * verifies payment receipt & method, and computes block & society subtotals.
 */
export function syncBlockWiseMonthlyBills({
  residents = [],
  blocks = [],
  bills = [],
  garbageBills = [],
  payments = [],
  month = new Date().toLocaleString("default", { month: "long" }),
  year = new Date().getFullYear(),
}) {
  const targetYearNum = Number(year);

  // 1. Create fast lookups
  const residentMap = new Map();
  residents.forEach((r) => residentMap.set(r.id, r));

  const monthlyPayments = payments.filter(
    (p) => p.month === month && Number(p.year) === targetYearNum
  );

  const paymentsByResId = new Map();
  const paymentsByPhone = new Map();
  const paymentsByFlat = new Map();

  monthlyPayments.forEach((p) => {
    if (p.residentId) paymentsByResId.set(p.residentId, p);
    if (p.mobile) {
      const ph = cleanMobile(p.mobile);
      if (ph) paymentsByPhone.set(ph, p);
    }
    if (p.flat) {
      const key = `${normalizeBlockName(p.block)}||${String(p.flat).trim().toUpperCase()}`;
      paymentsByFlat.set(key, p);
    }
  });

  // Filter bills for selected month and year
  const selectedBills = bills.filter(
    (b) => b.month === month && Number(b.year) === targetYearNum
  );

  const selectedGb = garbageBills.filter(
    (g) => g.month === month && Number(g.year) === targetYearNum
  );

  // Track all processed resident IDs to merge bills + garbageBills + payments
  const processedResIds = new Set();
  const unifiedBillItems = [];

  // A. Process primary bills collection
  selectedBills.forEach((b) => {
    processedResIds.add(b.residentId);
    const res = residentMap.get(b.residentId);
    const rawBlock = b.block || res?.block || "";
    const bName = normalizeBlockName(rawBlock);
    const flat = b.flat || res?.flat || "—";
    const phone = cleanMobile(res?.mobile || res?.phone);
    const flatKey = `${bName}||${String(flat).trim().toUpperCase()}`;

    const payment =
      paymentsByResId.get(b.residentId) ||
      (phone ? paymentsByPhone.get(phone) : null) ||
      paymentsByFlat.get(flatKey) ||
      null;

    const isPaid = Boolean(
      payment ||
      b.status === "Paid" ||
      b.status === "Exempted"
    );

    let finalStatus = "Pending";
    if (isPaid) {
      finalStatus = b.status === "Exempted" || payment?.paymentMethod === "Exempted" ? "Exempted" : "Paid";
    } else if (b.status === "Overdue" || (b.dueDate && new Date(b.dueDate) < new Date())) {
      finalStatus = "Overdue";
    }

    const billAmount = Number(b.amount || res?.charge || 80);
    const paidAmount = isPaid
      ? Number(payment?.amount || b.paidAmount || billAmount)
      : 0;
    const pendingAmount = isPaid ? 0 : billAmount;

    unifiedBillItems.push({
      id: b.id,
      residentId: b.residentId,
      residentName: b.residentName || res?.owner || res?.name || "Resident",
      flat,
      block: bName,
      mobile: res?.mobile || res?.phone || payment?.mobile || "—",
      billNumber: b.id ? `BILL-${String(b.id).slice(-6).toUpperCase()}` : `BILL-${targetYearNum}-${flat}`,
      billAmount,
      paidAmount,
      pendingAmount,
      status: finalStatus,
      isPaid,
      dueDate: b.dueDate || "—",
      paymentDate: payment?.paymentDate || b.paymentDate || (isPaid ? "Recorded" : "—"),
      paymentMethod: payment?.paymentMethod || payment?.paymentMode || b.paymentMethod || (isPaid ? "Cash/Direct" : "—"),
      receiptNumber: payment?.receiptNumber || payment?.receiptNo || b.paymentId || (isPaid ? "REC-CONFIRMED" : "—"),
      collector: payment?.collector || payment?.collectorName || res?.collectorName || "—",
    });
  });

  // B. Process any garbageBills not present in primary bills
  selectedGb.forEach((g) => {
    if (processedResIds.has(g.residentId)) return;
    processedResIds.add(g.residentId);

    const res = residentMap.get(g.residentId);
    const rawBlock = g.block || res?.block || "";
    const bName = normalizeBlockName(rawBlock);
    const flat = g.flat || res?.flat || "—";
    const phone = cleanMobile(res?.mobile || res?.phone);
    const flatKey = `${bName}||${String(flat).trim().toUpperCase()}`;

    const payment =
      paymentsByResId.get(g.residentId) ||
      (phone ? paymentsByPhone.get(phone) : null) ||
      paymentsByFlat.get(flatKey) ||
      null;

    const isPaid = Boolean(payment || g.status === "Paid" || g.status === "Exempted");
    const billAmount = Number(g.amount || res?.charge || 80);
    const paidAmount = isPaid ? Number(payment?.amount || g.paidAmount || billAmount) : 0;
    const pendingAmount = isPaid ? 0 : billAmount;

    unifiedBillItems.push({
      id: g.id,
      residentId: g.residentId,
      residentName: g.residentName || res?.owner || res?.name || "Resident",
      flat,
      block: bName,
      mobile: res?.mobile || res?.phone || payment?.mobile || "—",
      billNumber: `GB-${String(g.id).slice(-6).toUpperCase()}`,
      billAmount,
      paidAmount,
      pendingAmount,
      status: isPaid ? "Paid" : "Pending",
      isPaid,
      dueDate: g.dueDate || "—",
      paymentDate: payment?.paymentDate || (isPaid ? "Recorded" : "—"),
      paymentMethod: payment?.paymentMethod || payment?.paymentMode || (isPaid ? "Cash/Direct" : "—"),
      receiptNumber: payment?.receiptNumber || payment?.receiptNo || (isPaid ? "REC-CONFIRMED" : "—"),
      collector: payment?.collector || payment?.collectorName || res?.collectorName || "—",
    });
  });

  // C. Process participating residents who didn't get a bill doc yet (e.g., if bill generation wasn't clicked)
  // Ensures not a single participating flat is missed!
  residents.forEach((r) => {
    if (processedResIds.has(r.id)) return;
    if (!isGcParticipating(r)) return; // Only participating flats owe garbage fees
    if (r.status === "Inactive" || r.status === "inactive") return;

    processedResIds.add(r.id);
    const bName = normalizeBlockName(r.block);
    const flat = r.flat || "—";
    const phone = cleanMobile(r.mobile || r.phone);
    const flatKey = `${bName}||${String(flat).trim().toUpperCase()}`;

    const payment =
      paymentsByResId.get(r.id) ||
      (phone ? paymentsByPhone.get(phone) : null) ||
      paymentsByFlat.get(flatKey) ||
      null;

    const isPaid = Boolean(payment);
    const billAmount = Number(r.charge || 80);
    const paidAmount = isPaid ? Number(payment.amount || billAmount) : 0;
    const pendingAmount = isPaid ? 0 : billAmount;

    unifiedBillItems.push({
      id: `UNBILLED-${r.id}`,
      residentId: r.id,
      residentName: r.owner || r.name || "Resident",
      flat,
      block: bName,
      mobile: r.mobile || r.phone || "—",
      billNumber: `FEE-${targetYearNum}-${flat}`,
      billAmount,
      paidAmount,
      pendingAmount,
      status: isPaid ? "Paid" : "Pending",
      isPaid,
      dueDate: "10th of Month",
      paymentDate: payment?.paymentDate || "—",
      paymentMethod: payment?.paymentMethod || payment?.paymentMode || (isPaid ? "Cash/Direct" : "—"),
      receiptNumber: payment?.receiptNumber || payment?.receiptNo || (isPaid ? "REC-DIRECT" : "—"),
      collector: payment?.collector || payment?.collectorName || r.collectorName || "—",
    });
  });

  // Group unified bills block by block
  const blockMap = new Map();
  blocks.forEach((b) => {
    const bName = normalizeBlockName(b.name || b.id);
    if (!blockMap.has(bName)) {
      blockMap.set(bName, {
        blockName: bName,
        bills: [],
        totalBills: 0,
        paidBillsCount: 0,
        pendingBillsCount: 0,
        totalBilledAmount: 0,
        totalCollectedAmount: 0,
        totalPendingAmount: 0,
      });
    }
  });

  unifiedBillItems.forEach((item) => {
    if (!blockMap.has(item.block)) {
      blockMap.set(item.block, {
        blockName: item.block,
        bills: [],
        totalBills: 0,
        paidBillsCount: 0,
        pendingBillsCount: 0,
        totalBilledAmount: 0,
        totalCollectedAmount: 0,
        totalPendingAmount: 0,
      });
    }

    const bEntry = blockMap.get(item.block);
    bEntry.bills.push(item);
    bEntry.totalBills += 1;
    bEntry.totalBilledAmount += item.billAmount;
    if (item.isPaid) {
      bEntry.paidBillsCount += 1;
      bEntry.totalCollectedAmount += item.paidAmount;
    } else {
      bEntry.pendingBillsCount += 1;
      bEntry.totalPendingAmount += item.pendingAmount;
    }
  });

  const blocksArray = Array.from(blockMap.values())
    .filter((b) => b.bills.length > 0)
    .sort((a, b) => compareBlockNames(a.blockName, b.blockName));

  blocksArray.forEach((b) => {
    b.bills.sort((a, b) => compareFlatNumbers(a.flat, b.flat));
    b.collectionRate = b.totalBilledAmount > 0
      ? Math.round((b.totalCollectedAmount / b.totalBilledAmount) * 100)
      : (b.paidBillsCount > 0 ? 100 : 0);
  });

  // Calculate Grand Totals
  const grandTotals = blocksArray.reduce(
    (acc, b) => {
      acc.totalBlocks += 1;
      acc.totalBills += b.totalBills;
      acc.paidBillsCount += b.paidBillsCount;
      acc.pendingBillsCount += b.pendingBillsCount;
      acc.totalBilledAmount += b.totalBilledAmount;
      acc.totalCollectedAmount += b.totalCollectedAmount;
      acc.totalPendingAmount += b.totalPendingAmount;
      return acc;
    },
    {
      totalBlocks: 0,
      totalBills: 0,
      paidBillsCount: 0,
      pendingBillsCount: 0,
      totalBilledAmount: 0,
      totalCollectedAmount: 0,
      totalPendingAmount: 0,
    }
  );

  grandTotals.collectionRate = grandTotals.totalBilledAmount > 0
    ? Math.round((grandTotals.totalCollectedAmount / grandTotals.totalBilledAmount) * 100)
    : (grandTotals.paidBillsCount > 0 ? 100 : 0);

  return {
    blocks: blocksArray,
    grandTotals,
    billingMonth: month,
    billingYear: targetYearNum,
    generatedAt: new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  };
}

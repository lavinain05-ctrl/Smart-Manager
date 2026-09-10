// =============================================
// statisticsService.js
// Single Calculation Engine — Every page uses this.
// Pure functions — no Firestore, no side effects.
// =============================================

// ─── Flat‑number normalizer (shared) ─────────

function normalizeFlat(flat) {
  return (flat || "").trim().toUpperCase().replace(/[\s\-_]+/g, "");
}

// ─── GC Participation Helper ─────────────────
// Single source of truth for checking whether a resident is currently
// participating in garbage collection. Normalizes all known data
// formats: string "participating", boolean true, null, undefined, etc.

export function isGcParticipating(resident) {
  if (!resident) return false;
  const status = resident.garbageStatus ?? resident.gcStatus;
  // Exact string match (canonical format)
  if (status === "participating" || status === true) return true;
  // Explicitly not participating or paused must take precedence
  if (
    status === "not_participating" ||
    status === "inactive" ||
    status === "temporary_stopped" ||
    status === "opted_out" ||
    status === false
  ) {
    return false;
  }
  // If created by a collector or assigned to a collector, default to participating
  if (resident.createdBy === "Collector" || Boolean(resident.collectorId)) {
    return true;
  }
  // If resident has a monthly charge configured, default to participating
  if (Number(resident.charge) > 0) {
    return true;
  }
  return false;
}

// ─── Society Stats ───────────────────────────

export function calcResidentStats(residents = []) {
  const total = residents.length;
  const activeResidents = residents.filter((r) => r.status !== "Inactive" && r.status !== "inactive");
  const active = activeResidents.length;
  const inactive = total - active;
  const gcParticipants = activeResidents.filter((r) => isGcParticipating(r)).length;
  const gcNonParticipants = active - gcParticipants;
  return { total, active, inactive, gcParticipants, gcNonParticipants };
}

/**
 * Block‑level overview stats.
 * Occupancy is derived from BOTH:
 *  1. flats with a residentId set, AND
 *  2. residents whose blockId/block name matches a block + flatNumber matches a flat,
 *     even if the flat doc was never linked.
 * This ensures occupancy is accurate even when the flat‑linking step was skipped.
 */
export function calcBlockStats(blocks = [], flats = [], residents = []) {
  // Build a set of flat keys that are occupied via resident mapping
  const occupiedKeys = new Set();

  // Mark flats that already have residentId
  flats.forEach((f) => {
    if (f.residentId) {
      occupiedKeys.add(`${f.blockId}||${normalizeFlat(f.flatNumber)}`);
    }
  });

  // Also check residents whose blockId + flatNumber matches a flat doc
  const flatKeySet = new Set(
    flats.map((f) => `${f.blockId}||${normalizeFlat(f.flatNumber)}`)
  );

  (residents || []).forEach((r) => {
    if (!r.blockId && !r.block) return;
    // Try blockId first, then fall back to matching block name → block id
    let bId = r.blockId || "";
    if (!bId && r.block) {
      const matchedBlock = blocks.find(
        (b) => b.name && b.name.toLowerCase() === r.block.toLowerCase()
      );
      if (matchedBlock) bId = matchedBlock.id;
    }
    if (!bId) return;
    const flatKey = `${bId}||${normalizeFlat(r.flat || r.flatNumber)}`;
    if (flatKeySet.has(flatKey)) {
      occupiedKeys.add(flatKey);
    }
  });

  return {
    totalBlocks: blocks.length,
    totalFlats: flats.length,
    occupiedFlats: occupiedKeys.size,
    vacantFlats: Math.max(0, flats.length - occupiedKeys.size),
  };
}

export function calcCollectorStats(collectors = []) {
  return {
    total: collectors.length,
    active: collectors.filter((c) => c.status !== "inactive").length,
  };
}

export function calcCommitteeStats(committee = []) {
  return {
    total: committee.length,
    active: committee.filter((c) => c.status !== "inactive").length,
  };
}

// ─── Financial / Maintenance Stats ───────────
// Uses the `payments` collection — maintenance billing for ALL active residents.

export function calcPaymentStats(payments = [], residents = [], month, year) {
  const monthlyPayments = payments.filter(
    (p) => p.month === month && Number(p.year) === Number(year)
  );

  const collectedAmount = monthlyPayments.reduce(
    (sum, p) => sum + Number(p.amount || 0), 0
  );

  // Expected amount: ALL active residents × their charge
  // This is maintenance billing — NOT garbage-specific
  const activeResidents = residents.filter(
    (r) => r.status !== "Inactive" && r.status !== "inactive"
  );

  const expectedAmount = activeResidents.reduce(
    (sum, r) => sum + Number(r.charge || 0), 0
  );

  const pendingAmount = Math.max(0, expectedAmount - collectedAmount);

  const collectionRate = expectedAmount === 0
    ? 0
    : Math.round((collectedAmount / expectedAmount) * 100);

  const paidResidentIds = new Set(monthlyPayments.map((p) => p.residentId));
  const paidCount = activeResidents.filter((r) => paidResidentIds.has(r.id)).length;
  const pendingCount = Math.max(0, activeResidents.length - paidCount);

  // Today's breakdown
  const today = new Date().toLocaleDateString("en-IN");
  const todayPayments = monthlyPayments.filter((p) => p.paymentDate === today);
  const todayTotal = todayPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayCash = todayPayments
    .filter((p) => p.paymentMethod === "Cash")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayUPI = todayPayments
    .filter((p) => p.paymentMethod === "UPI")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayBank = todayPayments
    .filter((p) => p.paymentMethod === "Bank Transfer")
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  return {
    collectedAmount,
    expectedAmount,
    pendingAmount,
    collectionRate,
    paidCount,
    pendingCount,
    todayTotal,
    todayCash,
    todayUPI,
    todayBank,
    todayCount: todayPayments.length,
    totalReceipts: monthlyPayments.length,
    monthlyPayments,
  };
}

// ─── Garbage Stats ───────────────────────────
// Uses the `garbageBills` collection.
// `accounts` = garbageAccounts docs.
// gcParticipants is ALWAYS derived from master resident data, NOT accounts.

export function calcGarbageStats(accounts = [], bills = [], residents = [], month, year, payments = []) {
  // Participants from master resident data (single source of truth)
  const participatingResidents = (residents || []).filter(
    (r) =>
      isGcParticipating(r) &&
      r.status !== "Inactive" && r.status !== "inactive"
  );
  const gcParticipants = participatingResidents.length;
  const gcNonParticipants = (residents || []).filter(
    (r) =>
      !isGcParticipating(r) &&
      r.status !== "Inactive" && r.status !== "inactive"
  ).length;

  const participatingIds = new Set(participatingResidents.map((r) => r.id));
  const allResidentIds = new Set((residents || []).map((r) => r.id));

  // Only count unique accounts that belong to valid residents
  const totalAccounts = new Set(
    accounts.filter((a) => a.residentId && allResidentIds.has(a.residentId)).map((a) => a.residentId)
  ).size;
  // Active accounts: unique active participating residents who have an active account
  const activeAccounts = new Set(
    accounts
      .filter((a) => a.status === "active" && a.residentId && participatingIds.has(a.residentId))
      .map((a) => a.residentId)
  ).size;


  // Monthly bills for selected period
  const allMonthlyBills = (bills || []).filter(
    (b) => b.month === month && Number(b.year) === Number(year)
  );

  // IMPORTANT: Only include bills for CURRENTLY participating residents
  const monthlyBills = allMonthlyBills.filter(
    (b) => participatingIds.has(b.residentId)
  );

  // Monthly payments for participating residents
  const monthlyPayments = (payments || []).filter(
    (p) => p.month === month && Number(p.year) === Number(year) && participatingIds.has(p.residentId)
  );

  // Unified paid set
  const paidBills = monthlyBills.filter((b) => b.status === "Paid" || b.status === "Exempted");
  const paidResidentIds = new Set([
    ...paidBills.map((b) => b.residentId),
    ...monthlyPayments.map((p) => p.residentId),
  ]);

  // Expected amount: sum of billed amounts or participant charges
  let totalBilled;
  if (monthlyBills.length > 0) {
    const billMap = new Map();
    monthlyBills.forEach((b) => billMap.set(b.residentId, Number(b.amount || 0)));
    totalBilled = participatingResidents.reduce((s, r) => {
      return s + (billMap.has(r.id) ? billMap.get(r.id) : Number(r.charge || 0));
    }, 0);
  } else {
    totalBilled = participatingResidents.reduce((s, r) => s + Number(r.charge || 0), 0);
  }

  // Collected = sum of actual paid amounts without double counting
  let collectedAmount = 0;
  paidResidentIds.forEach((resId) => {
    const p = monthlyPayments.find((pay) => pay.residentId === resId);
    if (p) {
      collectedAmount += Number(p.amount || 0);
      return;
    }
    const b = paidBills.find((bill) => bill.residentId === resId);
    if (b) {
      collectedAmount += Number(b.paidAmount || b.amount || 0);
      return;
    }
    const r = participatingResidents.find((res) => res.id === resId);
    if (r) {
      collectedAmount += Number(r.charge || 0);
    }
  });

  const pendingAmount = Math.max(0, totalBilled - collectedAmount);

  const paidCount = participatingResidents.filter((r) => paidResidentIds.has(r.id)).length;
  const pendingCount = Math.max(0, gcParticipants - paidCount);

  const collectionRate = totalBilled === 0
    ? 0
    : Math.round((collectedAmount / totalBilled) * 100);

  return {
    totalAccounts,
    activeAccounts,
    gcParticipants,
    gcNonParticipants,
    totalBilled,
    collectedAmount,
    pendingAmount,
    collectionRate,
    paidCount,
    pendingCount,
    monthlyBills,
    paidResidentIds,
  };
}

// ─── Complaint Stats ─────────────────────────

export function calcComplaintStats(complaints = []) {
  const total = complaints.length;
  const open = complaints.filter((c) => c.status === "Open" || c.status === "open" || c.status === "Pending" || c.status === "pending").length;
  const inProgress = complaints.filter((c) => c.status === "In Progress" || c.status === "in_progress").length;
  const resolved = complaints.filter((c) => c.status === "Resolved" || c.status === "resolved" || c.status === "Closed" || c.status === "closed").length;
  return { total, open, inProgress, resolved };
}

// ─── Event Stats ─────────────────────────────

export function calcEventStats(events = []) {
  const total = events.length;
  const upcoming = events.filter((e) => {
    if (!e.date) return false;
    try {
      return new Date(e.date) >= new Date(new Date().toDateString());
    } catch { return false; }
  }).length;
  return { total, upcoming };
}

// ─── Notice Stats ────────────────────────────

export function calcNoticeStats(notices = []) {
  return { total: notices.length };
}

// ─── Centralized GC Monthly Stats ────────────
// ONE function used by Dashboard, Residents, Garbage Overview.
// Uses residents (source of truth for participation) + garbageBills/payments (billing data).

export function getGarbageMonthlyStats(
  residents = [],
  garbageBills = [],
  month,
  year,
  payments = [],
  bills = []
) {
  // 1. Participants = active residents with garbageStatus === "participating"
  const participatingResidents = (residents || []).filter(
    (r) =>
      isGcParticipating(r) &&
      r.status !== "Inactive" && r.status !== "inactive"
  );
  const participants = participatingResidents.length;

  // Build set of currently-participating resident IDs
  const participatingIds = new Set(participatingResidents.map((r) => r.id));

  // 2. ALL monthly bills for selected period (unfiltered — for historical reference)
  const allMonthlyBills = (garbageBills || []).filter(
    (b) => b.month === month && Number(b.year) === Number(year)
  );

  // 3. ACTIVE monthly bills = only bills for CURRENTLY participating residents.
  const monthlyBills = allMonthlyBills.filter(
    (b) => participatingIds.has(b.residentId)
  );

  // 4. Monthly payments for selected period for participating residents
  const monthlyPayments = (payments || []).filter(
    (p) => p.month === month && Number(p.year) === Number(year) && participatingIds.has(p.residentId)
  );

  // 5. Monthly general bills that are paid/exempted for participating residents
  const monthlyPaidBills = (bills || []).filter(
    (b) => b.month === month && Number(b.year) === Number(year) && (b.status === "Paid" || b.status === "Exempted") && participatingIds.has(b.residentId)
  );

  // 6. Paid bills in garbageBills
  const paidBills = monthlyBills.filter((b) => b.status === "Paid" || b.status === "Exempted");

  // 7. Unified set of resident IDs who have paid for this month from ANY valid source
  const paidResidentIds = new Set([
    ...paidBills.map((b) => b.residentId),
    ...monthlyPayments.map((p) => p.residentId),
    ...monthlyPaidBills.map((b) => b.residentId),
  ]);

  const billedResidentIds = new Set([
    ...monthlyBills.map((b) => b.residentId),
    ...monthlyPayments.map((p) => p.residentId),
    ...monthlyPaidBills.map((b) => b.residentId),
  ]);

  // 8. Paid = participating residents who have paid
  const paidResidents = participatingResidents.filter(
    (r) => paidResidentIds.has(r.id)
  ).length;

  // 9. Pending = participants - paid
  const pendingResidents = Math.max(0, participants - paidResidents);

  // 10. Expected = sum of billed amounts for currently-participating residents
  // If bills exist for some, use their bill amount; for others use resident charge
  let expectedAmount;
  if (monthlyBills.length > 0) {
    const billMap = new Map();
    monthlyBills.forEach((b) => billMap.set(b.residentId, Number(b.amount || 0)));
    expectedAmount = participatingResidents.reduce((s, r) => {
      return s + (billMap.has(r.id) ? billMap.get(r.id) : Number(r.charge || 0));
    }, 0);
  } else {
    expectedAmount = participatingResidents.reduce(
      (s, r) => s + Number(r.charge || 0), 0
    );
  }

  // 11. Collected = sum of actual paid amounts (unified across payments, garbageBills, and general bills without double counting)
  let collectedAmount = 0;
  paidResidentIds.forEach((resId) => {
    // Check payments first
    const p = monthlyPayments.find((pay) => pay.residentId === resId);
    if (p) {
      collectedAmount += Number(p.amount || 0);
      return;
    }
    // Check garbageBills
    const gb = paidBills.find((b) => b.residentId === resId);
    if (gb) {
      collectedAmount += Number(gb.paidAmount || gb.amount || 0);
      return;
    }
    // Check general bills
    const mb = monthlyPaidBills.find((b) => b.residentId === resId);
    if (mb) {
      collectedAmount += Number(mb.amount || 0);
      return;
    }
    // Fallback to resident charge
    const res = participatingResidents.find((r) => r.id === resId);
    if (res) {
      collectedAmount += Number(res.charge || 0);
    }
  });

  // 12. Pending amount
  const pendingAmount = Math.max(0, expectedAmount - collectedAmount);

  // 13. Collection percentage
  const collectionPercentage = expectedAmount === 0
    ? 0
    : Math.round((collectedAmount / expectedAmount) * 100);

  return {
    participants,
    paidResidents,
    pendingResidents,
    expectedAmount,
    collectedAmount,
    pendingAmount,
    collectionPercentage,
    paidResidentIds,
    billedResidentIds,
  };
}


import { useMemo } from "react";
import {
  FaMoneyBillWave,
  FaReceipt,
  FaUserTie,
  FaWallet,
  FaMobileAlt,
  FaUniversity,
  FaTrophy,
  FaBuilding,
} from "react-icons/fa";

import SummaryCard from "../dashboard/SummaryCard";
import {
  matchesCollector,
  isValidConfirmedSpecialPayment,
  normalizePaymentMethod,
} from "../../utils/collectorHelper";

export default function CollectorStatsCards({
  payments = [],
  specialPayments = [],
  collectors = [],
  collectionScope = "all", // "all" | "garbage" | "special"
  periodType = "today", // "today" | "custom" | "monthly" | "yearly" | "all_time"
  periodLabel = "Today",
}) {
  const stats = useMemo(() => {
    // 1. Garbage Payments for active period
    const validGc = payments || [];
    const gcTotal = validGc.reduce((s, p) => s + Number(p.amount || 0), 0);
    const gcCash = validGc
      .filter((p) => normalizePaymentMethod(p) === "Cash")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const gcUPI = validGc
      .filter((p) => normalizePaymentMethod(p) === "UPI")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const gcBank = validGc
      .filter((p) => normalizePaymentMethod(p) === "Bank Transfer")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const gcActive = new Set(
      validGc
        .filter((p) => !matchesCollector(p, { id: "admin_office", isAdmin: true }))
        .map((p) => p.collectorId || p.collector)
        .filter(Boolean)
    ).size;

    // 2. Special Payments for active period (Confirmed collections ONLY)
    const validSc = (specialPayments || []).filter(isValidConfirmedSpecialPayment);
    const scTotal = validSc.reduce((s, p) => s + Number(p.amount || 0), 0);
    const scCash = validSc
      .filter((p) => normalizePaymentMethod(p) === "Cash")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const scUPI = validSc
      .filter((p) => normalizePaymentMethod(p) === "UPI")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const scBank = validSc
      .filter((p) => normalizePaymentMethod(p) === "Bank Transfer")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const scActive = new Set(
      validSc
        .filter((p) => !matchesCollector(p, { id: "admin_office", isAdmin: true }))
        .map((p) => p.collectorId || p.collectorName)
        .filter(Boolean)
    ).size;

    // 3. Combine or pick by collectionScope
    let totalAmount = 0;
    let totalCash = 0;
    let totalUPI = 0;
    let totalBank = 0;
    let totalReceipts = 0;
    let activeCollectors = 0;
    let collectionSub = "";
    let cashSub = "";
    let upiSub = "";
    let bankSub = "";
    let receiptSub = "";

    // Field vs Admin / Office split
    let fieldCollectorsTotal = 0;
    let adminOfficeTotal = 0;

    const computeSplit = (list) => {
      list.forEach((p) => {
        const isAdm = matchesCollector(p, { id: "admin_office", isAdmin: true });
        if (isAdm) adminOfficeTotal += Number(p.amount || 0);
        else fieldCollectorsTotal += Number(p.amount || 0);
      });
    };

    if (collectionScope === "garbage") {
      totalAmount = gcTotal;
      totalCash = gcCash;
      totalUPI = gcUPI;
      totalBank = gcBank;
      totalReceipts = validGc.length;
      activeCollectors = gcActive;
      computeSplit(validGc);
      collectionSub = `${gcActive} field active • Garbage Only`;
      cashSub = `Cash (Garbage) • ₹${gcCash.toLocaleString()}`;
      upiSub = `UPI (Garbage) • ₹${gcUPI.toLocaleString()}`;
      bankSub = `Bank (Garbage) • ₹${gcBank.toLocaleString()}`;
      receiptSub = `Garbage receipts (${periodLabel})`;
    } else if (collectionScope === "special") {
      totalAmount = scTotal;
      totalCash = scCash;
      totalUPI = scUPI;
      totalBank = scBank;
      totalReceipts = validSc.length;
      activeCollectors = scActive;
      computeSplit(validSc);
      collectionSub = `${scActive} field active • Special Only`;
      cashSub = `Cash (Special) • ₹${scCash.toLocaleString()}`;
      upiSub = `UPI (Special) • ₹${scUPI.toLocaleString()}`;
      bankSub = `Bank (Special) • ₹${scBank.toLocaleString()}`;
      receiptSub = `Special receipts (${periodLabel})`;
    } else {
      // "all" Combined
      totalAmount = gcTotal + scTotal;
      totalCash = gcCash + scCash;
      totalUPI = gcUPI + scUPI;
      totalBank = gcBank + scBank;
      totalReceipts = validGc.length + validSc.length;
      activeCollectors = new Set([
        ...validGc
          .filter((p) => !matchesCollector(p, { id: "admin_office", isAdmin: true }))
          .map((p) => p.collectorId || p.collector),
        ...validSc
          .filter((p) => !matchesCollector(p, { id: "admin_office", isAdmin: true }))
          .map((p) => p.collectorId || p.collectorName),
      ].filter(Boolean)).size;

      computeSplit(validGc);
      computeSplit(validSc);

      collectionSub = `GC: ₹${gcTotal.toLocaleString()} • SC: ₹${scTotal.toLocaleString()}`;
      cashSub = `GC: ₹${gcCash.toLocaleString()} • SC: ₹${scCash.toLocaleString()}`;
      upiSub = `GC: ₹${gcUPI.toLocaleString()} • SC: ₹${scUPI.toLocaleString()}`;
      bankSub = `GC: ₹${gcBank.toLocaleString()} • SC: ₹${scBank.toLocaleString()}`;
      receiptSub = `GC: ${validGc.length} • SC: ${validSc.length}`;
    }

    // 4. Collector totals for Best performer based on scope and period
    const collectorTotals = {};

    collectors
      .filter((c) => c.id !== "admin_office" && !c.isAdmin)
      .forEach((c) => {
        let tot = 0;
        if (collectionScope === "all" || collectionScope === "garbage") {
          tot += validGc
            .filter((p) => matchesCollector(p, c))
            .reduce((s, p) => s + Number(p.amount || 0), 0);
        }
        if (collectionScope === "all" || collectionScope === "special") {
          tot += validSc
            .filter((p) => matchesCollector(p, c))
            .reduce((s, p) => s + Number(p.amount || 0), 0);
        }
        collectorTotals[c.id || c.uid || c.name] = {
          name: c.name + (c.isCommittee ? ` (${c.designation || "Committee"})` : ""),
          total: tot,
        };
      });

    const sorted = Object.values(collectorTotals).sort((a, b) => b.total - a.total);
    const best = sorted[0] || { name: "-", total: 0 };

    return {
      totalAmount,
      totalCash,
      totalUPI,
      totalBank,
      totalReceipts,
      activeCollectors,
      fieldCollectorsTotal,
      adminOfficeTotal,
      collectionSub,
      cashSub,
      upiSub,
      bankSub,
      receiptSub,
      best,
    };
  }, [payments, specialPayments, collectors, collectionScope, periodLabel]);

  // Dynamic titles based on periodType
  const titles = useMemo(() => {
    switch (periodType) {
      case "custom":
        return {
          total: "Custom Date Collection",
          cash: "Cash Received",
          upi: "UPI / Digital",
          bank: "Bank Transfer",
        };
      case "monthly":
        return {
          total: "Monthly Collection",
          cash: "Monthly Cash",
          upi: "Monthly UPI",
          bank: "Monthly Bank Transfer",
        };
      case "yearly":
        return {
          total: "Yearly Collection",
          cash: "Yearly Cash",
          upi: "Yearly UPI",
          bank: "Yearly Bank Transfer",
        };
      case "all_time":
        return {
          total: "Total Collection (All-Time)",
          cash: "Total Cash (All-Time)",
          upi: "Total UPI (All-Time)",
          bank: "Total Bank (All-Time)",
        };
      case "today":
      default:
        return {
          total: "Today's Collection",
          cash: "Today's Cash",
          upi: "Today's UPI",
          bank: "Today's Bank Transfer",
        };
    }
  }, [periodType]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* 1. Total Collection */}
      <SummaryCard
        title={titles.total}
        value={`₹${stats.totalAmount.toLocaleString()}`}
        subtitle={stats.collectionSub}
        color="bg-gradient-to-r from-emerald-600 to-green-500"
        icon={<FaMoneyBillWave />}
      />

      {/* 2. Cash Collection */}
      <SummaryCard
        title={titles.cash}
        value={`₹${stats.totalCash.toLocaleString()}`}
        subtitle={stats.cashSub}
        color="bg-gradient-to-r from-green-700 to-emerald-500"
        icon={<FaWallet />}
      />

      {/* 3. UPI / Digital Collection */}
      <SummaryCard
        title={titles.upi}
        value={`₹${stats.totalUPI.toLocaleString()}`}
        subtitle={stats.upiSub}
        color="bg-gradient-to-r from-purple-600 to-indigo-500"
        icon={<FaMobileAlt />}
      />

      {/* 4. Bank Transfer */}
      <SummaryCard
        title={titles.bank}
        value={`₹${stats.totalBank.toLocaleString()}`}
        subtitle={stats.bankSub}
        color="bg-gradient-to-r from-blue-600 to-cyan-500"
        icon={<FaUniversity />}
      />

      {/* 5. Total Receipts */}
      <SummaryCard
        title="Total Receipts"
        value={stats.totalReceipts}
        subtitle={stats.receiptSub}
        color="bg-gradient-to-r from-orange-500 to-amber-500"
        icon={<FaReceipt />}
      />

      {/* 6. Field Collectors Total */}
      <SummaryCard
        title="Field Collectors Total"
        value={`₹${stats.fieldCollectorsTotal.toLocaleString()}`}
        subtitle={`${stats.activeCollectors} active field collectors`}
        color="bg-gradient-to-r from-teal-600 to-teal-400"
        icon={<FaUserTie />}
      />

      {/* 7. Admin / Society Office (DIRECTLY clarifies the Admin payment!) */}
      <SummaryCard
        title="Admin / Society Office"
        value={`₹${stats.adminOfficeTotal.toLocaleString()}`}
        subtitle="Direct Admin & UPI collections"
        color="bg-gradient-to-r from-indigo-700 to-violet-500"
        icon={<FaBuilding />}
      />

      {/* 8. Top Collector */}
      <SummaryCard
        title="Top Collector"
        value={stats.best.name}
        subtitle={`₹${stats.best.total.toLocaleString()} • ${periodLabel}`}
        color="bg-gradient-to-r from-yellow-600 to-amber-400"
        icon={<FaTrophy />}
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import { FaSearch } from "react-icons/fa";

import { useCollectors } from "../../context/CollectorContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import { useBilling } from "../../context/BillingContext";
import { useCommittee } from "../../context/CommitteeContext";

import DailyReportSummaryCards from "../../components/collectors/DailyReportSummaryCards";
import DailyReportTable from "../../components/collectors/DailyReportTable";
import DailyReportDetailDrawer from "../../components/collectors/DailyReportDetailDrawer";
import DailyReportCharts from "../../components/collectors/DailyReportCharts";
import DailyReportExport from "../../components/collectors/DailyReportExport";
import { isGcParticipating } from "../../services/statisticsService";
import {
  getLocalTodayYMD,
  getLocalTodayEN,
  isSameDate,
  matchesCollector,
  parseDateSafe,
} from "../../utils/collectorHelper";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CollectorDailyReport() {
  const { collectors } = useCollectors();
  const { committee = [] } = useCommittee();
  const { payments } = usePayments();
  const { residents } = useResidents();
  const { selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = useBilling();

  // Combine regular collectors with authorized committee collectors and payment-recorded collectors
  const allCollectors = useMemo(() => {
    const list = [...collectors];
    const existingIds = new Set(list.map((c) => c.id || c.uid));
    const existingNames = new Set(list.map((c) => (c.name || "").trim().toLowerCase()));

    // 1. Committee members
    (committee || []).forEach((m) => {
      const mid = m.id || m.uid;
      const mname = (m.name || "").trim();
      const mnameLower = mname.toLowerCase();

      if (existingIds.has(mid) || (mnameLower && existingNames.has(mnameLower))) {
        return;
      }

      const hasPerm = Boolean(
        m.permissions?.canCollectGarbage ||
        m.permissions?.canCollectSpecial ||
        m.canCollectGarbage ||
        m.canCollectSpecial
      );

      const hasPayments = (payments || []).some((p) => matchesCollector(p, { id: mid, uid: mid, name: mname }));

      if (hasPerm || hasPayments) {
        list.push({
          id: mid,
          uid: mid,
          name: mname,
          mobile: m.mobile || m.phone || "-",
          status: m.status || "Active",
          isCommittee: true,
          designation: m.designation || "Executive Member",
          role: "committee",
        });
        existingIds.add(mid);
        if (mnameLower) existingNames.add(mnameLower);
      }
    });

    // 2. Any other collectors who have recorded payments
    (payments || []).forEach((p) => {
      const pName = (p.collectorName || p.collector || "").trim();
      const pCleanName = pName.replace(/\s*\([^)]*\)/g, "").trim();
      const pNameLower = pCleanName.toLowerCase();
      const pId = p.collectorId || p.collector;

      if (!pName || pName === "General / Admin" || pName === "Admin") return;

      if (!existingIds.has(pId) && !existingNames.has(pNameLower)) {
        const isComm = p.collectorRole === "committee" || p.collector?.includes("(");
        list.push({
          id: pId,
          uid: pId,
          name: pCleanName,
          mobile: "-",
          status: "Active",
          isCommittee: isComm,
          designation: p.collectorDesignation || (isComm ? "Executive Member" : ""),
          role: p.collectorRole || "collector",
        });
        existingIds.add(pId);
        existingNames.add(pNameLower);
      }
    });

    return list;
  }, [collectors, committee, payments]);

  const currentYear = new Date().getFullYear();

  // Local calendar date (YYYY-MM-DD) avoiding UTC midnight timezone rollback
  const [selectedDate, setSelectedDate] = useState(getLocalTodayYMD());
  const [datePreset, setDatePreset] = useState("today");
  const [collectorFilter, setCollectorFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [viewCollector, setViewCollector] = useState(null);

  function applyPreset(preset) {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "today") {
      setSelectedDate(getLocalTodayYMD());
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yYear = y.getFullYear();
      const yMonth = String(y.getMonth() + 1).padStart(2, "0");
      const yDay = String(y.getDate()).padStart(2, "0");
      setSelectedDate(`${yYear}-${yMonth}-${yDay}`);
    }
  }

  // Convert selectedDate (YYYY-MM-DD) to DD/MM/YYYY format for display
  const selectedDateEN = useMemo(() => {
    if (!selectedDate) return getLocalTodayEN();
    const parts = selectedDate.split("-").map(Number);
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return selectedDate;
  }, [selectedDate]);

  // Determine date range for week/month presets
  const dateRange = useMemo(() => {
    const now = new Date();
    if (datePreset === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return { from: weekAgo, to: now };
    }
    if (datePreset === "month") {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    }
    return null;
  }, [datePreset]);

  // Filter payments for the selected date/range + month/year scope
  const filteredPayments = useMemo(() => {
    let result = payments.filter(
      (p) => p.month === selectedMonth && Number(p.year) === Number(selectedYear)
    );

    // Apply date-level filter within the month
    if (datePreset === "today" || datePreset === "yesterday" || datePreset === "custom") {
      result = result.filter((p) => isSameDate(p.paymentDate, selectedDate));
    } else if (dateRange) {
      result = result.filter((p) => {
        const d = parseDateSafe(p.paymentDate);
        return d && d >= dateRange.from && d <= dateRange.to;
      });
    }
    // datePreset === "all-month" → no date filter, show entire month

    if (collectorFilter !== "All") {
      const targetCollector = allCollectors.find(
        (c) => c.name === collectorFilter || c.id === collectorFilter
      );
      result = result.filter((p) => {
        if (targetCollector) return matchesCollector(p, targetCollector);
        return (
          p.collectorId === collectorFilter ||
          p.collector === collectorFilter ||
          p.collectorName === collectorFilter
        );
      });
    }

    if (modeFilter !== "All") {
      result = result.filter((p) => p.paymentMethod === modeFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.collector || "").toLowerCase().includes(q) ||
          (p.collectorName || "").toLowerCase().includes(q) ||
          (p.residentName || "").toLowerCase().includes(q) ||
          (p.flat || "").toLowerCase().includes(q) ||
          (p.receiptNumber || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [payments, selectedMonth, selectedYear, selectedDate, datePreset, dateRange, collectorFilter, allCollectors, modeFilter, search]);

  // Expected collection (sum of participating residents' monthly charges)
  const expectedCollection = residents
    .filter((r) => isGcParticipating(r))
    .reduce(
      (s, r) => s + Number(r.charge || 0), 0
    );

  const displayDateLabel = useMemo(() => {
    if (datePreset === "today") return `Today — ${selectedDateEN}`;
    if (datePreset === "yesterday") return `Yesterday — ${selectedDateEN}`;
    if (datePreset === "week") return "This Week";
    if (datePreset === "month") return "This Month";
    if (datePreset === "all-month") return `${selectedMonth} ${selectedYear}`;
    return selectedDateEN;
  }, [datePreset, selectedDateEN, selectedMonth, selectedYear]);

  return (
    <>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-black text-gray-800 tracking-tight">Collector Daily Report</h1>
              <span className="px-3 py-1 rounded-full text-xs font-black tracking-wide border shadow-sm bg-emerald-50 text-emerald-800 border-emerald-200">
                🗑️ GARBAGE COLLECTION DAILY ANALYSIS
              </span>
            </div>
            <p className="text-gray-500 mt-1 font-medium">{displayDateLabel} • {selectedMonth} {selectedYear}</p>
          </div>
          <DailyReportExport
            payments={filteredPayments}
            collectors={allCollectors}
            label={displayDateLabel}
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">

          {/* Date Presets */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Today", value: "today" },
              { label: "Yesterday", value: "yesterday" },
              { label: "This Week", value: "week" },
              { label: "This Month", value: "month" },
              { label: "Full Month", value: "all-month" },
              { label: "Custom Date", value: "custom" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => applyPreset(f.value)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  datePreset === f.value
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Second row: dropdowns + search */}
          <div className="flex flex-wrap gap-3 items-center">

            {datePreset === "custom" && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-emerald-500 outline-none"
              />
            )}

            {/* Month Filter */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-emerald-500 outline-none font-medium"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Year Filter */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-emerald-500 outline-none font-medium"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Collector Filter */}
            <select
              value={collectorFilter}
              onChange={(e) => setCollectorFilter(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-emerald-500 outline-none"
            >
              <option value="All">All Collectors</option>
              {allCollectors.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} {c.isCommittee ? `(Committee - ${c.designation || "Member"})` : ""}
                </option>
              ))}
            </select>

            {/* Payment Mode Filter */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-emerald-500 outline-none"
            >
              <option value="All">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>

            {/* Search */}
            <div className="relative flex-1 min-w-[220px]">
              <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collector, resident, flat, receipt..."
                className="w-full border-2 border-gray-200 rounded-xl pl-10 py-2.5 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <DailyReportSummaryCards
          payments={filteredPayments}
          expectedCollection={expectedCollection}
          collectors={allCollectors}
        />

        {/* Charts */}
        <DailyReportCharts
          payments={filteredPayments}
          collectors={allCollectors}
        />

        {/* Table */}
        <DailyReportTable
          collectors={allCollectors}
          payments={filteredPayments}
          residents={residents}
          onView={(c) => setViewCollector(c)}
        />

      </div>

      {/* Detail Drawer */}
      <DailyReportDetailDrawer
        open={!!viewCollector}
        collector={viewCollector}
        payments={filteredPayments}
        onClose={() => setViewCollector(null)}
      />
    </>
  );
}

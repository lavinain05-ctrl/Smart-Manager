import { useState, useMemo, useEffect } from "react";
import {
  FaTimes,
  FaClock,
  FaSearch,
  FaWhatsapp,
  FaPhoneAlt,
  FaMoneyBillWave,
  FaFileExcel,
  FaPrint,
  FaCopy,
  FaCheck,
  FaSortAmountDown,
  FaExclamationTriangle,
  FaShieldAlt,
  FaCalendarAlt,
  FaArrowUp,
  FaCheckCircle,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { isGcParticipating } from "../../services/statisticsService";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function PendingDuesModal({
  isOpen,
  onClose,
  residents = [],
  bills = [],
  garbageBills = [],
  payments = [],
  gcMonthlyStats,
  currentMonth,
  currentYear,
  onCollectPayment,
}) {
  const [scope, setScope] = useState("month"); // 'month' | 'year' | 'all_time'
  const [activeMonth, setActiveMonth] = useState(currentMonth || "September");
  const [activeYear, setActiveYear] = useState(Number(currentYear) || 2026);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBlock, setFilterBlock] = useState("all");
  const [allTimeBills, setAllTimeBills] = useState([]);
  const [loadingAllTime, setLoadingAllTime] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Sync initial month and year from props
  useEffect(() => {
    if (currentMonth) setActiveMonth(currentMonth);
    if (currentYear) setActiveYear(Number(currentYear));
  }, [currentMonth, currentYear, isOpen]);

  // Fetch all historical pending bills when modal is open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function fetchHistoricalPendingBills() {
      setLoadingAllTime(true);
      try {
        const [billsSnap, gcBillsSnap] = await Promise.all([
          getDocs(query(collection(db, "bills"), where("status", "==", "Pending"))),
          getDocs(query(collection(db, "garbageBills"), where("status", "==", "Pending"))),
        ]);

        if (!isMounted) return;

        const fetchedBills = [
          ...billsSnap.docs.map((d) => ({ id: d.id, ...d.data(), source: "bills" })),
          ...gcBillsSnap.docs.map((d) => ({ id: d.id, ...d.data(), source: "garbageBills" })),
        ];
        setAllTimeBills(fetchedBills);
      } catch (err) {
        console.error("Failed to fetch historical pending bills:", err);
      } finally {
        if (isMounted) setLoadingAllTime(false);
      }
    }

    fetchHistoricalPendingBills();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Derive unique blocks for block filter
  const blocks = useMemo(() => {
    const set = new Set();
    residents.forEach((r) => {
      if (r.block) set.add(r.block);
    });
    return Array.from(set).sort();
  }, [residents]);

  // ─────────────────────────────────────────────────────────────
  // Core Pending Calculation Logic
  // ─────────────────────────────────────────────────────────────
  const pendingData = useMemo(() => {
    if (!isOpen) return [];

    const activeResidents = residents.filter(
      (r) =>
        r.status !== "Inactive" &&
        r.status !== "inactive" &&
        isGcParticipating(r)
    );

    const residentMap = new Map();
    activeResidents.forEach((r) => {
      residentMap.set(r.id, {
        resident: r,
        totalPendingAmount: 0,
        pendingMonths: [], // [{ month, year, amount, billId }]
        billsCount: 0,
      });
    });

    if (scope === "month") {
      // ─── Scope: Specific Month ───
      const isMonthPaid = (resId) => {
        if (
          activeMonth === currentMonth &&
          Number(activeYear) === Number(currentYear) &&
          gcMonthlyStats?.paidResidentIds
        ) {
          return gcMonthlyStats.paidResidentIds.has(resId);
        }

        const hasPayment = payments.some(
          (p) =>
            p.residentId === resId &&
            p.month === activeMonth &&
            Number(p.year) === Number(activeYear)
        );
        if (hasPayment) return true;

        const hasPaidGcBill = (garbageBills || []).some(
          (b) =>
            b.residentId === resId &&
            b.month === activeMonth &&
            Number(b.year) === Number(activeYear) &&
            (b.status === "Paid" || b.status === "Exempted")
        );
        if (hasPaidGcBill) return true;

        const hasPaidBill = (bills || []).some(
          (b) =>
            b.residentId === resId &&
            b.month === activeMonth &&
            Number(b.year) === Number(activeYear) &&
            (b.status === "Paid" || b.status === "Exempted")
        );
        return hasPaidBill;
      };

      activeResidents.forEach((r) => {
        if (!isMonthPaid(r.id)) {
          const matchingBill =
            (bills || []).find(
              (b) =>
                b.residentId === r.id &&
                b.month === activeMonth &&
                Number(b.year) === Number(activeYear) &&
                b.status === "Pending"
            ) ||
            (garbageBills || []).find(
              (b) =>
                b.residentId === r.id &&
                b.month === activeMonth &&
                Number(b.year) === Number(activeYear) &&
                b.status === "Pending"
            );

          let pendingAmt = 0;
          if (matchingBill) {
            pendingAmt = Number(matchingBill.amount || 0) - Number(matchingBill.paidAmount || 0);
          }
          if (pendingAmt <= 0) {
            pendingAmt = Number(r.charge || 80);
          }

          const entry = residentMap.get(r.id);
          entry.totalPendingAmount = pendingAmt;
          entry.pendingMonths.push({
            month: activeMonth,
            year: activeYear,
            amount: pendingAmt,
            billId: matchingBill?.id || null,
          });
          entry.billsCount = 1;
        }
      });
    } else if (scope === "year") {
      // ─── Scope: Full Year ───
      const yearBills = (bills || []).filter(
        (b) => Number(b.year) === Number(activeYear)
      );
      const yearGcBills = (garbageBills || []).filter(
        (b) => Number(b.year) === Number(activeYear)
      );
      const yearPayments = (payments || []).filter(
        (p) => Number(p.year) === Number(activeYear)
      );

      const billedMonths = new Set([
        ...yearBills.map((b) => b.month),
        ...yearGcBills.map((b) => b.month),
        ...yearPayments.map((p) => p.month),
      ]);

      if (activeYear === new Date().getFullYear()) {
        const curIdx = new Date().getMonth();
        for (let i = 0; i <= curIdx; i++) {
          billedMonths.add(MONTH_NAMES[i]);
        }
      }

      if (billedMonths.size === 0) {
        billedMonths.add(activeMonth);
      }

      activeResidents.forEach((r) => {
        const entry = residentMap.get(r.id);

        billedMonths.forEach((m) => {
          const paid =
            yearPayments.some((p) => p.residentId === r.id && p.month === m) ||
            yearGcBills.some(
              (b) =>
                b.residentId === r.id &&
                b.month === m &&
                (b.status === "Paid" || b.status === "Exempted")
            ) ||
            yearBills.some(
              (b) =>
                b.residentId === r.id &&
                b.month === m &&
                (b.status === "Paid" || b.status === "Exempted")
            );

          if (!paid) {
            const matchingBill =
              yearBills.find(
                (b) => b.residentId === r.id && b.month === m && b.status === "Pending"
              ) ||
              yearGcBills.find(
                (b) => b.residentId === r.id && b.month === m && b.status === "Pending"
              );

            let due = 0;
            if (matchingBill) {
              due = Number(matchingBill.amount || 0) - Number(matchingBill.paidAmount || 0);
            }
            if (due <= 0) {
              due = Number(r.charge || 80);
            }

            entry.totalPendingAmount += due;
            entry.pendingMonths.push({
              month: m,
              year: activeYear,
              amount: due,
              billId: matchingBill?.id || null,
            });
            entry.billsCount += 1;
          }
        });
      });
    } else {
      // ─── Scope: All Time ───
      const allKnownPendingBills = [
        ...allTimeBills,
        ...(bills || []).filter((b) => b.status === "Pending"),
        ...(garbageBills || []).filter((b) => b.status === "Pending"),
      ];

      const seenBillIds = new Set();
      const uniquePendingBills = [];
      allKnownPendingBills.forEach((b) => {
        if (!seenBillIds.has(b.id)) {
          seenBillIds.add(b.id);
          uniquePendingBills.push(b);
        }
      });

      uniquePendingBills.forEach((b) => {
        const resId = b.residentId;
        let entry = residentMap.get(resId);
        if (!entry) {
          const found = activeResidents.find(
            (r) => (r.flat && r.flat === b.flat) || (r.owner && r.owner === b.residentName)
          );
          if (found) entry = residentMap.get(found.id);
        }

        if (entry) {
          const amt = Number(b.amount || 0) - Number(b.paidAmount || 0);
          if (amt > 0) {
            entry.totalPendingAmount += amt;
            entry.pendingMonths.push({
              month: b.month || "Unknown",
              year: b.year || 2026,
              amount: amt,
              billId: b.id,
            });
            entry.billsCount += 1;
          }
        }
      });

      activeResidents.forEach((r) => {
        const entry = residentMap.get(r.id);
        if (entry.totalPendingAmount === 0) {
          const hasPaid =
            (payments || []).some(
              (p) =>
                p.residentId === r.id &&
                p.month === currentMonth &&
                Number(p.year) === Number(currentYear)
            ) ||
            (bills || []).some(
              (b) =>
                b.residentId === r.id &&
                b.month === currentMonth &&
                Number(b.year) === Number(currentYear) &&
                (b.status === "Paid" || b.status === "Exempted")
            );

          if (!hasPaid) {
            const due = Number(r.charge || 80);
            entry.totalPendingAmount += due;
            entry.pendingMonths.push({
              month: currentMonth,
              year: Number(currentYear),
              amount: due,
              billId: null,
            });
            entry.billsCount += 1;
          }
        }
      });
    }

    const list = Array.from(residentMap.values()).filter(
      (item) => item.totalPendingAmount > 0
    );

    // ─────────────────────────────────────────────────────────────
    // CRITICAL REQUIREMENT:
    // "SHOWS THE RESIDENT PENDING AMOUNT IN SEQUESCE OF LARGE AMOUNT FROM HIGH TO LOW"
    // ─────────────────────────────────────────────────────────────
    list.sort((a, b) => {
      if (b.totalPendingAmount !== a.totalPendingAmount) {
        return b.totalPendingAmount - a.totalPendingAmount;
      }
      return (a.resident.flat || "").localeCompare(
        b.resident.flat || "",
        undefined,
        { numeric: true }
      );
    });

    return list;
  }, [
    isOpen,
    scope,
    activeMonth,
    activeYear,
    residents,
    bills,
    garbageBills,
    payments,
    gcMonthlyStats,
    currentMonth,
    currentYear,
    allTimeBills,
  ]);

  const filteredList = useMemo(() => {
    return pendingData.filter((item) => {
      const r = item.resident;
      const search = searchTerm.trim().toLowerCase();
      if (search) {
        const matches =
          (r.flat || "").toLowerCase().includes(search) ||
          (r.owner || "").toLowerCase().includes(search) ||
          (r.mobile || "").includes(search) ||
          (r.block || "").toLowerCase().includes(search);
        if (!matches) return false;
      }

      if (filterBlock !== "all") {
        if ((r.block || "").toLowerCase() !== filterBlock.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [pendingData, searchTerm, filterBlock]);

  const metrics = useMemo(() => {
    const totalAmount = pendingData.reduce(
      (sum, item) => sum + item.totalPendingAmount,
      0
    );
    const count = pendingData.length;
    const highestAmount = count > 0 ? pendingData[0].totalPendingAmount : 0;
    const highestResident = count > 0 ? pendingData[0].resident : null;
    const avgAmount = count > 0 ? Math.round(totalAmount / count) : 0;

    return {
      totalAmount,
      count,
      highestAmount,
      highestResident,
      avgAmount,
    };
  }, [pendingData]);

  function handleSendWhatsApp(item) {
    const r = item.resident;
    const cleanPhone = (r.mobile || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Invalid mobile number for WhatsApp reminder");
      return;
    }

    const phoneWithCountry =
      cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const periodText =
      scope === "month"
        ? `${activeMonth} ${activeYear}`
        : scope === "year"
        ? `the year ${activeYear} (${item.pendingMonths.length} months)`
        : `all past pending dues (${item.pendingMonths.length} billing periods)`;

    const message = `Dear ${r.owner || "Resident"} (Flat: ${r.flat || "—"}, Block: ${r.block || "—"}),

This is a gentle payment reminder from D BLOCK RWA INDRAPRASTHA (Smart Manager).

Your pending dues amount to *₹${item.totalPendingAmount.toLocaleString("en-IN")}* for *${periodText}*.

Please clear your pending dues at the earliest via Cash, UPI, or Bank Transfer to avoid service disruption.

For any queries or assistance, please contact the RWA Office.
Thank you!
— RWA Administration`;

    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  function handleCopyDetails(item) {
    const r = item.resident;
    const text = `Flat: ${r.flat} | Name: ${r.owner} | Mobile: ${r.mobile} | Block: ${r.block} | Pending Dues: ₹${item.totalPendingAmount}`;
    navigator.clipboard.writeText(text);
    setCopiedId(r.id);
    toast.success(`Copied details for Flat ${r.flat}`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleExportExcel() {
    if (filteredList.length === 0) {
      toast.error("No pending records to export");
      return;
    }

    const data = filteredList.map((item, index) => {
      const r = item.resident;
      const monthsStr = item.pendingMonths
        .map((p) => `${p.month} ${p.year}`)
        .join(", ");

      return {
        "Rank (High to Low)": index + 1,
        "Flat Number": r.flat || "",
        "Resident Name": r.owner || "",
        "Mobile Number": r.mobile || "",
        Block: r.block || "",
        "Monthly Charge (₹)": r.charge || 80,
        "Total Pending Amount (₹)": item.totalPendingAmount,
        "Pending Months Count": item.pendingMonths.length,
        "Pending Periods": monthsStr || `${activeMonth} ${activeYear}`,
        Scope:
          scope === "month"
            ? `${activeMonth} ${activeYear}`
            : scope === "year"
            ? `Year ${activeYear}`
            : "All Time",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pending Defaulters");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fileName = `RWA_Pending_Residents_${scope.toUpperCase()}_${Date.now()}.xlsx`;
    saveAs(blob, fileName);
    toast.success("Excel report exported successfully!");
  }

  function handlePrint() {
    window.print();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* ─── Modal Header ─── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-red-50/80 via-rose-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500 text-white flex items-center justify-center text-xl shadow-lg shadow-red-200">
              <FaClock />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-gray-800">
                  Pending Residents Payments
                </h2>
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                  <FaSortAmountDown className="text-[10px]" /> High → Low
                </span>
              </div>
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                Outstanding dues checklist ordered from largest pending amount to smallest
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* ─── Scope Tabs & Filters Bar ─── */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/70 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Scope Tabs: Month | Year | All Time */}
            <div className="inline-flex p-1.5 bg-gray-200/80 rounded-2xl gap-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setScope("month")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
                  scope === "month"
                    ? "bg-white text-red-600 shadow-sm font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <FaCalendarAlt className="text-xs" />
                Selected Month
              </button>

              <button
                type="button"
                onClick={() => setScope("year")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
                  scope === "year"
                    ? "bg-white text-red-600 shadow-sm font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <FaShieldAlt className="text-xs" />
                Full Year ({activeYear})
              </button>

              <button
                type="button"
                onClick={() => setScope("all_time")}
                className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
                  scope === "all_time"
                    ? "bg-white text-red-600 shadow-sm font-bold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <FaArrowUp className="text-xs" />
                All Time (Cumulative)
              </button>
            </div>

            {/* Scope Date Switchers */}
            <div className="flex items-center gap-2 flex-wrap">
              {scope === "month" && (
                <>
                  <select
                    value={activeMonth}
                    onChange={(e) => setActiveMonth(e.target.value)}
                    className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                  >
                    {MONTH_NAMES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={activeYear}
                    onChange={(e) => setActiveYear(Number(e.target.value))}
                    className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {scope === "year" && (
                <select
                  value={activeYear}
                  onChange={(e) => setActiveYear(Number(e.target.value))}
                  className="bg-white border border-gray-300 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              )}

              {/* Action buttons: Excel & Print */}
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl text-sm font-semibold transition shadow-sm"
                title="Export list to Excel"
              >
                <FaFileExcel className="text-emerald-600" /> Excel
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 px-3.5 py-2 rounded-xl text-sm font-semibold transition shadow-sm"
                title="Print pending list"
              >
                <FaPrint className="text-gray-500" /> Print
              </button>
            </div>
          </div>

          {/* Search and Block Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search flat, resident, mobile, block..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none shadow-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-gray-500 font-medium">Block:</span>
              <select
                value={filterBlock}
                onChange={(e) => setFilterBlock(e.target.value)}
                className="bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
              >
                <option value="all">All Blocks</option>
                {blocks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ─── Metric KPI Cards ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-white border-b border-gray-100">
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200/70 rounded-2xl p-4">
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide">
              Total Pending Dues
            </p>
            <h3 className="text-2xl font-black text-red-700 mt-1">
              ₹{metrics.totalAmount.toLocaleString("en-IN")}
            </h3>
            <p className="text-[11px] text-red-500 font-medium mt-0.5">
              {metrics.count} Defaulter Residents
            </p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200/70 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              Largest Outstanding Due
            </p>
            <h3 className="text-2xl font-black text-amber-800 mt-1">
              ₹{metrics.highestAmount.toLocaleString("en-IN")}
            </h3>
            <p className="text-[11px] text-amber-700 font-medium mt-0.5 truncate">
              {metrics.highestResident
                ? `Flat ${metrics.highestResident.flat} (${metrics.highestResident.owner})`
                : "No pending dues"}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/70 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              Average Due / Resident
            </p>
            <h3 className="text-2xl font-black text-blue-800 mt-1">
              ₹{metrics.avgAmount.toLocaleString("en-IN")}
            </h3>
            <p className="text-[11px] text-blue-600 font-medium mt-0.5">
              Across active defaulters
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-200/70 rounded-2xl p-4">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">
              Current Scope
            </p>
            <h3 className="text-lg font-black text-purple-900 mt-1 capitalize truncate">
              {scope === "month"
                ? `${activeMonth} ${activeYear}`
                : scope === "year"
                ? `Year ${activeYear}`
                : "All Time Cumulative"}
            </h3>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">
              Sorted: Large → Small
            </p>
          </div>
        </div>

        {/* ─── Defaulters List Table ─── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loadingAllTime ? (
            <div className="text-center py-16">
              <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">
                Fetching complete pending records...
              </p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <FaCheckCircle className="text-emerald-500 text-4xl mx-auto mb-3" />
              <h4 className="text-lg font-bold text-gray-700">
                No Pending Dues Found!
              </h4>
              <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
                All residents have cleared their payments for the selected{" "}
                {scope === "month" ? `${activeMonth} ${activeYear}` : scope}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100/90 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                    <th className="p-3.5 text-center w-12">#</th>
                    <th className="p-3.5">Flat & Block</th>
                    <th className="p-3.5">Resident</th>
                    <th className="p-3.5">Mobile</th>
                    <th className="p-3.5">Pending Months</th>
                    <th className="p-3.5">Monthly Rate</th>
                    <th className="p-3.5 text-right font-black text-red-700">
                      Pending Amount (₹)
                    </th>
                    <th className="p-3.5 text-center">Quick Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 text-sm">
                  {filteredList.map((item, index) => {
                    const r = item.resident;
                    const isCopied = copiedId === r.id;

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-red-50/40 transition duration-150"
                      >
                        {/* Rank */}
                        <td className="p-3.5 text-center font-bold text-gray-400 text-xs">
                          {index === 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white font-black text-xs shadow-sm">
                              1
                            </span>
                          ) : index === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white font-black text-xs shadow-sm">
                              2
                            </span>
                          ) : index === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs shadow-sm">
                              3
                            </span>
                          ) : (
                            index + 1
                          )}
                        </td>

                        {/* Flat & Block */}
                        <td className="p-3.5 font-bold text-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-900 font-extrabold text-sm border">
                              {r.flat || "—"}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              {r.block || ""}
                            </span>
                          </div>
                        </td>

                        {/* Resident Name */}
                        <td className="p-3.5">
                          <p className="font-bold text-gray-900 leading-tight">
                            {r.owner || r.name || "Resident"}
                          </p>
                          <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {r.status || "Active"}
                          </span>
                        </td>

                        {/* Mobile with quick contact */}
                        <td className="p-3.5 text-gray-600 font-medium">
                          {r.mobile ? (
                            <div className="flex items-center gap-1.5">
                              <span>{r.mobile}</span>
                              <a
                                href={`tel:${r.mobile}`}
                                className="text-gray-400 hover:text-blue-600 p-1"
                                title="Call resident"
                              >
                                <FaPhoneAlt className="text-xs" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Pending Months breakdown */}
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.pendingMonths.map((p, pIdx) => (
                              <span
                                key={pIdx}
                                className="text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md"
                              >
                                {p.month.slice(0, 3)} {p.year}
                              </span>
                            ))}
                            {item.pendingMonths.length === 0 && (
                              <span className="text-xs text-gray-500">
                                {activeMonth} {activeYear}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Monthly Rate */}
                        <td className="p-3.5 text-gray-600 font-medium">
                          ₹{r.charge || 80}/mo
                        </td>

                        {/* Total Pending Amount (High to Low Badge) */}
                        <td className="p-3.5 text-right font-bold">
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 border border-red-300 px-3 py-1 rounded-xl text-base font-black shadow-sm">
                            ₹{item.totalPendingAmount.toLocaleString("en-IN")}
                          </span>
                        </td>

                        {/* Quick Actions */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* WhatsApp Reminder */}
                            {r.mobile && (
                              <button
                                onClick={() => handleSendWhatsApp(item)}
                                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition shadow-sm"
                                title="Send WhatsApp payment reminder"
                              >
                                <FaWhatsapp className="text-base" />
                              </button>
                            )}

                            {/* Copy Details */}
                            <button
                              onClick={() => handleCopyDetails(item)}
                              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition shadow-sm"
                              title="Copy details"
                            >
                              {isCopied ? (
                                <FaCheck className="text-xs text-emerald-600" />
                              ) : (
                                <FaCopy className="text-xs" />
                              )}
                            </button>

                            {/* Collect Payment Direct Trigger */}
                            {onCollectPayment && (
                              <button
                                onClick={() =>
                                  onCollectPayment(
                                    r,
                                    activeMonth,
                                    activeYear,
                                    item.totalPendingAmount
                                  )
                                }
                                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-sm"
                                title="Record payment for this resident"
                              >
                                <FaMoneyBillWave className="text-xs" /> Collect
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── Footer Action Bar ─── */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <FaExclamationTriangle className="text-amber-500 text-sm" />
            <span>
              Showing {filteredList.length} of {pendingData.length} pending resident(s), ordered strictly from Highest Due to Lowest Due.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm transition shadow-sm"
          >
            Close Checklist
          </button>
        </div>
      </div>
    </div>
  );
}

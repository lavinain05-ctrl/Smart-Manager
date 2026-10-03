import { useMemo, useState, useEffect } from "react";
import {
  FaSearch,
  FaFileDownload,
  FaTrashAlt,
  FaHandHoldingHeart,
  FaFilter,
  FaPrint,
  FaCalendarAlt,
  FaRedo,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import { useBilling } from "../../context/BillingContext";
import { subscribeAllSpecialPayments } from "../../services/specialCollectionService";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";
import { generateReceipt } from "../../utils/receiptGenerator";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import PrinterQuickAction from "../../components/common/PrinterQuickAction";

const MONTH_OPTIONS = [
  "all",
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

export default function CollectorHistory() {
  const { user } = useAuth();
  const { payments } = usePayments();
  const { residents } = useResidents();
  const { selectedMonth, selectedYear } = useBilling();
  const [specialPayments, setSpecialPayments] = useState([]);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all"); // "all", "garbage", "special"
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const currentYearNum = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const list = ["all"];
    for (let y = currentYearNum - 4; y <= currentYearNum + 2; y++) {
      list.push(String(y));
    }
    return list;
  }, [currentYearNum]);

  function enrichPayment(p) {
    const res = residents.find(
      (r) =>
        (p.residentId && r.id === p.residentId) ||
        (p.flat && (r.flat === p.flat || r.flatNumber === p.flat)) ||
        (p.flatNumber && (r.flat === p.flatNumber || r.flatNumber === p.flatNumber))
    );
    return {
      ...p,
      plotNumber: p.plotNumber || res?.plotNumber || "",
      floor: p.floor || res?.floor || "",
      unitNumber: p.unitNumber || res?.unitNumber || "",
      personType: p.personType || res?.personType || "",
      block: p.block || res?.block || "",
    };
  }

  useEffect(() => {
    const unsub = subscribeAllSpecialPayments((list) => {
      setSpecialPayments(list);
    });
    return () => unsub();
  }, []);

  const assignedModules = useMemo(() => {
    if (Array.isArray(user?.assignedModules) && user.assignedModules.length > 0) {
      return user.assignedModules;
    }
    return ["garbage"];
  }, [user?.assignedModules]);

  const hasSpecial = assignedModules.includes("special_collections");

  // Normalized unified payment history
  const combinedHistory = useMemo(() => {
    const list = [];

    // 1. Garbage payments
    payments
      .filter((p) => p.collectorId === user?.uid)
      .forEach((p) => {
        const enriched = enrichPayment(p);

        // Check month filter
        const matchMonth =
          monthFilter === "all" ||
          p.month === monthFilter ||
          (p.isAdvance &&
            Array.isArray(p.coveredMonths) &&
            p.coveredMonths.some((cm) => cm.month === monthFilter));

        // Check year filter
        const matchYear =
          yearFilter === "all" ||
          Number(p.year) === Number(yearFilter) ||
          (p.isAdvance &&
            Array.isArray(p.coveredMonths) &&
            p.coveredMonths.some((cm) => Number(cm.year) === Number(yearFilter)));

        if (!matchMonth || !matchYear) return;

        list.push({
          id: p.id,
          module: "garbage",
          title: `Flat ${enriched.flat || enriched.unitNumber || "—"} • ${enriched.residentName || "Resident"}`,
          subtitle: `Garbage Collection • ${p.month || ""} ${p.year || ""}`,
          paymentMethod: p.paymentMethod || "Cash",
          paymentDate: p.paymentDate || "—",
          amount: Number(p.amount || 0),
          receiptNumber: p.receiptNumber || "—",
          raw: enriched,
        });
      });

    // 2. Special Collection payments
    specialPayments
      .filter((p) => p.collectorId === user?.uid && p.status === "confirmed")
      .forEach((p) => {
        const enriched = enrichPayment(p);

        // Check month and year for special payment via paymentDate
        if (monthFilter !== "all" || yearFilter !== "all") {
          if (!p.paymentDate) return;
          const d = new Date(p.paymentDate);
          if (isNaN(d.getTime())) return;
          const m = d.toLocaleString("default", { month: "long" });
          const y = String(d.getFullYear());
          if (monthFilter !== "all" && m !== monthFilter) return;
          if (yearFilter !== "all" && y !== yearFilter) return;
        }

        const flatText = (enriched.flatNumber || enriched.flat) ? `Flat ${enriched.flatNumber || enriched.flat} • ` : "";
        list.push({
          id: p.id,
          module: "special",
          title: `${flatText}${enriched.contributorName || "Contributor"}`,
          subtitle: `${enriched.collectionName || "Special Collection"} • ${enriched.contributorType === "external" ? "External" : "Resident"}`,
          paymentMethod: enriched.paymentMethod || "Cash",
          paymentDate: enriched.paymentDate || "—",
          amount: Number(enriched.amount || 0),
          receiptNumber: enriched.receiptNumber || "—",
          raw: enriched,
        });
      });

    return list
      .filter((item) => {
        if (moduleFilter === "garbage") return item.module === "garbage";
        if (moduleFilter === "special") return item.module === "special";
        return true;
      })
      .filter((item) => {
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.receiptNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.paymentDate || "").localeCompare(a.paymentDate || ""));
  }, [
    payments,
    specialPayments,
    user?.uid,
    moduleFilter,
    monthFilter,
    yearFilter,
    search,
    residents,
  ]);

  const totalCollected = combinedHistory.reduce((s, item) => s + item.amount, 0);
  const cashCollected = combinedHistory
    .filter((item) => item.paymentMethod === "Cash")
    .reduce((s, item) => s + item.amount, 0);
  const upiCollected = combinedHistory
    .filter((item) => item.paymentMethod === "UPI" || item.paymentMethod === "Offline UPI")
    .reduce((s, item) => s + item.amount, 0);

  function handleSyncBillingPeriod() {
    setMonthFilter(selectedMonth);
    setYearFilter(String(selectedYear));
  }

  function handleResetFilters() {
    setMonthFilter("all");
    setYearFilter("all");
    setModuleFilter("all");
    setSearch("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Collection History</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Detailed records of everything you have collected • Filter by month & year
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <PrinterQuickAction />
          <button
            type="button"
            onClick={handleSyncBillingPeriod}
            className="text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title="Filter by active billing cycle"
          >
            <FaCalendarAlt className="text-emerald-600 text-[11px]" />
            <span>Active Cycle ({selectedMonth} {selectedYear})</span>
          </button>

          {(monthFilter !== "all" || yearFilter !== "all" || moduleFilter !== "all" || search) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
              title="Reset all filters"
            >
              <FaRedo className="text-[10px]" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">Total Shown</span>
          <span className="text-lg font-bold text-emerald-700">₹{totalCollected.toLocaleString("en-IN")}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">Cash Amount</span>
          <span className="text-lg font-bold text-blue-700">₹{cashCollected.toLocaleString("en-IN")}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">UPI Amount</span>
          <span className="text-lg font-bold text-purple-700">₹{upiCollected.toLocaleString("en-IN")}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">Total Receipts</span>
          <span className="text-lg font-bold text-gray-800">{combinedHistory.length}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3.5">
        <div className="relative">
          <FaSearch className="absolute left-4 top-3.5 text-gray-400 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flat, name, receipt number..."
            className="w-full border rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filter Controls: Module + Month + Year */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-gray-100">
          {/* Module Pills */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setModuleFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                moduleFilter === "all"
                  ? "bg-gray-800 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All Modules
            </button>
            <button
              onClick={() => setModuleFilter("garbage")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                moduleFilter === "garbage"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <FaTrashAlt className="text-[10px]" /> Garbage
            </button>
            {hasSpecial && (
              <button
                onClick={() => setModuleFilter("special")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  moduleFilter === "special"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <FaHandHoldingHeart className="text-[10px]" /> Special Collections
              </button>
            )}
          </div>

          {/* Month & Year Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
              <FaFilter className="text-gray-400 text-[10px]" />
              <span>Month:</span>
            </div>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-gray-50 text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All Months</option>
              {MONTH_OPTIONS.filter((m) => m !== "all").map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-gray-50 text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All Years</option>
              {yearOptions.filter((y) => y !== "all").map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Collection Records */}
      <div className="space-y-3">
        {combinedHistory.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-500 text-sm">
            No collection records found matching your filters.
          </div>
        ) : (
          combinedHistory.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between gap-3 border border-gray-100 hover:border-emerald-200 transition"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900 text-sm">{item.title}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.module === "special"
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {item.module === "special" ? "Special" : "Garbage"}
                  </span>
                </div>

                <p className="text-gray-500 text-xs">{item.subtitle}</p>
                <p className="text-gray-400 text-[11px]">
                  {item.paymentMethod} • {item.paymentDate}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-extrabold text-base text-emerald-700">
                    ₹{item.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] font-mono text-gray-400">{item.receiptNumber}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      printPaymentReceipt(item.raw);
                      toast.success(`Printing receipt ${item.receiptNumber}...`);
                    }}
                    title="Print Official Payment Receipt"
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                  >
                    <FaPrint className="text-[11px]" />
                    <span className="hidden sm:inline">Print</span>
                  </button>

                  <button
                    onClick={() => {
                      if (item.module === "special") {
                        generateSpecialCollectionReceipt({
                          ...item.raw,
                          contributorType:
                            item.raw.contributorType === "external"
                              ? "External Contributor"
                              : "Resident",
                        });
                      } else {
                        generateReceipt(item.raw);
                      }
                    }}
                    title="Download PDF Receipt"
                    className={`p-2 rounded-xl transition text-xs cursor-pointer ${
                      item.module === "special"
                        ? "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    <FaFileDownload />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
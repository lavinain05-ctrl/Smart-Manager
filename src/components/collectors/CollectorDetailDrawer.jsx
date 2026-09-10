import { useMemo, useState } from "react";
import {
  FaTimes,
  FaUserTie,
  FaPhone,
  FaEnvelope,
  FaCalendar,
  FaMoneyBillWave,
  FaWallet,
  FaMobileAlt,
  FaUniversity,
  FaReceipt,
  FaSearch,
  FaFileExcel,
  FaFilePdf,
  FaUndoAlt,
  FaTrashAlt,
  FaHandHoldingHeart,
  FaDownload,
  FaCheckCircle,
  FaGlobe,
  FaBuilding,
  FaFilter,
  FaQrcode,
} from "react-icons/fa";
import toast from "react-hot-toast";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { useAuth } from "../../context/AuthContext";
import { usePayments } from "../../context/PaymentContext";
import ConfirmDialog from "../common/ConfirmDialog";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";
import { matchesCollector, isSameDate, getLocalTodayEN } from "../../utils/collectorHelper";

/**
 * Helper to parse payment dates across different formats (DD/MM/YYYY, YYYY-MM-DD, Timestamp)
 */
function parsePaymentDate(p) {
  if (p.paymentDate) {
    if (typeof p.paymentDate === "string") {
      if (p.paymentDate.includes("-")) {
        const parts = p.paymentDate.split("-").map(Number);
        if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
      }
      if (p.paymentDate.includes("/")) {
        const parts = p.paymentDate.split("/").map(Number);
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
  }
  if (p.submittedAt?.toDate) return p.submittedAt.toDate();
  if (p.createdAt?.toDate) return p.createdAt.toDate();
  if (p.createdAt) return new Date(p.createdAt);
  return null;
}

export default function CollectorDetailDrawer({
  open,
  collector,
  payments = [],
  specialPayments = [],
  specialCampaigns = [],
  onClose,
}) {
  const { user } = useAuth();
  const { reversePayment } = usePayments();
  const isAdmin = user?.role === "admin";

  // Active module tab: "garbage" | "special"
  const [activeTab, setActiveTab] = useState("garbage");

  // ─── Shared Date & Mode Filters ───
  const [dateFilter, setDateFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // ─── Garbage Specific Filters ───
  const [garbageSearch, setGarbageSearch] = useState("");
  const [garbageModeFilter, setGarbageModeFilter] = useState("All");
  const [reverseTarget, setReverseTarget] = useState(null);

  // ─── Special Collections Specific Filters ───
  const [specialSearch, setSpecialSearch] = useState("");
  const [specialModeFilter, setSpecialModeFilter] = useState("All");
  const [specialCampaignFilter, setSpecialCampaignFilter] = useState("all");
  const [specialCategoryFilter, setSpecialCategoryFilter] = useState("all");

  // 1. Collector's Raw Garbage Payments
  const collectorGarbagePayments = useMemo(() => {
    if (!collector) return [];
    return (payments || []).filter((p) => matchesCollector(p, collector));
  }, [payments, collector]);

  // 2. Collector's Raw Special Collection Payments (Strictly Separated)
  const collectorSpecialPayments = useMemo(() => {
    if (!collector) return [];
    return (specialPayments || []).filter(
      (p) => matchesCollector(p, collector) && p.status !== "rejected"
    );
  }, [specialPayments, collector]);

  // 3. Filtered Garbage Payments
  const filteredGarbage = useMemo(() => {
    if (!collector) return [];
    const now = new Date();
    const todayStr = getLocalTodayEN();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = `${yesterday.getDate()}/${yesterday.getMonth() + 1}/${yesterday.getFullYear()}`;
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let list = [...collectorGarbagePayments];

    // Date Filter
    switch (dateFilter) {
      case "today":
        list = list.filter((p) => isSameDate(p.paymentDate, todayStr));
        break;
      case "yesterday":
        list = list.filter((p) => isSameDate(p.paymentDate, yesterdayStr));
        break;
      case "week":
        list = list.filter((p) => {
          const d = parsePaymentDate(p);
          return d && d >= weekAgo;
        });
        break;
      case "month":
        list = list.filter((p) => {
          const d = parsePaymentDate(p);
          return d && d >= monthStart;
        });
        break;
      case "custom":
        list = list.filter((p) => {
          const d = parsePaymentDate(p);
          if (!d) return false;
          const from = customFrom ? new Date(customFrom) : new Date(0);
          const to = customTo ? new Date(customTo + "T23:59:59") : new Date();
          return d >= from && d <= to;
        });
        break;
      default:
        break;
    }

    // Mode Filter
    if (garbageModeFilter !== "All") {
      list = list.filter((p) => p.paymentMethod === garbageModeFilter);
    }

    // Search Filter
    if (garbageSearch.trim()) {
      const q = garbageSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.residentName || "").toLowerCase().includes(q) ||
          (p.flat || "").toLowerCase().includes(q) ||
          (p.block || "").toLowerCase().includes(q) ||
          (p.receiptNumber || "").toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => {
      const tsA = Number((a.receiptNumber || "").replace("REC-", "")) || 0;
      const tsB = Number((b.receiptNumber || "").replace("REC-", "")) || 0;
      return tsB - tsA;
    });
  }, [collectorGarbagePayments, dateFilter, garbageModeFilter, garbageSearch, customFrom, customTo, collector]);

  // 4. Filtered Special Collection Payments
  const filteredSpecial = useMemo(() => {
    if (!collector) return [];
    const now = new Date();
    const todayISO = now.toISOString().split("T")[0];
    const todayStr = now.toLocaleDateString("en-IN");
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toLocaleDateString("en-IN");
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let list = [...collectorSpecialPayments];

    // Date Filter
    switch (dateFilter) {
      case "today":
        list = list.filter(
          (p) => p.paymentDate === todayISO || p.paymentDate === todayStr
        );
        break;
      case "yesterday":
        list = list.filter(
          (p) => p.paymentDate === yesterdayISO || p.paymentDate === yesterdayStr
        );
        break;
      case "week":
        list = list.filter((p) => {
          const d = parsePaymentDate(p);
          return d && d >= weekAgo;
        });
        break;
      case "month":
        list = list.filter((p) => {
          const d = parsePaymentDate(p);
          return d && d >= monthStart;
        });
        break;
      case "custom":
        list = list.filter((p) => {
          const d = parsePaymentDate(p);
          if (!d) return false;
          const from = customFrom ? new Date(customFrom) : new Date(0);
          const to = customTo ? new Date(customTo + "T23:59:59") : new Date();
          return d >= from && d <= to;
        });
        break;
      default:
        break;
    }

    // Mode Filter
    if (specialModeFilter !== "All") {
      if (specialModeFilter === "Cash") {
        list = list.filter(
          (p) => p.paymentMethod?.toLowerCase() === "cash" || p.utr === "CASH-OFFLINE"
        );
      } else if (specialModeFilter === "Online") {
        list = list.filter(
          (p) => p.paymentMethod?.toLowerCase() !== "cash" && p.utr !== "CASH-OFFLINE"
        );
      }
    }

    // Campaign Filter
    if (specialCampaignFilter !== "all") {
      list = list.filter((p) => p.collectionId === specialCampaignFilter);
    }

    // Category Filter
    if (specialCategoryFilter !== "all") {
      list = list.filter((p) => {
        const cat = p.contributorType === "external" ? "external" : "resident";
        return cat === specialCategoryFilter;
      });
    }

    // Search Filter
    if (specialSearch.trim()) {
      const q = specialSearch.trim().toLowerCase();
      list = list.filter((p) => {
        const camp = (specialCampaigns || []).find((c) => c.id === p.collectionId);
        const cName = (camp?.name || camp?.title || p.collectionName || "").toLowerCase();
        const cPurp = (camp?.purpose || p.purpose || "").toLowerCase();
        return (
          cName.includes(q) ||
          cPurp.includes(q) ||
          (p.contributorName || "").toLowerCase().includes(q) ||
          (p.flatNumber || "").toLowerCase().includes(q) ||
          (p.mobileNumber || "").includes(q) ||
          (p.receiptNumber || "").toLowerCase().includes(q) ||
          (p.utr || "").toLowerCase().includes(q)
        );
      });
    }

    return list.sort((a, b) => (b.paymentDate || "").localeCompare(a.paymentDate || ""));
  }, [
    collectorSpecialPayments,
    specialCampaigns,
    dateFilter,
    specialModeFilter,
    specialCampaignFilter,
    specialCategoryFilter,
    specialSearch,
    customFrom,
    customTo,
    collector,
  ]);

  // ─── Garbage Metrics ───
  const garbageTotals = useMemo(() => {
    const total = filteredGarbage.reduce((s, p) => s + Number(p.amount || 0), 0);
    const cash = filteredGarbage
      .filter((p) => p.paymentMethod === "Cash")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const upi = filteredGarbage
      .filter((p) => p.paymentMethod === "UPI")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const bank = filteredGarbage
      .filter((p) => p.paymentMethod === "Bank Transfer")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    return { total, cash, upi, bank, count: filteredGarbage.length };
  }, [filteredGarbage]);

  // ─── Special Metrics ───
  const specialTotals = useMemo(() => {
    const total = filteredSpecial.reduce((s, p) => s + Number(p.amount || 0), 0);
    const cash = filteredSpecial
      .filter((p) => p.paymentMethod?.toLowerCase() === "cash" || p.utr === "CASH-OFFLINE")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const online = total - cash;
    const uniqueCampaigns = new Set(filteredSpecial.map((p) => p.collectionId).filter(Boolean)).size;
    return { total, cash, online, uniqueCampaigns, count: filteredSpecial.length };
  }, [filteredSpecial]);

  // Total sums across all raw collector payments
  const allGarbageSum = useMemo(
    () => collectorGarbagePayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [collectorGarbagePayments]
  );
  const allSpecialSum = useMemo(
    () => collectorSpecialPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [collectorSpecialPayments]
  );

  // Unique campaign options collected by this collector (resolving and disambiguating titles)
  const collectorCampaignOptions = useMemo(() => {
    const map = new Map();
    collectorSpecialPayments.forEach((p) => {
      if (p.collectionId && !map.has(p.collectionId)) {
        const camp = (specialCampaigns || []).find((c) => c.id === p.collectionId);
        const name = (camp?.name || camp?.title || p.collectionName || "").trim() || "Special Collection";
        const purpose = (camp?.purpose || p.purpose || "").trim();
        const type = (camp?.collectionType || "").trim();
        const target = Number(camp?.targetAmount || 0);

        map.set(p.collectionId, {
          id: p.collectionId,
          name,
          purpose,
          type,
          target,
        });
      }
    });

    const list = Array.from(map.values());

    // Check for duplicate names across options to disambiguate
    const nameCounts = {};
    list.forEach((c) => {
      nameCounts[c.name] = (nameCounts[c.name] || 0) + 1;
    });

    return list.map((c, idx) => {
      let displayName = c.name;
      if (nameCounts[c.name] > 1) {
        if (c.purpose && c.purpose !== c.name) {
          displayName = `${c.name} — ${c.purpose}`;
        } else if (c.type) {
          displayName = `${c.name} (${c.type.toUpperCase()})`;
        } else if (c.target > 0) {
          displayName = `${c.name} (Target: ₹${c.target.toLocaleString()})`;
        } else {
          displayName = `${c.name} #${idx + 1}`;
        }
      }
      return { id: c.id, name: displayName };
    });
  }, [collectorSpecialPayments, specialCampaigns]);

  if (!open || !collector) return null;

  // ─── Export Functions ───
  function exportGarbagePDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("D BLOCK RWA INDRAPRASTHA", 105, 14, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Collector Garbage Report: ${collector.name} (${collector.area})`, 105, 22, { align: "center" });
    doc.setFontSize(10);
    doc.text(
      `Total: ₹${garbageTotals.total.toLocaleString("en-IN")} | Receipts: ${filteredGarbage.length} | Cash: ₹${garbageTotals.cash.toLocaleString("en-IN")} | UPI: ₹${garbageTotals.upi.toLocaleString("en-IN")}`,
      105,
      28,
      { align: "center" }
    );

    autoTable(doc, {
      startY: 34,
      head: [["#", "Resident", "Flat", "Block", "Amount", "Mode", "Date", "Time", "Receipt", "Period"]],
      body: filteredGarbage.map((p, i) => [
        i + 1,
        p.residentName,
        p.flat,
        p.block || "-",
        `₹${p.amount}`,
        p.paymentMethod,
        p.paymentDate,
        p.paymentTime || "-",
        p.receiptNumber,
        `${p.month || ""} ${p.year || ""}`,
      ]),
      styles: { fontSize: 8 },
    });

    doc.save(`Garbage-${collector.name}-Report.pdf`);
    toast.success("Garbage PDF report exported!");
  }

  function exportGarbageExcel() {
    const data = filteredGarbage.map((p, i) => ({
      "#": i + 1,
      Resident: p.residentName,
      Flat: p.flat,
      Block: p.block || "-",
      Amount: p.amount,
      Mode: p.paymentMethod,
      Date: p.paymentDate,
      Time: p.paymentTime || "-",
      Receipt: p.receiptNumber,
      Period: `${p.month || ""} ${p.year || ""}`,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Garbage Collections");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `Garbage-${collector.name}-History.xlsx`
    );
    toast.success("Garbage Excel report exported!");
  }

  function exportSpecialPDF() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("D BLOCK RWA INDRAPRASTHA", 105, 14, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Collector Special Collections: ${collector.name}`, 105, 22, { align: "center" });
    doc.setFontSize(10);
    doc.text(
      `Total: ₹${specialTotals.total.toLocaleString("en-IN")} | Receipts: ${filteredSpecial.length} | Cash: ₹${specialTotals.cash.toLocaleString("en-IN")} | Online: ₹${specialTotals.online.toLocaleString("en-IN")}`,
      105,
      28,
      { align: "center" }
    );

    autoTable(doc, {
      startY: 34,
      head: [["#", "Campaign", "Contributor", "Category", "Flat", "Amount", "Mode", "Date", "Receipt No", "UTR"]],
      body: filteredSpecial.map((p, i) => [
        i + 1,
        p.collectionName || "-",
        p.contributorName,
        p.contributorType === "external" ? "External" : "Resident",
        p.flatNumber || "-",
        `₹${p.amount}`,
        p.paymentMethod || (p.utr === "CASH-OFFLINE" ? "Cash" : "Online"),
        p.paymentDate || "-",
        p.receiptNumber || "-",
        p.utr || "-",
      ]),
      styles: { fontSize: 8 },
    });

    doc.save(`SpecialCollections-${collector.name}-Report.pdf`);
    toast.success("Special Collections PDF report exported!");
  }

  function exportSpecialExcel() {
    const data = filteredSpecial.map((p, i) => ({
      "#": i + 1,
      Campaign: p.collectionName || "-",
      Contributor: p.contributorName,
      Category: p.contributorType === "external" ? "External Guest" : "Resident",
      Flat: p.flatNumber || "-",
      Mobile: p.mobileNumber || "-",
      Amount: p.amount,
      Mode: p.paymentMethod || (p.utr === "CASH-OFFLINE" ? "Cash" : "Online"),
      Date: p.paymentDate || "-",
      Receipt: p.receiptNumber || "-",
      UTR: p.utr || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Special Collections");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `SpecialCollections-${collector.name}-History.xlsx`
    );
    toast.success("Special Collections Excel report exported!");
  }

  function handleDownloadSpecialReceipt(payment) {
    try {
      generateSpecialCollectionReceipt({
        receiptNumber: payment.receiptNumber || `SC-REC-${payment.id?.slice(0, 8)}`,
        collectionName: payment.collectionName || "Special Collection",
        purpose: payment.purpose || payment.collectionName || "Special Collection",
        contributorName: payment.contributorName || "Contributor",
        contributorType: payment.contributorType === "external" ? "External Contributor" : "Resident",
        flatNumber: payment.flatNumber || "",
        block: payment.block || "",
        mobileNumber: payment.mobileNumber || "",
        amount: payment.amount,
        utr: payment.utr || "CASH-OFFLINE",
        paymentDate: payment.paymentDate || new Date().toISOString().split("T")[0],
        confirmedAt: payment.confirmedAt || payment.submittedAt,
        confirmedByName: payment.collectorName || collector.name || "Collector",
      });
      toast.success(`Receipt ${payment.receiptNumber || ""} downloaded!`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate receipt PDF");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end animate-in fade-in">
      <div className="w-full max-w-5xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">

        {/* ─── Header ─── */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 via-emerald-800 to-teal-900 text-white p-6 flex justify-between items-start z-20 shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl border border-white/20 shadow-inner">
              <FaUserTie />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight">{collector.name}</h2>
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                    collector.status === "Active"
                      ? "bg-emerald-400 text-emerald-950"
                      : "bg-rose-400 text-rose-950"
                  }`}
                >
                  {collector.status}
                </span>
              </div>
              <p className="text-emerald-200 text-sm mt-0.5">
                {collector.area || "General Society"} • {collector.vehicle || "On Foot"}
              </p>

              {/* Assigned Powers Badges */}
              <div className="flex items-center gap-2 mt-2">
                {(!collector.assignedModules || collector.assignedModules.includes("garbage")) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                    <FaTrashAlt className="text-[10px]" /> Garbage Collection
                  </span>
                )}
                {collector.assignedModules?.includes("special_collections") && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-500/30 text-indigo-100 border border-indigo-400/30">
                    <FaHandHoldingHeart className="text-[10px]" /> Special Collections
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-xl transition"
            title="Close Drawer"
          >
            <FaTimes />
          </button>
        </div>

        {/* ─── Profile Info Bar ─── */}
        <div className="p-6 bg-slate-50 border-b grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white rounded-xl p-3 border shadow-2xs">
            <div className="flex items-center gap-1.5 text-gray-400 font-semibold mb-1">
              <FaPhone className="text-[10px]" /> Mobile Number
            </div>
            <p className="font-bold text-gray-800 font-mono text-sm">{collector.mobile}</p>
          </div>

          <div className="bg-white rounded-xl p-3 border shadow-2xs">
            <div className="flex items-center gap-1.5 text-gray-400 font-semibold mb-1">
              <FaEnvelope className="text-[10px]" /> Email
            </div>
            <p className="font-bold text-gray-800 truncate text-sm">{collector.email || "—"}</p>
          </div>

          <div className="bg-white rounded-xl p-3 border shadow-2xs">
            <div className="flex items-center gap-1.5 text-gray-400 font-semibold mb-1">
              <FaCalendar className="text-[10px]" /> Joined Date
            </div>
            <p className="font-bold text-gray-800 text-sm">
              {collector.createdAt
                ? new Date(
                    collector.createdAt.seconds
                      ? collector.createdAt.seconds * 1000
                      : collector.createdAt
                  ).toLocaleDateString("en-IN")
                : "—"}
            </p>
          </div>

          <div className="bg-white rounded-xl p-3 border shadow-2xs">
            <div className="flex items-center gap-1.5 text-gray-400 font-semibold mb-1">
              <FaReceipt className="text-[10px]" /> Total Receipts Issued
            </div>
            <p className="font-bold text-gray-800 text-sm font-mono">
              {collectorGarbagePayments.length + collectorSpecialPayments.length}{" "}
              <span className="text-[11px] font-normal text-gray-400">
                ({collectorGarbagePayments.length} GC + {collectorSpecialPayments.length} SC)
              </span>
            </p>
          </div>
        </div>

        {/* ─── MODULE SWITCHER TABS (STRICTLY SEGREGATED) ─── */}
        <div className="bg-white border-b px-6 pt-4 flex items-center justify-between gap-4">
          <div className="flex gap-2">
            {/* Garbage Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab("garbage")}
              className={`px-5 py-3 font-bold text-xs sm:text-sm rounded-t-xl border-b-2 transition flex items-center gap-2 ${
                activeTab === "garbage"
                  ? "bg-emerald-50/50 border-emerald-600 text-emerald-800 shadow-2xs"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <FaTrashAlt className="text-emerald-600" />
              <span>Garbage Collection</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  activeTab === "garbage"
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {collectorGarbagePayments.length} • ₹{allGarbageSum.toLocaleString("en-IN")}
              </span>
            </button>

            {/* Special Collections Tab Button */}
            <button
              type="button"
              onClick={() => setActiveTab("special")}
              className={`px-5 py-3 font-bold text-xs sm:text-sm rounded-t-xl border-b-2 transition flex items-center gap-2 ${
                activeTab === "special"
                  ? "bg-indigo-50/50 border-indigo-600 text-indigo-800 shadow-2xs"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              <FaHandHoldingHeart className="text-indigo-600" />
              <span>Special Collections & Contributions</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  activeTab === "special"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {collectorSpecialPayments.length} • ₹{allSpecialSum.toLocaleString("en-IN")}
              </span>
            </button>
          </div>
        </div>

        {/* ─── TAB 1: GARBAGE COLLECTION CONTENT ─── */}
        {activeTab === "garbage" && (
          <div className="p-6 space-y-5">
            {/* Garbage Stats Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center shadow-2xs">
                <FaMoneyBillWave className="text-xl text-emerald-600 mx-auto" />
                <p className="text-2xl font-black text-emerald-800 mt-1">
                  ₹{garbageTotals.total.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">
                  Garbage Collected
                </p>
              </div>

              <div className="bg-green-50 border border-green-200/80 rounded-2xl p-4 text-center shadow-2xs">
                <FaWallet className="text-xl text-green-600 mx-auto" />
                <p className="text-2xl font-black text-green-800 mt-1">
                  ₹{garbageTotals.cash.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wider mt-0.5">
                  Cash Collected
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200/80 rounded-2xl p-4 text-center shadow-2xs">
                <FaMobileAlt className="text-xl text-purple-600 mx-auto" />
                <p className="text-2xl font-black text-purple-800 mt-1">
                  ₹{garbageTotals.upi.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider mt-0.5">
                  UPI Payments
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 text-center shadow-2xs">
                <FaUniversity className="text-xl text-blue-600 mx-auto" />
                <p className="text-2xl font-black text-blue-800 mt-1">
                  ₹{garbageTotals.bank.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mt-0.5">
                  Bank Transfer
                </p>
              </div>
            </div>

            {/* Garbage Filter Bar */}
            <div className="bg-gray-50 border rounded-2xl p-4 space-y-3">
              {/* Date Pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "All Records", value: "all" },
                  { label: "Today", value: "today" },
                  { label: "Yesterday", value: "yesterday" },
                  { label: "This Week", value: "week" },
                  { label: "This Month", value: "month" },
                  { label: "Custom Range", value: "custom" },
                ].map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setDateFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      dateFilter === f.value
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {dateFilter === "custom" && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-gray-500 font-semibold">From:</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="border rounded-lg px-2.5 py-1.5 bg-white text-xs outline-none"
                  />
                  <span className="text-gray-500 font-semibold">To:</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="border rounded-lg px-2.5 py-1.5 bg-white text-xs outline-none"
                  />
                </div>
              )}

              {/* Search, Mode & Export Controls */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                <div className="relative flex-1 min-w-[220px]">
                  <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    value={garbageSearch}
                    onChange={(e) => setGarbageSearch(e.target.value)}
                    placeholder="Search resident, flat, block, receipt..."
                    className="w-full border bg-white rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <select
                  value={garbageModeFilter}
                  onChange={(e) => setGarbageModeFilter(e.target.value)}
                  className="border bg-white rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                >
                  <option value="All">All Modes</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>

                <button
                  type="button"
                  onClick={exportGarbagePDF}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs"
                >
                  <FaFilePdf /> PDF
                </button>

                <button
                  type="button"
                  onClick={exportGarbageExcel}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs"
                >
                  <FaFileExcel /> Excel
                </button>
              </div>
            </div>

            {/* Garbage Payments Table */}
            <div className="bg-white border rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b text-gray-600 font-bold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Resident</th>
                      <th className="p-3">Flat</th>
                      <th className="p-3">Block</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Time</th>
                      <th className="p-3">Receipt</th>
                      <th className="p-3">Billing Cycle</th>
                      {isAdmin && <th className="p-3 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredGarbage.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 11 : 10} className="text-center py-12 text-gray-400">
                          <FaReceipt className="text-3xl mx-auto mb-2 text-gray-300" />
                          <p className="font-semibold text-gray-600 text-sm">No garbage collection records found.</p>
                          <p className="text-xs text-gray-400 mt-0.5">Try clearing filters or selecting another date range.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredGarbage.map((p, i) => (
                        <tr key={p.id} className="hover:bg-emerald-50/30 transition">
                          <td className="p-3 text-gray-400 font-mono">{i + 1}</td>
                          <td className="p-3 font-semibold text-gray-900">{p.residentName}</td>
                          <td className="p-3 font-bold text-gray-800">{p.flat}</td>
                          <td className="p-3 text-gray-500">{p.block || "—"}</td>
                          <td className="p-3 text-right font-black text-emerald-700 font-mono text-sm">
                            ₹{Number(p.amount).toLocaleString("en-IN")}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.paymentMethod === "Cash"
                                  ? "bg-green-100 text-green-800"
                                  : p.paymentMethod === "UPI"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {p.paymentMethod}
                            </span>
                          </td>
                          <td className="p-3 text-gray-600">{p.paymentDate}</td>
                          <td className="p-3 text-gray-400">{p.paymentTime || "—"}</td>
                          <td className="p-3 font-mono text-gray-500">{p.receiptNumber}</td>
                          <td className="p-3 text-gray-600 font-medium">{p.month} {p.year}</td>
                          {isAdmin && (
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => setReverseTarget(p)}
                                className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-2 rounded-lg transition"
                                title="Reverse Payment"
                              >
                                <FaUndoAlt />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredGarbage.length > 0 && (
                <div className="bg-gray-50 p-3.5 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-gray-700">
                    Showing <span className="text-emerald-700">{filteredGarbage.length}</span> garbage collections
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-emerald-800 text-sm">
                      Total: ₹{garbageTotals.total.toLocaleString("en-IN")}
                    </span>
                    <span className="text-green-700 font-medium">Cash: ₹{garbageTotals.cash.toLocaleString("en-IN")}</span>
                    <span className="text-purple-700 font-medium">UPI: ₹{garbageTotals.upi.toLocaleString("en-IN")}</span>
                    <span className="text-blue-700 font-medium">Bank: ₹{garbageTotals.bank.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: SPECIAL COLLECTIONS CONTENT (STRICTLY SEGREGATED) ─── */}
        {activeTab === "special" && (
          <div className="p-6 space-y-5">
            {/* Special Stats Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-indigo-50 border border-indigo-200/80 rounded-2xl p-4 text-center shadow-2xs">
                <FaHandHoldingHeart className="text-xl text-indigo-600 mx-auto" />
                <p className="text-2xl font-black text-indigo-800 mt-1">
                  ₹{specialTotals.total.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mt-0.5">
                  Special Contributions
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center shadow-2xs">
                <FaWallet className="text-xl text-emerald-600 mx-auto" />
                <p className="text-2xl font-black text-emerald-800 mt-1">
                  ₹{specialTotals.cash.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">
                  Cash Collected
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200/80 rounded-2xl p-4 text-center shadow-2xs">
                <FaQrcode className="text-xl text-purple-600 mx-auto" />
                <p className="text-2xl font-black text-purple-800 mt-1">
                  ₹{specialTotals.online.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider mt-0.5">
                  Online / Direct
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-center shadow-2xs">
                <FaReceipt className="text-xl text-amber-600 mx-auto" />
                <p className="text-2xl font-black text-amber-800 mt-1 font-mono">
                  {specialTotals.count}
                </p>
                <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mt-0.5">
                  Receipts Issued ({specialTotals.uniqueCampaigns} Campaigns)
                </p>
              </div>
            </div>

            {/* Special Filter Bar */}
            <div className="bg-gray-50 border rounded-2xl p-4 space-y-3">
              {/* Date Pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "All Records", value: "all" },
                  { label: "Today", value: "today" },
                  { label: "Yesterday", value: "yesterday" },
                  { label: "This Week", value: "week" },
                  { label: "This Month", value: "month" },
                  { label: "Custom Range", value: "custom" },
                ].map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setDateFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      dateFilter === f.value
                        ? "bg-indigo-700 text-white shadow-xs"
                        : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {dateFilter === "custom" && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-gray-500 font-semibold">From:</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="border rounded-lg px-2.5 py-1.5 bg-white text-xs outline-none"
                  />
                  <span className="text-gray-500 font-semibold">To:</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="border rounded-lg px-2.5 py-1.5 bg-white text-xs outline-none"
                  />
                </div>
              )}

              {/* Search, Campaign, Category, Mode & Export Controls */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                <div className="relative flex-1 min-w-[220px]">
                  <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input
                    value={specialSearch}
                    onChange={(e) => setSpecialSearch(e.target.value)}
                    placeholder="Search contributor, campaign, flat, UTR, receipt..."
                    className="w-full border bg-white rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Campaign Dropdown */}
                <select
                  value={specialCampaignFilter}
                  onChange={(e) => setSpecialCampaignFilter(e.target.value)}
                  className="border bg-white rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                >
                  <option value="all">All Campaigns ({collectorCampaignOptions.length})</option>
                  {collectorCampaignOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Contributor Category Dropdown */}
                <select
                  value={specialCategoryFilter}
                  onChange={(e) => setSpecialCategoryFilter(e.target.value)}
                  className="border bg-white rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                >
                  <option value="all">All Contributors</option>
                  <option value="resident">Residents</option>
                  <option value="external">External Guests</option>
                </select>

                {/* Payment Mode Dropdown */}
                <select
                  value={specialModeFilter}
                  onChange={(e) => setSpecialModeFilter(e.target.value)}
                  className="border bg-white rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                >
                  <option value="All">All Modes</option>
                  <option value="Cash">Cash Only</option>
                  <option value="Online">Online / UPI</option>
                </select>

                <button
                  type="button"
                  onClick={exportSpecialPDF}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs"
                >
                  <FaFilePdf /> PDF
                </button>

                <button
                  type="button"
                  onClick={exportSpecialExcel}
                  className="flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs"
                >
                  <FaFileExcel /> Excel
                </button>
              </div>
            </div>

            {/* Special Collections Payments Table */}
            <div className="bg-white border rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b text-gray-600 font-bold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Campaign</th>
                      <th className="p-3">Contributor</th>
                      <th className="p-3">Flat / Category</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3">Payment Date</th>
                      <th className="p-3">Receipt No</th>
                      <th className="p-3">UTR / Ref</th>
                      <th className="p-3 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredSpecial.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-gray-400">
                          <FaHandHoldingHeart className="text-3xl mx-auto mb-2 text-gray-300" />
                          <p className="font-semibold text-gray-600 text-sm">No special collection records found.</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            This collector has not collected any contributions matching the active filter criteria.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredSpecial.map((p, i) => {
                        const isCash =
                          p.paymentMethod?.toLowerCase() === "cash" || p.utr === "CASH-OFFLINE";
                        const isExternal = p.contributorType === "external";

                        return (
                          <tr key={p.id} className="hover:bg-indigo-50/30 transition">
                            <td className="p-3 text-gray-400 font-mono">{i + 1}</td>
                            <td className="p-3">
                              {(() => {
                                const camp = (specialCampaigns || []).find((c) => c.id === p.collectionId);
                                const campName = camp?.name || camp?.title || p.collectionName || "Special Collection";
                                const campPurpose = camp?.purpose || p.purpose || "";
                                return (
                                  <>
                                    <span className="font-bold text-gray-900 block">{campName}</span>
                                    {campPurpose && <span className="text-[10px] text-gray-500 block">{campPurpose}</span>}
                                  </>
                                );
                              })()}
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-gray-900 block">{p.contributorName}</span>
                              <span className="text-[11px] text-gray-400 font-mono">{p.mobileNumber || "—"}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1 mb-0.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    isExternal ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {isExternal ? "External" : "Resident"}
                                </span>
                              </div>
                              {p.flatNumber && <span className="font-bold text-gray-800">Flat: {p.flatNumber}</span>}
                            </td>
                            <td className="p-3 text-right font-black text-indigo-700 font-mono text-sm">
                              ₹{Number(p.amount).toLocaleString("en-IN")}
                            </td>
                            <td className="p-3">
                              {isCash ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <FaMoneyBillWave className="text-[9px]" /> Cash
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                                  <FaQrcode className="text-[9px]" /> {p.paymentMethod || "Online"}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-gray-600">{p.paymentDate || "—"}</td>
                            <td className="p-3 font-mono font-medium text-gray-600">{p.receiptNumber || "—"}</td>
                            <td className="p-3 font-mono text-gray-400 text-[11px]">
                              {p.utr === "CASH-OFFLINE" ? (
                                <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                                  CASH-OFFLINE
                                </span>
                              ) : (
                                p.utr || "—"
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDownloadSpecialReceipt(p)}
                                className="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white p-2 rounded-lg transition inline-flex items-center gap-1 text-xs font-semibold"
                                title="Download Official PDF Receipt"
                              >
                                <FaDownload className="text-[10px]" />
                                <span>PDF</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {filteredSpecial.length > 0 && (
                <div className="bg-gray-50 p-3.5 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-gray-700">
                    Showing <span className="text-indigo-700">{filteredSpecial.length}</span> special collection records
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-indigo-800 text-sm">
                      Total: ₹{specialTotals.total.toLocaleString("en-IN")}
                    </span>
                    <span className="text-emerald-700 font-medium">Cash: ₹{specialTotals.cash.toLocaleString("en-IN")}</span>
                    <span className="text-purple-700 font-medium">Online: ₹{specialTotals.online.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Reverse Payment Confirm Dialog for Garbage Payments */}
      <ConfirmDialog
        open={!!reverseTarget}
        title="Reverse Garbage Payment?"
        message="This will permanently remove this payment and restore the resident's bill to Pending."
        confirmText="Reverse Payment"
        onCancel={() => setReverseTarget(null)}
        onConfirm={async () => {
          if (reverseTarget) {
            await reversePayment(reverseTarget, user);
            setReverseTarget(null);
          }
        }}
      />
    </div>
  );
}

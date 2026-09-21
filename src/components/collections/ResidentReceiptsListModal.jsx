import { useMemo, useState } from "react";
import {
  FaTimes,
  FaPrint,
  FaFileDownload,
  FaReceipt,
  FaTrashAlt,
  FaHandHoldingHeart,
  FaCopy,
  FaCheckCircle,
  FaSearch,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import { generateReceipt } from "../../utils/receiptGenerator";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";

export default function ResidentReceiptsListModal({
  open,
  resident,
  garbagePayments = [],
  specialPayments = [],
  onClose,
}) {
  const [filterType, setFilterType] = useState("all"); // "all" | "garbage" | "special"
  const [search, setSearch] = useState("");

  const flatLabel = resident?.flat || resident?.flatNumber || "—";
  const nameLabel = resident?.name || resident?.owner || resident?.residentName || "Resident";
  const blockLabel = resident?.block || "";
  const phoneLabel = resident?.mobile || resident?.phone || resident?.mobileNumber || "";

  // Normalize all receipts
  const unifiedReceipts = useMemo(() => {
    const list = [];

    // 1. Garbage maintenance receipts
    garbagePayments.forEach((p) => {
      const period = p.isAdvance && p.periodLabel
        ? `${p.periodLabel} (${p.advanceDuration || 1}M Advance)`
        : `${p.month || ""} ${p.year || ""}`.trim() || "Maintenance Fee";

      list.push({
        id: p.id || p.receiptNumber || Math.random().toString(),
        type: "garbage",
        title: "Garbage Maintenance",
        subtitle: period,
        receiptNumber: p.receiptNumber || p.receiptNo || p.paymentId || "—",
        amount: Number(p.totalPaidAmount || p.paidAmount || p.amount || 0),
        paymentMethod: p.paymentMethod || p.method || "Cash",
        paymentDate: p.paymentDate || p.date || "—",
        paymentTime: p.paymentTime || p.time || "",
        collector: p.collectorName || p.collector || "Collector",
        remarks: p.remarks || "",
        raw: {
          ...p,
          flat: flatLabel,
          block: blockLabel,
          residentName: nameLabel,
        },
      });
    });

    // 2. Special collections receipts
    specialPayments.forEach((p) => {
      list.push({
        id: p.id || p.receiptNumber || Math.random().toString(),
        type: "special",
        title: p.collectionName || p.campaignName || "Special Collection",
        subtitle: p.purpose || "Special Contribution",
        receiptNumber: p.receiptNumber || p.receiptNo || "—",
        amount: Number(p.amount || 0),
        paymentMethod: p.paymentMethod || "Cash",
        paymentDate: p.paymentDate || "—",
        paymentTime: p.paymentTime || "",
        collector: p.collectorName || "Collector",
        remarks: p.remarks || "",
        raw: {
          ...p,
          collectionName: p.collectionName || p.campaignName || "Special Collection",
          contributorName: nameLabel,
          flat: flatLabel,
          block: blockLabel,
          contributorType: "Resident",
        },
      });
    });

    // Sort newest first
    return list.sort((a, b) => (b.paymentDate || "").localeCompare(a.paymentDate || ""));
  }, [garbagePayments, specialPayments, flatLabel, blockLabel, nameLabel]);

  const filteredReceipts = useMemo(() => {
    return unifiedReceipts
      .filter((r) => {
        if (filterType === "garbage") return r.type === "garbage";
        if (filterType === "special") return r.type === "special";
        return true;
      })
      .filter((r) => {
        const q = search.toLowerCase();
        return (
          r.receiptNumber.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.subtitle.toLowerCase().includes(q) ||
          r.paymentMethod.toLowerCase().includes(q)
        );
      });
  }, [unifiedReceipts, filterType, search]);

  if (!open || !resident) return null;

  function handlePrint(receiptItem) {
    printPaymentReceipt(receiptItem.raw);
    toast.success(`Printing receipt ${receiptItem.receiptNumber}...`);
  }

  function handleDownloadPDF(receiptItem) {
    if (receiptItem.type === "special") {
      generateSpecialCollectionReceipt(receiptItem.raw);
    } else {
      generateReceipt(receiptItem.raw);
    }
  }

  function handleCopy(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success("Receipt Number copied!");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden my-auto border border-emerald-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-5 sm:p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition cursor-pointer"
            title="Close"
          >
            <FaTimes className="text-sm" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-2xl text-emerald-200 shrink-0">
              <FaReceipt />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight">
                  Flat {flatLabel} {blockLabel ? `(${blockLabel})` : ""}
                </h3>
                <span className="bg-emerald-500/30 text-emerald-100 border border-emerald-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unifiedReceipts.length} {unifiedReceipts.length === 1 ? "Receipt" : "Receipts"}
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                {nameLabel} {phoneLabel ? `• ${phoneLabel}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/60 space-y-3 shrink-0">
          <div className="relative">
            <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by receipt no, cycle, mode..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === "all"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              All ({unifiedReceipts.length})
            </button>
            <button
              onClick={() => setFilterType("garbage")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                filterType === "garbage"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <FaTrashAlt className="text-[10px]" /> Garbage ({garbagePayments.length})
            </button>
            <button
              onClick={() => setFilterType("special")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                filterType === "special"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <FaHandHoldingHeart className="text-[10px]" /> Special ({specialPayments.length})
            </button>
          </div>
        </div>

        {/* Receipts List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {filteredReceipts.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xl mx-auto">
                <FaReceipt />
              </div>
              <p className="text-sm font-semibold text-gray-700">No payment receipts found</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                No verified payment transactions have been recorded yet for this resident.
              </p>
            </div>
          ) : (
            filteredReceipts.map((receipt) => (
              <div
                key={receipt.id}
                className="bg-white border border-gray-200 hover:border-emerald-300 rounded-2xl p-4 transition shadow-xs hover:shadow-md space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          receipt.type === "special"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {receipt.type === "special" ? (
                          <>
                            <FaHandHoldingHeart className="text-[9px]" /> Special Campaign
                          </>
                        ) : (
                          <>
                            <FaTrashAlt className="text-[9px]" /> Garbage Fee
                          </>
                        )}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm">{receipt.title}</h4>
                    </div>

                    <p className="text-xs text-gray-600 font-medium">{receipt.subtitle}</p>

                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {receipt.receiptNumber}
                      </span>
                      <button
                        onClick={() => handleCopy(receipt.receiptNumber)}
                        className="text-gray-400 hover:text-gray-600 text-xs transition"
                        title="Copy Receipt Number"
                      >
                        <FaCopy />
                      </button>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-base font-extrabold text-emerald-700 block">
                      ₹{receipt.amount.toLocaleString("en-IN")}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                      <FaCheckCircle className="text-[9px]" /> Paid
                    </span>
                  </div>
                </div>

                {/* Meta details & Action buttons */}
                <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="text-gray-500 text-[11px] space-y-0.5">
                    <p>
                      <span className="font-medium text-gray-700">Date:</span> {receipt.paymentDate}
                      {receipt.paymentTime ? ` at ${receipt.paymentTime}` : ""} •{" "}
                      <span className="font-medium text-gray-700">Mode:</span> {receipt.paymentMethod}
                    </p>
                    <p>
                      <span className="font-medium text-gray-700">Collector:</span> {receipt.collector}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePrint(receipt)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
                      title="Direct Print Receipt"
                    >
                      <FaPrint className="text-[11px]" />
                      Print Receipt
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadPDF(receipt)}
                      className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition text-xs cursor-pointer"
                      title="Download PDF"
                    >
                      <FaFileDownload className="text-xs" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 text-center shrink-0">
          <p className="text-[11px] text-gray-400">
            D Block RWA Indraprastha • Official Electronic Receipts
          </p>
        </div>
      </div>
    </div>
  );
}

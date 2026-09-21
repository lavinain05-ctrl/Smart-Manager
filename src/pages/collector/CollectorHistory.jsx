import { useMemo, useState, useEffect } from "react";
import {
  FaSearch,
  FaFileDownload,
  FaTrashAlt,
  FaHandHoldingHeart,
  FaFilter,
  FaPrint,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { usePayments } from "../../context/PaymentContext";
import { subscribeAllSpecialPayments } from "../../services/specialCollectionService";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";
import { generateReceipt } from "../../utils/receiptGenerator";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";

export default function CollectorHistory() {
  const { user } = useAuth();
  const { payments } = usePayments();
  const [specialPayments, setSpecialPayments] = useState([]);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all"); // "all", "garbage", "special"

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
        list.push({
          id: p.id,
          module: "garbage",
          title: `Flat ${p.flat || "—"} • ${p.residentName || "Resident"}`,
          subtitle: `Garbage Collection • ${p.month || ""} ${p.year || ""}`,
          paymentMethod: p.paymentMethod || "Cash",
          paymentDate: p.paymentDate || "—",
          amount: Number(p.amount || 0),
          receiptNumber: p.receiptNumber || "—",
          raw: p,
        });
      });

    // 2. Special Collection payments
    specialPayments
      .filter((p) => p.collectorId === user?.uid && p.status === "confirmed")
      .forEach((p) => {
        const flatText = p.flatNumber ? `Flat ${p.flatNumber} • ` : "";
        list.push({
          id: p.id,
          module: "special",
          title: `${flatText}${p.contributorName || "Contributor"}`,
          subtitle: `${p.collectionName || "Special Collection"} • ${p.contributorType === "external" ? "External" : "Resident"}`,
          paymentMethod: p.paymentMethod || "Cash",
          paymentDate: p.paymentDate || "—",
          amount: Number(p.amount || 0),
          receiptNumber: p.receiptNumber || "—",
          raw: p,
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
  }, [payments, specialPayments, user?.uid, moduleFilter, search]);

  const totalCollected = combinedHistory.reduce((s, item) => s + item.amount, 0);

  return (
    <div className="space-y-5">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Collections History</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Everything you've personally collected across assigned modules
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl text-right self-start sm:self-auto">
          <span className="text-[11px] text-emerald-700 font-semibold block">Total Shown</span>
          <span className="text-lg font-bold text-emerald-800">
            ₹{totalCollected.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="relative">
          <FaSearch className="absolute left-4 top-3.5 text-gray-400 text-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flat, name, receipt number..."
            className="w-full border rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2">
          <button
            onClick={() => setModuleFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              moduleFilter === "all"
                ? "bg-gray-800 text-white shadow-xs"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All Collections
          </button>
          <button
            onClick={() => setModuleFilter("garbage")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                moduleFilter === "special"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <FaHandHoldingHeart className="text-[10px]" /> Special Collections
            </button>
          )}
        </div>
      </div>

      {/* Collection Records */}
      <div className="space-y-3">
        {combinedHistory.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-500 text-sm">
            No collection records found.
          </div>
        ) : (
          combinedHistory.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between gap-3 border border-gray-100 hover:border-emerald-200 transition"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
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
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
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
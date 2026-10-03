import { useState, useEffect, useMemo } from "react";
import {
  FaHistory,
  FaReceipt,
  FaSearch,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaDownload,
  FaTrash,
  FaStar,
  FaFilter,
  FaPrint,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { generateReceiptPDF } from "../../utils/receiptGenerator";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import Pagination from "../../components/common/Pagination";
import PrinterQuickAction from "../../components/common/PrinterQuickAction";

export default function CommitteeCollectionHistory() {
  const { user } = useAuth();
  const { residents = [] } = useResidents() || {};
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  function enrichPayment(p) {
    if (!p) return p;
    const res = residents.find(
      (r) =>
        (p.residentId && r.id === p.residentId) ||
        (p.flatNumber && (r.flatNumber === p.flatNumber || r.flat === p.flatNumber)) ||
        (p.flat && (r.flat === p.flat || r.flatNumber === p.flat))
    );
    return {
      ...p,
      plotNumber: p.plotNumber || res?.plotNumber || "",
      floor: p.floor || res?.floor || "",
      floorCode: p.floorCode || res?.floorCode || "",
      unitNumber: p.unitNumber || res?.unitNumber || "",
      personType: p.personType || res?.personType || "",
      block: p.block || res?.block || "",
    };
  }

  useEffect(() => {
    if (!user?.uid) return;

    // Listen to payments collected by this committee official
    const q = query(
      collection(db, "payments"),
      where("collectorId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        // Sort descending by date
        list.sort((a, b) => {
          const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });
        setPayments(list);
        setLoading(false);
      },
      (err) => {
        console.warn("[CommitteeCollectionHistory] listener error:", err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Filtered list
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (filterType !== "all") {
        if (filterType === "garbage" && p.collectionType !== "garbage" && !p.type?.toLowerCase().includes("garbage")) return false;
        if (filterType === "special" && p.collectionType !== "special" && !p.type?.toLowerCase().includes("special")) return false;
      }
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          p.residentName?.toLowerCase().includes(s) ||
          p.flat?.toLowerCase().includes(s) ||
          p.block?.toLowerCase().includes(s) ||
          p.receiptNo?.toLowerCase().includes(s) ||
          p.referenceNumber?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [payments, filterType, search]);

  // Statistics
  const stats = useMemo(() => {
    const totalCollected = filtered.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const count = filtered.length;
    return { totalCollected, count };
  }, [filtered]);

  // Pagination
  const pagedList = useMemo(() => {
    if (pageSize === "all" || pageSize === "All" || Number(pageSize) >= filtered.length) {
      return filtered;
    }
    const numericSize = Number(pageSize) || 25;
    const start = (page - 1) * numericSize;
    return filtered.slice(start, start + numericSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FaHistory className="text-indigo-600 dark:text-indigo-400" />
            <span>My Collection History</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            View all collections recorded under your committee official account and reprint receipts.
          </p>
        </div>

        {/* Stats & Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <PrinterQuickAction />

          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl px-4 py-2 text-right">
            <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Total Collected</p>
            <p className="text-xl font-black text-emerald-800 dark:text-emerald-200">₹{stats.totalCollected.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2 text-right">
            <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Transactions</p>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{stats.count}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by resident name, flat, block, or receipt #..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="garbage">Garbage Collection</option>
          <option value="special">Special Collection</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">Loading collection records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <FaReceipt className="text-4xl text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-base font-bold text-slate-700 dark:text-slate-300">No Collection Records Found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Payments you record via the Collection Desk will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Resident / Flat</th>
                  <th className="py-3 px-4">Type / Period</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagedList.map((p) => {
                  const dateStr = p.createdAt?.toDate
                    ? p.createdAt.toDate().toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{p.receiptNo || "—"}</span>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">{dateStr}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 dark:text-white">{p.residentName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Flat {p.flat} {p.block ? `(${p.block})` : ""}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.collectionType === "garbage" || p.type?.includes("Garbage")
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                        }`}>
                          {p.collectionType === "garbage" || p.type?.includes("Garbage") ? <FaTrash className="text-[9px]" /> : <FaStar className="text-[9px]" />}
                          <span>{p.type || "Collection"}</span>
                        </span>
                        {(p.month || p.specialCampaignName) && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[200px]">
                            {p.month ? `${p.month} ${p.year || ""}` : p.specialCampaignName}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                        ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                          {p.paymentMode || "Cash"}
                        </span>
                        {p.referenceNumber && (
                          <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[120px]">
                            {p.referenceNumber}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const ep = enrichPayment(p);
                              printPaymentReceipt({
                                ...ep,
                                receiptNumber: ep.receiptNo || ep.receiptNumber,
                                paymentDate: dateStr,
                                residentName: ep.residentName,
                                flat: ep.flat,
                                block: ep.block,
                                plotNumber: ep.plotNumber,
                                floor: ep.floor,
                                unitNumber: ep.unitNumber,
                                personType: ep.personType,
                                amount: ep.amount,
                                type: ep.type,
                                month: ep.month,
                                year: ep.year,
                                specialCampaignName: ep.specialCampaignName,
                                paymentMethod: ep.paymentMode || ep.paymentMethod || "Cash",
                                referenceNumber: ep.referenceNumber,
                                collectorName: ep.collectedBy || ep.collectorName,
                                remarks: ep.remarks,
                              });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs transition cursor-pointer active:scale-95"
                            title="Print Receipt"
                          >
                            <FaPrint className="text-[10px]" />
                            <span>Print</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const ep = enrichPayment(p);
                              generateReceiptPDF({
                                ...ep,
                                receiptNo: ep.receiptNo,
                                date: dateStr,
                                residentName: ep.residentName,
                                flat: ep.flat,
                                block: ep.block,
                                plotNumber: ep.plotNumber,
                                floor: ep.floor,
                                unitNumber: ep.unitNumber,
                                personType: ep.personType,
                                amount: ep.amount,
                                type: ep.type,
                                monthYear: ep.month ? `${ep.month} ${ep.year}` : ep.specialCampaignName,
                                paymentMode: ep.paymentMode,
                                referenceNumber: ep.referenceNumber,
                                collectorName: ep.collectedBy || ep.collectorName,
                              });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs transition cursor-pointer active:scale-95"
                            title="Download PDF"
                          >
                            <FaDownload className="text-[10px]" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <Pagination
              currentPage={page}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, "all"]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

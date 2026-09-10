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
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { generateReceiptPDF } from "../../utils/receiptGenerator";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import Pagination from "../../components/common/Pagination";

export default function CommitteeCollectionHistory() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <FaHistory className="text-indigo-600" />
            <span>My Collection History</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            View all collections recorded under your committee official account and reprint receipts.
          </p>
        </div>

        {/* Stats Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-right">
            <p className="text-[10px] uppercase font-bold text-emerald-600">Total Collected</p>
            <p className="text-xl font-black text-emerald-800">₹{stats.totalCollected.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right">
            <p className="text-[10px] uppercase font-bold text-slate-500">Transactions</p>
            <p className="text-xl font-bold text-slate-800">{stats.count}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by resident name, flat, block, or receipt #..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="all">All Types</option>
          <option value="garbage">Garbage Collection</option>
          <option value="special">Special Collection</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading collection records...</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-gray-400 space-y-2">
            <FaReceipt className="text-4xl text-gray-300 mx-auto mb-2" />
            <p className="text-base font-bold text-gray-700">No Collection Records Found</p>
            <p className="text-xs text-gray-400">Payments you record via the Collection Desk will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Resident / Flat</th>
                  <th className="py-3 px-4">Type / Period</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedList.map((p) => {
                  const dateStr = p.createdAt?.toDate
                    ? p.createdAt.toDate().toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-indigo-700">{p.receiptNo || "—"}</span>
                        <p className="text-[11px] text-gray-400">{dateStr}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-gray-900">{p.residentName}</p>
                        <p className="text-xs text-gray-500">
                          Flat {p.flat} {p.block ? `(${p.block})` : ""}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.collectionType === "garbage" || p.type?.includes("Garbage")
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}>
                          {p.collectionType === "garbage" || p.type?.includes("Garbage") ? <FaTrash className="text-[9px]" /> : <FaStar className="text-[9px]" />}
                          <span>{p.type || "Collection"}</span>
                        </span>
                        {(p.month || p.specialCampaignName) && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                            {p.month ? `${p.month} ${p.year || ""}` : p.specialCampaignName}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                          {p.paymentMode || "Cash"}
                        </span>
                        {p.referenceNumber && (
                          <p className="text-[10px] font-mono text-gray-400 mt-0.5 truncate max-w-[120px]">
                            {p.referenceNumber}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              printPaymentReceipt({
                                receiptNumber: p.receiptNo || p.receiptNumber,
                                paymentDate: dateStr,
                                residentName: p.residentName,
                                flat: p.flat,
                                block: p.block,
                                amount: p.amount,
                                type: p.type,
                                month: p.month,
                                year: p.year,
                                specialCampaignName: p.specialCampaignName,
                                paymentMethod: p.paymentMode || p.paymentMethod || "Cash",
                                referenceNumber: p.referenceNumber,
                                collectorName: p.collectedBy || p.collectorName,
                                remarks: p.remarks,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs transition cursor-pointer"
                            title="Print Receipt"
                          >
                            <FaPrint className="text-[10px]" />
                            <span>Print</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              generateReceiptPDF({
                                receiptNo: p.receiptNo,
                                date: dateStr,
                                residentName: p.residentName,
                                flat: p.flat,
                                block: p.block,
                                amount: p.amount,
                                type: p.type,
                                monthYear: p.month ? `${p.month} ${p.year}` : p.specialCampaignName,
                                paymentMode: p.paymentMode,
                                referenceNumber: p.referenceNumber,
                                collectorName: p.collectedBy || p.collectorName,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition cursor-pointer"
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
          <div className="p-4 border-t border-gray-100">
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

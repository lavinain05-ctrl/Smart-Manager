import { useMemo, useState } from "react";
import { FaSearch, FaHistory } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import GarbageModuleTabs from "../../components/resident/GarbageModuleTabs";

export default function ResidentPayments() {
  const { user } = useAuth();
  const { payments } = usePayments();
  const { residents = [] } = useResidents();

  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  const cleanPhone = useMemo(() => {
    const raw = user?.phone || user?.mobile || (user?.email?.includes("@") ? user.email.split("@")[0] : "");
    const digits = String(raw).replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }, [user]);

  const canonicalResident = useMemo(() => {
    return (
      residents.find((r) => r.id === user?.residentId || r.id === user?.uid) ||
      residents.find((r) => {
        if (!cleanPhone) return false;
        const rDigits = String(r.mobile || r.phone || "").replace(/\D/g, "");
        const rClean = rDigits.length >= 10 ? rDigits.slice(-10) : rDigits;
        return rClean === cleanPhone;
      }) ||
      residents.find(
        (r) =>
          user?.email &&
          !user.email.includes("firebaseapp.com") &&
          r.email?.toLowerCase() === user.email.toLowerCase()
      ) ||
      residents.find(
        (r) =>
          user?.name &&
          r.owner?.toLowerCase() === user.name.toLowerCase()
      ) ||
      null
    );
  }, [residents, user, cleanPhone]);

  const canonicalResidentId = canonicalResident?.id || user?.residentId || user?.uid;

  const myPayments = useMemo(() => {
    let result = payments.filter((p) => {
      if (p.residentId === canonicalResidentId || p.residentId === user?.residentId || p.residentId === user?.uid) {
        return true;
      }
      if (canonicalResident?.id && p.residentId === canonicalResident.id) {
        return true;
      }
      if (cleanPhone && p.mobile) {
        const pClean = String(p.mobile).replace(/\D/g, "").slice(-10);
        if (pClean === cleanPhone) return true;
      }
      const residentOwnerName = (canonicalResident?.owner || user?.name || "").trim().toLowerCase();
      if (
        residentOwnerName &&
        p.residentName?.trim().toLowerCase() === residentOwnerName &&
        (!p.flat || p.flat === (canonicalResident?.flat || user?.flat))
      ) {
        return true;
      }
      return false;
    });

    if (modeFilter !== "All") {
      result = result.filter((p) => p.paymentMethod === modeFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.receiptNumber || "").toLowerCase().includes(q) ||
          (p.collector || "").toLowerCase().includes(q) ||
          (p.paymentMethod || "").toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const tsA = Number((a.receiptNumber || "").replace("REC-", "")) || 0;
      const tsB = Number((b.receiptNumber || "").replace("REC-", "")) || 0;
      return sortBy === "newest" ? tsB - tsA : tsA - tsB;
    });

    return result;
  }, [payments, canonicalResidentId, canonicalResident, user, cleanPhone, search, modeFilter, sortBy]);

  return (
    <div className="space-y-6">
      <GarbageModuleTabs />

      <div>
        <h1 className="text-3xl font-bold">Payment History</h1>
        <p className="text-gray-500">{myPayments.length} payments</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search receipt, collector..."
            className="w-full border rounded-xl pl-10 py-3"
          />
        </div>
        <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className="border rounded-xl px-4 py-3">
          <option value="All">All Methods</option>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border rounded-xl px-4 py-3">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-left font-bold text-gray-600">Receipt</th>
              <th className="p-4 text-right font-bold text-gray-600">Amount</th>
              <th className="p-4 text-left font-bold text-gray-600">Mode</th>
              <th className="p-4 text-left font-bold text-gray-600">Collector</th>
              <th className="p-4 text-left font-bold text-gray-600">Date</th>
              <th className="p-4 text-left font-bold text-gray-600">Time</th>
              <th className="p-4 text-left font-bold text-gray-600">Period</th>
            </tr>
          </thead>
          <tbody>
            {myPayments.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-16 text-gray-500">
                <FaHistory className="text-5xl text-gray-300 mx-auto mb-3" />
                No payment history
              </td></tr>
            ) : (
              myPayments.map((p) => (
                <tr key={p.id} className="border-t hover:bg-blue-50/30 transition">
                  <td className="p-4 font-mono text-sm">{p.receiptNumber}</td>
                  <td className="p-4 text-right font-bold text-emerald-600">₹{Number(p.amount).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      p.paymentMethod === "Cash" ? "bg-green-100 text-green-700"
                      : p.paymentMethod === "UPI" ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                    }`}>{p.paymentMethod}</span>
                  </td>
                  <td className="p-4">
                    {p.collectorRole === "committee" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-full text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        {p.collector || p.collectorName} {p.collectorDesignation ? `(${p.collectorDesignation})` : ""}
                      </span>
                    ) : (
                      <span className="text-gray-700">{p.collector || p.collectorName || "-"}</span>
                    )}
                  </td>
                  <td className="p-4">{p.paymentDate}</td>
                  <td className="p-4 text-gray-500">{p.paymentTime || "-"}</td>
                  <td className="p-4 text-sm">{p.month} {p.year}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

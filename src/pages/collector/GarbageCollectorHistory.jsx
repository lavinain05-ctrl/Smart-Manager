import { useMemo, useState } from "react";
import {
  FaHistory,
  FaSearch,
  FaRecycle,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { useGarbage } from "../../context/GarbageContext";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function GarbageCollectorHistory() {
  const { user } = useAuth();
  const { garbageBills } = useGarbage();

  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

  // My collections
  const myCollections = useMemo(() => {
    return garbageBills
      .filter((b) => b.collectedById === user?.uid && b.status === "Paid")
      .filter((b) => {
        const matchSearch = `${b.residentName} ${b.flat} ${b.block}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchMonth = monthFilter === "all" || b.month === monthFilter;
        const matchYear = Number(b.year) === Number(yearFilter);
        return matchSearch && matchMonth && matchYear;
      })
      .sort((a, b) => {
        // Sort by payment date descending
        if (a.paymentDate && b.paymentDate) return b.paymentDate.localeCompare(a.paymentDate);
        return 0;
      });
  }, [garbageBills, user, search, monthFilter, yearFilter]);

  const totalAmount = myCollections.reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <FaHistory className="text-emerald-600" />
          Garbage Collection History
        </h1>
        <p className="text-gray-500">
          {myCollections.length} collections • ₹{totalAmount.toLocaleString()} total
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FaSearch className="absolute left-4 top-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resident..."
              className="w-full border rounded-xl pl-12 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="border rounded-xl px-4 py-3 bg-white outline-none"
          >
            <option value="all">All Months</option>
            {MONTHS.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(Number(e.target.value))}
            className="border rounded-xl px-4 py-3 bg-white outline-none"
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {myCollections.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold">{b.residentName}</h3>
              <p className="text-gray-500 text-sm">{b.flat} • {b.block}</p>
              <p className="text-gray-400 text-xs">{b.month} {b.year}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-emerald-700">₹{Number(b.paidAmount || b.amount || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-400">{b.paymentMethod} • {b.paymentDate}</p>
            </div>
          </div>
        ))}

        {myCollections.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">
            No collection history found
          </div>
        )}
      </div>
    </div>
  );
}

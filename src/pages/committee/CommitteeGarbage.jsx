import { useMemo, useState } from "react";
import {
  FaRecycle,
  FaChartBar,
  FaUsers,
  FaMoneyBillWave,
  FaClock,
  FaWallet,
} from "react-icons/fa";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { useGarbage } from "../../context/GarbageContext";

ChartJS.register(ArcElement, Tooltip, Legend);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CommitteeGarbage() {
  const {
    garbageAccounts,
    garbageBills,
  } = useGarbage();

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString("default", { month: "long" })
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthlyBills = useMemo(
    () => garbageBills.filter(
      (b) => b.month === selectedMonth && Number(b.year) === Number(selectedYear)
    ),
    [garbageBills, selectedMonth, selectedYear]
  );

  const totalAccounts = garbageAccounts.length;
  const activeAccounts = garbageAccounts.filter((a) => a.status === "active").length;
  const totalBilled = monthlyBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const collected = monthlyBills.filter((b) => b.status === "Paid").reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
  const pending = totalBilled - collected;
  const paidCount = monthlyBills.filter((b) => b.status === "Paid").length;
  const pendingCount = monthlyBills.filter((b) => b.status === "Pending").length;

  // Block breakdown
  const blockData = useMemo(() => {
    const map = {};
    monthlyBills.forEach((b) => {
      const block = b.block || "General";
      if (!map[block]) map[block] = { total: 0, collected: 0, count: 0 };
      map[block].total += Number(b.amount || 0);
      map[block].count += 1;
      if (b.status === "Paid") map[block].collected += Number(b.paidAmount || b.amount || 0);
    });
    return Object.entries(map).map(([block, data]) => ({ block, ...data })).sort((a, b) => a.block.localeCompare(b.block));
  }, [monthlyBills]);

  const pieData = {
    labels: ["Paid", "Pending"],
    datasets: [{
      data: [paidCount, pendingCount],
      backgroundColor: ["#10B981", "#F59E0B"],
      borderWidth: 0,
    }],
  };

  const stats = [
    { label: "Total Accounts", value: totalAccounts, icon: <FaUsers />, color: "bg-blue-100 text-blue-700" },
    { label: "Active", value: activeAccounts, icon: <FaUsers />, color: "bg-emerald-100 text-emerald-700" },
    { label: "Total Billed", value: `₹${totalBilled.toLocaleString()}`, icon: <FaMoneyBillWave />, color: "bg-indigo-100 text-indigo-700" },
    { label: "Collected", value: `₹${collected.toLocaleString()}`, icon: <FaWallet />, color: "bg-green-100 text-green-700" },
    { label: "Pending", value: `₹${pending.toLocaleString()}`, icon: <FaClock />, color: "bg-yellow-100 text-yellow-700" },
    { label: "Collection %", value: `${totalBilled > 0 ? Math.round((collected / totalBilled) * 100) : 0}%`, icon: <FaChartBar />, color: "bg-purple-100 text-purple-700" },
  ];

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FaRecycle className="text-emerald-600" />
            Garbage Reports
          </h1>
          <p className="text-gray-500 mt-1">Read-only analytics and statistics</p>
        </div>

        <div className="flex items-center gap-3">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border rounded-xl px-4 py-2.5 bg-white shadow-sm text-sm outline-none">
            {MONTHS.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="border rounded-xl px-4 py-2.5 bg-white shadow-sm text-sm outline-none">
            {[2024, 2025, 2026, 2027, 2028].map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-sm p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-gray-500 text-xs">{stat.label}</p>
            <h3 className="text-lg font-bold mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Payment Status</h3>
          <div className="h-64 flex items-center justify-center">
            {paidCount + pendingCount > 0 ? (
              <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} />
            ) : (
              <p className="text-gray-400">No data</p>
            )}
          </div>
        </div>

        {/* Block Report */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Block-wise Report</h3>
          {blockData.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No data</p>
          ) : (
            <div className="space-y-3">
              {blockData.map((b) => (
                <div key={b.block} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border-b last:border-0">
                  <div>
                    <p className="font-medium">Block {b.block}</p>
                    <p className="text-gray-500 text-xs">{b.count} bills</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="text-emerald-700 font-medium">₹{b.collected.toLocaleString()}</span>
                      {" / "}
                      <span className="text-gray-500">₹{b.total.toLocaleString()}</span>
                    </p>
                    <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${b.total > 0 ? Math.min((b.collected / b.total) * 100, 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

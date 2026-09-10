import { useMemo } from "react";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaMoneyBillWave,
  FaClock,
  FaWallet,
  FaExclamationTriangle,
  FaRecycle,
  FaChartLine,
} from "react-icons/fa";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { useGarbage } from "../../context/GarbageContext";
import { usePayments } from "../../context/PaymentContext";
import { calcGarbageStats, getGarbageMonthlyStats } from "../../services/statisticsService";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function GarbageDashboard() {
  const {
    garbageAccounts,
    garbageBills,
    garbageCollections,
    garbageLogs,
    residents,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
  } = useGarbage();

  const { payments } = usePayments();

  // ========================
  // Stats — from shared statistics engine
  // ========================

  const gs = useMemo(
    () => calcGarbageStats(garbageAccounts, garbageBills, residents || [], selectedMonth, selectedYear, payments),
    [garbageAccounts, garbageBills, residents, selectedMonth, selectedYear, payments]
  );

  // Centralized monthly stats (works even without garbageAccounts docs)
  const gcMs = useMemo(
    () => getGarbageMonthlyStats(residents || [], garbageBills, selectedMonth, selectedYear, payments),
    [residents, garbageBills, selectedMonth, selectedYear, payments]
  );

  const today = new Date().toLocaleDateString("en-IN");
  const todayCollections = garbageCollections.filter(
    (c) => c.date === today || (c.collectedAt?.toDate?.()?.toLocaleDateString("en-IN") === today)
  ).length;

  const stats = [
    { label: "Total Residents", value: (residents || []).length, icon: <FaUsers />, color: "bg-blue-100 text-blue-700" },
    { label: "GC Participants", value: gcMs.participants, icon: <FaUserCheck />, color: "bg-emerald-100 text-emerald-700" },
    { label: "Active Accounts", value: gs.activeAccounts, icon: <FaUserTimes />, color: "bg-teal-100 text-teal-700" },
    { label: "Monthly Billed", value: `₹${gcMs.expectedAmount.toLocaleString()}`, icon: <FaMoneyBillWave />, color: "bg-indigo-100 text-indigo-700" },
    { label: "Collected", value: `₹${gcMs.collectedAmount.toLocaleString()}`, icon: <FaWallet />, color: "bg-green-100 text-green-700" },
    { label: "Pending", value: `₹${gcMs.pendingAmount.toLocaleString()}`, icon: <FaClock />, color: "bg-yellow-100 text-yellow-700" },
    { label: "Outstanding Bills", value: gcMs.pendingResidents, icon: <FaExclamationTriangle />, color: "bg-orange-100 text-orange-700" },
    { label: "Today's Collections", value: todayCollections, icon: <FaRecycle />, color: "bg-purple-100 text-purple-700" },
  ];

  // ========================
  // Charts Data
  // ========================

  const monthlyChartData = useMemo(() => {
    const data = MONTHS.map((month) => {
      const bills = garbageBills.filter(
        (b) => b.month === month && Number(b.year) === Number(selectedYear)
      );
      const collected = bills.filter((b) => b.status === "Paid").reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
      const pending = bills.filter((b) => b.status === "Pending").reduce((s, b) => s + Number(b.amount || 0), 0);
      return { collected, pending };
    });

    return {
      labels: MONTHS.map((m) => m.slice(0, 3)),
      datasets: [
        {
          label: "Collected",
          data: data.map((d) => d.collected),
          backgroundColor: "rgba(16, 185, 129, 0.7)",
          borderRadius: 6,
        },
        {
          label: "Pending",
          data: data.map((d) => d.pending),
          backgroundColor: "rgba(245, 158, 11, 0.7)",
          borderRadius: 6,
        },
      ],
    };
  }, [garbageBills, selectedYear]);

  const pieData = {
    labels: ["Paid", "Pending"],
    datasets: [
      {
        data: [gcMs.paidResidents, gcMs.pendingResidents],
        backgroundColor: ["#10B981", "#F59E0B"],
        borderWidth: 0,
      },
    ],
  };

  // ========================
  // Recent Activity
  // ========================

  const recentLogs = garbageLogs.slice(0, 8);

  return (
    <div className="space-y-8">

      {/* Month/Year Selector */}
      <div className="flex justify-end">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded-xl px-4 py-2.5 bg-white shadow-sm text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border rounded-xl px-4 py-2.5 bg-white shadow-sm text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-gray-500 text-sm">{stat.label}</p>
            <h3 className="text-xl font-bold mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Collection Progress */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FaChartLine className="text-emerald-600" />
          Collection Progress — {selectedMonth} {selectedYear}
        </h3>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-700"
            style={{ width: `${gcMs.collectionPercentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-500">
          <span>₹{gcMs.collectedAmount.toLocaleString()} collected</span>
          <span>₹{gcMs.expectedAmount.toLocaleString()} target</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Monthly Collection Trend — {selectedYear}</h3>
          <div className="h-72">
            <Bar
              data={monthlyChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
                scales: {
                  y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
                  x: { grid: { display: false } },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold mb-4">Payment Status — {selectedMonth}</h3>
          <div className="h-72 flex items-center justify-center">
            {gcMs.paidResidents + gcMs.pendingResidents > 0 ? (
              <Pie
                data={pieData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "bottom" } },
                }}
              />
            ) : (
              <p className="text-gray-400 text-sm">No bills generated yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        {recentLogs.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition"
              >
                <div className="w-2 h-2 mt-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{log.action}</p>
                  <p className="text-gray-500 text-xs truncate">{log.details}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {log.performedByName || "System"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

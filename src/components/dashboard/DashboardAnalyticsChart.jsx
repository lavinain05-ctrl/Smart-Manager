import { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  FaChartBar,
  FaChartPie,
  FaWallet,
  FaMobileAlt,
  FaUniversity,
} from "react-icons/fa";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardAnalyticsChart({
  paymentStats = {},
  selectedMonth = "",
  selectedYear = "",
}) {
  const [chartView, setChartView] = useState("overview"); // "overview" | "methods"

  const collected = paymentStats?.collectedAmount || 0;
  const pending = paymentStats?.pendingAmount || 0;
  const expected = paymentStats?.expectedAmount || (collected + pending);

  const monthlyPayments = paymentStats?.monthlyPayments || [];

  const cashAmount = monthlyPayments
    .filter((p) => (p.paymentMethod || "").toLowerCase() === "cash")
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const upiAmount = monthlyPayments
    .filter((p) => (p.paymentMethod || "").toLowerCase() === "upi")
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const bankAmount = monthlyPayments
    .filter((p) => (p.paymentMethod || "").toLowerCase().includes("bank"))
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  // ─── Bar Chart Data (Collected vs Pending vs Target) ───
  const barData = useMemo(() => {
    return {
      labels: ["Collected", "Pending Dues", "Target Expected"],
      datasets: [
        {
          label: "Amount (₹)",
          data: [collected, pending, expected],
          backgroundColor: [
            "rgba(16, 185, 129, 0.85)", // Emerald
            "rgba(244, 63, 94, 0.85)",  // Rose / Amber
            "rgba(59, 130, 246, 0.85)",  // Blue
          ],
          borderColor: [
            "#10b981",
            "#f43f5e",
            "#3b82f6",
          ],
          borderWidth: 1.5,
          borderRadius: 8,
          barPercentage: 0.45,
          categoryPercentage: 0.6,
        },
      ],
    };
  }, [collected, pending, expected]);

  const barOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          titleFont: { size: 12, weight: "bold" },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => ` ₹${(ctx.parsed.y || 0).toLocaleString("en-IN")}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#64748b",
            font: { size: 11, weight: "600" },
          },
        },
        y: {
          border: { dash: [4, 4] },
          grid: { color: "rgba(226, 232, 240, 0.6)" },
          ticks: {
            color: "#64748b",
            font: { size: 11 },
            callback: (val) => `₹${val.toLocaleString("en-IN")}`,
          },
        },
      },
    };
  }, []);

  // ─── Doughnut Data (Payment Methods Breakdown) ───
  const doughnutData = useMemo(() => {
    const hasData = cashAmount > 0 || upiAmount > 0 || bankAmount > 0;
    return {
      labels: ["UPI", "Cash", "Bank Transfer"],
      datasets: [
        {
          data: hasData ? [upiAmount, cashAmount, bankAmount] : [1, 1, 1],
          backgroundColor: hasData
            ? [
                "rgba(168, 85, 247, 0.85)", // Purple UPI
                "rgba(16, 185, 129, 0.85)", // Green Cash
                "rgba(59, 130, 246, 0.85)",  // Blue Bank
              ]
            : ["#e2e8f0", "#e2e8f0", "#e2e8f0"],
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 4,
        },
      ],
    };
  }, [cashAmount, upiAmount, bankAmount]);

  const doughnutOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            padding: 14,
            color: "#64748b",
            font: { size: 11, weight: "600" },
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed || 0;
              return ` ₹${val.toLocaleString("en-IN")}`;
            },
          },
        },
      },
    };
  }, []);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
      {/* Header with Title & View Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Financial Analytics
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
            Collection Intelligence — {selectedMonth} {selectedYear}
          </h3>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-center">
          <button
            type="button"
            onClick={() => setChartView("overview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              chartView === "overview"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <FaChartBar className="text-xs" />
            <span>Comparison</span>
          </button>

          <button
            type="button"
            onClick={() => setChartView("methods")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              chartView === "methods"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <FaChartPie className="text-xs" />
            <span>Channels</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="my-5 h-64 w-full relative flex items-center justify-center">
        {chartView === "overview" ? (
          <Bar data={barData} options={barOptions} />
        ) : (
          <div className="w-full h-full max-w-[260px] mx-auto relative flex items-center justify-center">
            <Doughnut data={doughnutData} options={doughnutOptions} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-7">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
              <span className="text-sm font-black text-slate-900">
                ₹{collected.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Channel Quick Stats Footer */}
      <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100/60">
          <div className="flex items-center justify-center gap-1.5 text-purple-600 mb-0.5">
            <FaMobileAlt className="text-xs" />
            <span className="text-[10px] font-bold uppercase tracking-wider">UPI</span>
          </div>
          <p className="text-sm font-black text-slate-900 truncate">
            ₹{upiAmount.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100/60">
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 mb-0.5">
            <FaWallet className="text-xs" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Cash</span>
          </div>
          <p className="text-sm font-black text-slate-900 truncate">
            ₹{cashAmount.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100/60">
          <div className="flex items-center justify-center gap-1.5 text-blue-600 mb-0.5">
            <FaUniversity className="text-xs" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Bank</span>
          </div>
          <p className="text-sm font-black text-slate-900 truncate">
            ₹{bankAmount.toLocaleString("en-IN")}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Pie, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function DailyReportCharts({ payments, collectors }) {
  // 1. Collector-wise Bar Chart
  const barData = useMemo(() => {
    const map = {};
    payments.forEach((p) => {
      const key = p.collector || "General / Admin";
      map[key] = (map[key] || 0) + Number(p.amount || 0);
    });

    const labels = Object.keys(map);
    const values = Object.values(map);

    return {
      labels,
      datasets: [{
        label: "Amount (₹)",
        data: values,
        backgroundColor: [
          "#10B981", "#6366F1", "#F59E0B", "#EF4444", "#3B82F6",
          "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#06B6D4",
        ],
        borderRadius: 10,
        borderSkipped: false,
      }],
    };
  }, [payments]);

  // 2. Cash vs UPI vs Bank Pie Chart
  const pieData = useMemo(() => {
    const cash = payments.filter((p) => p.paymentMethod === "Cash").reduce((s, p) => s + Number(p.amount || 0), 0);
    const upi = payments.filter((p) => p.paymentMethod === "UPI").reduce((s, p) => s + Number(p.amount || 0), 0);
    const bank = payments.filter((p) => p.paymentMethod === "Bank Transfer").reduce((s, p) => s + Number(p.amount || 0), 0);

    return {
      labels: ["Cash", "UPI", "Bank Transfer"],
      datasets: [{
        data: [cash, upi, bank],
        backgroundColor: ["#22C55E", "#8B5CF6", "#3B82F6"],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    };
  }, [payments]);

  // 3. Hourly Collection Timeline
  const lineData = useMemo(() => {
    const hourMap = {};
    for (let i = 6; i <= 22; i++) {
      const label = i <= 12 ? `${i} AM` : `${i - 12} PM`;
      if (i === 12) hourMap["12 PM"] = 0;
      else hourMap[label] = 0;
    }

    payments.forEach((p) => {
      const ts = Number((p.receiptNumber || "").replace("REC-", "")) || 0;
      if (!ts) return;
      const d = new Date(ts);
      const h = d.getHours();
      const label = h <= 12 ? `${h} AM` : `${h - 12} PM`;
      if (h === 12) {
        hourMap["12 PM"] = (hourMap["12 PM"] || 0) + Number(p.amount || 0);
      } else if (hourMap[label] !== undefined) {
        hourMap[label] += Number(p.amount || 0);
      }
    });

    return {
      labels: Object.keys(hourMap),
      datasets: [{
        label: "Collection (₹)",
        data: Object.values(hourMap),
        fill: true,
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        borderColor: "#10B981",
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#10B981",
      }],
    };
  }, [payments]);

  // 4. Collection Percentage Comparison
  const pctData = useMemo(() => {
    const map = {};
    const totalExpected = collectors.length > 0
      ? Math.round(payments.reduce((s, p) => s + Number(p.amount || 0), 0) * 1.5)
      : 0;
    const perCollector = collectors.length > 0 ? Math.round(totalExpected / collectors.length) : 0;

    collectors.forEach((c) => {
      const cPayments = payments.filter(
        (p) => p.collectorId === c.uid || p.collector === c.name
      );
      const actual = cPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const pct = perCollector === 0 ? 0 : Math.round((actual / perCollector) * 100);
      map[c.name] = Math.min(pct, 100);
    });

    return {
      labels: Object.keys(map),
      datasets: [{
        label: "Collection %",
        data: Object.values(map),
        backgroundColor: Object.values(map).map((v) =>
          v >= 80 ? "#22C55E" : v >= 50 ? "#F59E0B" : "#EF4444"
        ),
        borderRadius: 10,
        borderSkipped: false,
      }],
    };
  }, [payments, collectors]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => "₹" + Number(ctx.raw).toLocaleString() } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v) => "₹" + Number(v).toLocaleString() } },
    },
  };

  const pctOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => ctx.raw + "%" } },
    },
    scales: {
      y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + "%" } },
    },
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => "₹" + Number(ctx.raw).toLocaleString() } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v) => "₹" + Number(v).toLocaleString() } },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { padding: 16, usePointStyle: true } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ₹${Number(ctx.raw).toLocaleString()}` } },
    },
  };

  if (payments.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Collector-wise Bar Chart */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Collector-wise Collection</h3>
        <div className="h-72"><Bar data={barData} options={barOptions} /></div>
      </div>

      {/* Cash vs UPI vs Bank Pie Chart */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Payment Mode Split</h3>
        <div className="h-72"><Pie data={pieData} options={pieOptions} /></div>
      </div>

      {/* Hourly Collection Timeline */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Hourly Collection Timeline</h3>
        <div className="h-72"><Line data={lineData} options={lineOptions} /></div>
      </div>

      {/* Collection Percentage Comparison */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Collection % Comparison</h3>
        <div className="h-72"><Bar data={pctData} options={pctOptions} /></div>
      </div>

    </div>
  );
}

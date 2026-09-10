import { useMemo } from "react";
import {
  FaMoneyBillWave,
  FaWallet,
  FaMobileAlt,
  FaUniversity,
  FaUserTie,
  FaReceipt,
  FaClock,
  FaChartLine,
} from "react-icons/fa";

export default function DailyReportSummaryCards({ payments, expectedCollection, collectors }) {
  const stats = useMemo(() => {
    const actual = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const cash = payments.filter((p) => p.paymentMethod === "Cash").reduce((s, p) => s + Number(p.amount || 0), 0);
    const upi = payments.filter((p) => p.paymentMethod === "UPI").reduce((s, p) => s + Number(p.amount || 0), 0);
    const bank = payments.filter((p) => p.paymentMethod === "Bank Transfer").reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = expectedCollection - actual;
    const pct = expectedCollection === 0 ? 0 : Math.round((actual / expectedCollection) * 100);
    const activeCollectors = new Set(payments.map((p) => p.collectorId || p.collector).filter(Boolean)).size;

    return { actual, cash, upi, bank, pending, pct, activeCollectors, receipts: payments.length };
  }, [payments, expectedCollection]);

  const cards = [
    { title: "Expected", value: `₹${expectedCollection.toLocaleString()}`, icon: <FaChartLine />, color: "bg-blue-600", sub: "Total expected" },
    { title: "Collected", value: `₹${stats.actual.toLocaleString()}`, icon: <FaMoneyBillWave />, color: "bg-emerald-600", sub: `${stats.pct}% achieved` },
    { title: "Pending", value: `₹${Math.max(0, stats.pending).toLocaleString()}`, icon: <FaClock />, color: "bg-red-600", sub: "Remaining" },
    { title: "Cash", value: `₹${stats.cash.toLocaleString()}`, icon: <FaWallet />, color: "bg-green-700", sub: "Cash total" },
    { title: "UPI", value: `₹${stats.upi.toLocaleString()}`, icon: <FaMobileAlt />, color: "bg-purple-600", sub: "UPI total" },
    { title: "Bank Transfer", value: `₹${stats.bank.toLocaleString()}`, icon: <FaUniversity />, color: "bg-indigo-600", sub: "Bank total" },
    { title: "Active Collectors", value: stats.activeCollectors, icon: <FaUserTie />, color: "bg-teal-600", sub: `of ${collectors.length}` },
    { title: "Receipts", value: stats.receipts, icon: <FaReceipt />, color: "bg-orange-500", sub: "Generated" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
      {cards.map((card) => (
        <div key={card.title} className={`${card.color} text-white rounded-2xl p-4 shadow-lg`}>
          <div className="text-2xl opacity-80 mb-2">{card.icon}</div>
          <h3 className="text-xl font-bold">{card.value}</h3>
          <p className="text-xs opacity-80 mt-1">{card.title}</p>
        </div>
      ))}
    </div>
  );
}

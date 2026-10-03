import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaWallet,
  FaMoneyBillWave,
  FaMobileAlt,
  FaUserClock,
  FaRecycle,
  FaPrint,
  FaCheckCircle,
  FaArrowRight,
  FaCalendarCheck,
  FaReceipt,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { useGarbage } from "../../context/GarbageContext";
import { useResidents } from "../../context/ResidentContext";
import { useBilling } from "../../context/BillingContext";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import CollectorMonthBar from "../../components/collections/CollectorMonthBar";
import PrinterQuickAction from "../../components/common/PrinterQuickAction";

export default function GarbageCollectorDashboard() {
  const { user } = useAuth();
  const { residents = [] } = useResidents() || {};
  const { garbageAccounts, garbageBills } = useGarbage();
  const { selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useBilling();

  const [viewTab, setViewTab] = useState("month"); // "month" or "today"

  function enrichBill(b) {
    const res = residents.find(
      (r) =>
        (b.residentId && r.id === b.residentId) ||
        (b.flat && (r.flat === b.flat || r.flatNumber === b.flat))
    );
    return {
      ...b,
      plotNumber: b.plotNumber || res?.plotNumber || "",
      floor: b.floor || res?.floor || "",
      unitNumber: b.unitNumber || res?.unitNumber || "",
      personType: b.personType || res?.personType || "",
      block: b.block || res?.block || "",
    };
  }

  const today = new Date().toLocaleDateString("en-IN");

  // My assigned accounts
  const myAccounts = useMemo(
    () => garbageAccounts.filter((a) => a.collectorId === user?.uid && a.status === "active"),
    [garbageAccounts, user]
  );

  // Today's collections by this collector
  const todayCollections = useMemo(
    () =>
      garbageBills.filter(
        (b) =>
          b.collectedById === user?.uid &&
          b.paymentDate === today &&
          b.status === "Paid"
      ),
    [garbageBills, user, today]
  );

  const totalToday = todayCollections.reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
  const cashToday = todayCollections
    .filter((b) => b.paymentMethod === "Cash")
    .reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
  const upiToday = todayCollections
    .filter((b) => b.paymentMethod === "UPI")
    .reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);

  // Selected Month's collections by this collector
  const monthCollections = useMemo(
    () =>
      garbageBills.filter(
        (b) =>
          b.collectedById === user?.uid &&
          b.month === selectedMonth &&
          Number(b.year) === Number(selectedYear) &&
          b.status === "Paid"
      ),
    [garbageBills, user, selectedMonth, selectedYear]
  );

  const totalMonth = monthCollections.reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
  const cashMonth = monthCollections
    .filter((b) => b.paymentMethod === "Cash")
    .reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
  const upiMonth = monthCollections
    .filter((b) => b.paymentMethod === "UPI")
    .reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);

  // Pending for selected month
  const pendingThisMonth = useMemo(() => {
    return myAccounts.filter((acc) => {
      const bill = garbageBills.find(
        (b) =>
          b.accountId === acc.id &&
          b.month === selectedMonth &&
          Number(b.year) === Number(selectedYear)
      );
      return !bill || bill.status === "Pending";
    }).length;
  }, [myAccounts, garbageBills, selectedMonth, selectedYear]);

  const paidThisMonth = Math.max(0, myAccounts.length - pendingThisMonth);
  const collectionRate = myAccounts.length > 0 ? Math.round((paidThisMonth / myAccounts.length) * 100) : 0;

  const stats = [
    {
      label: `Collected (${selectedMonth})`,
      value: `₹${totalMonth.toLocaleString()}`,
      subtext: `${monthCollections.length} collections`,
      icon: <FaWallet />,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: `Pending (${selectedMonth})`,
      value: pendingThisMonth,
      subtext: `${collectionRate}% paid so far`,
      icon: <FaUserClock />,
      color: "bg-red-100 text-red-700",
    },
    {
      label: `Paid (${selectedMonth})`,
      value: paidThisMonth,
      subtext: `out of ${myAccounts.length} assigned`,
      icon: <FaCheckCircle />,
      color: "bg-green-100 text-green-700",
    },
    {
      label: "Collected Today",
      value: `₹${totalToday.toLocaleString()}`,
      subtext: `${todayCollections.length} today`,
      icon: <FaMoneyBillWave />,
      color: "bg-blue-100 text-blue-700",
    },
  ];

  const displayedCollections = viewTab === "month" ? monthCollections : todayCollections;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-900">
            <FaRecycle className="text-emerald-600" />
            Garbage Collector Dashboard
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            {myAccounts.length} assigned accounts • Monthly billing and collection tracker
          </p>
        </div>
        <div>
          <PrinterQuickAction />
        </div>
      </div>

      {/* Month Selection Bar */}
      <CollectorMonthBar
        title={`Cycle: ${selectedMonth} ${selectedYear}`}
        subtitle="Filter and track pending/paid records for this cycle"
      />

      {/* Selected Month Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FaCalendarCheck className="text-emerald-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
              Billing Period: {selectedMonth} {selectedYear}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold">
            {paidThisMonth} of {myAccounts.length} Assigned Accounts Paid ({collectionRate}%)
          </h2>
          <p className="text-xs text-emerald-100">
            Pending: {pendingThisMonth} • Collected: ₹{totalMonth.toLocaleString()}
          </p>
        </div>

        <Link
          to="/collector/garbage/collect"
          className="bg-white text-emerald-800 hover:bg-emerald-50 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shadow-sm shrink-0 self-start sm:self-auto"
        >
          <span>Collect for {selectedMonth}</span>
          <FaArrowRight className="text-xs" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${stat.color}`}>
                {stat.icon}
              </div>
              <span className="text-[11px] text-gray-400 font-medium">{stat.subtext}</span>
            </div>
            <p className="text-gray-500 text-xs font-semibold">{stat.label}</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Payment Modes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">Cash ({selectedMonth})</span>
          <span className="text-base sm:text-lg font-bold text-gray-800">₹{cashMonth.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">UPI ({selectedMonth})</span>
          <span className="text-base sm:text-lg font-bold text-gray-800">₹{upiMonth.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">Cash Today</span>
          <span className="text-base sm:text-lg font-bold text-gray-800">₹{cashToday.toLocaleString()}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">UPI Today</span>
          <span className="text-base sm:text-lg font-bold text-gray-800">₹{upiToday.toLocaleString()}</span>
        </div>
      </div>

      {/* Collection Log with Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
              <FaReceipt />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Collections & Receipts Log</h3>
              <p className="text-xs text-gray-400">Instantly print payment receipts</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewTab("month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewTab === "month" ? "bg-white text-emerald-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {selectedMonth} ({monthCollections.length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab("today")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewTab === "today" ? "bg-white text-emerald-700 shadow-xs" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Today ({todayCollections.length})
            </button>
          </div>
        </div>

        {displayedCollections.length === 0 ? (
          <p className="text-gray-400 text-center py-8 text-xs sm:text-sm">
            {viewTab === "month"
              ? `No collections recorded for ${selectedMonth} ${selectedYear} yet.`
              : "No collections recorded today."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {displayedCollections.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50/70 hover:bg-emerald-50/40 transition border border-gray-100"
              >
                <div>
                  <p className="font-bold text-sm text-gray-900">{b.residentName}</p>
                  <p className="text-gray-500 text-xs">{b.flat} • {b.block}</p>
                  <p className="text-[11px] font-mono text-gray-400 mt-0.5">{b.paymentDate} • {b.paymentMethod}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-extrabold text-sm text-emerald-700">₹{Number(b.paidAmount || b.amount || 0).toLocaleString()}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const eb = enrichBill(b);
                      printPaymentReceipt({
                        ...eb,
                        totalPaidAmount: eb.paidAmount || eb.amount,
                        paymentMethod: eb.paymentMethod || "Cash",
                        paymentDate: eb.paymentDate || new Date().toLocaleDateString("en-IN"),
                        receiptNumber: eb.paymentId || ("REC-" + eb.id),
                        collector: user?.name || "Collector",
                      });
                      toast.success(`Printing receipt for Flat ${eb.flat || eb.unitNumber}...`);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer shrink-0"
                    title="Print Official Payment Receipt"
                  >
                    <FaPrint className="text-[11px]" />
                    <span className="hidden sm:inline">Print Receipt</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo } from "react";
import {
  FaWallet,
  FaMoneyBillWave,
  FaMobileAlt,
  FaUserClock,
  FaRecycle,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { useGarbage } from "../../context/GarbageContext";

export default function GarbageCollectorDashboard() {
  const { user } = useAuth();
  const {
    garbageAccounts,
    garbageBills,
    garbageCollections,
    selectedMonth,
    selectedYear,
  } = useGarbage();

  const today = new Date().toLocaleDateString("en-IN");
  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();

  // My assigned accounts
  const myAccounts = useMemo(
    () => garbageAccounts.filter((a) => a.collectorId === user?.uid && a.status === "active"),
    [garbageAccounts, user]
  );

  // Today's collections by this collector
  const todayCollections = useMemo(
    () => garbageBills.filter(
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

  // Pending for this month
  const pendingThisMonth = useMemo(() => {
    return myAccounts.filter((acc) => {
      const bill = garbageBills.find(
        (b) =>
          b.accountId === acc.id &&
          b.month === currentMonth &&
          Number(b.year) === Number(currentYear)
      );
      return !bill || bill.status === "Pending";
    }).length;
  }, [myAccounts, garbageBills, currentMonth, currentYear]);

  const stats = [
    { label: "Collected Today", value: `₹${totalToday.toLocaleString()}`, icon: <FaWallet />, color: "bg-emerald-100 text-emerald-700" },
    { label: "Cash Today", value: `₹${cashToday.toLocaleString()}`, icon: <FaMoneyBillWave />, color: "bg-blue-100 text-blue-700" },
    { label: "UPI Today", value: `₹${upiToday.toLocaleString()}`, icon: <FaMobileAlt />, color: "bg-purple-100 text-purple-700" },
    { label: "Pending This Month", value: pendingThisMonth, icon: <FaUserClock />, color: "bg-red-100 text-red-700" },
  ];

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <FaRecycle className="text-emerald-600" />
          Garbage Collection
        </h1>
        <p className="text-gray-500">
          {currentMonth} {currentYear} • {myAccounts.length} assigned residents
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-sm p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-gray-500 text-sm">{stat.label}</p>
            <h3 className="text-xl font-bold">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Today's Summary */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="font-semibold mb-4">Today's Collections</h3>
        {todayCollections.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No collections today</p>
        ) : (
          <div className="space-y-3">
            {todayCollections.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition">
                <div>
                  <p className="font-medium">{b.residentName}</p>
                  <p className="text-gray-500 text-sm">{b.flat} • {b.block}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-700">₹{Number(b.paidAmount || b.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{b.paymentMethod}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

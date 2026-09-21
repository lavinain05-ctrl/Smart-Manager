import { useMemo, useState, useEffect } from "react";
import {
  FaWallet,
  FaMoneyBillWave,
  FaMobileAlt,
  FaUserClock,
  FaUserPlus,
  FaTimes,
  FaTrashAlt,
  FaHandHoldingHeart,
  FaPrint,
  FaReceipt,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import { useBills } from "../../context/BillContext";
import { useSettings } from "../../context/SettingsContext";

import { printPaymentReceipt } from "../../utils/printReceiptHelper";

import ResidentForm from "../../components/forms/ResidentForm";
import { isGcParticipating } from "../../services/statisticsService";
import { subscribeAllSpecialPayments } from "../../services/specialCollectionService";

export default function CollectorDashboard() {
  const { user } = useAuth();
  const { payments } = usePayments();
  const { residents, addResident } = useResidents();
  const { bills } = useBills();
  const { settings } = useSettings();

  const [showAddResident, setShowAddResident] = useState(false);
  const [specialPayments, setSpecialPayments] = useState([]);

  useEffect(() => {
    const unsub = subscribeAllSpecialPayments((list) => {
      setSpecialPayments(list);
    });
    return () => unsub();
  }, []);

  const today = new Date().toLocaleDateString("en-IN");
  const todayISO = new Date().toISOString().split("T")[0];

  const assignedModules = useMemo(() => {
    if (Array.isArray(user?.assignedModules) && user.assignedModules.length > 0) {
      return user.assignedModules;
    }
    return ["garbage"];
  }, [user?.assignedModules]);

  const hasGarbage = assignedModules.includes("garbage");
  const hasSpecial = assignedModules.includes("special_collections");

  const currentMonth = new Date().toLocaleString("default", {
    month: "long",
  });

  const currentYear = new Date().getFullYear();

  // Garbage payments collected today
  const myGarbagePaymentsToday = useMemo(() => {
    return payments.filter(
      (payment) =>
        payment.collectorId === user?.uid &&
        payment.paymentDate === today
    );
  }, [payments, user, today]);

  // Special collection payments collected today
  const mySpecialPaymentsToday = useMemo(() => {
    return specialPayments.filter(
      (p) =>
        p.collectorId === user?.uid &&
        (p.paymentDate === todayISO || p.paymentDate === today) &&
        p.status === "confirmed"
    );
  }, [specialPayments, user, today, todayISO]);

  const garbageTotalToday = myGarbagePaymentsToday.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const specialTotalToday = mySpecialPaymentsToday.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );

  const totalToday = garbageTotalToday + specialTotalToday;

  const cashToday =
    myGarbagePaymentsToday
      .filter((p) => p.paymentMethod === "Cash")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0) +
    mySpecialPaymentsToday
      .filter((p) => p.paymentMethod === "Cash")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const upiToday =
    myGarbagePaymentsToday
      .filter((p) => p.paymentMethod === "UPI")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0) +
    mySpecialPaymentsToday
      .filter((p) => p.paymentMethod === "UPI" || p.paymentMethod === "Offline UPI")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // All unified payments collected today
  const allPaymentsToday = useMemo(() => {
    const list = [];
    myGarbagePaymentsToday.forEach((p) => {
      list.push({
        id: p.id,
        module: "garbage",
        title: `Flat ${p.flat || "—"} • ${p.residentName || "Resident"}`,
        subtitle: `Garbage Maintenance • ${p.month || ""} ${p.year || ""}`,
        amount: Number(p.amount || 0),
        paymentMethod: p.paymentMethod || "Cash",
        paymentTime: p.paymentTime || "",
        receiptNumber: p.receiptNumber || p.receiptNo || "—",
        raw: p,
      });
    });

    mySpecialPaymentsToday.forEach((p) => {
      list.push({
        id: p.id,
        module: "special",
        title: `${p.flatNumber ? `Flat ${p.flatNumber} • ` : ""}${p.contributorName || "Contributor"}`,
        subtitle: p.collectionName || "Special Collection",
        amount: Number(p.amount || 0),
        paymentMethod: p.paymentMethod || "Cash",
        paymentTime: p.paymentTime || "",
        receiptNumber: p.receiptNumber || p.receiptNo || "—",
        raw: p,
      });
    });

    return list;
  }, [myGarbagePaymentsToday, mySpecialPaymentsToday]);

  // Residents with no bill yet this month, or a bill still Pending.
  // Only count participating residents.
  const pendingCount = useMemo(() => {
    return residents.filter((resident) => {
      if (!isGcParticipating(resident)) return false;

      const bill = bills.find(
        (b) =>
          b.residentId === resident.id &&
          b.month === currentMonth &&
          Number(b.year) === Number(currentYear)
      );

      return !bill || bill.status === "Pending";
    }).length;
  }, [residents, bills, currentMonth, currentYear]);

  async function handleAddResident(formData) {
    const result = await addResident({
      ...formData,
      status: "Active",
      garbageStatus: "participating",
      collectorId: user?.uid || "",
      collectorName: user?.name || user?.email || "Collector",
      createdBy: "Collector",
      createdById: user?.uid,
      createdByName: user?.name || user?.email,
      charge: Number(formData.charge) || Number(settings?.monthlyCharge) || 80,
      createdAt: new Date().toISOString(),
    });

    if (result) {
      setShowAddResident(false);
    }
  }

  const stats = [
    {
      label: "Collected Today",
      value: `₹${totalToday.toLocaleString()}`,
      icon: <FaWallet />,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Cash Today",
      value: `₹${cashToday.toLocaleString()}`,
      icon: <FaMoneyBillWave />,
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "UPI Today",
      value: `₹${upiToday.toLocaleString()}`,
      icon: <FaMobileAlt />,
      color: "bg-purple-100 text-purple-700",
    },
    {
      label: "Pending This Month",
      value: pendingCount,
      icon: <FaUserClock />,
      color: "bg-red-100 text-red-700",
    },
  ];

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">
              Welcome, {user?.name || "Collector"}
            </h1>
            <div className="flex items-center gap-1.5">
              {hasGarbage && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  <FaTrashAlt className="text-[10px]" /> Garbage
                </span>
              )}
              {hasSpecial && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                  <FaHandHoldingHeart className="text-[10px]" /> Special Collections
                </span>
              )}
            </div>
          </div>

          <p className="text-gray-500 text-sm mt-0.5">
            {currentMonth} {currentYear} • Today's Collections & Performance
          </p>
        </div>

        <button
          onClick={() => setShowAddResident(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-medium transition shadow-lg shadow-emerald-500/30 self-start sm:self-auto"
        >
          <FaUserPlus /> Add Resident
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">

        {stats.map((stat) => (

          <div
            key={stat.label}
            className="bg-white rounded-2xl shadow-sm p-5"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3 ${stat.color}`}
            >
              {stat.icon}
            </div>

            <p className="text-gray-500 text-sm">
              {stat.label}
            </p>

            <h3 className="text-xl font-bold">
              {stat.value}
            </h3>
          </div>

        ))}

      </div>

      {/* Today's Collections & Resident Receipts */}
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
              <FaReceipt />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Today's Collections & Receipts</h3>
              <p className="text-xs text-gray-400">Instantly print official payment receipts</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
            {allPaymentsToday.length} {allPaymentsToday.length === 1 ? "Receipt" : "Receipts"}
          </span>
        </div>

        {allPaymentsToday.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs">
            No collections recorded today yet. Use the Collect tab to record payments.
          </div>
        ) : (
          <div className="space-y-2.5">
            {allPaymentsToday.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50/70 hover:bg-emerald-50/40 border border-gray-100 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">{p.title}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        p.module === "special"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {p.module === "special" ? "Special" : "Garbage"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.subtitle}</p>
                  <p className="text-[11px] font-mono text-gray-400">{p.receiptNumber} • {p.paymentMethod}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="font-extrabold text-sm text-emerald-700">
                    ₹{p.amount.toLocaleString("en-IN")}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      printPaymentReceipt(p.raw);
                      toast.success(`Printing receipt ${p.receiptNumber}...`);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
                    title="Print Official Payment Receipt"
                  >
                    <FaPrint className="text-[11px]" />
                    <span>Print Receipt</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Resident Drawer */}
      {showAddResident && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-emerald-600 text-white p-5 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <FaUserPlus className="text-xl" />
                <h2 className="text-xl font-bold">Add New Resident</h2>
              </div>
              <button onClick={() => setShowAddResident(false)} className="text-xl hover:text-red-300">
                <FaTimes />
              </button>
            </div>
            <div className="p-6">
              <ResidentForm
                onSave={handleAddResident}
                onClose={() => setShowAddResident(false)}
                defaultCharge={settings?.monthlyCharge || ""}
                hidePortalFields
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
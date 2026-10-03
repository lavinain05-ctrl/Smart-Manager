import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  FaCheckCircle,
  FaArrowRight,
  FaSearch,
  FaCalendarCheck,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import { useBills } from "../../context/BillContext";
import { useSettings } from "../../context/SettingsContext";
import { useBilling } from "../../context/BillingContext";

import { printPaymentReceipt } from "../../utils/printReceiptHelper";

import ResidentForm from "../../components/forms/ResidentForm";
import CollectorMonthBar from "../../components/collections/CollectorMonthBar";
import PrinterQuickAction from "../../components/common/PrinterQuickAction";
import { isGcParticipating } from "../../services/statisticsService";
import { subscribeAllSpecialPayments } from "../../services/specialCollectionService";

export default function CollectorDashboard() {
  const { user } = useAuth();
  const { payments } = usePayments();
  const { residents, addResident } = useResidents();
  const { bills } = useBills();
  const { settings } = useSettings();
  const { selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useBilling();

  const [showAddResident, setShowAddResident] = useState(false);
  const [specialPayments, setSpecialPayments] = useState([]);
  const [historyTab, setHistoryTab] = useState("month"); // "month" or "today"
  const [recordsSearch, setRecordsSearch] = useState("");

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

  function enrichPayment(p) {
    const res = residents.find(
      (r) =>
        (p.residentId && r.id === p.residentId) ||
        (p.flatNumber && (r.flatNumber === p.flatNumber || r.flat === p.flatNumber)) ||
        (p.flat && (r.flat === p.flat || r.flatNumber === p.flat))
    );
    return {
      ...p,
      plotNumber: p.plotNumber || res?.plotNumber || "",
      floor: p.floor || res?.floor || "",
      unitNumber: p.unitNumber || res?.unitNumber || "",
      personType: p.personType || res?.personType || "",
      block: p.block || res?.block || "",
    };
  }

  // ─── 1. TODAY'S COLLECTIONS BY THIS COLLECTOR ───
  const myGarbagePaymentsToday = useMemo(() => {
    return payments.filter(
      (payment) =>
        payment.collectorId === user?.uid &&
        payment.paymentDate === today
    );
  }, [payments, user, today]);

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

  // ─── 2. SELECTED MONTH'S COLLECTIONS BY THIS COLLECTOR ───
  const myGarbagePaymentsMonth = useMemo(() => {
    return payments.filter((p) => {
      if (p.collectorId !== user?.uid) return false;
      const direct = p.month === selectedMonth && Number(p.year) === Number(selectedYear);
      const advance =
        p.isAdvance &&
        Array.isArray(p.coveredMonths) &&
        p.coveredMonths.some(
          (cm) =>
            cm.month === selectedMonth &&
            Number(cm.year) === Number(selectedYear)
        );
      return direct || advance;
    });
  }, [payments, user?.uid, selectedMonth, selectedYear]);

  const mySpecialPaymentsMonth = useMemo(() => {
    return specialPayments.filter((p) => {
      if (p.collectorId !== user?.uid || p.status !== "confirmed") return false;
      if (p.paymentDate) {
        const d = new Date(p.paymentDate);
        if (!isNaN(d.getTime())) {
          const m = d.toLocaleString("default", { month: "long" });
          const y = d.getFullYear();
          if (m === selectedMonth && y === Number(selectedYear)) return true;
        }
      }
      return false;
    });
  }, [specialPayments, user?.uid, selectedMonth, selectedYear]);

  const garbageTotalMonth = myGarbagePaymentsMonth.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );
  const specialTotalMonth = mySpecialPaymentsMonth.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  );
  const totalMonth = garbageTotalMonth + specialTotalMonth;

  const cashMonth =
    myGarbagePaymentsMonth
      .filter((p) => p.paymentMethod === "Cash")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0) +
    mySpecialPaymentsMonth
      .filter((p) => p.paymentMethod === "Cash")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const upiMonth =
    myGarbagePaymentsMonth
      .filter((p) => p.paymentMethod === "UPI")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0) +
    mySpecialPaymentsMonth
      .filter((p) => p.paymentMethod === "UPI" || p.paymentMethod === "Offline UPI")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // ─── 3. RESIDENTS PENDING / PAID FOR SELECTED MONTH ───
  const isGarbagePaidForSelectedMonth = (resident) => {
    if (!resident) return false;
    const resId = resident.id;
    const flatStr = String(resident.flat || resident.flatNumber || "").toLowerCase();

    // In payments
    const inPayments = payments.some((payment) => {
      const matchRes =
        (resId && payment.residentId === resId) ||
        (flatStr && payment.flat && String(payment.flat).toLowerCase() === flatStr);
      if (!matchRes) return false;

      const direct =
        payment.month === selectedMonth &&
        Number(payment.year) === Number(selectedYear);
      const advance =
        payment.isAdvance &&
        Array.isArray(payment.coveredMonths) &&
        payment.coveredMonths.some(
          (cm) =>
            cm.month === selectedMonth &&
            Number(cm.year) === Number(selectedYear)
        );
      return direct || advance;
    });
    if (inPayments) return true;

    // In bills
    const inBills = (bills || []).some((bill) => {
      const matchRes =
        (resId && bill.residentId === resId) ||
        (flatStr && bill.flat && String(bill.flat).toLowerCase() === flatStr);
      if (!matchRes) return false;

      return (
        bill.month === selectedMonth &&
        Number(bill.year) === Number(selectedYear) &&
        (bill.status === "Paid" || bill.status === "Exempted")
      );
    });
    return inBills;
  };

  const { pendingCountMonth, paidCountMonth, participatingTotal } = useMemo(() => {
    let pending = 0;
    let paid = 0;
    let participating = 0;

    residents.forEach((r) => {
      if (!isGcParticipating(r)) return;
      participating++;
      if (isGarbagePaidForSelectedMonth(r)) {
        paid++;
      } else {
        pending++;
      }
    });

    return {
      pendingCountMonth: pending,
      paidCountMonth: paid,
      participatingTotal: participating,
    };
  }, [residents, payments, bills, selectedMonth, selectedYear]);

  const collectionRate =
    participatingTotal > 0
      ? Math.round((paidCountMonth / participatingTotal) * 100)
      : 0;

  // ─── 4. UNIFIED PAYMENTS LISTS ───
  const allPaymentsToday = useMemo(() => {
    const list = [];
    myGarbagePaymentsToday.forEach((p) => {
      const enriched = enrichPayment(p);
      list.push({
        id: p.id,
        module: "garbage",
        title: `Flat ${enriched.flat || enriched.unitNumber || "—"} • ${enriched.residentName || "Resident"}`,
        subtitle: `Garbage Collection • ${p.month || ""} ${p.year || ""}`,
        amount: Number(p.amount || 0),
        paymentMethod: p.paymentMethod || "Cash",
        paymentDate: p.paymentDate || today,
        paymentTime: p.paymentTime || "",
        receiptNumber: p.receiptNumber || p.receiptNo || "—",
        raw: enriched,
      });
    });

    mySpecialPaymentsToday.forEach((p) => {
      const enriched = enrichPayment(p);
      const flatText = (enriched.flatNumber || enriched.flat) ? `Flat ${enriched.flatNumber || enriched.flat} • ` : "";
      list.push({
        id: p.id,
        module: "special",
        title: `${flatText}${enriched.contributorName || "Contributor"}`,
        subtitle: enriched.collectionName || "Special Collection",
        amount: Number(enriched.amount || 0),
        paymentMethod: enriched.paymentMethod || "Cash",
        paymentDate: enriched.paymentDate || today,
        paymentTime: enriched.paymentTime || "",
        receiptNumber: enriched.receiptNumber || enriched.receiptNo || "—",
        raw: enriched,
      });
    });

    return list;
  }, [myGarbagePaymentsToday, mySpecialPaymentsToday, residents, today]);

  const allPaymentsMonth = useMemo(() => {
    const list = [];
    myGarbagePaymentsMonth.forEach((p) => {
      const enriched = enrichPayment(p);
      list.push({
        id: p.id,
        module: "garbage",
        title: `Flat ${enriched.flat || enriched.unitNumber || "—"} • ${enriched.residentName || "Resident"}`,
        subtitle: `Garbage Collection • ${p.month || ""} ${p.year || ""}`,
        amount: Number(p.amount || 0),
        paymentMethod: p.paymentMethod || "Cash",
        paymentDate: p.paymentDate || "",
        paymentTime: p.paymentTime || "",
        receiptNumber: p.receiptNumber || p.receiptNo || "—",
        raw: enriched,
      });
    });

    mySpecialPaymentsMonth.forEach((p) => {
      const enriched = enrichPayment(p);
      const flatText = (enriched.flatNumber || enriched.flat) ? `Flat ${enriched.flatNumber || enriched.flat} • ` : "";
      list.push({
        id: p.id,
        module: "special",
        title: `${flatText}${enriched.contributorName || "Contributor"}`,
        subtitle: enriched.collectionName || "Special Collection",
        amount: Number(enriched.amount || 0),
        paymentMethod: enriched.paymentMethod || "Cash",
        paymentDate: enriched.paymentDate || "",
        paymentTime: enriched.paymentTime || "",
        receiptNumber: enriched.receiptNumber || enriched.receiptNo || "—",
        raw: enriched,
      });
    });

    return list;
  }, [myGarbagePaymentsMonth, mySpecialPaymentsMonth, residents]);

  const displayedReceipts = useMemo(() => {
    const source = historyTab === "month" ? allPaymentsMonth : allPaymentsToday;
    if (!recordsSearch.trim()) return source;
    const q = recordsSearch.toLowerCase();
    return source.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.receiptNumber.toLowerCase().includes(q) ||
        item.paymentMethod.toLowerCase().includes(q)
    );
  }, [historyTab, allPaymentsMonth, allPaymentsToday, recordsSearch]);

  async function handleAddResident(formData) {
    try {
      const result = await addResident({
        ...formData,
        status: "Active",
        garbageStatus: formData.garbageStatus || "participating",
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
        toast.success("Resident added! Ready for collection.");
        return true;
      }
      return false;
    } catch (err) {
      toast.error(err.message || "Failed to add resident");
      return false;
    }
  }

  const primaryStats = [
    {
      label: `Collected in ${selectedMonth}`,
      value: `₹${totalMonth.toLocaleString("en-IN")}`,
      subtext: `${myGarbagePaymentsMonth.length + mySpecialPaymentsMonth.length} collections`,
      icon: <FaWallet />,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: `Pending in ${selectedMonth}`,
      value: pendingCountMonth,
      subtext: `${collectionRate}% paid so far`,
      icon: <FaUserClock />,
      color: "bg-red-100 text-red-700",
    },
    {
      label: `Paid in ${selectedMonth}`,
      value: paidCountMonth,
      subtext: `out of ${participatingTotal} participating`,
      icon: <FaCheckCircle />,
      color: "bg-green-100 text-green-700",
    },
    {
      label: "Collected Today",
      value: `₹${totalToday.toLocaleString("en-IN")}`,
      subtext: `${allPaymentsToday.length} today`,
      icon: <FaMoneyBillWave />,
      color: "bg-blue-100 text-blue-700",
    },
  ];

  return (
    <div className="space-y-5">
      {/* ─── Top Header & Add Resident ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
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

          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Synchronized collection terminal & monthly performance tracking
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <PrinterQuickAction />
          <button
            onClick={() => setShowAddResident(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
          >
            <FaUserPlus /> Add Resident
          </button>
        </div>
      </div>

      {/* ─── Month Selection Bar ─── */}
      <CollectorMonthBar
        title={`Monthly Cycle: ${selectedMonth} ${selectedYear}`}
        subtitle="Select month to track resident pending/paid status and view past records"
      />

      {/* ─── Selected Month Progress Action Banner ─── */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <FaCalendarCheck className="text-emerald-200 text-base" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
              Cycle Status: {selectedMonth} {selectedYear}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold">
            {paidCountMonth} of {participatingTotal} Residents Paid ({collectionRate}%)
          </h2>
          <div className="flex items-center gap-3 text-xs text-emerald-100 pt-0.5">
            <span>Pending: <strong className="text-white">{pendingCountMonth}</strong></span>
            <span>•</span>
            <span>Collected this month: <strong className="text-white">₹{totalMonth.toLocaleString("en-IN")}</strong></span>
          </div>
        </div>

        <Link
          to="/collector/collect"
          className="bg-white text-emerald-800 hover:bg-emerald-50 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm shrink-0 self-start sm:self-auto active:scale-95"
        >
          <span>Collect for {selectedMonth}</span>
          <FaArrowRight className="text-xs" />
        </Link>
      </div>

      {/* ─── Key Stats Grid ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {primaryStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 transition hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${stat.color}`}
              >
                {stat.icon}
              </div>
              <span className="text-[11px] text-gray-400 font-medium">
                {stat.subtext}
              </span>
            </div>

            <p className="text-gray-500 text-xs font-semibold">{stat.label}</p>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
              {stat.value}
            </h3>
          </div>
        ))}
      </div>

      {/* ─── Payment Mode Breakdown Bar ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">Cash ({selectedMonth})</span>
          <span className="text-base sm:text-lg font-bold text-gray-800">₹{cashMonth.toLocaleString("en-IN")}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">UPI ({selectedMonth})</span>
          <span className="text-base sm:text-lg font-bold text-gray-800">₹{upiMonth.toLocaleString("en-IN")}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">Cash Today</span>
          <span className="text-base sm:text-lg font-bold text-gray-800">₹{cashToday.toLocaleString("en-IN")}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-xs">
          <span className="text-[11px] text-gray-500 font-semibold block">UPI Today</span>
          <span className="text-base sm:text-lg font-bold text-gray-800">₹{upiToday.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* ─── Collections & Receipts Log Section ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm shrink-0">
              <FaReceipt />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Collections & Receipts Log</h3>
              <p className="text-xs text-gray-400">Instantly print official payment receipts</p>
            </div>
          </div>

          {/* Toggle between Month Collections and Today */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setHistoryTab("month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                historyTab === "month"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {selectedMonth} ({allPaymentsMonth.length})
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab("today")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                historyTab === "today"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Today ({allPaymentsToday.length})
            </button>
          </div>
        </div>

        {/* Search within log */}
        <div className="relative">
          <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-xs" />
          <input
            type="text"
            value={recordsSearch}
            onChange={(e) => setRecordsSearch(e.target.value)}
            placeholder="Search by flat, resident name, receipt number..."
            className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {displayedReceipts.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-xs sm:text-sm">
            {historyTab === "month"
              ? `No collections recorded by you for ${selectedMonth} ${selectedYear} yet. Use the Collect tab to record payments.`
              : "No collections recorded today yet. Use the Collect tab to record payments."}
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedReceipts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50/70 hover:bg-emerald-50/40 border border-gray-100 transition"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
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
                  <p className="text-[11px] font-mono text-gray-400">
                    {p.receiptNumber} • {p.paymentMethod} {p.paymentDate ? `• ${p.paymentDate}` : ""}
                  </p>
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
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer"
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

      {/* Add Resident Drawer */}
      {showAddResident && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-emerald-600 text-white p-5 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <FaUserPlus className="text-xl" />
                <h2 className="text-xl font-bold">Add New Resident</h2>
              </div>
              <button
                onClick={() => setShowAddResident(false)}
                className="text-xl hover:text-red-300"
              >
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
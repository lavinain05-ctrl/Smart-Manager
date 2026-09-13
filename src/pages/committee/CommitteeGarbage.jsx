import { useMemo, useState } from "react";
import {
  FaRecycle,
  FaChartBar,
  FaUsers,
  FaMoneyBillWave,
  FaClock,
  FaWallet,
  FaCheckCircle,
  FaHistory,
  FaPaperPlane,
  FaTimes,
  FaReceipt,
  FaPrint,
  FaUserTie,
  FaHome,
  FaCreditCard,
} from "react-icons/fa";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { useGarbage } from "../../context/GarbageContext";
import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBills } from "../../context/BillContext";
import { useSettings } from "../../context/SettingsContext";
import { collectResidentPayment } from "../../utils/collectPayment";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import { DEFAULT_JOIN_GC_MESSAGE, DEFAULT_LEAVE_GC_MESSAGE } from "../resident/ResidentGarbage";

ChartJS.register(ArcElement, Tooltip, Legend);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CommitteeGarbage() {
  const { user } = useAuth();
  const {
    garbageAccounts = [],
    garbageBills = [],
    garbageSettings = {},
    garbageRequests = [],
    submitRequest,
  } = useGarbage();
  const { residents = [] } = useResidents();
  const { payments = [], addPayment } = usePayments();
  const { bills = [] } = useBills();
  const { settings = {} } = useSettings();

  // Active view: "personal" (My Flat Garbage Service) or "society" (Analytics)
  const [activeTab, setActiveTab] = useState("personal");

  // Filter for analytics
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString("default", { month: "long" })
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Opt-in / Opt-out request modal
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestReason, setRequestReason] = useState("");

  // Payment modal state for paying own flat's garbage collection fee
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMonth, setPayMonth] = useState(new Date().toLocaleString("default", { month: "long" }));
  const [payYear, setPayYear] = useState(new Date().getFullYear());
  const [payMethod, setPayMethod] = useState("UPI");
  const [isAdvance, setIsAdvance] = useState(false);
  const [advanceDuration, setAdvanceDuration] = useState(3);
  const [refNumber, setRefNumber] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // ══════════════════════════════════════════════════════
  // Canonical Resident Resolution (for Committee Member)
  // ══════════════════════════════════════════════════════
  const cleanPhone = useMemo(() => {
    const raw = user?.phone || user?.mobile || (user?.email?.includes("@") ? user.email.split("@")[0] : "");
    const digits = String(raw).replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }, [user]);

  const canonicalResident = useMemo(() => {
    return (
      residents.find((r) => r.id === user?.residentId || r.id === user?.uid) ||
      residents.find((r) => {
        if (!cleanPhone) return false;
        const rDigits = String(r.mobile || r.phone || "").replace(/\D/g, "");
        const rClean = rDigits.length >= 10 ? rDigits.slice(-10) : rDigits;
        return rClean === cleanPhone;
      }) ||
      residents.find(
        (r) =>
          user?.email &&
          !user.email.includes("firebaseapp.com") &&
          r.email?.toLowerCase() === user.email.toLowerCase()
      ) ||
      residents.find(
        (r) =>
          user?.name &&
          r.owner?.toLowerCase() === user.name.toLowerCase()
      ) ||
      null
    );
  }, [residents, user, cleanPhone]);

  const canonicalResidentId = canonicalResident?.id || user?.residentId || user?.uid;

  // Personal flat info
  const myFlatNumber = canonicalResident?.flat || canonicalResident?.flatNumber || user?.flat || "—";
  const myBlock = canonicalResident?.block || user?.block || "";

  // My Garbage Account
  const myAccount = useMemo(
    () =>
      garbageAccounts.find(
        (a) =>
          a.residentId === canonicalResidentId ||
          a.residentId === canonicalResident?.id ||
          a.residentId === user?.residentId ||
          a.residentId === user?.uid ||
          (cleanPhone && (a.mobile || "").replace(/\D/g, "").slice(-10) === cleanPhone)
      ) || null,
    [garbageAccounts, canonicalResidentId, canonicalResident, user, cleanPhone]
  );

  // My Payments
  const myPayments = useMemo(() => {
    return payments
      .filter((p) => {
        if (p.residentId === canonicalResidentId || p.residentId === user?.residentId || p.residentId === user?.uid) {
          return true;
        }
        if (canonicalResident?.id && p.residentId === canonicalResident.id) {
          return true;
        }
        if (cleanPhone && p.mobile) {
          const pClean = String(p.mobile).replace(/\D/g, "").slice(-10);
          if (pClean === cleanPhone) return true;
        }
        const residentOwnerName = (canonicalResident?.owner || user?.name || "").trim().toLowerCase();
        if (
          residentOwnerName &&
          p.residentName?.trim().toLowerCase() === residentOwnerName &&
          (!p.flat || p.flat === (canonicalResident?.flat || user?.flat))
        ) {
          return true;
        }
        return false;
      })
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [payments, canonicalResidentId, user, canonicalResident, cleanPhone]);

  // Account Status
  const isEnrolled = myAccount ? myAccount.status === "active" : Boolean(canonicalResident?.garbageEnrolled);
  const isPaused = myAccount?.status === "temporary_stopped" || canonicalResident?.status === "temporary_stopped";
  const isInactive = myAccount?.status === "inactive" || canonicalResident?.status === "inactive";
  const monthlyCharge = Number(myAccount?.monthlyCharge || canonicalResident?.charge || garbageSettings.defaultCharge || 80);

  const statusLabel = isPaused
    ? "Paused"
    : isInactive
    ? "Inactive"
    : isEnrolled
    ? "Active"
    : "Not Enrolled";

  // Current month & year checks
  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();

  const currentMonthPayment = myPayments.find(
    (p) => p.month === currentMonth && Number(p.year) === Number(currentYear)
  );

  const currentMonthBill = useMemo(() => {
    return (
      garbageBills.find(
        (g) =>
          (g.residentId === canonicalResidentId || g.residentId === user?.uid || g.accountId === myAccount?.id) &&
          g.month === currentMonth &&
          Number(g.year) === Number(currentYear)
      ) ||
      bills.find(
        (b) =>
          (b.residentId === canonicalResidentId || b.residentId === user?.uid) &&
          b.month === currentMonth &&
          Number(b.year) === Number(currentYear)
      ) ||
      null
    );
  }, [garbageBills, bills, canonicalResidentId, user, myAccount, currentMonth, currentYear]);

  // Total Paid by this flat
  const totalPaid = useMemo(() => {
    return myPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  }, [myPayments]);

  // Outstanding
  const outstanding = useMemo(() => {
    const paidKeys = new Set(myPayments.map((p) => `${p.month}-${p.year}`));
    let sum = 0;
    bills
      .filter((b) => b.residentId === canonicalResidentId || b.residentId === user?.uid)
      .forEach((b) => {
        if (b.status === "Pending" && !paidKeys.has(`${b.month}-${b.year}`)) {
          sum += Number(b.amount || monthlyCharge || 0);
        }
      });
    return sum;
  }, [bills, myPayments, canonicalResidentId, user, monthlyCharge]);

  // Collector info
  const collectorName =
    myAccount?.collectorName ||
    canonicalResident?.collectorName ||
    myPayments[0]?.collector ||
    "Society Assigned Collector";

  const myPendingRequest = useMemo(
    () =>
      garbageRequests.find(
        (r) =>
          (r.residentId === canonicalResidentId || r.residentId === user?.uid) &&
          r.status === "pending"
      ),
    [garbageRequests, canonicalResidentId, user]
  );

  // Opt-in / out submit
  async function handleSubmitRequest() {
    const requestType = isEnrolled ? "opt_out" : "opt_in";
    const defaultMsg = isEnrolled ? DEFAULT_LEAVE_GC_MESSAGE : DEFAULT_JOIN_GC_MESSAGE;

    await submitRequest({
      residentId: canonicalResidentId || user?.uid || "",
      requestType,
      reason: requestReason.trim() || defaultMsg,
    });

    setShowRequestForm(false);
    setRequestReason("");
  }

  // Handle Self Payment Execution
  async function handleExecutePayment(e) {
    e.preventDefault();
    if (!canonicalResident) {
      toast.error("Could not link flat details for your committee account.");
      return;
    }

    try {
      setSubmittingPayment(true);
      const coveredMonthsList = [];

      if (isAdvance && advanceDuration > 1) {
        let curMonthIdx = MONTHS.indexOf(payMonth);
        let curY = Number(payYear);
        for (let i = 0; i < advanceDuration; i++) {
          coveredMonthsList.push({
            month: MONTHS[curMonthIdx],
            year: curY,
          });
          curMonthIdx++;
          if (curMonthIdx >= 12) {
            curMonthIdx = 0;
            curY++;
          }
        }
      } else {
        coveredMonthsList.push({ month: payMonth, year: Number(payYear) });
      }

      const paymentAmt = monthlyCharge * coveredMonthsList.length;

      const success = await collectResidentPayment({
        resident: canonicalResident,
        month: payMonth,
        year: Number(payYear),
        paymentData: {
          amount: paymentAmt,
          monthlyRate: monthlyCharge,
          method: payMethod,
          isAdvance: isAdvance && advanceDuration > 1,
          coveredMonths: coveredMonthsList,
          collectorRole: "committee",
          collectorDesignation: user?.designation || "Committee Member",
          referenceNumber: refNumber.trim() || "",
        },
        bills,
        addPayment,
        collector: `Committee Self-Pay (${user?.name || "Official"})`,
        collectorId: user?.uid,
      });

      if (success) {
        toast.success(`Garbage collection fee of ₹${paymentAmt} paid successfully!`);
        setShowPayModal(false);
        setRefNumber("");
      }
    } catch (err) {
      console.error(err);
      toast.error("Payment recording failed. Please try again.");
    } finally {
      setSubmittingPayment(false);
    }
  }

  // ══════════════════════════════════════════════════════
  // Society-wide Analytics Calculations
  // ══════════════════════════════════════════════════════
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-900">
            <FaRecycle className="text-emerald-600" />
            Garbage Collection Service
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Manage your flat's doorstep waste service, pay dues, and inspect society collection analytics.
          </p>
        </div>

        {/* Primary View Switcher: My Flat vs Society Analytics */}
        <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("personal")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "personal"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FaHome className="text-xs" />
            <span>My Flat Service</span>
            {currentMonthPayment || currentMonthBill?.status === "Paid" ? (
              <span className="w-2 h-2 rounded-full bg-emerald-300" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("society")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === "society"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FaChartBar className="text-xs" />
            <span>Society Analytics</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 1: MY FLAT GARBAGE & PAYMENT (RESIDENT EXPERIENCE)         */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "personal" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Flat Profile & Status Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-6 shadow-xl border border-slate-800">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-emerald-500/25 shrink-0">
                  <FaRecycle />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      {statusLabel} Doorstep Service
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300">
                      Committee Official
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {canonicalResident?.owner || user?.name || "Committee Member"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-300">
                    <span className="bg-white/10 px-2.5 py-1 rounded-lg font-bold text-white border border-white/10 flex items-center gap-1">
                      <FaHome className="text-emerald-400" /> Flat {myFlatNumber}
                    </span>
                    {myBlock && (
                      <span className="bg-white/10 px-2.5 py-1 rounded-lg font-medium border border-white/10">
                        Block {myBlock}
                      </span>
                    )}
                    <span className="text-slate-400">
                      • Monthly Fee: ₹{monthlyCharge.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button: Pay Garbage Collection Fee */}
              <div className="flex items-center gap-2.5 self-start md:self-center shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setPayMonth(currentMonth);
                    setPayYear(currentYear);
                    setShowPayModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition"
                >
                  <FaCreditCard className="text-xs" />
                  <span>Give / Pay Garbage Fee</span>
                </button>
              </div>
            </div>
          </div>

          {/* Current Month Payment Alert Banner */}
          {currentMonthPayment || currentMonthBill?.status === "Paid" ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shrink-0 shadow-md shadow-emerald-600/20">
                  <FaCheckCircle />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-900 border border-emerald-300">
                      Payment Confirmed
                    </span>
                    <span className="text-xs font-bold text-emerald-900">
                      {currentMonth} {currentYear}
                    </span>
                    {(currentMonthPayment?.receiptNumber || currentMonthBill?.paymentId) && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200">
                        {currentMonthPayment?.receiptNumber || currentMonthBill?.paymentId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-emerald-800 mt-1">
                    Your garbage collection fee for {currentMonth} {currentYear} has been recorded!
                  </p>
                </div>
              </div>

              {currentMonthPayment && (
                <button
                  type="button"
                  onClick={() => printPaymentReceipt(currentMonthPayment, canonicalResident || { owner: user?.name, flat: myFlatNumber, block: myBlock }, settings)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition shadow-xs self-start sm:self-auto"
                >
                  <FaPrint className="text-emerald-600" /> Print Receipt
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shrink-0 shadow-md shadow-amber-500/20">
                  <FaClock />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300">
                      Monthly Fee Due
                    </span>
                    <span className="text-xs font-bold text-amber-900">
                      {currentMonth} {currentYear}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-amber-900 mt-1">
                    Monthly garbage collection fee of ₹{monthlyCharge} is due for this month.
                    {outstanding > monthlyCharge ? ` Total unpaid dues: ₹${outstanding}.` : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPayMonth(currentMonth);
                  setPayYear(currentYear);
                  setShowPayModal(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition self-start sm:self-auto"
              >
                <FaWallet className="text-xs" /> Pay ₹{monthlyCharge} Now
              </button>
            </div>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Current Month</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {currentMonthPayment || currentMonthBill?.status === "Paid" ? (
                    <span className="text-emerald-600 text-base">₹{monthlyCharge} Paid</span>
                  ) : (
                    <span className="text-amber-600">₹{monthlyCharge} Due</span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{currentMonth} {currentYear}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
                <FaMoneyBillWave />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Paid</p>
                <h3 className="text-xl font-black text-emerald-600 mt-1">
                  ₹{totalPaid.toLocaleString()}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Lifetime verified payments</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shrink-0">
                <FaWallet />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Receipts</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {myPayments.length}
                </h3>
                <p className="text-[10px] text-blue-600 mt-0.5">Official slips issued</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg shrink-0">
                <FaReceipt />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assigned Collector</p>
                <h3 className="text-sm font-bold text-slate-800 mt-1 truncate">
                  {collectorName}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Door-to-door waste pickup</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg shrink-0">
                <FaUserTie />
              </div>
            </div>
          </div>

          {/* Service Enrollment Status / Opt-in Request */}
          <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {isEnrolled ? "Doorstep Collection Enrollment" : "Doorstep Collection Request"}
              </h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {isEnrolled
                  ? "Your flat is active in daily door-to-door garbage pickup. Submit a request if you need to pause during travel."
                  : "Doorstep waste pickup is currently not enrolled for your flat. Submit an enrollment request below."}
              </p>
            </div>

            {myPendingRequest ? (
              <span className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold self-start sm:self-auto">
                ⏳ Request Sent (Pending Admin Action)
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRequestReason(isEnrolled ? DEFAULT_LEAVE_GC_MESSAGE : DEFAULT_JOIN_GC_MESSAGE);
                  setShowRequestForm(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition self-start sm:self-auto"
              >
                <FaPaperPlane className="text-[10px]" />
                <span>{isEnrolled ? "Request Pause / Opt-Out" : "Request to Join Collection"}</span>
              </button>
            )}
          </div>

          {/* Payment History & Receipts Archive */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
                  <FaHistory />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    My Flat Payment Receipts ({myPayments.length})
                  </h3>
                  <p className="text-xs text-slate-400">All garbage fee payments recorded for Flat {myFlatNumber}</p>
                </div>
              </div>
            </div>

            {myPayments.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <FaReceipt className="text-3xl mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No payment receipts found yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click "Give / Pay Garbage Fee" above to record your first monthly collection payment.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {myPayments.map((pay) => (
                  <div
                    key={pay.id || pay.receiptNumber}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {pay.month} {pay.year}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
                          {pay.receiptNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Paid
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Paid on {pay.paymentDate || "—"}{pay.paymentMethod ? ` via ${pay.paymentMethod}` : ""}{pay.collector ? ` • Collector: ${pay.collector}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center sm:justify-end gap-3 self-start sm:self-auto">
                      <div className="text-right">
                        <span className="font-black text-emerald-600 text-base">
                          ₹{Number(pay.amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => printPaymentReceipt(pay, canonicalResident || { owner: user?.name, flat: myFlatNumber, block: myBlock }, settings)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-semibold border border-slate-200 transition"
                        title="Print or download official slip"
                      >
                        <FaPrint className="text-xs" />
                        <span>Print Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB 2: SOCIETY ANALYTICS & REPORTS                             */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "society" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Controls: Month and Year selectors */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Society Garbage Financial Reports</h2>
              <p className="text-xs text-slate-500">Macro overview of society collections for the selected billing cycle</p>
            </div>

            <div className="flex items-center gap-2.5">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-slate-200 rounded-xl px-3.5 py-2 bg-white shadow-xs text-xs font-semibold outline-none"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-3.5 py-2 bg-white shadow-xs text-xs font-semibold outline-none"
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl shadow-xs p-5 border border-slate-200">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3 ${stat.color}`}>
                  {stat.icon}
                </div>
                <p className="text-gray-500 text-xs">{stat.label}</p>
                <h3 className="text-lg font-bold mt-1 text-slate-900">{stat.value}</h3>
              </div>
            ))}
          </div>

          {/* Charts & Breakdown */}
          <div className="grid xl:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white rounded-2xl shadow-xs p-6 border border-slate-200">
              <h3 className="font-bold text-sm text-slate-900 mb-4">Payment Status Breakdown</h3>
              <div className="h-64 flex items-center justify-center">
                {paidCount + pendingCount > 0 ? (
                  <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} />
                ) : (
                  <p className="text-gray-400 text-xs">No billing records for {selectedMonth} {selectedYear}</p>
                )}
              </div>
            </div>

            {/* Block Report */}
            <div className="bg-white rounded-2xl shadow-xs p-6 border border-slate-200">
              <h3 className="font-bold text-sm text-slate-900 mb-4">Block-wise Collection Status</h3>
              {blockData.length === 0 ? (
                <p className="text-gray-400 text-center py-6 text-xs">No data recorded</p>
              ) : (
                <div className="space-y-3">
                  {blockData.map((b) => (
                    <div key={b.block} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="font-semibold text-xs text-slate-800">Block {b.block}</p>
                        <p className="text-slate-400 text-[10px]">{b.count} accounts</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold">
                          <span className="text-emerald-700">₹{b.collected.toLocaleString()}</span>
                          {" / "}
                          <span className="text-slate-400">₹{b.total.toLocaleString()}</span>
                        </p>
                        <div className="w-28 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all"
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
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: PAY / RECORD GARBAGE COLLECTION FEE (SELF PAYMENT)    */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-100">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
                  <FaCreditCard />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Pay Garbage Collection Fee
                  </h3>
                  <p className="text-xs text-slate-400">Flat {myFlatNumber} ({canonicalResident?.owner || user?.name})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4">
              {/* Billing Month & Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Starting Month
                  </label>
                  <select
                    value={payMonth}
                    onChange={(e) => setPayMonth(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Year
                  </label>
                  <select
                    value={payYear}
                    onChange={(e) => setPayYear(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Advance Payment Option */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Pay for Multiple Months (Advance)</p>
                    <p className="text-[11px] text-slate-500">Pay ahead and avoid monthly reminders</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isAdvance}
                    onChange={(e) => setIsAdvance(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                </div>

                {isAdvance && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700">Duration:</label>
                    <div className="flex items-center gap-2">
                      {[3, 6, 12].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => setAdvanceDuration(dur)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            advanceDuration === dur
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white border text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {dur} Mo (₹{monthlyCharge * dur})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Mode Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["UPI", "Cash", "Bank Transfer"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        payMethod === m
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference Number */}
              {payMethod !== "Cash" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Transaction ID / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    placeholder="e.g. UPI Ref / UTR number"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Total Summary */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase font-bold text-emerald-900 tracking-wider">Total Amount</span>
                  <p className="text-xs text-emerald-700">
                    {isAdvance ? `${advanceDuration} Months Advance` : `1 Month (${payMonth})`}
                  </p>
                </div>
                <span className="text-xl font-black text-emerald-900">
                  ₹{(monthlyCharge * (isAdvance ? advanceDuration : 1)).toLocaleString()}
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  disabled={submittingPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                  <FaCheckCircle className="text-xs" />
                  <span>{submittingPayment ? "Recording Payment..." : "Confirm & Give Payment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: OPT-IN / OPT-OUT REQUEST MODAL                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-gray-800">
                {isEnrolled ? "Request Pause / Opt-Out" : "Request to Join Garbage Collection"}
              </h3>
              <button
                onClick={() => setShowRequestForm(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Message to Society Administrator
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={4}
                  className="w-full border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-xs text-gray-800 leading-relaxed"
                  placeholder={isEnrolled ? DEFAULT_LEAVE_GC_MESSAGE : DEFAULT_JOIN_GC_MESSAGE}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowRequestForm(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRequest}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  <FaPaperPlane className="text-[10px]" /> Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

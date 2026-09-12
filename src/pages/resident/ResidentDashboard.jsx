import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaUser,
  FaHome,
  FaMoneyBillWave,
  FaClock,
  FaCheckCircle,
  FaReceipt,
  FaWallet,
  FaRecycle,
  FaBullhorn,
  FaCalendarAlt,
  FaExclamationCircle,
  FaUserTie,
  FaLeaf,
  FaArrowRight,
  FaInfoCircle,
  FaPauseCircle,
  FaBan,
  FaPhone,
  FaWhatsapp,
  FaBell,
  FaExclamationTriangle,
  FaPaperPlane,
  FaTimes,
  FaQuestionCircle,
  FaHandHoldingHeart,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { useGarbage } from "../../context/GarbageContext";
import { usePayments } from "../../context/PaymentContext";
import { useBills } from "../../context/BillContext";
import { useBilling } from "../../context/BillingContext";
import { useNotices } from "../../context/NoticeContext";
import { useComplaints } from "../../context/ComplaintContext";
import { useEvents } from "../../context/EventContext";
import { useCommittee } from "../../context/CommitteeContext";
import { useActivities } from "../../context/ActivityContext";
import { useNotifications } from "../../context/NotificationContext";
import { createNotification } from "../../services/notificationService";
import { getDisplayStatus } from "../../utils/billStatus";
import { isGcParticipating } from "../../services/statisticsService";
import { DEFAULT_JOIN_GC_MESSAGE } from "./ResidentGarbage";
import RecentUpdatesCard from "../../components/notifications/RecentUpdatesCard";

const GC_CONFIG = {
  participating: {
    label: "Active",
    color: "text-green-700 bg-green-100",
    icon: <FaCheckCircle className="text-green-500" />,
  },
  not_participating: {
    label: "Not Enrolled",
    color: "text-gray-600 bg-gray-100",
    icon: <FaInfoCircle className="text-gray-400" />,
  },
  temporary_stopped: {
    label: "Paused",
    color: "text-yellow-700 bg-yellow-100",
    icon: <FaPauseCircle className="text-yellow-500" />,
  },
  inactive: {
    label: "Inactive",
    color: "text-red-700 bg-red-100",
    icon: <FaBan className="text-red-500" />,
  },
};

export default function ResidentDashboard() {
  const { user } = useAuth();
  const { residents } = useResidents();
  const { payments } = usePayments();
  const { bills } = useBills();
  const { selectedMonth, selectedYear } = useBilling();
  const { notices } = useNotices();
  const { complaints } = useComplaints();
  const { events } = useEvents();
  const { committee } = useCommittee();
  const { activities } = useActivities();
  const { garbageRequests = [], submitRequest } = useGarbage();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinReason, setJoinReason] = useState(DEFAULT_JOIN_GC_MESSAGE);
  const [submittingJoin, setSubmittingJoin] = useState(false);

  const cleanPhone = useMemo(() => {
    const raw = user?.phone || user?.mobile || (user?.email?.includes("@") ? user.email.split("@")[0] : "");
    const digits = String(raw).replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }, [user]);

  const resident = useMemo(() => {
    return (
      residents.find(
        (r) =>
          r.id === user?.residentId ||
          r.id === user?.uid ||
          (cleanPhone && String(r.mobile || "").replace(/\D/g, "").slice(-10) === cleanPhone) ||
          (user?.name && r.owner?.toLowerCase() === user.name.toLowerCase())
      ) || null
    );
  }, [residents, user, cleanPhone]);

  const canonicalResidentId = resident?.id || user?.residentId || user?.uid;

  // GC-related data
  const myPayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.residentId === canonicalResidentId || p.residentId === user?.residentId || p.residentId === user?.uid) {
        return true;
      }
      if (resident?.id && p.residentId === resident.id) {
        return true;
      }
      if (cleanPhone && p.mobile) {
        const pClean = String(p.mobile).replace(/\D/g, "").slice(-10);
        if (pClean === cleanPhone) return true;
      }
      const residentOwnerName = (resident?.owner || user?.name || "").trim().toLowerCase();
      if (
        residentOwnerName &&
        p.residentName?.trim().toLowerCase() === residentOwnerName &&
        (!p.flat || p.flat === (resident?.flat || user?.flat))
      ) {
        return true;
      }
      return false;
    });
  }, [payments, user, canonicalResidentId, resident, cleanPhone]);

  const isParticipating = isGcParticipating(resident) || myPayments.length > 0;
  const gcStatus = resident?.garbageStatus || (myPayments.length > 0 ? "participating" : "not_participating");
  const gcCfg = GC_CONFIG[gcStatus] || GC_CONFIG.not_participating;

  // Pending GC requests
  const myPendingRequest = useMemo(
    () =>
      garbageRequests.find(
        (r) =>
          (r.residentId === canonicalResidentId || r.residentId === user?.uid) &&
          r.status === "pending"
      ),
    [garbageRequests, canonicalResidentId, user]
  );

  const myBills = useMemo(() => {
    if (!isParticipating) return [];
    return bills.filter(
      (b) =>
        b.residentId === canonicalResidentId ||
        b.residentId === resident?.id ||
        b.residentId === user?.residentId ||
        b.residentId === user?.uid
    );
  }, [bills, user, isParticipating, canonicalResidentId, resident]);

  const currentBill = useMemo(() => {
    if (!isParticipating) return null;
    const matchPay = myPayments.find(
      (p) => p.month === selectedMonth && Number(p.year) === Number(selectedYear)
    );
    const bill = myBills.find(
      (b) => b.month === selectedMonth && Number(b.year) === Number(selectedYear)
    );
    if (matchPay) {
      return {
        ...(bill || {}),
        month: selectedMonth,
        year: selectedYear,
        amount: Number(matchPay.amount || bill?.amount || 0),
        status: matchPay.paymentMethod === "Exempted" ? "Exempted" : "Paid",
        displayStatus: matchPay.paymentMethod === "Exempted" ? "Exempted" : "Paid",
        paymentDate: matchPay.paymentDate,
        paymentMethod: matchPay.paymentMethod,
        dueDate: bill?.dueDate || `10 ${selectedMonth} ${selectedYear}`,
      };
    }
    return bill ? { ...bill, displayStatus: getDisplayStatus(bill) } : null;
  }, [myBills, myPayments, selectedMonth, selectedYear, isParticipating]);

  const totalPaid = myPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  const lastPayment = useMemo(() => {
    if (myPayments.length === 0) return null;
    return [...myPayments].sort((a, b) => {
      const tsA = Number((a.receiptNumber || "").replace("REC-", "")) || 0;
      const tsB = Number((b.receiptNumber || "").replace("REC-", "")) || 0;
      return tsB - tsA;
    })[0];
  }, [myPayments]);

  // Notices, Events, Complaints, Activities
  const recentNotices = useMemo(() => notices.slice(0, 3), [notices]);

  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => e.status !== "cancelled")
      .slice(0, 3);
  }, [events]);

  const myComplaints = useMemo(() => {
    return complaints
      .filter(
        (c) =>
          c.residentId === canonicalResidentId ||
          c.residentId === user?.uid ||
          c.residentId === user?.residentId
      )
      .slice(0, 3);
  }, [complaints, canonicalResidentId, user]);

  const recentActivities = useMemo(() => {
    return activities
      .filter((a) => a.status !== "cancelled")
      .slice(0, 3);
  }, [activities]);

  const activeCommittee = useMemo(() => {
    return (committee || [])
      .filter((m) => m.status !== "inactive")
      .sort((a, b) => Number(a.order || 99) - Number(b.order || 99));
  }, [committee]);

  const { notifications = [] } = useNotifications();

  // Current Calendar Month & Year for New Month Garbage Payment
  const currentMonthName = useMemo(() => {
    return new Date().toLocaleString("en-US", { month: "long" });
  }, []);

  const currentYearNum = useMemo(() => {
    return new Date().getFullYear();
  }, []);

  const todayDate = new Date().getDate();
  const isPastDue = todayDate > 10;

  const currentMonthFee = useMemo(() => {
    return Number(resident?.charge) || Number(currentBill?.amount) || Number(myPayments[0]?.amount) || 80;
  }, [resident, currentBill, myPayments]);

  // Check if a payment covers a given month and year (either direct match or coveredMonths array)
  const isCoveredByPayment = (p, m, y) => {
    if (!p) return false;
    const yNum = Number(y);
    if (p.month === m && Number(p.year) === yNum) return true;
    if (p.isAdvance && Array.isArray(p.coveredMonths)) {
      return p.coveredMonths.some(
        (cm) => cm.month === m && Number(cm.year) === yNum
      );
    }
    return false;
  };

  const currentMonthPayment = useMemo(() => {
    return myPayments.find(
      (p) =>
        isCoveredByPayment(p, currentMonthName, currentYearNum) ||
        isCoveredByPayment(p, selectedMonth, selectedYear)
    );
  }, [myPayments, currentMonthName, selectedMonth, currentYearNum, selectedYear]);

  // Check if bill exists and is marked Paid / Exempted
  const currentMonthBillPaid = useMemo(() => {
    return myBills.some(
      (b) =>
        ((b.month === currentMonthName && Number(b.year) === currentYearNum) ||
         (b.month === selectedMonth && Number(b.year) === Number(selectedYear))) &&
        (b.status === "Paid" || b.status === "Exempted" || b.displayStatus === "Paid")
    );
  }, [myBills, currentMonthName, currentYearNum, selectedMonth, selectedYear]);

  // Is this month paid via advance payment?
  const isAdvanceCovered = useMemo(() => {
    if (currentMonthPayment?.isAdvance) return true;
    const billMatch = myBills.find(
      (b) =>
        (b.month === currentMonthName && Number(b.year) === currentYearNum) ||
        (b.month === selectedMonth && Number(b.year) === Number(selectedYear))
    );
    if (billMatch?.isAdvance) return true;
    return myPayments.some((p) => p.isAdvance && isCoveredByPayment(p, currentMonthName, currentYearNum));
  }, [currentMonthPayment, myBills, myPayments, currentMonthName, currentYearNum, selectedMonth, selectedYear]);

  const advanceDetails = useMemo(() => {
    if (!isAdvanceCovered) return null;
    return (
      currentMonthPayment ||
      myPayments.find((p) => p.isAdvance && isCoveredByPayment(p, currentMonthName, currentYearNum)) ||
      myBills.find((b) => b.isAdvance && ((b.month === currentMonthName && Number(b.year) === currentYearNum) || (b.month === selectedMonth && Number(b.year) === Number(selectedYear))))
    );
  }, [isAdvanceCovered, currentMonthPayment, myPayments, myBills, currentMonthName, currentYearNum, selectedMonth, selectedYear]);

  // If paid (regular or advance) -> TRUE, so no due message is ever shown for covered months!
  const isCurrentMonthPaid = !!currentMonthPayment || currentMonthBillPaid || isAdvanceCovered;

  const collectorName = useMemo(() => {
    return myPayments[0]?.collectorName || "RWA Collector / Office";
  }, [myPayments]);

  // Auto-dispatch in-app Notification when a new month starts and fee is unpaid
  useEffect(() => {
    if (!user?.uid || !isParticipating || isCurrentMonthPaid) return;

    const notifKey = `rwa_gc_due_notif_${user.uid}_${currentMonthName}_${currentYearNum}`;
    if (localStorage.getItem(notifKey)) return;

    const alreadyExists = (notifications || []).some(
      (n) =>
        n.type === "payment" &&
        n.title?.includes(currentMonthName) &&
        n.title?.includes(String(currentYearNum)) &&
        n.title?.toLowerCase().includes("garbage")
    );

    if (alreadyExists) {
      localStorage.setItem(notifKey, "true");
      return;
    }

    createNotification({
      userId: user.uid,
      title: `🔔 Garbage Fee Due: ${currentMonthName} ${currentYearNum}`,
      message: `Your monthly garbage collection fee of ₹${currentMonthFee} for ${currentMonthName} ${currentYearNum} is due. Please pay to ensure continuous daily door-to-door waste collection.`,
      type: "payment",
      link: "/resident/bills",
    })
      .then(() => {
        localStorage.setItem(notifKey, "true");
      })
      .catch((err) => {
        console.warn("Could not dispatch monthly garbage due notification:", err);
      });
  }, [user?.uid, isParticipating, isCurrentMonthPaid, currentMonthName, currentYearNum, currentMonthFee, notifications]);

  if (!resident) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FaUser className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-600">Profile Not Linked</h2>
          <p className="text-gray-500 mt-2">Contact your administrator to link your account.</p>
        </div>
      </div>
    );
  }

  const basePath = `/resident`;

  return (
    <div className="space-y-6">

      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-18 h-18 bg-white/20 rounded-2xl flex items-center justify-center text-4xl shrink-0">
            <FaUser />
          </div>
          <div className="flex-1">
            <p className="text-blue-200 text-sm">Welcome back,</p>
            <h1 className="text-2xl sm:text-3xl font-bold">{resident.owner}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-blue-200 text-sm">
              <span className="flex items-center gap-1"><FaHome className="text-xs" /> {resident.flat}</span>
              {resident.block && <span>• Block {resident.block}</span>}
              {resident.floor && <span>• Floor {resident.floor}</span>}
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${gcCfg.color}`}>
            <FaRecycle className="text-[10px]" /> GC: {gcCfg.label}
          </div>
        </div>
      </div>

      {/* ─── NEW MONTH GARBAGE PAYMENT NOTIFICATION / MESSAGE CARD ─── */}
      {isParticipating && (
        !isCurrentMonthPaid ? (
          <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/70 border border-amber-300/80 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
            {/* Background watermark icon */}
            <div className="absolute -right-6 -bottom-6 text-amber-200/30 text-9xl pointer-events-none select-none">
              <FaRecycle />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/15 text-amber-700 border border-amber-400/30 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                  <FaMoneyBillWave />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isPastDue ? "bg-red-100 text-red-800 border border-red-200" : "bg-amber-100 text-amber-900 border border-amber-200"
                    }`}>
                      {isPastDue ? "⚠️ Overdue Payment" : "🔔 New Month Billing • Payment Due"}
                    </span>
                    <span className="text-xs text-amber-900 font-semibold">
                      Billing Cycle: {currentMonthName} {currentYearNum}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">
                    Garbage Collection Fee for {currentMonthName} {currentYearNum} is Due
                  </h2>

                  <p className="text-xs sm:text-sm text-gray-600 max-w-2xl leading-relaxed">
                    Friendly reminder: The society door-to-door garbage collection fee of{" "}
                    <strong className="text-gray-900 font-mono font-bold">₹{currentMonthFee}</strong> for{" "}
                    <strong>{currentMonthName} {currentYearNum}</strong> is pending. Please complete your payment to maintain uninterrupted daily waste pickup.
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-gray-600">
                    <span>
                      Fee: <strong className="text-emerald-700 font-mono font-bold">₹{currentMonthFee}</strong>
                    </span>
                    <span>
                      Due Date: <strong className={isPastDue ? "text-red-700 font-bold" : "text-gray-800 font-semibold"}>
                        {currentBill?.dueDate || `10 ${currentMonthName} ${currentYearNum}`}
                      </strong>
                    </span>
                    {collectorName && (
                      <span className="text-gray-500">
                        Assigned Collector: <strong className="text-gray-700">{collectorName}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2.5 shrink-0 pt-2 md:pt-0">
                <Link
                  to="/resident/bills"
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                >
                  <FaWallet /> Pay ₹{currentMonthFee} Now <FaArrowRight className="text-xs" />
                </Link>
                <Link
                  to="/resident/bills"
                  className="w-full sm:w-auto px-4 py-2 bg-white/80 hover:bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold transition text-center"
                >
                  View Bill Details
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50/70 border border-emerald-300/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-700 border border-emerald-300 flex items-center justify-center text-xl shrink-0">
                <FaCheckCircle />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-200 text-emerald-950 border border-emerald-300">
                    {isAdvanceCovered ? "🎉 Paid in Advance" : "✅ Payment Confirmed"}
                  </span>
                  <span className="text-xs font-bold text-emerald-950">
                    {currentMonthName} {currentYearNum}
                  </span>
                  {advanceDetails?.receiptNumber && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 shadow-2xs">
                      {advanceDetails.receiptNumber}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm font-bold text-emerald-950 mt-1">
                  {isAdvanceCovered
                    ? `Garbage Collection Fee Paid in Advance for ${currentMonthName} ${currentYearNum}`
                    : `Garbage Collection Fee for ${currentMonthName} ${currentYearNum} is Paid`}
                </p>

                <p className="text-[11px] sm:text-xs text-emerald-700 mt-0.5">
                  {isAdvanceCovered
                    ? `Covered under advance payment ${advanceDetails?.periodLabel ? `(${advanceDetails.periodLabel})` : ""}. You have zero dues for this month!`
                    : `Thank you! Your daily door-to-door garbage collection service is active for this month.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <Link
                to="/resident/receipts"
                className="px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <FaReceipt className="text-emerald-600" /> View Receipt
              </Link>
            </div>
          </div>
        )
      )}

      {/* Mandatory Notifications & Recent Society Updates */}
      <RecentUpdatesCard />

      {/* GC Status Section — adapts to participation */}
      {isParticipating ? (
        <>
          {/* GC Active — Show billing */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                {selectedMonth} {selectedYear} — Collection Status
              </h2>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                isAdvanceCovered || currentBill?.isAdvance || currentBill?.displayStatus === "Paid" ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : currentBill?.displayStatus === "Overdue" ? "bg-red-100 text-red-700"
                : currentBill?.displayStatus === "Exempted" ? "bg-gray-200 text-gray-700"
                : "bg-yellow-100 text-yellow-700"
              }`}>
                {isAdvanceCovered || currentBill?.isAdvance
                  ? "Advance Paid"
                  : currentBill?.displayStatus || "No Bill"}
              </span>
            </div>
            {currentBill && (
              <p className="text-sm text-gray-500">
                {isAdvanceCovered || currentBill?.isAdvance
                  ? `Covered by advance payment: ${advanceDetails?.periodLabel || `${selectedMonth} ${selectedYear}`}`
                  : `Due: ${currentBill.dueDate || "—"}`}
              </p>
            )}
          </div>

          {/* Payment Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<FaMoneyBillWave />} label="Total Paid" value={`₹${totalPaid.toLocaleString()}`} color="emerald" />
            <StatCard icon={<FaWallet />} label="Monthly Charge" value={`₹${(Number(resident.charge) || Number(myPayments[0]?.amount) || 0).toLocaleString()}`} color="purple" />
            <StatCard icon={<FaReceipt />} label="Receipts" value={myPayments.length} color="blue" />
            <StatCard icon={<FaClock />} label="Bills" value={myBills.length} color="orange" />
          </div>

          {/* Last Payment */}
          {lastPayment && (
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold text-gray-800 mb-3">Last Payment</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-gray-500">Amount</span><p className="font-bold text-emerald-600 text-lg">₹{Number(lastPayment.amount).toLocaleString()}</p></div>
                <div><span className="text-gray-500">Method</span><p className="font-bold">{lastPayment.paymentMethod}</p></div>
                <div><span className="text-gray-500">Date</span><p className="font-bold">{lastPayment.paymentDate}</p></div>
                <div><span className="text-gray-500">Receipt</span><p className="font-bold font-mono text-xs">{lastPayment.receiptNumber}</p></div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* GC Not Active — Show info card */
        <div className={`rounded-2xl shadow-sm p-6 border ${
          gcStatus === "temporary_stopped" ? "bg-yellow-50 border-yellow-200" :
          gcStatus === "inactive" ? "bg-red-50 border-red-200" :
          "bg-gray-50 border-gray-200"
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl shrink-0">
                {gcCfg.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {gcStatus === "temporary_stopped"
                    ? "Garbage Collection Service Paused"
                    : gcStatus === "inactive"
                    ? "Garbage Collection Service Inactive"
                    : "Not Enrolled in Garbage Collection"}
                </h2>
                <p className="text-gray-600 text-sm mt-1 leading-relaxed">
                  {gcStatus === "temporary_stopped"
                    ? "Your garbage collection service is temporarily paused. Payment and collection features are unavailable until the service is reactivated by the admin."
                    : gcStatus === "inactive"
                    ? "Your garbage collection service is currently inactive. No collection or payment features are available."
                    : "You are currently not participating in the Society Garbage Collection Program. No charges, bills, or payment records will be generated for your account."}
                </p>
                {gcStatus === "not_participating" && (
                  <p className="text-gray-500 text-xs mt-2.5 flex items-center gap-1.5">
                    <FaInfoCircle className="text-blue-500 shrink-0" />
                    Want doorstep waste pickup? Send an enrollment request to the admin below.
                  </p>
                )}
              </div>
            </div>

            {/* Option to send request to admin to join GC */}
            <div className="md:shrink-0 flex items-center self-start md:self-center">
              {myPendingRequest ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Request Sent to Admin (Pending Approval)
                </div>
              ) : (
                <button
                  onClick={() => {
                    setJoinReason(DEFAULT_JOIN_GC_MESSAGE);
                    setShowJoinModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs transition shadow-sm"
                >
                  <FaPaperPlane className="text-xs" />
                  Send Request to Admin to Join GC
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className={`grid ${isParticipating ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"} gap-3`}>
          {isParticipating && (
            <>
              <QuickAction to={`${basePath}/bills`} icon={<FaWallet />} label="My Bills" color="blue" />
              <QuickAction to={`${basePath}/payments`} icon={<FaReceipt />} label="Payments" color="emerald" />
            </>
          )}
          <QuickAction to={`${basePath}/notices`} icon={<FaBullhorn />} label="Notices" color="purple" />
          <QuickAction to={`${basePath}/complaints`} icon={<FaExclamationCircle />} label="Complaints" color="red" />
          <QuickAction to={`${basePath}/events`} icon={<FaCalendarAlt />} label="Events" color="indigo" />
          <QuickAction to={`${basePath}/activities`} icon={<FaLeaf />} label="Activities" color="green" />
          <QuickAction to={`${basePath}/committee`} icon={<FaUserTie />} label="Committee" color="amber" />
          <QuickAction to={`${basePath}/special-collections`} icon={<FaHandHoldingHeart />} label="Special Drives" color="rose" />
          <QuickAction to={`${basePath}/support`} icon={<FaQuestionCircle />} label="Help & FAQs" color="teal" />
          <QuickAction to={`${basePath}/profile`} icon={<FaUser />} label="Profile" color="sky" />
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Notices */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><FaBullhorn className="text-purple-500" /> Notices</h2>
            <Link to={`${basePath}/notices`} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">View All <FaArrowRight className="text-[10px]" /></Link>
          </div>
          {recentNotices.length === 0 ? (
            <p className="text-gray-400 text-sm">No notices yet.</p>
          ) : (
            <div className="space-y-2">
              {recentNotices.map((n) => (
                <div key={n.id} className="bg-gray-50 rounded-xl p-3">
                  <p className="font-semibold text-sm truncate">{n.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{n.content || n.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><FaCalendarAlt className="text-indigo-500" /> Upcoming Events</h2>
            <Link to={`${basePath}/events`} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">View All <FaArrowRight className="text-[10px]" /></Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-gray-400 text-sm">No upcoming events.</p>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((e) => (
                <div key={e.id} className="bg-gray-50 rounded-xl p-3">
                  <p className="font-semibold text-sm truncate">{e.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{e.date || e.eventDate} {e.time && `at ${e.time}`}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Complaints */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><FaExclamationCircle className="text-red-500" /> My Complaints</h2>
            <Link to={`${basePath}/complaints`} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">View All <FaArrowRight className="text-[10px]" /></Link>
          </div>
          {myComplaints.length === 0 ? (
            <p className="text-gray-400 text-sm">No complaints submitted.</p>
          ) : (
            <div className="space-y-2">
              {myComplaints.map((c) => (
                <div key={c.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                  <p className="font-semibold text-sm truncate flex-1">{c.title || c.subject}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-2 ${
                    c.status === "resolved" ? "bg-green-100 text-green-700" :
                    c.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {c.status?.replace("_", " ") || "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><FaLeaf className="text-green-500" /> Recent Activities</h2>
            <Link to={`${basePath}/activities`} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">View All <FaArrowRight className="text-[10px]" /></Link>
          </div>
          {recentActivities.length === 0 ? (
            <p className="text-gray-400 text-sm">No activities yet.</p>
          ) : (
            <div className="space-y-2">
              {recentActivities.map((a) => (
                <div key={a.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">{a.category}</span>
                    <p className="font-semibold text-sm truncate">{a.title}</p>
                  </div>
                  {a.date && <p className="text-xs text-gray-500 mt-0.5">{a.date}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RWA Committee Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-base">
                <FaUserTie />
              </span>
              RWA Committee Members
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Elected leadership and office bearers of D BLOCK RWA INDRAPRASTHA
            </p>
          </div>
          <Link
            to={`${basePath}/committee`}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 transition"
          >
            View All ({activeCommittee.length}) <FaArrowRight className="text-[10px]" />
          </Link>
        </div>

        {activeCommittee.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FaUserTie className="text-3xl text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">No committee members listed yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Committee details will appear once added by the administrator.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeCommittee.slice(0, 6).map((member) => {
              const phoneClean = (member.phone || "").replace(/\D/g, "").slice(-10);
              const desigColor =
                member.designation === "President" ? "bg-amber-100 text-amber-800" :
                member.designation === "Vice President" ? "bg-emerald-100 text-emerald-800" :
                member.designation === "General Secretary" ? "bg-blue-100 text-blue-800" :
                member.designation === "Treasurer" ? "bg-violet-100 text-violet-800" :
                "bg-slate-100 text-slate-700";

              return (
                <div
                  key={member.id || member.uid}
                  className="bg-slate-50/70 hover:bg-slate-100/80 rounded-2xl p-4 border border-slate-200/80 transition duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      {member.profilePhotoUrl ? (
                        <img
                          src={member.profilePhotoUrl}
                          alt={member.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                          {member.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase() || "RWA"}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="font-bold text-sm text-slate-900 truncate">
                            {member.name}
                          </h3>
                        </div>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${desigColor}`}>
                          {member.designation}
                        </span>
                        {(member.flat || member.block) && (
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-1">
                            <FaHome className="text-[9px] text-slate-400 shrink-0" />
                            <span>
                              {member.flat ? `Flat ${member.flat}` : ""}
                              {member.flat && member.block ? " • " : ""}
                              {member.block ? `Block ${member.block}` : ""}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                    {member.phone ? (
                      <a
                        href={`tel:${member.phone}`}
                        className="text-xs font-semibold text-slate-700 hover:text-blue-600 flex items-center gap-1.5 truncate"
                      >
                        <FaPhone className="text-[10px] text-emerald-600" />
                        <span>{member.phone}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No phone listed</span>
                    )}

                    {phoneClean && (
                      <a
                        href={`https://wa.me/91${phoneClean}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition text-xs shadow-xs shrink-0"
                        title="Chat on WhatsApp"
                      >
                        <FaWhatsapp />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeCommittee.length > 6 && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <Link
              to={`${basePath}/committee`}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              View all {activeCommittee.length} committee members <FaArrowRight className="text-[10px]" />
            </Link>
          </div>
        )}
      </div>

      {/* Join GC Request Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <FaRecycle className="text-lg" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">
                    Request to Join Garbage Collection
                  </h3>
                  <p className="text-xs text-gray-400">Door-to-door society service</p>
                </div>
              </div>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Request Message to Admin (Pre-filled default message)
                </label>
                <textarea
                  value={joinReason}
                  onChange={(e) => setJoinReason(e.target.value)}
                  rows={4}
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm text-gray-800 leading-relaxed"
                  placeholder="Reason / message for joining..."
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  The standard message is pre-filled above. You can customize it or send directly.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 text-sm font-medium transition text-gray-600"
                disabled={submittingJoin}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingJoin}
                onClick={async () => {
                  setSubmittingJoin(true);
                  try {
                    const success = await submitRequest({
                      residentId: canonicalResidentId || user?.uid || "",
                      requestType: "opt_in",
                      reason: joinReason.trim() || DEFAULT_JOIN_GC_MESSAGE,
                    });
                    if (success) {
                      setShowJoinModal(false);
                      setJoinReason(DEFAULT_JOIN_GC_MESSAGE);
                    }
                  } finally {
                    setSubmittingJoin(false);
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-sm disabled:opacity-50"
              >
                <FaPaperPlane className="text-xs" />
                {submittingJoin ? "Sending..." : "Submit Request to Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===============================
   Sub-Components
================================ */

function StatCard({ icon, label, value, color }) {
  const colors = {
    emerald: "border-emerald-500 text-emerald-600",
    purple: "border-purple-500 text-purple-600",
    blue: "border-blue-500 text-blue-600",
    orange: "border-orange-500 text-orange-600",
    red: "border-red-500 text-red-600",
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-4 border-l-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <h3 className="text-xl font-bold text-gray-800">{value}</h3>
    </div>
  );
}

function QuickAction({ to, icon, label, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
    purple: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    red: "bg-red-50 text-red-600 hover:bg-red-100",
    indigo: "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
    green: "bg-green-50 text-green-600 hover:bg-green-100",
    sky: "bg-sky-50 text-sky-600 hover:bg-sky-100",
    amber: "bg-amber-50 text-amber-700 hover:bg-amber-100",
    teal: "bg-teal-50 text-teal-700 hover:bg-teal-100",
    rose: "bg-rose-50 text-rose-600 hover:bg-rose-100",
  };

  return (
    <Link
      to={to}
      className={`rounded-xl p-4 flex flex-col items-center gap-2 text-sm font-medium transition ${colors[color]}`}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </Link>
  );
}

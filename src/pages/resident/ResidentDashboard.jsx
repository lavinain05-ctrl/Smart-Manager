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
  FaPaperPlane,
  FaTimes,
  FaQuestionCircle,
  FaHandHoldingHeart,
  FaShieldAlt,
  FaLightbulb,
  FaChevronRight,
  FaBell,
} from "react-icons/fa";

import toast from "react-hot-toast";

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
import { subscribeSpecialCollections } from "../../services/specialCollectionService";
import { DEFAULT_JOIN_GC_MESSAGE } from "./ResidentGarbage";
import RecentUpdatesCard from "../../components/notifications/RecentUpdatesCard";

const GC_CONFIG = {
  participating: {
    label: "Active Service",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    icon: <FaCheckCircle className="text-emerald-500" />,
  },
  not_participating: {
    label: "Not Enrolled",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    icon: <FaInfoCircle className="text-slate-400" />,
  },
  temporary_stopped: {
    label: "Service Paused",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    icon: <FaPauseCircle className="text-amber-500" />,
  },
  inactive: {
    label: "Service Inactive",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
    icon: <FaBan className="text-rose-500" />,
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

  // Live special collection drives
  const [specialDrives, setSpecialDrives] = useState([]);

  useEffect(() => {
    const unsub = subscribeSpecialCollections((data) => {
      setSpecialDrives(data || []);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

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

  const {
    notifications = [],
    phonePermission,
    requestPhonePermission,
  } = useNotifications();

  const [phoneBannerDismissed, setPhoneBannerDismissed] = useState(() => {
    return localStorage.getItem("rwa_dismiss_phone_notif_banner") === "true";
  });

  // Active special drives to display
  const activeSpecialDrives = useMemo(() => {
    return specialDrives
      .filter((d) => d.status === "active" || !d.status)
      .slice(0, 2);
  }, [specialDrives]);

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

  const currentMonthBillPaid = useMemo(() => {
    return myBills.some(
      (b) =>
        ((b.month === currentMonthName && Number(b.year) === currentYearNum) ||
         (b.month === selectedMonth && Number(b.year) === Number(selectedYear))) &&
        (b.status === "Paid" || b.status === "Exempted" || b.displayStatus === "Paid")
    );
  }, [myBills, currentMonthName, currentYearNum, selectedMonth, selectedYear]);

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md text-center shadow-lg">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-3xl mx-auto mb-4">
            <FaUser />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Profile Not Linked</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 leading-relaxed">
            Your login account is not linked to a resident record yet. Please contact the society administrator to map your flat number.
          </p>
          <Link
            to="/resident/support"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition"
          >
            <FaQuestionCircle /> Contact Support
          </Link>
        </div>
      </div>
    );
  }

  const basePath = `/resident`;

  return (
    <div className="space-y-4 sm:space-y-6 sm:space-y-7 pb-12">
      {/* ═══════════ Phone Notification Bar Activation Banner ═══════════ */}
      {phonePermission === "default" && !phoneBannerDismissed && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
              <FaBell className="animate-bounce" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Get Phone Bar Notifications
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Stay updated with bill reminders, payment receipts, and society announcements in your phone's notification bar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setPhoneBannerDismissed(true);
                localStorage.setItem("rwa_dismiss_phone_notif_banner", "true");
              }}
              className="px-3 py-1.5 text-xs text-emerald-100 hover:text-white transition"
            >
              Later
            </button>
            <button
              type="button"
              onClick={async () => {
                const perm = await requestPhonePermission();
                if (perm === "granted") {
                  toast.success("Phone notifications activated! 🔔");
                } else if (perm === "denied") {
                  toast.error("Permission denied. You can enable it in browser settings.");
                }
              }}
              className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-black rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <FaBell className="text-emerald-600 text-xs" /> Enable Alerts
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ Hero Card: Resident & Society Profile ═══════════ */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-4 sm:p-6 md:p-8 shadow-xl border border-slate-800/80">
        {/* Glow ambient effects */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -ml-20 -mb-20 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-5">
            {/* Avatar container */}
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xl sm:text-3xl font-black shrink-0 shadow-lg shadow-blue-500/30 border border-white/20">
              {resident.owner
                ?.split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || <FaUser />}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <FaShieldAlt className="text-[8px] sm:text-[9px]" /> Verified Resident
                </span>
                <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider border ${gcCfg.badgeClass}`}>
                  {gcCfg.icon} {gcCfg.label}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight truncate">
                {resident.owner}
              </h1>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1 bg-white/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-semibold text-white border border-white/10 text-xs">
                  <FaHome className="text-emerald-400" /> Flat {resident.flat}
                </span>
                {resident.block && (
                  <span className="bg-white/10 px-2 py-0.5 sm:py-1 rounded-lg font-medium border border-white/10 text-xs">
                    Block {resident.block}
                  </span>
                )}
                {resident.floor && (
                  <span className="bg-white/10 px-2 py-0.5 sm:py-1 rounded-lg font-medium border border-white/10 text-xs">
                    Floor {resident.floor}
                  </span>
                )}
                <span className="text-slate-400 hidden sm:inline">• D BLOCK RWA INDRAPRASTHA</span>
              </div>
            </div>
          </div>

          {/* Quick Header Shortcuts */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
            <Link
              to="/resident/support"
              className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition backdrop-blur-sm"
              title="Help & FAQs"
            >
              <FaQuestionCircle className="text-amber-400 text-xs" />
              <span>Support & FAQs</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════ Billing Status / Payment Notice Card ═══════════ */}
      {isParticipating ? (
        !isCurrentMonthPaid ? (
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border border-amber-300/80 dark:border-amber-700/50 p-4 sm:p-6 md:p-7 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-lg shadow-amber-500/30">
                  <FaMoneyBillWave />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isPastDue
                          ? "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                          : "bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      {isPastDue ? "⚠️ Overdue Payment" : "🔔 Monthly Fee Due"}
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Billing Cycle: {currentMonthName} {currentYearNum}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
                    Garbage Collection Fee for {currentMonthName} {currentYearNum} is Due
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                    Please clear your monthly fee of{" "}
                    <strong className="text-emerald-700 dark:text-emerald-400 font-bold">
                      ₹{currentMonthFee}
                    </strong>{" "}
                    to maintain seamless daily doorstep waste collection.
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Fee: <strong className="text-slate-900 dark:text-white font-bold">₹{currentMonthFee}</strong>
                    </span>
                    <span>
                      Due Date:{" "}
                      <strong className={isPastDue ? "text-rose-600 font-bold" : "text-slate-900 dark:text-white font-semibold"}>
                        {currentBill?.dueDate || `10 ${currentMonthName} ${currentYearNum}`}
                      </strong>
                    </span>
                    {collectorName && (
                      <span>
                        Assigned Collector: <strong className="text-slate-800 dark:text-slate-200">{collectorName}</strong>
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
                  className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition text-center"
                >
                  View Bill Details
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-950/30 border border-emerald-300/80 dark:border-emerald-800/60 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md shadow-emerald-600/20">
                <FaCheckCircle />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-200 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    {isAdvanceCovered ? "🎉 Paid in Advance" : "✅ Payment Confirmed"}
                  </span>
                  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    {currentMonthName} {currentYearNum}
                  </span>
                  {advanceDetails?.receiptNumber && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                      {advanceDetails.receiptNumber}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200 mt-1">
                  {isAdvanceCovered
                    ? `Garbage Collection Fee Paid in Advance for ${currentMonthName} ${currentYearNum}`
                    : `Garbage Collection Fee for ${currentMonthName} ${currentYearNum} is Paid`}
                </p>

                <p className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {isAdvanceCovered
                    ? `Covered under advance payment ${advanceDetails?.periodLabel ? `(${advanceDetails.periodLabel})` : ""}. Zero dues pending!`
                    : `Thank you! Your daily doorstep garbage collection service is active for this month.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              <Link
                to="/resident/receipts"
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <FaReceipt className="text-emerald-600" /> View Receipt
              </Link>
            </div>
          </div>
        )
      ) : (
        /* GC Not Active — Info Card */
        <div
          className={`rounded-3xl p-6 border shadow-sm ${
            gcStatus === "temporary_stopped"
              ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60"
              : gcStatus === "inactive"
              ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
              : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-2xl shrink-0">
                {gcCfg.icon}
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {gcStatus === "temporary_stopped"
                    ? "Garbage Collection Service Paused"
                    : gcStatus === "inactive"
                    ? "Garbage Collection Service Inactive"
                    : "Not Enrolled in Garbage Collection"}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
                  {gcStatus === "temporary_stopped"
                    ? "Your garbage collection service is temporarily paused. Service will resume once reactivated."
                    : gcStatus === "inactive"
                    ? "Your garbage collection service is currently inactive. Contact society administration for activation."
                    : "You are currently not participating in the Society Garbage Collection Program. Doorstep pickup is not scheduled for your flat."}
                </p>
                {gcStatus === "not_participating" && (
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 flex items-center gap-1.5">
                    <FaInfoCircle className="text-blue-500 shrink-0" />
                    Want door-to-door waste pickup? Submit an enrollment request below.
                  </p>
                )}
              </div>
            </div>

            {/* Option to send request to admin to join GC */}
            <div className="md:shrink-0 flex items-center self-start md:self-center">
              {myPendingRequest ? (
                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Request Sent to Admin (Pending Approval)
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setJoinReason(DEFAULT_JOIN_GC_MESSAGE);
                    setShowJoinModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs transition shadow-sm"
                >
                  <FaPaperPlane className="text-xs" />
                  Request to Join Garbage Collection
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Mandatory Notifications & Recent Updates ═══════════ */}
      <RecentUpdatesCard />

      {/* ═══════════ Section: Financial & Account Metrics ═══════════ */}
      {isParticipating && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Paid</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{totalPaid.toLocaleString("en-IN")}
              </h3>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Lifetime verified</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg shrink-0">
              <FaMoneyBillWave />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Monthly Fee</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                ₹{(Number(resident.charge) || Number(myPayments[0]?.amount) || 80).toLocaleString("en-IN")}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Monthly billing rate</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center text-lg shrink-0">
              <FaWallet />
            </div>
          </div>

          <Link
            to="/resident/receipts"
            className="group bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition flex items-center justify-between"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Receipts</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {myPayments.length}
              </h3>
              <p className="text-[10px] text-blue-600 group-hover:underline mt-0.5">View all slips →</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
              <FaReceipt />
            </div>
          </Link>

          <Link
            to="/resident/bills"
            className="group bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition flex items-center justify-between"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bills</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                {myBills.length}
              </h3>
              <p className="text-[10px] text-amber-600 group-hover:underline mt-0.5">Invoice history →</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
              <FaClock />
            </div>
          </Link>
        </div>
      )}

      {/* ═══════════ Last Payment Highlight ═══════════ */}
      {lastPayment && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FaReceipt className="text-emerald-500" /> Most Recent Payment
            </h3>
            <Link
              to="/resident/receipts"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              All Receipts <FaArrowRight className="text-[9px]" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400">Amount Paid</span>
              <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                ₹{Number(lastPayment.amount || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400">Payment Mode</span>
              <p className="font-bold text-slate-900 dark:text-white truncate">
                {lastPayment.paymentMethod || "Direct"}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400">Date</span>
              <p className="font-bold text-slate-900 dark:text-white truncate">
                {lastPayment.paymentDate || "—"}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] text-slate-400">Receipt No</span>
              <p className="font-bold font-mono text-xs text-blue-600 dark:text-blue-400 truncate">
                {lastPayment.receiptNumber || "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Active Special Collection Drives ═══════════ */}
      {activeSpecialDrives.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center text-lg font-bold">
                <FaHandHoldingHeart />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Active Community Drives & Fundraisers
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Festival celebrations, security funds, and society improvements
                </p>
              </div>
            </div>

            <Link
              to="/resident/special-collections"
              className="text-xs font-bold text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
            >
              View All <FaArrowRight className="text-[9px]" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSpecialDrives.map((drive) => {
              const collected = Number(drive.collectedAmount || drive.currentAmount || 0);
              const target = Number(drive.targetAmount || 0);
              const pct = target > 0 ? Math.round((collected / target) * 100) : 0;

              return (
                <div
                  key={drive.id}
                  className="p-4 rounded-2xl bg-gradient-to-br from-pink-50/50 via-slate-50 to-pink-50/30 dark:from-pink-950/20 dark:via-slate-850 dark:to-slate-800 border border-pink-100 dark:border-pink-900/40 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300">
                        {drive.collectionType || "Special Drive"}
                      </span>
                      <span className="text-xs font-bold text-pink-600 dark:text-pink-400">
                        {pct}% Funded
                      </span>
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                      {drive.name || drive.title || "Society Initiative"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {drive.purpose || drive.description || "Community contribution drive"}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      <span>Raised: <strong>₹{collected.toLocaleString("en-IN")}</strong></span>
                      {target > 0 && <span>Goal: ₹{target.toLocaleString("en-IN")}</span>}
                    </div>

                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {drive.targetAudience === "public_open" ? "Open to All" : "Society Residents"}
                      </span>

                      <Link
                        to={`/resident/special-collections`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        <FaHandHoldingHeart className="text-[10px]" /> Contribute
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════ Quick Actions Grid ═══════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Quick Services & Shortcuts
          </h2>
          <span className="text-xs text-slate-400">Essential Resident Tools</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5">
          {isParticipating && (
            <>
              <QuickActionTile to={`${basePath}/bills`} icon={<FaWallet />} label="My Bills" desc="Dues & invoices" color="blue" />
              <QuickActionTile to={`${basePath}/payments`} icon={<FaReceipt />} label="Payments" desc="Receipt archive" color="emerald" />
            </>
          )}
          <QuickActionTile to={`${basePath}/special-collections`} icon={<FaHandHoldingHeart />} label="Special Drives" desc="Festivals & funds" color="pink" />
          <QuickActionTile to={`${basePath}/notices`} icon={<FaBullhorn />} label="Notices" desc="Circulars & alerts" color="purple" />
          <QuickActionTile to={`${basePath}/complaints`} icon={<FaExclamationCircle />} label="Complaints" desc="Report an issue" color="rose" />
          <QuickActionTile to={`${basePath}/suggestions`} icon={<FaLightbulb />} label="Suggestions" desc="Ideas & feedback" color="amber" />
          <QuickActionTile to={`${basePath}/events`} icon={<FaCalendarAlt />} label="Events" desc="Society calendar" color="indigo" />
          <QuickActionTile to={`${basePath}/activities`} icon={<FaLeaf />} label="Activities" desc="Green drives & work" color="green" />
          <QuickActionTile to={`${basePath}/committee`} icon={<FaUserTie />} label="Committee" desc="Office bearers" color="amber" />
          <QuickActionTile to={`${basePath}/support`} icon={<FaQuestionCircle />} label="Help & FAQs" desc="Support guides" color="teal" />
          <QuickActionTile to={`${basePath}/profile`} icon={<FaUser />} label="My Profile" desc="Account settings" color="sky" />
        </div>
      </div>

      {/* ═══════════ Community Hub: 2-Column Grid ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notice Board */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center text-sm">
                  <FaBullhorn />
                </span>
                Official Notices
              </h2>
              <Link to={`${basePath}/notices`} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                View All <FaArrowRight className="text-[9px]" />
              </Link>
            </div>

            {recentNotices.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No active announcements right now.
              </div>
            ) : (
              <div className="space-y-3">
                {recentNotices.map((n) => (
                  <Link
                    key={n.id}
                    to={`${basePath}/notices`}
                    className="block group p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {n.title}
                      </h4>
                      {n.priority === "urgent" && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {n.content || n.description}
                    </p>
                    {n.date && (
                      <span className="text-[10px] text-slate-400 mt-2 block">
                        Published: {n.date}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
            <Link to={`${basePath}/notices`} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
              Read all circulars <FaChevronRight className="text-[9px]" />
            </Link>
          </div>
        </div>

        {/* Upcoming Society Events */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-sm">
                  <FaCalendarAlt />
                </span>
                Upcoming Society Events
              </h2>
              <Link to={`${basePath}/events`} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                View All <FaArrowRight className="text-[9px]" />
              </Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No upcoming events scheduled.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60"
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex flex-col items-center justify-center text-center shrink-0 border border-indigo-100 dark:border-indigo-900/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider">EVENT</span>
                      <FaCalendarAlt className="text-sm" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {e.title}
                      </h4>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                        {e.date || e.eventDate} {e.time && `• ${e.time}`}
                      </p>
                      {e.location && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          📍 {e.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
            <Link to={`${basePath}/events`} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
              Check society calendar <FaChevronRight className="text-[9px]" />
            </Link>
          </div>
        </div>

        {/* My Complaints */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center text-sm">
                  <FaExclamationCircle />
                </span>
                My Tickets & Grievances
              </h2>
              <Link to={`${basePath}/complaints`} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                View All <FaArrowRight className="text-[9px]" />
              </Link>
            </div>

            {myComplaints.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <p>No complaints submitted.</p>
                <Link
                  to={`${basePath}/complaints`}
                  className="mt-2 inline-block text-xs font-bold text-rose-600 hover:underline"
                >
                  Raise a ticket if you need assistance +
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myComplaints.map((c) => {
                  const status = (c.status || "pending").toLowerCase();
                  const badgeColor =
                    status === "resolved"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                      : status === "in_progress"
                      ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300";

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {c.title || c.subject}
                        </h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {c.category || "General"} • {c.createdAt ? String(c.createdAt).slice(0, 10) : "Recent"}
                        </p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${badgeColor}`}>
                        {status.replace("_", " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
            <Link to={`${basePath}/complaints`} className="text-xs font-semibold text-rose-600 hover:underline inline-flex items-center gap-1">
              Submit new complaint +
            </Link>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-sm">
                  <FaLeaf />
                </span>
                Society Activities & Drives
              </h2>
              <Link to={`${basePath}/activities`} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                View All <FaArrowRight className="text-[9px]" />
              </Link>
            </div>

            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No recent activities posted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {a.category || "Activity"}
                      </span>
                      {a.date && <span className="text-xs text-slate-400">{a.date}</span>}
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {a.title}
                    </h4>
                    {a.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {a.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-right">
            <Link to={`${basePath}/activities`} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
              Explore past activities <FaChevronRight className="text-[9px]" />
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════ RWA Committee Section ═══════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-base">
                <FaUserTie />
              </span>
              RWA Executive Committee
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Leadership and office bearers of D BLOCK RWA INDRAPRASTHA
            </p>
          </div>
          <Link
            to={`${basePath}/committee`}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 transition"
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
                member.designation === "President"
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200"
                  : member.designation === "Vice President"
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200"
                  : member.designation === "General Secretary"
                  ? "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200"
                  : member.designation === "Treasurer"
                  ? "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-300 border-violet-200"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200";

              return (
                <div
                  key={member.id || member.uid}
                  className="bg-slate-50/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 transition duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      {member.profilePhotoUrl ? (
                        <img
                          src={member.profilePhotoUrl}
                          alt={member.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                          {member.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase() || "RWA"}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {member.name}
                        </h3>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${desigColor}`}>
                          {member.designation}
                        </span>
                        {(member.flat || member.block) && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate flex items-center gap-1">
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

                  <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                    {member.phone ? (
                      <a
                        href={`tel:${member.phone}`}
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 flex items-center gap-1.5 truncate"
                      >
                        <FaPhone className="text-[10px] text-emerald-600" />
                        <span>{member.phone}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No direct phone</span>
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
      </div>

      {/* ═══════════ Join GC Request Modal ═══════════ */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-emerald-700 dark:text-emerald-400">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
                  <FaRecycle />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                    Request Doorstep Waste Service
                  </h3>
                  <p className="text-xs text-slate-400">Society door-to-door garbage collection</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Message to Society Admin
                </label>
                <textarea
                  value={joinReason}
                  onChange={(e) => setJoinReason(e.target.value)}
                  rows={4}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm text-slate-900 dark:text-white leading-relaxed"
                  placeholder="Reason / message for joining..."
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Standard enrollment message is filled above. You can customize it or send directly.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition text-slate-600 dark:text-slate-300"
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

function QuickActionTile({ to, icon, label, desc, color }) {
  const colorStyles = {
    blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 hover:border-blue-300",
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-300",
    purple: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/50 hover:border-purple-300",
    rose: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/50 hover:border-rose-300",
    indigo: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-300",
    green: "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/50 hover:border-green-300",
    sky: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/50 hover:border-sky-300",
    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50 hover:border-amber-300",
    teal: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-100 dark:border-teal-900/50 hover:border-teal-300",
    pink: "bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border-pink-100 dark:border-pink-900/50 hover:border-pink-300",
  };

  const style = colorStyles[color] || colorStyles.blue;

  return (
    <Link
      to={to}
      className={`group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${style}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl sm:text-2xl transition-transform group-hover:scale-110">
          {icon}
        </span>
        <FaChevronRight className="text-[9px] text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
      </div>

      <div>
        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
          {label}
        </h4>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {desc}
        </p>
      </div>
    </Link>
  );
}

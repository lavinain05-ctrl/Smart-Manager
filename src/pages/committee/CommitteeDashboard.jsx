import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaUser,
  FaBell,
  FaCalendarAlt,
  FaExclamationCircle,
  FaUsers,
  FaPhone,
  FaEnvelope,
  FaClock,
  FaMoneyBillWave,
  FaUserCheck,
  FaIdCard,
  FaReceipt,
  FaShieldAlt,
  FaRecycle,
  FaKey,
  FaTrashAlt,
  FaHandHoldingHeart,
  FaChartBar,
  FaArrowRight,
} from "react-icons/fa";

import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { isRealEmail } from "../../services/authService";

import { useAuth } from "../../context/AuthContext";
import { useNotices } from "../../context/NoticeContext";
import { useEvents } from "../../context/EventContext";
import { useComplaints } from "../../context/ComplaintContext";
import { useCommittee } from "../../context/CommitteeContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import { useGarbage } from "../../context/GarbageContext";
import { useBills } from "../../context/BillContext";
import { getResidentPendingBillingCycles } from "../../utils/billingCycle";
import RecentUpdatesCard from "../../components/notifications/RecentUpdatesCard";

export default function CommitteeDashboard() {
  const { user } = useAuth();
  const { notices } = useNotices();
  const { events } = useEvents();
  const { complaints } = useComplaints();
  const { committee } = useCommittee();
  const { payments = [] } = usePayments();
  const { residents = [] } = useResidents();
  const { garbageBills = [] } = useGarbage();
  const { bills = [] } = useBills();

  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(user?.permissions || {});

  const isAdmin = user?.role === "admin";
  const effectivePermissions = useMemo(() => {
    if (isAdmin) {
      return {
        canManageResidents: true,
        canManageCollectors: true,
        canManageRegistrations: true,
        canManageProfileRequests: true,
        canManageAccountRecovery: true,
        canCollectGarbage: true,
        canCollectSpecial: true,
        canViewGarbageReports: true,
      };
    }
    return {
      ...(permissions || {}),
      ...(user?.permissions || {}),
      canCollectGarbage: Boolean(
        permissions?.canCollectGarbage ||
        user?.permissions?.canCollectGarbage ||
        user?.canCollectGarbage
      ),
      canCollectSpecial: Boolean(
        permissions?.canCollectSpecial ||
        user?.permissions?.canCollectSpecial ||
        user?.canCollectSpecial
      ),
      canViewGarbageReports: Boolean(
        permissions?.canViewGarbageReports ||
        user?.permissions?.canViewGarbageReports ||
        user?.canViewGarbageReports
      ),
    };
  }, [isAdmin, permissions, user]);

  // Fetch committee profile doc & listen for real-time permissions
  useEffect(() => {
    if (!user?.uid) return;
    async function fetchProfile() {
      try {
        const profileDoc = await getDoc(doc(db, "committee", user.uid));
        if (profileDoc.exists()) {
          setProfile({ id: profileDoc.id, ...profileDoc.data() });
        } else {
          const userPhone = String(user?.phone || user?.mobile || "").replace(/\D/g, "").slice(-10);
          const matched = committee.find((c) => {
            const cPhone = String(c.phone || c.mobile || "").replace(/\D/g, "").slice(-10);
            return (userPhone && cPhone === userPhone) || (user?.email && c.email?.toLowerCase() === user.email.toLowerCase());
          });
          if (matched) {
            setProfile(matched);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchProfile();

    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.permissions) setPermissions(d.permissions);
      }
    });

    return () => unsubUser();
  }, [user?.uid, committee]);

  const hasAnyPower = Object.values(effectivePermissions).some(Boolean);

  const recentNotices = notices.slice(0, 3);
  const upcomingEvents = events
    .filter((e) => e.date && new Date(e.date) >= new Date(new Date().toDateString()))
    .slice(0, 3);
  const pendingComplaints = complaints.filter((c) => c.status === "Pending" || c.status === "In Progress");

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }

  // ══════════════════════════════════════════════════════
  // Personal Flat Garbage Resolution for Committee Member
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

  const myPersonalPayments = useMemo(() => {
    return payments.filter((p) => {
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
      return false;
    });
  }, [payments, canonicalResidentId, user, canonicalResident, cleanPhone]);

  const currentMonthName = useMemo(() => new Date().toLocaleString("default", { month: "long" }), []);
  const currentYearNum = useMemo(() => new Date().getFullYear(), []);

  const pendingBilling = useMemo(() => {
    return getResidentPendingBillingCycles({
      resident: canonicalResident,
      payments: myPersonalPayments,
      bills,
      garbageBills,
      monthlyCharge: canonicalResident?.charge || 80,
    });
  }, [canonicalResident, myPersonalPayments, bills, garbageBills]);

  const isCurrentMonthPaid = pendingBilling.isAllPaid;
  const dueAmount = pendingBilling.totalDueAmount;
  const dueMonthsLabel = pendingBilling.monthsLabel || `${currentMonthName} ${currentYearNum}`;
  const monthlyCharge = canonicalResident?.charge || 80;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ─── Premium Committee Profile Hero Banner ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800/80">
        {/* Ambient Decorative Glows */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar with Glow Ring */}
            <div className="relative shrink-0">
              {profile?.profilePhotoUrl ? (
                <img
                  src={profile.profilePhotoUrl}
                  alt={user?.name || "Profile"}
                  className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl object-cover border-2 border-indigo-400/40 shadow-xl"
                  onError={(e) => { e.target.style.display = "none"; e.target.nextSibling && (e.target.nextSibling.style.display = "flex"); }}
                />
              ) : null}
              <div
                className={`w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center text-3xl font-extrabold text-white border-2 border-indigo-400/40 shadow-xl ${
                  profile?.profilePhotoUrl ? "hidden" : "flex"
                }`}
              >
                {user?.name?.charAt(0) || "C"}
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-slate-900 rounded-full flex items-center justify-center text-[10px] text-white shadow-sm" title="Active Official">
                ✓
              </span>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  🏛️ Executive Committee
                </span>
                {profile?.tenure && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-slate-300 flex items-center gap-1 border border-white/10">
                    <FaClock className="text-[9px]" /> {profile.tenure}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {user?.name || "Committee Member"}
              </h1>

              <p className="text-xs sm:text-sm font-semibold text-indigo-300 flex items-center gap-2">
                <span>{user?.designation || "Executive Member"}</span>
                {canonicalResident?.flat && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-300 font-medium">Flat {canonicalResident.flat}</span>
                  </>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
                {isRealEmail(user?.email || profile?.email) && (
                  <span className="flex items-center gap-1.5 truncate max-w-xs">
                    <FaEnvelope className="text-indigo-400 shrink-0 text-[11px]" />
                    <span className="truncate">{user?.email || profile?.email}</span>
                  </span>
                )}
                {user?.phone && (
                  <span className="flex items-center gap-1.5">
                    <FaPhone className="text-emerald-400 shrink-0 text-[11px]" />
                    <span>+91 {user.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0">
            <Link
              to="/committee/garbage"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 text-xs font-bold transition flex items-center justify-center gap-2 backdrop-blur-xs active:scale-98"
            >
              <FaRecycle />
              <span>Garbage Services</span>
            </Link>
          </div>
        </div>

        {/* Delegated Powers Chips */}
        {hasAnyPower && (
          <div className="relative z-10 mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
              <FaShieldAlt className="text-amber-400" /> Active Delegated Powers:
            </span>
            {effectivePermissions.canManageResidents && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                👥 Residents
              </span>
            )}
            {effectivePermissions.canManageCollectors && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                👤 Collectors
              </span>
            )}
            {effectivePermissions.canManageRegistrations && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                📋 Registrations
              </span>
            )}
            {effectivePermissions.canManageProfileRequests && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                📝 Profiles
              </span>
            )}
            {effectivePermissions.canManageAccountRecovery && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                🔑 Recovery
              </span>
            )}
            {effectivePermissions.canCollectGarbage && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ♻️ GC Collector
              </span>
            )}
            {effectivePermissions.canCollectSpecial && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                🎁 Special {effectivePermissions.specialCollectionScope === "specific" ? `(${effectivePermissions.allowedSpecialCollections?.length || 0} Assigned)` : "Collector"}
              </span>
            )}
            {effectivePermissions.canViewGarbageReports && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                📊 Society Reports
              </span>
            )}
          </div>
        )}

        {profile?.introduction && (
          <div className="relative z-10 mt-4 pt-3 border-t border-slate-800/80">
            <p className="text-xs text-slate-300 leading-relaxed italic">"{profile.introduction}"</p>
          </div>
        )}
      </div>

      {/* ─── My Flat Garbage Collection Status Banner ─── */}
      <div className={`rounded-3xl p-5 sm:p-6 border shadow-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isCurrentMonthPaid
          ? "bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
          : "bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30 border-amber-200 dark:border-amber-800/60"
      }`}>
        <div className="flex items-start sm:items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-md ${
            isCurrentMonthPaid
              ? "bg-emerald-600 text-white shadow-emerald-600/20"
              : "bg-amber-500 text-white shadow-amber-500/20"
          }`}>
            <FaRecycle />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isCurrentMonthPaid
                  ? "bg-emerald-200 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                  : pendingBilling.isCurrentCycleOverdue
                  ? "bg-rose-200 dark:bg-rose-900/60 text-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-700"
                  : pendingBilling.hasOverdue
                  ? "bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                  : "bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700"
              }`}>
                {isCurrentMonthPaid
                  ? "✅ Garbage Fee Paid"
                  : pendingBilling.isCurrentCycleOverdue
                  ? "⚠️ Garbage Fee Overdue"
                  : pendingBilling.hasOverdue
                  ? "⚠️ Sep Overdue • Oct Due"
                  : "🔔 Garbage Fee Due"}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isCurrentMonthPaid ? `${currentMonthName} ${currentYearNum}` : dueMonthsLabel}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                • Flat {canonicalResident?.flat || user?.flat || "—"}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
              {isCurrentMonthPaid
                ? `Doorstep garbage collection fee for ${currentMonthName} ${currentYearNum} is paid.`
                : `Doorstep garbage collection fee for ${dueMonthsLabel} is pending (₹${dueAmount}).`}
            </p>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isCurrentMonthPaid
                ? "Your flat's daily doorstep pickup is active. Official receipt is available."
                : "Give or record your flat's monthly collection payment now to keep service active."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Link
            to="/committee/garbage"
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs ${
              isCurrentMonthPaid
                ? "bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
            }`}
          >
            <FaRecycle className="text-xs" />
            <span>{isCurrentMonthPaid ? "View Service & Receipts" : `Pay ₹${dueAmount} Now`}</span>
            <FaArrowRight className="text-[10px]" />
          </Link>
        </div>
      </div>



      {/* ─── Delegated Administrative Workspaces ─── */}
      {hasAnyPower && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 transition-colors">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FaShieldAlt className="text-indigo-600 dark:text-indigo-400" />
              Delegated Administrative Workspaces
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Access society management tools granted to your committee profile by the administrator
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {permissions.canManageResidents && (
              <Link
                to="/committee/residents"
                className="p-4 rounded-2xl border border-purple-200 dark:border-purple-800/50 bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-purple-950 dark:text-purple-200 flex items-center gap-2">
                    <FaUsers className="text-purple-600 dark:text-purple-400" /> Society Residents
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">Manage society residents, flats, and records</p>
                </div>
                <FaArrowRight className="text-purple-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {permissions.canManageCollectors && (
              <Link
                to="/committee/collectors"
                className="p-4 rounded-2xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-blue-950 dark:text-blue-200 flex items-center gap-2">
                    <FaIdCard className="text-blue-600 dark:text-blue-400" /> Field Collectors
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Manage collector accounts and status</p>
                </div>
                <FaArrowRight className="text-blue-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {permissions.canManageRegistrations && (
              <Link
                to="/committee/registrations"
                className="p-4 rounded-2xl border border-pink-200 dark:border-pink-800/50 bg-pink-50/40 dark:bg-pink-950/20 hover:bg-pink-50 dark:hover:bg-pink-950/30 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-pink-950 dark:text-pink-200 flex items-center gap-2">
                    <FaUserCheck className="text-pink-600 dark:text-pink-400" /> Registrations
                  </p>
                  <p className="text-xs text-pink-700 dark:text-pink-400 mt-1">Review and approve new resident signups</p>
                </div>
                <FaArrowRight className="text-pink-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {permissions.canManageProfileRequests && (
              <Link
                to="/committee/profile-requests"
                className="p-4 rounded-2xl border border-cyan-200 dark:border-cyan-800/50 bg-cyan-50/40 dark:bg-cyan-950/20 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-cyan-950 dark:text-cyan-200 flex items-center gap-2">
                    <FaUser className="text-cyan-600 dark:text-cyan-400" /> Profile Requests
                  </p>
                  <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-1">Verify resident info change requests</p>
                </div>
                <FaArrowRight className="text-cyan-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {permissions.canManageAccountRecovery && (
              <Link
                to="/committee/account-recovery"
                className="p-4 rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-rose-950 dark:text-rose-200 flex items-center gap-2">
                    <FaKey className="text-rose-600 dark:text-rose-400" /> Account Recovery
                  </p>
                  <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">Assist residents with logins & resets</p>
                </div>
                <FaArrowRight className="text-rose-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {effectivePermissions.canCollectGarbage && (
              <Link
                to="/committee/collect-garbage"
                className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                    <FaTrashAlt className="text-emerald-600 dark:text-emerald-400" /> GC Collection
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    Collect monthly society garbage fees and issue official receipts
                  </p>
                </div>
                <FaArrowRight className="text-emerald-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {effectivePermissions.canCollectSpecial && (
              <Link
                to="/committee/collect-special"
                className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                    <FaHandHoldingHeart className="text-indigo-600 dark:text-indigo-400" /> Special Collection
                  </p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                    Collect festival drives, events, and special campaign contributions
                  </p>
                </div>
                <FaArrowRight className="text-indigo-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {effectivePermissions.canViewGarbageReports && (
              <Link
                to="/committee/garbage"
                className="p-4 rounded-2xl border border-teal-200 dark:border-teal-800/50 bg-teal-50/40 dark:bg-teal-950/20 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-teal-950 dark:text-teal-200 flex items-center gap-2">
                    <FaChartBar className="text-teal-600 dark:text-teal-400" /> Society Analytics
                  </p>
                  <p className="text-xs text-teal-700 dark:text-teal-400 mt-1">Macro collection analytics & defaulters report</p>
                </div>
                <FaArrowRight className="text-teal-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

          </div>
        </div>
      )}

      {/* ─── Mandatory Notifications & Recent Society Updates ─── */}
      <RecentUpdatesCard />

      {/* ─── Key Metrics Grid ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm p-5 border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-indigo-500 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-lg">
              <FaBell />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{notices.length}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Notices</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm p-5 border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-emerald-500 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-lg">
              <FaCalendarAlt />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{upcomingEvents.length}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Upcoming Events</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm p-5 border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-amber-500 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/50 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 text-lg">
              <FaExclamationCircle />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{pendingComplaints.length}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Complaints</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm p-5 border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-purple-500 transition-colors">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-purple-50 dark:bg-purple-950/50 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 text-lg">
              <FaUsers />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{committee.length}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Committee Members</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Two Column: Notices & Events ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Notices */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 sm:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FaBell className="text-indigo-600 dark:text-indigo-400" /> Recent Notices
            </h2>
            <Link to="/committee/notices" className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
              View All
            </Link>
          </div>
          {recentNotices.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">No notices posted yet.</p>
          ) : (
            <div className="space-y-2.5">
              {recentNotices.map((notice) => (
                <div key={notice.id} className="flex items-start justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{notice.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {notice.category} · {formatDate(notice.createdAt)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                    notice.priority === "Urgent" ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800" :
                    notice.priority === "High" ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800" :
                    "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                  }`}>
                    {notice.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 sm:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FaCalendarAlt className="text-emerald-600 dark:text-emerald-400" /> Upcoming Events
            </h2>
            <Link to="/committee/events" className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
              View All
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">No upcoming events scheduled.</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{event.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {event.category} · {new Date(event.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      {event.time ? ` at ${event.time}` : ""}
                    </p>
                  </div>
                  {event.venue && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
                      📍 {event.venue}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Committee Members Directory Preview ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 sm:p-6 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FaUsers className="text-purple-600 dark:text-purple-400" /> Executive Committee Directory
          </h2>
          <Link to="/committee/directory" className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline">
            Full Directory
          </Link>
        </div>
        {committee.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">No committee members added yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {committee.map((member) => (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-3.5 rounded-2xl transition border ${
                  member.id === user?.uid
                    ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 ring-1 ring-indigo-400/20"
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800"
                }`}
              >
              {(() => {
                const photo = member.profilePhotoUrl || (
                  (member.designation === "President" || member.name?.toLowerCase().includes("dharmendra"))
                    ? "/committee/president.jpg"
                    : (member.designation === "Vice President" || member.name?.toLowerCase().includes("ankit"))
                    ? "/committee/ankit-chaudhary.png"
                    : (member.designation === "Secretary" || member.designation?.toLowerCase() === "secretary" || member.name?.toLowerCase().includes("janardan") || member.name?.toLowerCase().includes("janardhan"))
                    ? "/committee/secretary.jpg"
                    : (member.designation === "Treasurer" || member.designation?.toLowerCase() === "treasurer" || member.name?.toLowerCase().includes("sandeep") || member.name?.toLowerCase().includes("gaur"))
                    ? "/committee/treasurer.jpg"
                    : (member.designation === "Vice Treasurer" || member.name?.toLowerCase().includes("vinod"))
                    ? "/committee/vinod-kumar.jpg"
                    : (member.designation === "Spokesperson" || member.name?.toLowerCase().includes("narendra") || member.name?.toLowerCase().includes("dhama"))
                    ? "/committee/narendra-dhama.png"
                    : (member.designation === "Advisor" || member.name?.toLowerCase().includes("dinesh"))
                    ? "/committee/dinesh-kumar.png"
                    : (member.designation === "Vice Secretary" || member.name?.toLowerCase().includes("manoj") || member.name?.toLowerCase().includes("tomar"))
                    ? "/committee/manoj-tomar.jpg"
                    : (member.name?.toLowerCase().includes("pandey") || member.name?.toLowerCase().includes("d k") || member.name?.toLowerCase().includes("dk"))
                    ? "/committee/dk-pandey.jpg"
                    : null
                );
                return (
                  <>
                    {photo ? (
                      <img
                        src={photo}
                        alt={member.name}
                        className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                        onError={(e) => { e.target.style.display = "none"; e.target.nextSibling && (e.target.nextSibling.style.display = "flex"); }}
                      />
                    ) : null}
                    <div
                      className={`w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center text-white font-bold shrink-0 ${
                        photo ? "hidden" : "flex"
                      }`}
                    >
                      {member.name?.charAt(0) || "?"}
                    </div>
                  </>
                );
              })()}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {member.name}
                    {member.id === user?.uid && (
                      <span className="text-indigo-600 dark:text-indigo-400 text-xs ml-1 font-extrabold">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.designation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import {
  FaPlus,
  FaSearch,
  FaKey,
  FaCopy,
  FaTimes,
  FaCheckCircle,
  FaUser,
  FaExternalLinkAlt,
  FaBan,
  FaUnlock,
  FaClock,
  FaCalendarDay,
  FaCalendarAlt,
  FaCalendarCheck,
  FaChartLine,
  FaGlobe,
  FaBolt,
  FaHistory,
  FaSyncAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";

import AddCollectorDrawer from "../../components/forms/AddCollectorDrawer";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import CollectorStatsCards from "../../components/collectors/CollectorStatsCards";
import CollectorPerformanceTable from "../../components/collectors/CollectorPerformanceTable";
import CollectorDetailDrawer from "../../components/collectors/CollectorDetailDrawer";

import { useCollectors } from "../../context/CollectorContext";
import { useCommittee } from "../../context/CommitteeContext";
import { usePayments } from "../../context/PaymentContext";
import { useBilling } from "../../context/BillingContext";
import { useAuth } from "../../context/AuthContext";
import { deleteUserAccount } from "../../services/accountDeletionService";
import { adminResetPasswordFn, db } from "../../firebase/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  subscribeAllSpecialPayments,
  subscribeSpecialCollections,
} from "../../services/specialCollectionService";
import { blockAccount, unblockAccount } from "../../services/blockService";
import {
  matchesCollector,
  parseDateSafe,
  getLocalTodayYMD,
  getLocalTodayEN,
  isPaymentOnDate,
  isPaymentInMonthYear,
  isPaymentInYear,
  isValidConfirmedSpecialPayment,
  isPaymentInCustomDate,
  MONTH_NAMES,
} from "../../utils/collectorHelper";

export default function Collectors() {
  const {
    collectors,
    addCollector,
    updateCollector,
    deleteCollector,
  } = useCollectors();

  const { committee = [] } = useCommittee();
  const { payments } = usePayments();
  const { selectedMonth, selectedYear } = useBilling();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [collectionScope, setCollectionScope] = useState("all"); // "all" | "garbage" | "special"
  const [openDrawer, setOpenDrawer] = useState(false);
  const [editingCollector, setEditingCollector] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [viewCollector, setViewCollector] = useState(null);

  // Special Collections Data
  const [specialPayments, setSpecialPayments] = useState([]);
  const [specialCampaigns, setSpecialCampaigns] = useState([]);

  useEffect(() => {
    const unsubPay = subscribeAllSpecialPayments((list) => {
      setSpecialPayments(list);
    });
    const unsubCol = subscribeSpecialCollections((list) => {
      setSpecialCampaigns(list);
    });
    return () => {
      unsubPay();
      unsubCol();
    };
  }, []);

  // Reset password state
  const [resetTarget, setResetTarget] = useState(null);
  const [customPassword, setCustomPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState("");
  const [copied, setCopied] = useState(false);

  function handleOpenResetPassword(collector) {
    setResetTarget(collector);
    setCustomPassword("");
    setTempPasswordResult("");
    setCopied(false);
  }

  // Block / Suspend Collector State
  const [blockTarget, setBlockTarget] = useState(null);
  const [blockModalType, setBlockModalType] = useState("temporary");
  const [blockModalDays, setBlockModalDays] = useState(3);
  const [blockModalReason, setBlockModalReason] = useState("Disciplinary / Audit Review");
  const [blockModalDetails, setBlockModalDetails] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);

  function handleOpenBlock(collector) {
    setBlockTarget(collector);
    setBlockModalType("temporary");
    setBlockModalDays(3);
    setBlockModalReason("Disciplinary / Audit Review");
    setBlockModalDetails("");
  }

  async function handleConfirmBlockCollector(e) {
    e.preventDefault();
    if (!blockTarget) return;

    if (!blockTarget.mobile) {
      toast.error("Collector has no registered mobile number to enforce block");
      return;
    }

    setBlockLoading(true);
    try {
      if (blockTarget.isBlocked || blockTarget.status?.toLowerCase() === "blocked") {
        await unblockAccount(blockTarget.mobile, user);
        toast.success(`Access restored for ${blockTarget.name}`);
      } else {
        let blockedUntil = null;
        if (blockModalType === "temporary") {
          const d = new Date();
          d.setDate(d.getDate() + Number(blockModalDays));
          blockedUntil = d;
        }

        const fullReason = blockModalDetails
          ? `${blockModalReason}: ${blockModalDetails}`
          : blockModalReason;

        await blockAccount({
          mobile: blockTarget.mobile,
          userId: blockTarget.id || blockTarget.uid,
          name: blockTarget.name,
          role: "collector",
          blockType: blockModalType,
          blockedUntil,
          reason: fullReason,
          adminUser: user,
        });

        toast.success(
          `Successfully ${blockModalType === "temporary" ? "suspended" : "blocked"} ${blockTarget.name}`
        );
      }
      setBlockTarget(null);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update block status");
    } finally {
      setBlockLoading(false);
    }
  }

  async function handleConfirmResetPassword(e) {
    e.preventDefault();
    if (!resetTarget) return;

    if (customPassword && customPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      setResetLoading(true);
      const chosenPassword =
        customPassword ||
        "RWA@" + Math.floor(100000 + Math.random() * 900000);

      // 1. Try Cloud Function
      try {
        const result = await adminResetPasswordFn({
          targetUid: resetTarget.id,
          password: chosenPassword,
        });
        if (result?.data?.tempPassword) {
          setTempPasswordResult(result.data.tempPassword);
          toast.success("Password reset successfully!");
          return;
        }
      } catch (fnErr) {
        console.warn("Cloud function reset:", fnErr.message);
      }

      // 2. Mark mustChangePassword flag on user document
      try {
        await updateDoc(doc(db, "users", resetTarget.id), {
          mustChangePassword: true,
          tempPasswordSetAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "collectors", resetTarget.id), {
          mustChangePassword: true,
        });
      } catch (docErr) {
        console.warn("User doc update:", docErr.message);
      }

      setTempPasswordResult(chosenPassword);
      toast.success("Password reset registered! Please share with collector.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  }

  // ─── Multi-Timeframe Collection States & Synchronization ───
  const [periodType, setPeriodType] = useState("today"); // "today" | "monthly" | "yearly" | "all_time" | "custom"
  const [activeMonth, setActiveMonth] = useState(selectedMonth || "September");
  const [activeYear, setActiveYear] = useState(Number(selectedYear) || 2026);

  // Custom Date States (Single Date or Date Range)
  const [customDateMode, setCustomDateMode] = useState("single"); // "single" | "range"
  const [customSingleDate, setCustomSingleDate] = useState(getLocalTodayYMD());
  const [customFromDate, setCustomFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const dy = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${dy}`;
  });
  const [customToDate, setCustomToDate] = useState(getLocalTodayYMD());

  useEffect(() => {
    if (selectedMonth) setActiveMonth(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedYear) setActiveYear(Number(selectedYear));
  }, [selectedYear]);

  const todayYMD = getLocalTodayYMD();
  const todayEN = getLocalTodayEN();

  // 1. TODAY'S COLLECTION (Garbage + Special)
  const gcTodayPayments = useMemo(() => {
    return (payments || []).filter((p) => isPaymentOnDate(p, todayYMD));
  }, [payments, todayYMD]);

  const scTodayPayments = useMemo(() => {
    return (specialPayments || []).filter(
      (p) => isValidConfirmedSpecialPayment(p) && isPaymentOnDate(p, todayYMD)
    );
  }, [specialPayments, todayYMD]);

  const todayGcTotal = useMemo(
    () => gcTodayPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [gcTodayPayments]
  );
  const todayScTotal = useMemo(
    () => scTodayPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [scTodayPayments]
  );
  const todayAllTotal = todayGcTotal + todayScTotal;

  // 2. CUSTOM DATE COLLECTION (Single Date or Date Range)
  const gcCustomPayments = useMemo(() => {
    return (payments || []).filter((p) =>
      isPaymentInCustomDate(p, customDateMode, customSingleDate, customFromDate, customToDate)
    );
  }, [payments, customDateMode, customSingleDate, customFromDate, customToDate]);

  const scCustomPayments = useMemo(() => {
    return (specialPayments || []).filter(
      (p) =>
        isValidConfirmedSpecialPayment(p) &&
        isPaymentInCustomDate(p, customDateMode, customSingleDate, customFromDate, customToDate)
    );
  }, [specialPayments, customDateMode, customSingleDate, customFromDate, customToDate]);

  const customGcTotal = useMemo(
    () => gcCustomPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [gcCustomPayments]
  );
  const customScTotal = useMemo(
    () => scCustomPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [scCustomPayments]
  );
  const customAllTotal = customGcTotal + customScTotal;

  // 3. MONTHLY COLLECTION (Garbage + Special)
  const gcMonthlyPayments = useMemo(() => {
    return (payments || []).filter((p) =>
      isPaymentInMonthYear(p, activeMonth, activeYear)
    );
  }, [payments, activeMonth, activeYear]);

  const scMonthlyPayments = useMemo(() => {
    return (specialPayments || []).filter(
      (p) =>
        isValidConfirmedSpecialPayment(p) &&
        isPaymentInMonthYear(p, activeMonth, activeYear)
    );
  }, [specialPayments, activeMonth, activeYear]);

  const monthlyGcTotal = useMemo(
    () => gcMonthlyPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [gcMonthlyPayments]
  );
  const monthlyScTotal = useMemo(
    () => scMonthlyPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [scMonthlyPayments]
  );
  const monthlyAllTotal = monthlyGcTotal + monthlyScTotal;

  // 4. YEARLY COLLECTION (Garbage + Special)
  const gcYearlyPayments = useMemo(() => {
    return (payments || []).filter((p) => isPaymentInYear(p, activeYear));
  }, [payments, activeYear]);

  const scYearlyPayments = useMemo(() => {
    return (specialPayments || []).filter(
      (p) => isValidConfirmedSpecialPayment(p) && isPaymentInYear(p, activeYear)
    );
  }, [specialPayments, activeYear]);

  const yearlyGcTotal = useMemo(
    () => gcYearlyPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [gcYearlyPayments]
  );
  const yearlyScTotal = useMemo(
    () => scYearlyPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [scYearlyPayments]
  );
  const yearlyAllTotal = yearlyGcTotal + yearlyScTotal;

  // 5. TOTAL COLLECTION (All-Time Grand Total across Entire Project)
  const gcAllPayments = useMemo(() => payments || [], [payments]);
  const scAllPayments = useMemo(
    () => (specialPayments || []).filter(isValidConfirmedSpecialPayment),
    [specialPayments]
  );

  const allTimeGcTotal = useMemo(
    () => gcAllPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [gcAllPayments]
  );
  const allTimeScTotal = useMemo(
    () => scAllPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [scAllPayments]
  );
  const allTimeAllTotal = allTimeGcTotal + allTimeScTotal;

  // ─── Active Period Data Routing ───
  const {
    activeGcPayments,
    activeScPayments,
    periodLabel,
    periodBadge,
  } = useMemo(() => {
    switch (periodType) {
      case "custom": {
        if (customDateMode === "range") {
          const fromParts = customFromDate ? customFromDate.split("-") : [];
          const toParts = customToDate ? customToDate.split("-") : [];
          const fStr = fromParts.length === 3 ? `${fromParts[2]}/${fromParts[1]}/${fromParts[0]}` : customFromDate;
          const tStr = toParts.length === 3 ? `${toParts[2]}/${toParts[1]}/${toParts[0]}` : customToDate;
          return {
            activeGcPayments: gcCustomPayments,
            activeScPayments: scCustomPayments,
            periodLabel: `${fStr} - ${tStr}`,
            periodBadge: `Custom Range (${fStr} to ${tStr})`,
          };
        } else {
          const parts = customSingleDate ? customSingleDate.split("-") : [];
          const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : customSingleDate;
          return {
            activeGcPayments: gcCustomPayments,
            activeScPayments: scCustomPayments,
            periodLabel: `${formatted}`,
            periodBadge: `Custom Date (${formatted})`,
          };
        }
      }
      case "monthly":
        return {
          activeGcPayments: gcMonthlyPayments,
          activeScPayments: scMonthlyPayments,
          periodLabel: `${activeMonth} ${activeYear}`,
          periodBadge: `Monthly (${activeMonth} ${activeYear})`,
        };
      case "yearly":
        return {
          activeGcPayments: gcYearlyPayments,
          activeScPayments: scYearlyPayments,
          periodLabel: `Year ${activeYear}`,
          periodBadge: `Yearly (${activeYear})`,
        };
      case "all_time":
        return {
          activeGcPayments: gcAllPayments,
          activeScPayments: scAllPayments,
          periodLabel: "All-Time",
          periodBadge: "Total Collection (All-Time Project)",
        };
      case "today":
      default:
        return {
          activeGcPayments: gcTodayPayments,
          activeScPayments: scTodayPayments,
          periodLabel: `Today (${todayEN})`,
          periodBadge: "Today's Collection",
        };
    }
  }, [
    periodType,
    customDateMode,
    customSingleDate,
    customFromDate,
    customToDate,
    activeMonth,
    activeYear,
    todayEN,
    gcTodayPayments,
    scTodayPayments,
    gcCustomPayments,
    scCustomPayments,
    gcMonthlyPayments,
    scMonthlyPayments,
    gcYearlyPayments,
    scYearlyPayments,
    gcAllPayments,
    scAllPayments,
  ]);

  const activePeriodGc = useMemo(
    () => activeGcPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [activeGcPayments]
  );
  const activePeriodSc = useMemo(
    () => activeScPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [activeScPayments]
  );
  const activePeriodAll = activePeriodGc + activePeriodSc;

  // Available years list
  const availableYears = useMemo(() => {
    const years = new Set();
    const curYear = new Date().getFullYear();
    years.add(curYear);
    years.add(curYear - 1);
    years.add(curYear - 2);
    years.add(curYear + 1);
    (payments || []).forEach((p) => {
      if (p.year) years.add(Number(p.year));
      const d = parseDateSafe(p.paymentDate);
      if (d) years.add(d.getFullYear());
    });
    (specialPayments || []).forEach((p) => {
      const d = parseDateSafe(p.paymentDate);
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [payments, specialPayments]);

  async function handleSave(data) {
    if (editingCollector) {
      return await updateCollector(editingCollector.id, data);
    }
    return await addCollector(data);
  }

  // Combine regular collectors and committee members who collect payments
  const allCollectors = useMemo(() => {
    const list = [...collectors];
    const existingIds = new Set(list.map((c) => c.id || c.uid));
    const existingNames = new Set(list.map((c) => (c.name || "").trim().toLowerCase()));

    // 0. Check if there are any Admin / Direct Office collections in either Garbage or Special
    const hasAdminGc = (payments || []).some((p) => matchesCollector(p, { id: "admin_office", isAdmin: true }));
    const hasAdminSc = (specialPayments || []).some((p) => matchesCollector(p, { id: "admin_office", isAdmin: true }));

    if (hasAdminGc || hasAdminSc) {
      list.push({
        id: "admin_office",
        uid: "admin_office",
        name: "Society Admin / Direct Office",
        mobile: "Admin Portal",
        email: "office@society.rwa",
        area: "RWA Central Office",
        status: "Active",
        isCommittee: false,
        isAdmin: true,
        designation: "Central Office / Admin Payments",
        role: "admin",
        assignedModules: ["garbage", "special_collections"],
      });
      existingIds.add("admin_office");
      existingNames.add("society admin / direct office");
      existingNames.add("admin");
    }

    // 1. Add authorized committee members or committee members with collected payments
    (committee || []).forEach((m) => {
      const mid = m.id || m.uid;
      const mname = (m.name || "").trim();
      const mnameLower = mname.toLowerCase();

      if (existingIds.has(mid) || (mnameLower && existingNames.has(mnameLower))) {
        return;
      }

      const hasPerm = Boolean(
        m.permissions?.canCollectGarbage ||
        m.permissions?.canCollectSpecial ||
        m.canCollectGarbage ||
        m.canCollectSpecial
      );

      const hasPayments = (payments || []).some((p) => matchesCollector(p, { id: mid, uid: mid, name: mname })) ||
        (specialPayments || []).some((p) => matchesCollector(p, { id: mid, uid: mid, name: mname }));

      if (hasPerm || hasPayments) {
        list.push({
          id: mid,
          uid: mid,
          name: mname,
          mobile: m.mobile || m.phone || "-",
          email: m.email || "",
          area: m.designation || "Committee Member",
          status: m.status || "Active",
          isCommittee: true,
          designation: m.designation || "Executive Member",
          role: "committee",
          assignedModules: [
            ...(m.permissions?.canCollectGarbage !== false ? ["garbage"] : []),
            ...(m.permissions?.canCollectSpecial ? ["special_collections"] : []),
          ],
        });
        existingIds.add(mid);
        if (mnameLower) existingNames.add(mnameLower);
      }
    });

    // 2. Add any collector present in payments (e.g. legacy/direct)
    (payments || []).forEach((p) => {
      const pName = (p.collectorName || p.collector || "").trim();
      const pCleanName = pName.replace(/\s*\([^)]*\)/g, "").trim();
      const pNameLower = pCleanName.toLowerCase();
      const pId = p.collectorId || p.collector;

      if (!pName || pName === "General / Admin" || pName === "Admin") return;

      if (!existingIds.has(pId) && !existingNames.has(pNameLower)) {
        const isComm = p.collectorRole === "committee" || p.collector?.includes("(");
        list.push({
          id: pId,
          uid: pId,
          name: pCleanName,
          mobile: "-",
          email: "",
          area: p.collectorDesignation || (isComm ? "Committee Member" : "Field Collector"),
          status: "Active",
          isCommittee: isComm,
          designation: p.collectorDesignation || (isComm ? "Executive Member" : ""),
          role: p.collectorRole || "collector",
          assignedModules: ["garbage"],
        });
        existingIds.add(pId);
        existingNames.add(pNameLower);
      }
    });

    return list;
  }, [collectors, committee, payments, specialPayments]);

  function handleEdit(collector) {
    if (collector.isCommittee) {
      toast("To edit committee member details, please use Manage Committee.", { icon: "ℹ️" });
      return;
    }
    setEditingCollector(collector);
    setOpenDrawer(true);
  }

  function handleDelete(id) {
    const target = allCollectors.find((c) => c.id === id);
    if (target?.isCommittee) {
      toast.error("Committee members cannot be deleted from Collectors. Manage them in Committee tab.");
      return;
    }
    setDeleteId(id);
    setOpenDeleteDialog(true);
  }

  async function confirmDelete() {
    const collector = collectors.find((c) => c.id === deleteId);
    try {
      // First delete account via deleteUserAccount (cleans authLookup, Firebase Auth, archive)
      const results = await deleteUserAccount({
        userId: deleteId,
        userName: collector?.name || "Unknown",
        userEmail: collector?.email || "",
        userPhone: collector?.mobile || "",
        userRole: "collector",
        userFlat: "",
        userBlock: "",
        deletionReason: "Collector removed by admin",
        adminName: user?.name || "Admin",
        adminUid: user?.uid || "",
      });

      // Then ensure context/Firestore doc is cleaned up
      await deleteCollector(deleteId);

      if (results.authDeleted) {
        toast.success("Collector permanently deleted — registered phone & login details removed from Firebase");
      } else {
        toast.success("Collector removed successfully");
      }
    } catch (error) {
      console.error("Collector deletion error:", error);
      toast.error("Failed to delete collector");
    }
    setDeleteId(null);
    setOpenDeleteDialog(false);
  }


  const filteredCollectors = allCollectors.filter((collector) => {
    const value = search.toLowerCase();
    return (
      collector.name.toLowerCase().includes(value) ||
      (collector.mobile || "").includes(value) ||
      (collector.area || "").toLowerCase().includes(value) ||
      (collector.designation || "").toLowerCase().includes(value)
    );
  });

  return (
    <>
      <div className="space-y-6">

        {/* Header with Scope Switcher */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-black text-gray-800 tracking-tight">
                Collector Management
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide border shadow-sm ${
                collectionScope === "all"
                  ? "bg-blue-50 text-blue-800 border-blue-200"
                  : collectionScope === "garbage"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-indigo-50 text-indigo-800 border-indigo-200"
              }`}>
                {collectionScope === "all"
                  ? "🌐 ALL COLLECTIONS (GARBAGE + SPECIAL)"
                  : collectionScope === "garbage"
                  ? "🗑️ GARBAGE COLLECTION OVERALL DATA"
                  : "💝 SPECIAL COLLECTIONS & FUNDS"}
              </span>
            </div>
            <p className="text-gray-500 mt-1 font-medium">
              Performance Dashboard • <span className="font-bold text-gray-700">{periodBadge}</span> • Synchronized Project Data
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Scope Switcher: All | Garbage | Special */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
              <button
                type="button"
                onClick={() => setCollectionScope("all")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  collectionScope === "all"
                    ? "bg-white text-gray-900 shadow-md font-extrabold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                title="View combined Garbage & Special Collections"
              >
                <span>🌐 All Collections</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-bold">
                  ₹{activePeriodAll.toLocaleString()}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCollectionScope("garbage")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  collectionScope === "garbage"
                    ? "bg-emerald-600 text-white shadow-md font-extrabold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                title="View Garbage Collection Overall Data"
              >
                <span>🗑️ Garbage Only</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  collectionScope === "garbage" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                }`}>
                  ₹{activePeriodGc.toLocaleString()}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCollectionScope("special")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  collectionScope === "special"
                    ? "bg-indigo-600 text-white shadow-md font-extrabold"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                title="View Special Collections & Relief Funds"
              >
                <span>💝 Special Only</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  collectionScope === "special" ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-800"
                }`}>
                  ₹{activePeriodSc.toLocaleString()}
                </span>
              </button>
            </div>

            <button
              onClick={() => {
                setEditingCollector(null);
                setOpenDrawer(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-emerald-500/30 transition active:scale-95"
            >
              <FaPlus />
              Add Collector
            </button>
          </div>
        </div>

        {/* ─── Redesigned Unified Timeframe & Filter Bar (Non-repetitive, Modern & Clean) ─── */}
        <div className="bg-white rounded-3xl border border-gray-200/90 p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Segmented Timeframe Switcher */}
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                <FaClock className="text-emerald-600" />
                <span>Select Timeframe:</span>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-100/90 p-1.5 rounded-2xl border border-gray-200/80 shadow-inner flex-wrap">
                {[
                  { id: "today", label: "Today", icon: FaBolt },
                  { id: "monthly", label: "Monthly", icon: FaCalendarAlt },
                  { id: "yearly", label: "Yearly", icon: FaChartLine },
                  { id: "all_time", label: "All-Time Total", icon: FaGlobe },
                  { id: "custom", label: "Custom Date", icon: FaCalendarDay },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = periodType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPeriodType(tab.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                        isActive
                          ? "bg-white text-gray-900 shadow-md ring-1 ring-black/5 scale-[1.02]"
                          : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                      }`}
                    >
                      <Icon className={isActive ? "text-emerald-600 text-sm" : "text-gray-400 text-sm"} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Synchronization Status & Active Badge */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="text-xs text-gray-600 font-semibold flex items-center gap-2 bg-emerald-50/80 px-3.5 py-2 rounded-xl border border-emerald-200/70 shadow-sm">
                <FaSyncAlt className="text-emerald-600 text-xs" />
                <span>
                  Synchronized: <b className="text-emerald-800">{activeGcPayments.length}</b> GC •{" "}
                  <b className="text-emerald-800">{activeScPayments.length}</b> SC
                </span>
              </div>
              <div className="px-3.5 py-2 rounded-xl text-xs font-black bg-gray-900 text-white shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{periodBadge}</span>
              </div>
            </div>
          </div>

          {/* Contextual Selector Controls for Active Timeframe */}
          <div className="pt-3 border-t border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 flex-wrap">
            {periodType === "today" && (
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <span className="text-gray-400">Current Day Collections:</span>
                <span className="px-3 py-1 bg-emerald-100/70 text-emerald-800 rounded-lg font-black border border-emerald-200">
                  📅 Today ({todayEN})
                </span>
              </div>
            )}

            {periodType === "monthly" && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-bold text-gray-600">Select Month & Year:</span>
                <select
                  value={activeMonth}
                  onChange={(e) => setActiveMonth(e.target.value)}
                  className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-500 shadow-sm cursor-pointer"
                >
                  {MONTH_NAMES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={activeYear}
                  onChange={(e) => setActiveYear(Number(e.target.value))}
                  className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-bold text-purple-900 outline-none focus:ring-2 focus:ring-purple-500 shadow-sm cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodType === "yearly" && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-bold text-gray-600">Select Financial / Calendar Year:</span>
                <select
                  value={activeYear}
                  onChange={(e) => setActiveYear(Number(e.target.value))}
                  className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-900 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodType === "all_time" && (
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <span className="text-gray-400">Total Project Scope:</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-lg font-black border border-gray-200">
                  🌐 Complete Society Records (All-Time Lifetime Project History)
                </span>
              </div>
            )}

            {periodType === "custom" && (
              <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto">
                {/* Custom Mode Toggle: Single Date vs Date Range */}
                <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setCustomDateMode("single")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      customDateMode === "single"
                        ? "bg-white text-blue-700 shadow font-extrabold"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Single Date
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomDateMode("range")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      customDateMode === "range"
                        ? "bg-white text-blue-700 shadow font-extrabold"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Date Range
                  </button>
                </div>

                {customDateMode === "single" ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-600">Pick Date:</span>
                    <input
                      type="date"
                      value={customSingleDate}
                      onChange={(e) => setCustomSingleDate(e.target.value)}
                      className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomSingleDate(todayYMD)}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 transition"
                    >
                      Today
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-600">From:</span>
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      className="bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-600">To:</span>
                    <input
                      type="date"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(e.target.value)}
                      className="bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        const yr = d.getFullYear();
                        const mo = String(d.getMonth() + 1).padStart(2, "0");
                        const dy = String(d.getDate()).padStart(2, "0");
                        setCustomFromDate(`${yr}-${mo}-${dy}`);
                        setCustomToDate(todayYMD);
                      }}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 transition"
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        const yr = d.getFullYear();
                        const mo = String(d.getMonth() + 1).padStart(2, "0");
                        setCustomFromDate(`${yr}-${mo}-01`);
                        setCustomToDate(todayYMD);
                      }}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 transition"
                    >
                      This Month
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <CollectorStatsCards
          payments={activeGcPayments}
          specialPayments={activeScPayments}
          collectors={allCollectors}
          collectionScope={collectionScope}
          periodType={periodType}
          periodLabel={periodLabel}
        />

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="relative">
            <FaSearch className="absolute left-4 top-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Name, Mobile or Area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-xl pl-12 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Performance Table */}
        <CollectorPerformanceTable
          collectors={filteredCollectors}
          payments={activeGcPayments}
          allPayments={payments}
          specialPayments={activeScPayments}
          allSpecialPayments={specialPayments}
          todayGcPayments={periodType === "custom" ? gcCustomPayments : gcTodayPayments}
          todayScPayments={periodType === "custom" ? scCustomPayments : scTodayPayments}
          collectionScope={collectionScope}
          periodType={periodType}
          periodLabel={periodLabel}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={(c) => setViewCollector(c)}
          onResetPassword={handleOpenResetPassword}
          onBlock={handleOpenBlock}
        />

      </div>

      {/* Detail Drawer */}
      <CollectorDetailDrawer
        open={!!viewCollector}
        collector={viewCollector}
        payments={payments}
        monthlyPayments={gcMonthlyPayments}
        specialPayments={specialPayments}
        specialCampaigns={specialCampaigns}
        onClose={() => setViewCollector(null)}
      />

      {/* Add/Edit Drawer */}
      <AddCollectorDrawer
        open={openDrawer}
        collector={editingCollector}
        onClose={() => {
          setOpenDrawer(false);
          setEditingCollector(null);
        }}
        onSave={handleSave}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={openDeleteDialog}
        title="Delete Collector"
        message="Are you sure you want to delete this collector? Their login will stop working immediately."
        onCancel={() => {
          setDeleteId(null);
          setOpenDeleteDialog(false);
        }}
        onConfirm={confirmDelete}
      />

      {/* Direct Reset Password Dialog */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-amber-50">
              <h2 className="text-xl font-bold text-amber-700 flex items-center gap-2">
                <FaKey /> Reset Collector Password
              </h2>
              <button
                onClick={() => {
                  setResetTarget(null);
                  setTempPasswordResult("");
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-amber-100 transition"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Collector Summary */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                  <FaUser />
                </div>
                <div>
                  <p className="font-bold text-gray-800">{resetTarget.name}</p>
                  <p className="text-sm text-gray-500">
                    Mobile: <span className="font-mono font-semibold text-gray-700">{resetTarget.mobile}</span> • Area: {resetTarget.area || "—"}
                  </p>
                </div>
              </div>

              {tempPasswordResult ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                    <FaCheckCircle className="text-green-600 text-xl mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-green-800">Temporary Password Ready</p>
                      <p className="text-xs text-green-700 mt-1">
                        Share this temporary password with <strong>{resetTarget.name}</strong>. When they log in with their mobile number and this password, they will be prompted to set their own permanent password.
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-100 border rounded-xl p-4 text-center">
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider block mb-1">
                      Temporary Password
                    </span>
                    <div className="flex items-center justify-center gap-3 mt-1">
                      <span className="text-2xl font-mono font-bold text-gray-900 tracking-wider select-all">
                        {tempPasswordResult}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(tempPasswordResult);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <FaCopy /> {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {/* Spark plan helper */}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1.5 text-left">
                    <p className="font-semibold text-blue-900">💡 Firebase Spark Plan Note:</p>
                    <p>
                      If Cloud Functions are not active on your Firebase plan, you can also paste this temporary password directly in Firebase Auth:
                    </p>
                    <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-blue-200 font-mono text-xs text-gray-700">
                      <span>Auth Email: {resetTarget.mobile}@smart-manager-aad4d.firebaseapp.com</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${resetTarget.mobile}@smart-manager-aad4d.firebaseapp.com`);
                          toast.success("Auth email copied!");
                        }}
                        className="text-blue-600 hover:underline font-bold text-[11px] ml-2"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="pt-0.5">
                      <a
                        href="https://console.firebase.google.com/project/smart-manager-aad4d/authentication/users"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold underline"
                      >
                        Open Firebase Console Users <FaExternalLinkAlt className="text-[10px]" />
                      </a>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        setResetTarget(null);
                        setTempPasswordResult("");
                      }}
                      className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl font-semibold transition text-sm"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-gray-700">
                      Temporary Password <span className="text-gray-400 font-normal">(Leave blank to auto-generate)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 123456 or leave blank for random code"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-amber-500 outline-none text-sm font-mono"
                      minLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      Minimum 6 characters. The collector will be forced to change this upon their next login.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setResetTarget(null)}
                      className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold transition text-sm flex items-center gap-2 shadow-sm"
                    >
                      <FaKey />
                      {resetLoading ? "Resetting..." : "Confirm & Reset Password"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Block / Suspend Collector Modal */}
      {blockTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                  blockTarget.isBlocked || blockTarget.status?.toLowerCase() === "blocked"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-600"
                }`}>
                  {blockTarget.isBlocked || blockTarget.status?.toLowerCase() === "blocked" ? <FaUnlock /> : <FaBan />}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">
                    {blockTarget.isBlocked || blockTarget.status?.toLowerCase() === "blocked"
                      ? "Restore Collector Access"
                      : "Block or Suspend Collector"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {blockTarget.name} • {blockTarget.mobile || "No Mobile"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setBlockTarget(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <FaTimes />
              </button>
            </div>

            {blockTarget.isBlocked || blockTarget.status?.toLowerCase() === "blocked" ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  This collector is currently blocked. Restoring access will allow them to log into the collector portal immediately.
                </p>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBlockTarget(null)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBlockCollector}
                    disabled={blockLoading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <FaUnlock /> {blockLoading ? "Restoring..." : "Restore Collector Access"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmBlockCollector} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1.5">
                    Suspension Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBlockModalType("temporary")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        blockModalType === "temporary"
                          ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                          : "bg-white border-gray-200 text-gray-600"
                      }`}
                    >
                      <FaClock /> Temporary
                    </button>

                    <button
                      type="button"
                      onClick={() => setBlockModalType("permanent")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        blockModalType === "permanent"
                          ? "bg-red-50 border-red-300 text-red-800 shadow-sm"
                          : "bg-white border-gray-200 text-gray-600"
                      }`}
                    >
                      <FaBan /> Permanent
                    </button>
                  </div>
                </div>

                {blockModalType === "temporary" && (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                    <label className="text-xs font-bold text-amber-900 block">
                      Choose Duration:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "24h", days: 1 },
                        { label: "3 Days", days: 3 },
                        { label: "7 Days", days: 7 },
                        { label: "15 Days", days: 15 },
                      ].map((opt) => (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => setBlockModalDays(opt.days)}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                            blockModalDays === opt.days
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-white text-slate-700 border-amber-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1.5">
                    Reason
                  </label>
                  <select
                    value={blockModalReason}
                    onChange={(e) => setBlockModalReason(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    <option value="Disciplinary / Audit Review">Disciplinary / Audit Review</option>
                    <option value="Misconduct / Irregularities">Misconduct / Irregularities</option>
                    <option value="Suspicious Activity Detected">Suspicious Activity Detected</option>
                    <option value="Temporary Leave of Duty">Temporary Leave of Duty</option>
                    <option value="Other / Investigation">Other / Investigation</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1.5">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={blockModalDetails}
                    onChange={(e) => setBlockModalDetails(e.target.value)}
                    placeholder="Enter context or internal notes..."
                    className="w-full border rounded-xl p-2 text-xs focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setBlockTarget(null)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={blockLoading}
                    className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm ${
                      blockModalType === "temporary"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    <FaBan />
                    {blockLoading
                      ? "Applying..."
                      : blockModalType === "temporary"
                      ? `Suspend for ${blockModalDays} Days`
                      : "Permanently Block"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
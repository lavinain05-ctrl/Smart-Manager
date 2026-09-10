import { useState, useEffect, useMemo } from "react";
import {
  FaHistory,
  FaSearch,
  FaFilter,
  FaUser,
  FaClock,
  FaShieldAlt,
  FaSignInAlt,
  FaLaptop,
  FaMobileAlt,
  FaTabletAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaFileDownload,
  FaUserTie,
  FaMoneyBillWave,
  FaRecycle,
  FaUserPlus,
  FaExclamationTriangle,
  FaSync,
  FaTimes,
  FaEye,
  FaReceipt,
  FaChevronRight,
  FaDesktop,
} from "react-icons/fa";

import {
  subscribeActivityLogs,
  LOG_CATEGORIES,
} from "../../services/activityLogService";
import {
  subscribeLoginHistory,
  ensureActiveSessionLogged,
} from "../../services/loginTrackerService";
import PortalScreenInspectorModal from "../../components/common/PortalScreenInspectorModal";
import { useAuth } from "../../context/AuthContext";
import { usePayments } from "../../context/PaymentContext";
import { useCollectors } from "../../context/CollectorContext";
import { useResidents } from "../../context/ResidentContext";
import { subscribeAllSpecialPayments } from "../../services/specialCollectionService";
import toast from "react-hot-toast";

function resolveDate(timestamp, clientTimestamp) {
  if (timestamp?.toDate) {
    const d = timestamp.toDate();
    if (!isNaN(d.getTime())) return d;
  }
  if (clientTimestamp) {
    const d = new Date(clientTimestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (timestamp) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function formatDate(timestamp, clientTimestamp) {
  const date = resolveDate(timestamp, clientTimestamp);
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(timestamp, clientTimestamp) {
  const date = resolveDate(timestamp, clientTimestamp);
  if (!date) return "Active recently";
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);

  if (diffSeconds < 60) return "Just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function isToday(timestamp, clientTimestamp) {
  const date = resolveDate(timestamp, clientTimestamp);
  if (!date) return false;
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function getPortalBadge(portal = "") {
  const p = (portal || "").toLowerCase();
  if (p.includes("admin")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (p.includes("collector")) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (p.includes("resident")) {
    return "bg-indigo-100 text-indigo-800 border-indigo-200";
  }
  if (p.includes("committee")) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (p.includes("guard") || p.includes("security")) {
    return "bg-purple-100 text-purple-800 border-purple-200";
  }
  return "bg-slate-100 text-slate-800 border-slate-200";
}

function getDeviceIcon(device = "") {
  const d = (device || "").toLowerCase();
  if (d === "mobile") return <FaMobileAlt className="text-blue-500" />;
  if (d === "tablet") return <FaTabletAlt className="text-purple-500" />;
  return <FaLaptop className="text-emerald-500" />;
}

export function formatIdentifier(val) {
  if (!val) return "—";
  let str = String(val).trim();
  // Strip synthetic Firebase auth email domain so only clean 10-digit mobile shows
  if (str.includes("@smart-manager-aad4d.firebaseapp.com")) {
    return str.replace(/@smart-manager-aad4d\.firebaseapp\.com$/i, "");
  }
  if (/^(\d{10})@[^.]+\.firebaseapp\.com$/i.test(str)) {
    return str.replace(/@[^.]+\.firebaseapp\.com$/i, "");
  }
  return str;
}

export default function ActivityLogs() {
  const [activeTab, setActiveTab] = useState("logins"); // "logins" | "updates" | "userWork"
  const [logs, setLogs] = useState([]);
  const [logins, setLogins] = useState([]);
  const [specialPayments, setSpecialPayments] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPortal, setFilterPortal] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFilter, setDateFilter] = useState("all"); // "today" | "7d" | "30d" | "all"
  const [selectedUserDrilldown, setSelectedUserDrilldown] = useState(null);
  const [selectedLoginSession, setSelectedLoginSession] = useState(null);
  const [loginModalTab, setLoginModalTab] = useState("all"); // "all" | "session"
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorTargetUser, setInspectorTargetUser] = useState(null);

  const { user } = useAuth();
  const { payments = [] } = usePayments();
  const { collectors = [] } = useCollectors();
  const { residents = [] } = useResidents();

  // Ensure currently active user (e.g. Admin) session is recorded in portalLogins
  useEffect(() => {
    if (user) {
      ensureActiveSessionLogged(user);
    }
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setLogs([]);
      setLogins([]);
      return;
    }

    const unsubLogs = subscribeActivityLogs(setLogs, 300);
    const unsubLogins = subscribeLoginHistory(setLogins, 300);
    const unsubSpecial = subscribeAllSpecialPayments((list) => {
      setSpecialPayments(list || []);
    });

    return () => {
      unsubLogs();
      unsubLogins();
      unsubSpecial();
    };
  }, [user]);

  // Date filtering predicate
  const matchesDate = (timestamp, clientTimestamp) => {
    if (dateFilter === "all") return true;
    const date = resolveDate(timestamp, clientTimestamp);
    if (!date) return false;
    const now = new Date();

    if (dateFilter === "today") {
      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }
    if (dateFilter === "7d") {
      const diffMs = now - date;
      return diffMs <= 7 * 24 * 60 * 60 * 1000;
    }
    if (dateFilter === "30d") {
      const diffMs = now - date;
      return diffMs <= 30 * 24 * 60 * 60 * 1000;
    }
    return true;
  };
  // Filtered Logins
  const filteredLogins = useMemo(() => {
    return logins.filter((item) => {
      // Exclude automated test check docs
      if (item.name === "Test Check" || item.test === true) return false;

      if (!matchesDate(item.createdAt, item.clientTimestamp)) return false;
      if (filterPortal !== "all" && item.portal !== filterPortal) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;

      if (search) {
        const s = search.toLowerCase();
        const cleanId = formatIdentifier(item.identifier).toLowerCase();
        return (
          item.name?.toLowerCase().includes(s) ||
          cleanId.includes(s) ||
          item.identifier?.toLowerCase().includes(s) ||
          item.portal?.toLowerCase().includes(s) ||
          item.browser?.toLowerCase().includes(s) ||
          item.os?.toLowerCase().includes(s) ||
          item.device?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [logins, search, filterPortal, filterStatus, dateFilter]);

  // Filtered Activity Updates
  const filteredUpdates = useMemo(() => {
    return logs.filter((log) => {
      if (!matchesDate(log.createdAt, log.clientTimestamp)) return false;
      if (filterCategory !== "all" && log.category !== filterCategory) return false;
      if (filterPortal !== "all" && log.portal !== filterPortal) return false;

      if (search) {
        const s = search.toLowerCase();
        return (
          log.action?.toLowerCase().includes(s) ||
          log.performedByName?.toLowerCase().includes(s) ||
          log.targetName?.toLowerCase().includes(s) ||
          log.details?.toLowerCase().includes(s) ||
          log.category?.toLowerCase().includes(s) ||
          log.portal?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [logs, search, filterCategory, filterPortal, dateFilter]);

  // Work done by individual users (comprehensively aggregated across collectors, payments, residents, and audit logs)
  const userWorkSummary = useMemo(() => {
    const map = {};

    // 1. Seed with all enrolled Collectors from society database
    (collectors || []).forEach((c) => {
      const key = (c.id || c.uid || c.name || "").toLowerCase();
      if (!key) return;
      map[key] = {
        uid: c.id || c.uid || "",
        name: c.name || "Collector",
        role: "collector",
        portal: "Collector Portal",
        mobile: c.mobile || "",
        area: c.area || "",
        status: c.status || "Active",
        totalActions: 0,
        collectionsCount: 0,
        totalAmountCollected: 0,
        residentsCreated: 0,
        lastActive: null,
        actions: [],
      };
    });

    // Helper to find or create a user entry in map
    const getOrCreateUser = (id, name, role, portal) => {
      const key = (id || name || "unknown").toLowerCase();
      if (!map[key]) {
        map[key] = {
          uid: id || "",
          name: name || "Staff Member",
          role: role || "admin",
          portal: portal || "Admin Portal",
          mobile: "",
          area: "",
          status: "Active",
          totalActions: 0,
          collectionsCount: 0,
          totalAmountCollected: 0,
          residentsCreated: 0,
          lastActive: null,
          actions: [],
        };
      }
      return map[key];
    };

    // 2. Aggregate Garbage Collection Payments
    (payments || []).forEach((p) => {
      let collectorKey = (p.collectorId || p.collector || "").toLowerCase();
      let userObj = null;

      if (collectorKey && map[collectorKey]) {
        userObj = map[collectorKey];
      } else if (p.collector) {
        const matchByName = Object.values(map).find(
          (u) => u.name.trim().toLowerCase() === p.collector.trim().toLowerCase()
        );
        if (matchByName) {
          userObj = matchByName;
        } else {
          userObj = getOrCreateUser(
            p.collectorId,
            p.collector,
            p.collector?.toLowerCase().includes("admin") ? "admin" : "collector",
            p.collector?.toLowerCase().includes("admin") ? "Admin Portal" : "Collector Portal"
          );
        }
      }

      if (userObj) {
        userObj.collectionsCount += 1;
        userObj.totalAmountCollected += Number(p.amount || 0);
        userObj.totalActions += 1;

        const pDate = p.createdAt || p.paymentDate;
        if (!userObj.lastActive || (pDate && new Date(pDate) > new Date(userObj.lastActive))) {
          userObj.lastActive = pDate;
        }

        userObj.actions.push({
          id: p.id,
          action: `Collected Payment ₹${Number(p.amount || 0).toLocaleString()} (${p.paymentMethod || "Cash"})`,
          category: "payment",
          targetName: `${p.residentName || "Resident"} (Flat: ${p.flat || "—"})`,
          details: `Receipt: ${p.receiptNumber || "—"} • Month: ${p.month || ""} ${p.year || ""}`,
          createdAt: p.createdAt || p.paymentDate,
          clientTimestamp: p.createdAtClient || p.paymentDate,
        });
      }
    });

    // 3. Aggregate Special Collection Payments
    (specialPayments || []).forEach((sp) => {
      let colName = sp.collectorName || sp.collector || "";
      let colId = sp.collectorId || "";
      let userObj = null;

      const colKey = (colId || colName).toLowerCase();
      if (colKey && map[colKey]) {
        userObj = map[colKey];
      } else if (colName) {
        const matchByName = Object.values(map).find(
          (u) => u.name.trim().toLowerCase() === colName.trim().toLowerCase()
        );
        if (matchByName) userObj = matchByName;
      }

      if (userObj) {
        userObj.collectionsCount += 1;
        userObj.totalAmountCollected += Number(sp.amount || 0);
        userObj.totalActions += 1;

        const spDate = sp.createdAt || sp.paymentDate;
        if (!userObj.lastActive || (spDate && new Date(spDate) > new Date(userObj.lastActive))) {
          userObj.lastActive = spDate;
        }

        userObj.actions.push({
          id: sp.id,
          action: `Collected Special Campaign ₹${Number(sp.amount || 0).toLocaleString()} (${sp.paymentMethod || "UPI"})`,
          category: "special",
          targetName: `${sp.residentName || "Donor"} (${sp.campaignTitle || "Campaign"})`,
          details: `Receipt: ${sp.receiptNumber || "—"} • Campaign: ${sp.campaignTitle || "Special"}`,
          createdAt: sp.createdAt || sp.paymentDate,
        });
      }
    });

    // 4. Aggregate Residents Added by Collector / Staff
    (residents || []).forEach((r) => {
      const addedBy = r.addedBy || "";
      const addedByRole = (r.addedByRole || "").toLowerCase();
      const colId = r.collectorId || "";

      let userObj = null;
      if (colId && map[colId.toLowerCase()]) {
        userObj = map[colId.toLowerCase()];
      } else if (addedBy) {
        const matchByName = Object.values(map).find(
          (u) => u.name.trim().toLowerCase() === addedBy.trim().toLowerCase()
        );
        if (matchByName) {
          userObj = matchByName;
        } else if (addedByRole === "collector" || addedByRole === "admin") {
          userObj = getOrCreateUser(
            "",
            addedBy,
            addedByRole,
            addedByRole === "collector" ? "Collector Portal" : "Admin Portal"
          );
        }
      }

      if (userObj) {
        userObj.residentsCreated += 1;
        userObj.totalActions += 1;
        if (!userObj.lastActive || (r.createdAt && new Date(r.createdAt) > new Date(userObj.lastActive))) {
          userObj.lastActive = r.createdAt;
        }

        userObj.actions.push({
          id: r.id,
          action: `Added Resident: ${r.owner || r.name || "Resident"}`,
          category: "resident",
          targetName: `Flat: ${r.flat || "—"} (${r.block || ""})`,
          details: `Mobile: ${r.mobile || "—"} • Added via ${userObj.role === "collector" ? "Collector Portal" : "Admin Portal"}`,
          createdAt: r.createdAt,
        });
      }
    });

    // 5. Aggregate System Logs from activityLogs
    (logs || []).forEach((log) => {
      const perfName = log.performedByName || "";
      const perfId = log.performedBy || "";
      const perfRole = (log.performedByRole || "admin").toLowerCase();
      const perfPortal = log.portal || "Admin Portal";

      let userObj = null;
      if (perfId && map[perfId.toLowerCase()]) {
        userObj = map[perfId.toLowerCase()];
      } else if (perfName) {
        const matchByName = Object.values(map).find(
          (u) => u.name.trim().toLowerCase() === perfName.trim().toLowerCase()
        );
        if (matchByName) {
          userObj = matchByName;
        } else {
          userObj = getOrCreateUser(perfId, perfName, perfRole, perfPortal);
        }
      }

      if (userObj) {
        const isDuplicatePayment =
          log.category === "payment" &&
          userObj.actions.some((a) => a.action === log.action);

        if (!isDuplicatePayment) {
          userObj.totalActions += 1;
          userObj.actions.push(log);
        }

        if (!userObj.lastActive || (log.createdAt && new Date(log.createdAt) > new Date(userObj.lastActive))) {
          userObj.lastActive = log.createdAt;
        }
      }
    });

    // 6. Sort each user's actions descending by timestamp
    const list = Object.values(map);
    list.forEach((u) => {
      u.actions.sort((a, b) => {
        const timeA = a.createdAt?.toDate
          ? a.createdAt.toDate().getTime()
          : a.clientTimestamp
          ? new Date(a.clientTimestamp).getTime()
          : a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0;
        const timeB = b.createdAt?.toDate
          ? b.createdAt.toDate().getTime()
          : b.clientTimestamp
          ? new Date(b.clientTimestamp).getTime()
          : b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0;
        return timeB - timeA;
      });

      if (!u.lastActive && u.actions.length > 0) {
        u.lastActive = u.actions[0].createdAt;
      }
    });

    // Filter by search if applied
    if (search) {
      const s = search.toLowerCase();
      return list.filter(
        (u) =>
          u.name.toLowerCase().includes(s) ||
          u.role.toLowerCase().includes(s) ||
          u.portal.toLowerCase().includes(s) ||
          u.area?.toLowerCase().includes(s) ||
          u.mobile?.includes(s)
      );
    }

    // Sort users: active users with collections/actions first, then by totalActions
    return list.sort((a, b) => {
      if (b.totalActions !== a.totalActions) {
        return b.totalActions - a.totalActions;
      }
      return (b.totalAmountCollected || 0) - (a.totalAmountCollected || 0);
    });
  }, [collectors, payments, specialPayments, residents, logs, search]);

  // Connect selected login session directly to all operations & work completed by that user
  const selectedLoginUserWork = useMemo(() => {
    if (!selectedLoginSession) return null;
    const login = selectedLoginSession;
    const cleanId = formatIdentifier(login.identifier);

    // 1. Try matching against userWorkSummary
    let matched = userWorkSummary.find((u) => {
      if (login.uid && u.uid && u.uid === login.uid) return true;
      if (cleanId && u.mobile && String(u.mobile).includes(cleanId)) return true;
      if (login.name && u.name && u.name !== "User" && u.name.trim().toLowerCase() === login.name.trim().toLowerCase()) return true;
      return false;
    });

    if (matched && (matched.actions.length > 0 || matched.collectionsCount > 0)) {
      return matched;
    }

    // 2. Direct lookup across payments, specialCollections, residents, and logs
    const userPayments = (payments || []).filter((p) => {
      if (login.uid && (p.collectorId === login.uid || p.userId === login.uid)) return true;
      if (login.name && p.collector && p.collector.trim().toLowerCase() === login.name.trim().toLowerCase()) return true;
      return false;
    });

    const userSpecial = (specialPayments || []).filter((sp) => {
      if (login.uid && sp.collectorId === login.uid) return true;
      if (login.name && sp.collectorName && sp.collectorName.trim().toLowerCase() === login.name.trim().toLowerCase()) return true;
      return false;
    });

    const userResidents = (residents || []).filter((r) => {
      if (login.uid && (r.collectorId === login.uid || r.addedById === login.uid)) return true;
      if (login.name && r.addedBy && r.addedBy.trim().toLowerCase() === login.name.trim().toLowerCase()) return true;
      return false;
    });

    const userLogs = (logs || []).filter((l) => {
      if (login.uid && l.performedBy === login.uid) return true;
      if (login.name && l.performedByName && l.performedByName.trim().toLowerCase() === login.name.trim().toLowerCase()) return true;
      return false;
    });

    const totalCollected =
      userPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0) +
      userSpecial.reduce((sum, sp) => sum + Number(sp.amount || 0), 0);

    const combinedActions = [
      ...userPayments.map((p) => ({
        id: p.id,
        action: `Collected Payment ₹${Number(p.amount || 0).toLocaleString()} (${p.paymentMethod || "Cash"})`,
        category: "payment",
        targetName: `${p.residentName || "Resident"} (Flat: ${p.flat || "—"})`,
        details: `Receipt: ${p.receiptNumber || "—"} • Month: ${p.month || ""} ${p.year || ""}`,
        createdAt: p.createdAt || p.paymentDate,
        clientTimestamp: p.createdAtClient || p.paymentDate,
      })),
      ...userSpecial.map((sp) => ({
        id: sp.id,
        action: `Collected Special Campaign ₹${Number(sp.amount || 0).toLocaleString()} (${sp.paymentMethod || "UPI"})`,
        category: "special",
        targetName: `${sp.residentName || "Donor"} (${sp.campaignTitle || "Special"})`,
        details: `Receipt: ${sp.receiptNumber || "—"}`,
        createdAt: sp.createdAt || sp.paymentDate,
      })),
      ...userResidents.map((r) => ({
        id: r.id,
        action: `Added Resident: ${r.owner || r.name || "Resident"}`,
        category: "resident",
        targetName: `Flat: ${r.flat || "—"} (${r.block || ""})`,
        details: `Mobile: ${r.mobile || "—"}`,
        createdAt: r.createdAt,
      })),
      ...userLogs,
    ];

    return {
      uid: login.uid || (matched ? matched.uid : ""),
      name: login.name || (matched ? matched.name : "User"),
      role: login.role || (matched ? matched.role : "resident"),
      portal: login.portal || (matched ? matched.portal : "User Portal"),
      mobile: cleanId || (matched ? matched.mobile : ""),
      collectionsCount: userPayments.length + userSpecial.length + (matched?.collectionsCount || 0),
      totalAmountCollected: totalCollected + (matched?.totalAmountCollected || 0),
      residentsCreated: userResidents.length + (matched?.residentsCreated || 0),
      totalActions: combinedActions.length || (matched?.totalActions || 0),
      actions: combinedActions.length > 0 ? combinedActions : (matched?.actions || []),
    };
  }, [selectedLoginSession, userWorkSummary, payments, specialPayments, residents, logs]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const todayLogins = logins.filter((l) => isToday(l.createdAt, l.clientTimestamp));
    const adminLogins = todayLogins.filter(
      (l) => (l.portal || "").toLowerCase().includes("admin") || (l.role || "").toLowerCase() === "admin"
    ).length;
    const collectorLogins = todayLogins.filter(
      (l) => (l.portal || "").toLowerCase().includes("collector") || (l.role || "").toLowerCase() === "collector"
    ).length;
    const residentLogins = todayLogins.filter(
      (l) => (l.portal || "").toLowerCase().includes("resident") || (l.role || "").toLowerCase() === "resident"
    ).length;
    const failedLogins = logins.filter((l) => l.status === "failed").length;

    // Unique active users today across logins, payments, and logs
    const uniqueUids = new Set();
    todayLogins.forEach((l) => { if (l.identifier || l.uid) uniqueUids.add(l.identifier || l.uid); });
    logs.filter((l) => isToday(l.createdAt, l.clientTimestamp)).forEach((l) => { if (l.performedByName) uniqueUids.add(l.performedByName); });
    payments.filter((p) => isToday(p.createdAt, p.createdAtClient || p.paymentDate)).forEach((p) => { if (p.collector) uniqueUids.add(p.collector); });

    return {
      totalLoginsToday: todayLogins.length,
      adminLogins,
      collectorLogins,
      residentLogins,
      totalUpdates: logs.length + payments.length,
      activeUsersToday: Math.max(uniqueUids.size, todayLogins.length > 0 ? 1 : 0),
      failedLogins,
    };
  }, [logins, logs, payments]);

  // CSV Export for society audit records
  function exportCSV() {
    try {
      let rows = [];
      let filename = "activity_logs.csv";

      if (activeTab === "logins") {
        filename = "portal_logins.csv";
        rows = filteredLogins.map((l) => ({
          Name: l.name || "User",
          Identifier: l.identifier || "—",
          Portal: l.portal || "—",
          Status: l.status || "—",
          Device: l.device || "—",
          OS: l.os || "—",
          Browser: l.browser || "—",
          Date: formatDate(l.createdAt),
        }));
      } else {
        filename = "system_updates.csv";
        rows = filteredUpdates.map((u) => ({
          PerformedBy: u.performedByName || "System",
          Role: u.performedByRole || "—",
          Portal: u.portal || "—",
          Action: u.action || "—",
          Target: u.targetName || "—",
          Category: u.category || "—",
          Details: u.details || "—",
          Date: formatDate(u.createdAt),
        }));
      }

      if (rows.length === 0) {
        toast.error("No data available to export");
        return;
      }

      const headers = Object.keys(rows[0]).join(",");
      const csvContent = [
        headers,
        ...rows.map((r) =>
          Object.values(r)
            .map((val) => `"${String(val).replace(/"/g, '""')}"`)
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${rows.length} rows to ${filename}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export CSV");
    }
  }

  const categoryKeys = Object.keys(LOG_CATEGORIES);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold flex items-center gap-2.5 text-slate-800">
              <FaHistory className="text-emerald-600" /> Portal Activity & Login Audit
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync
            </span>
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            Monitor real-time login sessions across all portals, system updates & user work audit trail
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border rounded-xl px-3.5 py-2.5 text-sm bg-white shadow-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">📅 All Time</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-slate-700 border px-4 py-2.5 rounded-xl font-semibold transition text-sm shadow-sm"
          >
            <FaFileDownload className="text-slate-500" /> Export CSV
          </button>

          <button
            onClick={() => {
              setInspectorTargetUser(null);
              setIsInspectorOpen(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-4 py-2.5 rounded-xl font-semibold transition text-sm shadow-sm"
            title="Search and inspect the exact live portal screen seen by any resident, collector, or committee member"
          >
            <FaEye /> Inspect Any Portal Screen
          </button>
        </div>
      </div>

      {/* Top Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Logins Today */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Logins Today
              </p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">
                {metrics.totalLoginsToday}
              </h3>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                  {metrics.adminLogins} Admin
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {metrics.collectorLogins} Collector
                </span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                  {metrics.residentLogins} Resident
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 text-xl shrink-0">
              <FaSignInAlt />
            </div>
          </div>
        </div>

        {/* Updates & Actions Logged */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Total Updates & Actions
              </p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">
                {metrics.totalUpdates}
              </h3>
              <p className="text-xs text-gray-400 mt-2">
                Operations audited in society
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-xl shrink-0">
              <FaHistory />
            </div>
          </div>
        </div>

        {/* Active Staff & Users */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Active People Today
              </p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">
                {metrics.activeUsersToday}
              </h3>
              <p className="text-xs text-gray-400 mt-2">
                Staff & residents active
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 text-xl shrink-0">
              <FaUserTie />
            </div>
          </div>
        </div>

        {/* Security / Failed Attempts */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Failed Attempts / Security
              </p>
              <h3 className={`text-2xl font-bold mt-1 ${metrics.failedLogins > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {metrics.failedLogins}
              </h3>
              <p className="text-xs text-gray-400 mt-2">
                {metrics.failedLogins === 0 ? "✅ No security anomalies" : "⚠️ Flagged login attempts"}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
              metrics.failedLogins > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
            }`}>
              <FaShieldAlt />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab("logins")}
          className={`px-5 py-3 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === "logins"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          <FaSignInAlt className={activeTab === "logins" ? "text-emerald-400" : "text-gray-400"} />
          Portal Logins & Sessions ({filteredLogins.length})
        </button>

        <button
          onClick={() => setActiveTab("updates")}
          className={`px-5 py-3 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === "updates"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          <FaHistory className={activeTab === "updates" ? "text-blue-400" : "text-gray-400"} />
          All Updates & Audit Trail ({filteredUpdates.length})
        </button>

        <button
          onClick={() => setActiveTab("userWork")}
          className={`px-5 py-3 rounded-xl font-semibold text-sm transition flex items-center gap-2 ${
            activeTab === "userWork"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          <FaUserTie className={activeTab === "userWork" ? "text-amber-400" : "text-gray-400"} />
          Work Done by User ({userWorkSummary.length})
        </button>
      </div>

      {/* Search & Dynamic Filters Bar */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={
              activeTab === "logins"
                ? "Search by user name, mobile, device, browser, portal..."
                : activeTab === "updates"
                ? "Search by action, performer, flat, resident, category..."
                : "Search by staff name, role, portal..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>

        {/* Portal Filter (Logins & Updates tab) */}
        {(activeTab === "logins" || activeTab === "updates") && (
          <div className="flex items-center gap-2">
            <FaFilter className="text-gray-400 text-sm hidden sm:inline" />
            <select
              value={filterPortal}
              onChange={(e) => setFilterPortal(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium bg-white"
            >
              <option value="all">All Portals</option>
              <option value="Admin Portal">🛡️ Admin Portal</option>
              <option value="Collector Portal">👤 Collector Portal</option>
              <option value="Resident Portal">🏠 Resident Portal</option>
              <option value="Committee Portal">👥 Committee Portal</option>
              <option value="Security Guard Portal">🛡️ Guard Portal</option>
            </select>
          </div>
        )}

        {/* Category Filter (Updates tab only) */}
        {activeTab === "updates" && (
          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium bg-white"
            >
              <option value="all">All Categories</option>
              {categoryKeys.map((key) => (
                <option key={key} value={key}>
                  {LOG_CATEGORIES[key].label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Filter (Logins tab only) */}
        {activeTab === "logins" && (
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="success">✅ Successful Logins</option>
              <option value="failed">❌ Failed Attempts</option>
            </select>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PORTAL LOGINS & SESSIONS                           */}
      {/* ========================================================= */}
      {activeTab === "logins" && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
          {filteredLogins.length === 0 ? (
            <div className="p-16 text-center text-gray-500">
              <FaSignInAlt className="text-6xl text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-700">No Login Sessions Found</h3>
              <p className="text-sm mt-1">Login events across portals will appear here in real-time as users sign in.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead className="bg-slate-50 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <tr>
                    <th className="p-4 text-left">User & Account</th>
                    <th className="p-4 text-left">Portal</th>
                    <th className="p-4 text-left">Device / Platform</th>
                    <th className="p-4 text-left">Login Time</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Work & Details</th>
                    <th className="p-4 text-center">Live Portal Screen</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredLogins.map((item) => {
                    const isSuccess = item.status === "success";

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedLoginSession(item);
                          setLoginModalTab("all");
                        }}
                        className="hover:bg-emerald-50/40 transition cursor-pointer group"
                        title="Click to view full session details & work done by this user"
                      >
                        {/* User info */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition group-hover:scale-105 shadow-sm ${
                              isSuccess ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                            }`}>
                              {item.name ? item.name.charAt(0).toUpperCase() : <FaUser />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 group-hover:text-emerald-700 transition flex items-center gap-1.5">
                                {item.name || "User"}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                                <span>📞 {formatIdentifier(item.identifier)}</span>
                                {item.flat && (
                                  <span className="font-medium text-slate-600">
                                    • Flat: {item.flat}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Portal badge */}
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getPortalBadge(item.portal)}`}>
                            {item.portal || "Portal"}
                          </span>
                        </td>

                        {/* Device / OS info */}
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{getDeviceIcon(item.device)}</span>
                            <div>
                              <p className="font-medium text-slate-700 text-xs">
                                {item.os || "Device"} • {item.browser || "Browser"}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                {item.device || "Desktop"} ({item.screen || "Screen"})
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Login Time */}
                        <td className="p-4">
                          <div>
                            <p className="font-semibold text-slate-700 text-xs flex items-center gap-1">
                              <FaClock className="text-gray-400 text-[10px]" />
                              {timeAgo(item.createdAt, item.clientTimestamp)}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {formatDate(item.createdAt, item.clientTimestamp)}
                            </p>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-4 text-center">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                              <FaCheckCircle className="text-[11px]" /> Success
                            </span>
                          ) : (
                            <span
                              title={item.error || "Login Failed"}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-semibold"
                            >
                              <FaTimesCircle className="text-[11px]" /> Failed
                            </span>
                          )}
                        </td>

                        {/* Action 1: Work Details Button */}
                        <td className="p-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLoginSession(item);
                              setLoginModalTab("all");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-emerald-600 text-slate-700 group-hover:text-white font-semibold text-xs transition shadow-sm"
                            title="Click to view full session details & work"
                          >
                            <FaEye className="text-xs" />
                            <span>View Work</span>
                            <FaChevronRight className="text-[10px]" />
                          </button>
                        </td>

                        {/* Action 2: Live Portal Screen Inspector */}
                        <td className="p-4 text-center">
                          {item.role === "admin" || (item.portal && item.portal.toLowerCase().includes("admin")) ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs border border-slate-200 cursor-default"
                              title="Admin Console is currently active"
                            >
                              <FaShieldAlt className="text-slate-400 text-xs" />
                              <span>Admin Console</span>
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectorTargetUser(item);
                                setIsInspectorOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 font-semibold text-xs transition shadow-sm"
                              title="Inspect the exact live portal screen seen by this user"
                            >
                              <FaDesktop className="text-xs" />
                              <span>View Screen</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>


            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ALL UPDATES & AUDIT TRAIL                          */}
      {/* ========================================================= */}
      {activeTab === "updates" && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
          {filteredUpdates.length === 0 ? (
            <div className="p-16 text-center text-gray-500">
              <FaHistory className="text-6xl text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-700">No Activity Logs Found</h3>
              <p className="text-sm mt-1">Actions performed by Admins, Collectors, and Users will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredUpdates.map((log) => {
                const catCfg = LOG_CATEGORIES[log.category] || LOG_CATEGORIES.general;

                return (
                  <div key={log.id} className="p-4 hover:bg-slate-50/60 transition">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-slate-600 font-bold text-sm">
                        {log.performedByName ? log.performedByName.charAt(0).toUpperCase() : <FaUser />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-800">
                            {log.performedByName || "System"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getPortalBadge(log.portal)}`}>
                            {log.portal || (log.performedByRole ? `${log.performedByRole} Portal` : "Admin Portal")}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${catCfg.color}`}>
                            {catCfg.label}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-slate-700 mt-1">
                          {log.action}
                        </p>

                        {log.targetName && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Target: <span className="font-medium text-slate-700">{log.targetName}</span>
                          </p>
                        )}

                        {log.details && (
                          <p className="text-xs text-gray-500 mt-0.5 bg-slate-50 inline-block px-2.5 py-1 rounded-md border border-slate-200/60">
                            {log.details}
                          </p>
                        )}

                        <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1.5">
                          <FaClock className="text-gray-300" />
                          <span>{timeAgo(log.createdAt, log.clientTimestamp)}</span>
                          <span>•</span>
                          <span>{formatDate(log.createdAt, log.clientTimestamp)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: WORK DONE BY USER (USER ACTIVITY SUMMARY)          */}
      {/* ========================================================= */}
      {activeTab === "userWork" && (
        <div className="space-y-4">
          {userWorkSummary.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center text-gray-500 border border-slate-100">
              <FaUserTie className="text-6xl text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-700">No User Work Records Found</h3>
              <p className="text-sm mt-1">Activities logged by collectors, admins, and staff will appear grouped here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {userWorkSummary.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between hover:shadow-md transition"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs uppercase font-semibold text-gray-400">
                              {item.role}
                            </span>
                            <span>•</span>
                            <span className={`text-[11px] px-2 py-0.2 rounded border font-medium ${getPortalBadge(item.portal)}`}>
                              {item.portal}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats metrics */}
                    <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <div>
                        <p className="text-lg font-bold text-slate-800">{item.totalActions}</p>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                          Actions
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-600">{item.collectionsCount}</p>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                          Collections
                        </p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-600">₹{item.totalAmountCollected}</p>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                          Collected
                        </p>
                      </div>
                    </div>

                    {/* Recent 2 actions preview */}
                    <div className="mt-3.5 space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Recent Activity:
                      </p>
                      {item.actions.slice(0, 2).map((a, aIdx) => (
                        <div key={aIdx} className="text-xs text-slate-600 bg-white border rounded-lg p-2">
                          <p className="font-semibold line-clamp-1">{a.action}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 flex justify-between">
                            <span>{a.targetName || "General"}</span>
                            <span>{timeAgo(a.createdAt)}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      Last active: {timeAgo(item.lastActive)}
                    </span>

                    <button
                      onClick={() => setSelectedUserDrilldown(item)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 transition"
                    >
                      <FaEye /> View All ({item.totalActions})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drill-down Modal for Individual User Actions */}
      {selectedUserDrilldown && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                  {selectedUserDrilldown.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800">
                    {selectedUserDrilldown.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Role: <span className="font-semibold capitalize">{selectedUserDrilldown.role}</span> • Portal: {selectedUserDrilldown.portal}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserDrilldown(null)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-200 transition text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            {/* Modal Content / Action Timeline */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Full Work History ({selectedUserDrilldown.actions.length} Operations)
                </span>
                <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold">
                  Total Collected: ₹{selectedUserDrilldown.totalAmountCollected}
                </span>
              </div>

              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-slate-50/40">
                {selectedUserDrilldown.actions.map((act, actIdx) => (
                  <div key={actIdx} className="p-3.5 hover:bg-white transition">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{act.action}</p>
                        {act.targetName && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Target: <span className="font-medium text-slate-700">{act.targetName}</span>
                          </p>
                        )}
                        {act.details && (
                          <p className="text-xs text-gray-500 mt-0.5 bg-white inline-block px-2 py-0.5 rounded border border-gray-200">
                            {act.details}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-slate-600">{timeAgo(act.createdAt, act.clientTimestamp)}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(act.createdAt, act.clientTimestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t bg-gray-50 text-right">
              <button
                onClick={() => setSelectedUserDrilldown(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal for Login Session & Connected Work */}
      {selectedLoginSession && (

        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
                  {selectedLoginSession.name ? selectedLoginSession.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-xl text-white">
                      {selectedLoginSession.name || "User"}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getPortalBadge(selectedLoginSession.portal)}`}>
                      {selectedLoginSession.portal || "Portal"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white capitalize">
                      {selectedLoginSession.role || "User"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                    <span>📞 {formatIdentifier(selectedLoginSession.identifier)}</span>
                    {selectedLoginSession.flat && (
                      <span>• Flat: {selectedLoginSession.flat}</span>
                    )}
                    <span>• Logged in {timeAgo(selectedLoginSession.createdAt, selectedLoginSession.clientTimestamp)}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLoginSession(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Top 4 Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-50 border-b border-gray-100">
              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Session Status</p>
                <div className="mt-1 flex items-center justify-center gap-1.5 font-bold text-xs">
                  {selectedLoginSession.status === "success" ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <FaCheckCircle className="text-emerald-500" /> Authenticated
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1">
                      <FaTimesCircle className="text-red-500" /> Failed
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Platform / Device</p>
                <p className="font-bold text-xs text-slate-800 mt-1 flex items-center justify-center gap-1 truncate">
                  {getDeviceIcon(selectedLoginSession.device)} {selectedLoginSession.os || "OS"} • {selectedLoginSession.browser || "Browser"}
                </p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Collections Count</p>
                <p className="font-bold text-base text-blue-600 mt-0.5">
                  {selectedLoginUserWork?.collectionsCount || 0}
                </p>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm text-center">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Amount</p>
                <p className="font-bold text-base text-emerald-600 mt-0.5">
                  ₹{(selectedLoginUserWork?.totalAmountCollected || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6 bg-white">
              <button
                onClick={() => setLoginModalTab("all")}
                className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-2 ${
                  loginModalTab === "all"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <FaUserTie /> User Work & Operations ({selectedLoginUserWork?.actions?.length || 0})
              </button>

              <button
                onClick={() => setLoginModalTab("session")}
                className={`py-3 px-4 font-semibold text-xs border-b-2 transition flex items-center gap-2 ${
                  loginModalTab === "session"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <FaLaptop /> Technical Session & Device Details
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loginModalTab === "all" && (
                <div>
                  {selectedLoginUserWork && selectedLoginUserWork.actions && selectedLoginUserWork.actions.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Full Operations Logged by {selectedLoginSession.name} ({selectedLoginUserWork.actions.length})
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          Collected: ₹{(selectedLoginUserWork.totalAmountCollected || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                        {selectedLoginUserWork.actions.map((act, idx) => (
                          <div key={idx} className="p-4 hover:bg-slate-50 transition">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-bold text-sm text-slate-800">{act.action}</p>
                                {act.targetName && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    Target / Resident: <span className="font-semibold text-slate-700">{act.targetName}</span>
                                  </p>
                                )}
                                {act.details && (
                                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100">
                                    <FaReceipt className="text-[10px]" />
                                    <span>{act.details}</span>
                                  </div>
                                )}
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-xs font-bold text-slate-700">{timeAgo(act.createdAt, act.clientTimestamp)}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(act.createdAt, act.clientTimestamp)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-500 border border-dashed border-gray-200 rounded-2xl p-6 bg-slate-50/50">
                      <FaUserTie className="text-5xl text-gray-300 mx-auto mb-3" />
                      <h4 className="font-bold text-base text-gray-700">No Operations Recorded Yet</h4>
                      <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                        This user has logged into the {selectedLoginSession.portal || "Portal"}. Any payment collections, receipts issued, or resident additions done by this user will appear here in real time.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {loginModalTab === "session" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Account Mobile / Phone</p>
                      <p className="font-bold text-sm text-slate-800 mt-1">
                        📞 {formatIdentifier(selectedLoginSession.identifier)}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Portal Accessed</p>
                      <p className="font-bold text-sm text-slate-800 mt-1">
                        🛡️ {selectedLoginSession.portal || "User Portal"}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Exact Login Time</p>
                      <p className="font-semibold text-xs text-slate-800 mt-1">
                        📅 {formatDate(selectedLoginSession.createdAt, selectedLoginSession.clientTimestamp)}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Session Status</p>
                      <p className="font-bold text-xs mt-1">
                        {selectedLoginSession.status === "success" ? (
                          <span className="text-emerald-600">✅ Login Successful</span>
                        ) : (
                          <span className="text-red-600">❌ Failed: {selectedLoginSession.error || "Authentication error"}</span>
                        )}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Operating System</p>
                      <p className="font-semibold text-xs text-slate-800 mt-1">
                        {selectedLoginSession.os || "Unknown OS"}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Browser & Platform</p>
                      <p className="font-semibold text-xs text-slate-800 mt-1">
                        {selectedLoginSession.browser || "Unknown Browser"} ({selectedLoginSession.device || "Desktop"})
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Screen Resolution</p>
                      <p className="font-semibold text-xs text-slate-800 mt-1">
                        {selectedLoginSession.screen || "Default"}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Firebase UID</p>
                      <p className="font-mono text-[11px] text-gray-500 mt-1 break-all select-all">
                        {selectedLoginSession.uid || "Anonymous / Unregistered"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">
                Session Record #{selectedLoginSession.id || "live"}
              </span>

              <div className="flex items-center gap-2">
                {selectedLoginUserWork && selectedLoginUserWork.actions && selectedLoginUserWork.actions.length > 0 && (
                  <button
                    onClick={() => {
                      const userWorkItem = selectedLoginUserWork;
                      setSelectedLoginSession(null);
                      setActiveTab("userWork");
                      setSelectedUserDrilldown(userWorkItem);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-sm flex items-center gap-1.5"
                  >
                    <FaEye /> Open in User Work Tab
                  </button>
                )}

                <button
                  onClick={() => {
                    const sessionItem = selectedLoginSession;
                    setSelectedLoginSession(null);
                    setInspectorTargetUser(sessionItem);
                    setIsInspectorOpen(true);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition shadow-sm flex items-center gap-1.5"
                  title="Inspect the live portal screen of this user"
                >
                  <FaDesktop /> View User Portal Screen
                </button>

                <button
                  onClick={() => setSelectedLoginSession(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Global Portal Screen Inspector Modal */}
      <PortalScreenInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => {
          setIsInspectorOpen(false);
          setInspectorTargetUser(null);
        }}
        initialUser={inspectorTargetUser}
      />
    </div>
  );
}



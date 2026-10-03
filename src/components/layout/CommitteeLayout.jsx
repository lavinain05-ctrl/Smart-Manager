import { useState, useEffect, useMemo, Suspense } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import ErrorBoundary from "../common/ErrorBoundary";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import {
  FaHome,
  FaBell,
  FaExclamationCircle,
  FaCalendarAlt,
  FaUsers,
  FaUser,
  FaSignOutAlt,
  FaBuilding,
  FaLeaf,
  FaPhone,
  FaRecycle,
  FaMoneyBillWave,
  FaUserTie,
  FaUserPlus,
  FaEdit,
  FaKey,
  FaHistory,
  FaShieldAlt,
  FaTrashAlt,
  FaHandHoldingHeart,
  FaBars,
  FaTimes,
  FaMoon,
  FaSun,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
} from "react-icons/fa";
import NotificationBell from "../notifications/NotificationBell";
import PrinterQuickAction from "../common/PrinterQuickAction";

export default function CommitteeLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { darkMode, toggleTheme } = useTheme();

  const [livePermissions, setLivePermissions] = useState(user?.permissions || {});
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Desktop sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("smartmanager_committee_sidebar_collapsed") === "true";
  });

  const toggleSidebarCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("smartmanager_committee_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Real-time synchronization of assigned permissions
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.permissions) {
          setLivePermissions(data.permissions);
        }
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const isAdmin = user?.role === "admin";
  const permissions = useMemo(() => {
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
      ...(livePermissions || {}),
      ...(user?.permissions || {}),
      canCollectGarbage: Boolean(
        livePermissions?.canCollectGarbage ||
        user?.permissions?.canCollectGarbage ||
        user?.canCollectGarbage
      ),
      canCollectSpecial: Boolean(
        livePermissions?.canCollectSpecial ||
        user?.permissions?.canCollectSpecial ||
        user?.canCollectSpecial
      ),
      canViewGarbageReports: Boolean(
        livePermissions?.canViewGarbageReports ||
        user?.permissions?.canViewGarbageReports ||
        user?.canViewGarbageReports
      ),
    };
  }, [isAdmin, livePermissions, user]);

  // Grouped Menu Items
  const menuSections = useMemo(() => {
    const sections = [];

    // 1. Overview
    sections.push({
      title: "Overview",
      items: [
        { name: "Dashboard", icon: <FaHome className="text-blue-400" />, path: "/committee/dashboard" },
      ],
    });

    // 2. Delegated Admin Powers
    const adminItems = [];
    if (permissions.canManageResidents) {
      adminItems.push({ name: "Residents", icon: <FaUsers className="text-emerald-400" />, path: "/committee/residents", power: true });
    }
    if (permissions.canManageCollectors) {
      adminItems.push({ name: "Collectors", icon: <FaUserTie className="text-purple-400" />, path: "/committee/collectors", power: true });
    }
    if (permissions.canManageRegistrations) {
      adminItems.push({ name: "Registrations", icon: <FaUserPlus className="text-cyan-400" />, path: "/committee/registrations", power: true });
    }
    if (permissions.canManageProfileRequests) {
      adminItems.push({ name: "Profile Requests", icon: <FaEdit className="text-amber-400" />, path: "/committee/profile-requests", power: true });
    }
    if (permissions.canManageAccountRecovery) {
      adminItems.push({ name: "Account Recovery", icon: <FaKey className="text-rose-400" />, path: "/committee/account-recovery", power: true });
    }
    if (permissions.canCollectGarbage) {
      adminItems.push({
        name: "GC Collection",
        icon: <FaTrashAlt className="text-emerald-400" />,
        path: "/committee/collect-garbage",
        power: true,
      });
    }
    if (permissions.canCollectSpecial) {
      adminItems.push({
        name: "Special Collection",
        icon: <FaHandHoldingHeart className="text-indigo-400" />,
        path: "/committee/collect-special",
        power: true,
      });
    }
    if (permissions.canCollectGarbage || permissions.canCollectSpecial) {
      adminItems.push({
        name: "Collection History",
        icon: <FaHistory className="text-teal-400" />,
        path: "/committee/history",
        power: true,
      });
    }
    if (adminItems.length > 0) {
      sections.push({ title: "Executive Powers", items: adminItems });
    }

    // 3. Society & Community Services
    sections.push({
      title: "Society & Services",
      items: [
        { name: "Garbage Service", icon: <FaRecycle className="text-emerald-400" />, path: "/committee/garbage" },
        { name: "Special Collections", icon: <FaHandHoldingHeart className="text-pink-400" />, path: "/committee/special-collections" },
        { name: "Notices", icon: <FaBell className="text-amber-400" />, path: "/committee/notices" },
        { name: "Events", icon: <FaCalendarAlt className="text-indigo-400" />, path: "/committee/events" },
        { name: "Complaints", icon: <FaExclamationCircle className="text-rose-400" />, path: "/committee/complaints" },
        { name: "Committee Directory", icon: <FaUsers className="text-sky-400" />, path: "/committee/directory" },
        { name: "Activities", icon: <FaLeaf className="text-green-400" />, path: "/committee/activities" },
        { name: "Emergency Contacts", icon: <FaPhone className="text-red-400" />, path: "/committee/emergency" },
      ],
    });

    // 5. Account
    sections.push({
      title: "My Account",
      items: [
        { name: "Profile", icon: <FaUser className="text-slate-300" />, path: "/committee/profile" },
      ],
    });

    // 6. Resident Portal (if official is also a resident)
    if (user?.isResident || Boolean(user?.flat)) {
      sections.push({
        title: "Resident Portal",
        items: [
          {
            name: `My Flat (${user?.flat || "Resident"})`,
            icon: <FaHome className="text-emerald-400" />,
            path: "/resident/dashboard",
          },
        ],
      });
    }

    return sections;
  }, [permissions, user]);

  const hasAnyPower = Object.values(permissions).some(Boolean);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-200">
      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white flex flex-col shadow-2xl border-r border-slate-800 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "lg:w-20" : "lg:w-72"}`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-5 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30 shrink-0">
              <FaBuilding />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h1 className="text-base font-extrabold tracking-tight truncate text-white">
                  D Block RWA
                </h1>
                <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider truncate">
                  Committee Portal
                </p>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 bg-slate-800/50 rounded-2xl p-2.5 border border-slate-700/40">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-base font-bold text-white shrink-0 shadow-inner">
              {user?.name?.charAt(0) || "C"}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs truncate text-white">
                  {user?.name || "Committee Official"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 truncate max-w-[150px]">
                    🏛️ {user?.designation || "Executive Member"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
          {menuSections.map((sec, idx) => (
            <div key={sec.title || idx} className="space-y-1">
              {!isCollapsed && sec.title && (
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {sec.title}
                </div>
              )}
              {sec.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  title={isCollapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 font-bold"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    } ${isCollapsed ? "justify-center px-0" : ""}`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base shrink-0 group-hover:scale-110 transition-transform">
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </div>
                  {!isCollapsed && item.power && (
                    <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Power
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer: Theme Toggle & Logout */}
        <div className="border-t border-slate-800/80 p-3 space-y-1.5 shrink-0 bg-slate-950/40">
          {/* Collapse Sidebar Button (Desktop) */}
          <button
            onClick={toggleSidebarCollapse}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition text-xs font-medium cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
            {!isCollapsed && <span>Collapse Sidebar</span>}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition text-xs font-medium cursor-pointer ${
              isCollapsed ? "justify-center" : ""
            }`}
            title="Toggle Light / Dark Mode"
          >
            {darkMode ? <FaSun className="text-amber-400" /> : <FaMoon className="text-indigo-400" />}
            {!isCollapsed && <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition text-xs font-medium cursor-pointer ${
              isCollapsed ? "justify-center" : ""
            }`}
            title="Logout"
          >
            <FaSignOutAlt />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-2xs shrink-0 transition-colors">
          {/* Left: Mobile Drawer Trigger & Society Info */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition cursor-pointer"
              title="Open Navigation Menu"
            >
              <FaBars className="text-base" />
            </button>

            <div className="flex items-center gap-2.5 truncate">
              <span className="hidden sm:inline-block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Committee Console
              </span>
              <span className="hidden sm:inline-block text-slate-300 dark:text-slate-700">•</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {user?.designation ? `${user.designation}` : "Executive Console"}
              </span>

              {hasAnyPower && (
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <FaShieldAlt className="text-emerald-600 dark:text-emerald-400 text-[10px]" /> Delegated Powers
                </span>
              )}
            </div>
          </div>

          {/* Right Actions: Printer Quick Action, Theme Toggle, Notifications */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {isAdmin && (
              <Link
                to="/admin/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition shadow-xs"
                title="Return to Admin Dashboard"
              >
                <FaShieldAlt className="text-xs" />
                <span className="hidden sm:inline">Admin Portal</span>
              </Link>
            )}

            {Boolean(user?.isResident || user?.flat) && (
              <Link
                to="/resident/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition shadow-xs"
                title="View My Resident Flat Portal"
              >
                <FaHome className="text-xs text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Resident Portal</span>
              </Link>
            )}

            {/* Direct Printer Badge */}
            <PrinterQuickAction />

            {/* Dark Mode Quick Toggle on Desktop */}
            <button
              onClick={toggleTheme}
              className="hidden sm:flex p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <FaSun className="text-amber-400 text-sm" /> : <FaMoon className="text-indigo-400 text-sm" />}
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Avatar Chip */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {user?.name?.charAt(0) || "C"}
              </div>
              <div className="text-left hidden xl:block">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[120px]">
                  {user?.name || "Official"}
                </p>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">
                  {user?.designation || "Committee"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              <Suspense fallback={
                <div className="min-h-[40vh] flex items-center justify-center p-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/50 flex items-center justify-center shadow-lg">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <span className="text-xs text-slate-500 font-semibold tracking-wide">Loading...</span>
                  </div>
                </div>
              }>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

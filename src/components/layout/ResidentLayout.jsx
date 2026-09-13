import { useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
  FaHome,
  FaFileInvoiceDollar,
  FaHistory,
  FaReceipt,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaBuilding,
  FaExclamationCircle,
  FaCalendarAlt,
  FaLeaf,
  FaPhone,
  FaRecycle,
  FaHandHoldingHeart,
  FaUserTie,
  FaQuestionCircle,
  FaLightbulb,
  FaChevronDown,
  FaChevronRight,
  FaBars,
  FaTimes,
  FaMoon,
  FaSun,
  FaChevronLeft,
} from "react-icons/fa";
import NotificationBell from "../notifications/NotificationBell";

export default function ResidentLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { darkMode, toggleTheme } = useTheme();

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Desktop sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("smartmanager_resident_sidebar_collapsed") === "true";
  });

  const toggleSidebarCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("smartmanager_resident_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Check if current route is part of Garbage Collection module
  const isGarbageActive =
    location.pathname === "/resident/garbage" ||
    location.pathname === "/resident/bills" ||
    location.pathname === "/resident/payments" ||
    location.pathname === "/resident/receipts";

  // Garbage accordion state
  const [garbageOpen, setGarbageOpen] = useState(true);
  const isGarbageSectionOpen = isGarbageActive || garbageOpen;

  const garbageItems = [
    { name: "Garbage Overview", icon: <FaRecycle />, path: "/resident/garbage" },
    { name: "My Bills", icon: <FaFileInvoiceDollar />, path: "/resident/bills" },
    { name: "Payment History", icon: <FaHistory />, path: "/resident/payments" },
    { name: "Receipts", icon: <FaReceipt />, path: "/resident/receipts" },
  ];

  const societyItems = [
    { name: "RWA Committee", icon: <FaUserTie className="text-amber-400" />, path: "/resident/committee" },
    { name: "Notices", icon: <FaBell className="text-purple-400" />, path: "/resident/notices" },
    { name: "Complaints", icon: <FaExclamationCircle className="text-rose-400" />, path: "/resident/complaints" },
    { name: "Suggestion Box", icon: <FaLightbulb className="text-amber-400" />, path: "/resident/suggestions" },
    { name: "Events", icon: <FaCalendarAlt className="text-indigo-400" />, path: "/resident/events" },
    { name: "Activities", icon: <FaLeaf className="text-emerald-400" />, path: "/resident/activities" },
    { name: "Emergency Contacts", icon: <FaPhone className="text-rose-400" />, path: "/resident/emergency" },
    { name: "Help & Support", icon: <FaQuestionCircle className="text-teal-400" />, path: "/resident/support" },
  ];

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden">
      {/* Mobile Overlay */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Desktop & Mobile Drawer Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white flex flex-col shadow-2xl border-r border-slate-800 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "lg:w-20" : "lg:w-68"}`}
      >
        {/* Brand Header */}
        <div
          className={`h-20 flex items-center border-b border-slate-800/80 px-4 transition-all duration-300 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <Link
            to="/resident/dashboard"
            onClick={() => setMobileDrawerOpen(false)}
            title="Go to Home / Dashboard"
            className="flex items-center gap-3 overflow-hidden group cursor-pointer hover:opacity-90 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-blue-500/25 shrink-0 group-hover:scale-105 transition-transform">
              <FaBuilding />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 transition-opacity duration-200">
                <h1 className="text-sm font-black tracking-tight leading-snug truncate text-white group-hover:text-blue-300 transition-colors">
                  Resident Portal
                </h1>
                <p className="text-[10px] text-blue-400 font-bold tracking-wider uppercase truncate">
                  {user?.name || "D Block Resident"}
                </p>
              </div>
            )}
          </Link>

          {/* Close Mobile Drawer Button */}
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
            aria-label="Close menu"
          >
            <FaTimes className="text-lg" />
          </button>

          {/* Desktop Collapse Toggle Button */}
          {!isCollapsed && (
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white items-center justify-center text-xs transition"
              title="Collapse sidebar"
            >
              <FaChevronLeft />
            </button>
          )}
        </div>

        {/* When collapsed on desktop, show an expand toggle button */}
        {isCollapsed && (
          <div className="hidden lg:flex justify-center pt-2 pb-1 border-b border-slate-800/60">
            <button
              onClick={toggleSidebarCollapse}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition"
              title="Expand sidebar"
            >
              <FaChevronRight />
            </button>
          </div>
        )}

        {/* Navigation Content */}
        <nav className="flex-1 overflow-y-auto px-3 py-3.5 space-y-3.5 custom-scrollbar">
          {/* 1. Dashboard */}
          <div>
            <NavLink
              to="/resident/dashboard"
              onClick={() => setMobileDrawerOpen(false)}
              title={isCollapsed ? "Dashboard" : undefined}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                } ${isCollapsed ? "justify-center px-0 py-3" : ""}`
              }
            >
              <span className="text-base flex items-center justify-center shrink-0">
                <FaHome />
              </span>
              {!isCollapsed && <span>Dashboard</span>}

              {/* Tooltip in collapsed mode */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-slate-800">
                  Dashboard
                </div>
              )}
            </NavLink>
          </div>

          {/* 2. Garbage Collection Module */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pt-1 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  Garbage Services
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-400 font-bold">
                  4 Tabs
                </span>
              </div>
            )}

            {isCollapsed ? (
              // Collapsed view for Garbage Module: direct link or clean icon
              <NavLink
                to="/resident/garbage"
                onClick={() => setMobileDrawerOpen(false)}
                title="Garbage Collection"
                className={({ isActive }) =>
                  `group relative flex items-center justify-center py-3 rounded-xl transition-all duration-200 ${
                    isActive || isGarbageActive
                      ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20"
                      : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                  }`
                }
              >
                <span className="text-base text-emerald-400 group-hover:text-white">
                  <FaRecycle />
                </span>
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-slate-800">
                  Garbage Services
                </div>
              </NavLink>
            ) : (
              // Expanded view: Clean accordion
              <div className="rounded-2xl bg-slate-850/60 border border-slate-800/80 p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => setGarbageOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/50 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs">
                      <FaRecycle />
                    </div>
                    <span>Doorstep Collection</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {isGarbageSectionOpen ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                </button>

                {isGarbageSectionOpen && (
                  <div className="space-y-0.5 pt-0.5">
                    {garbageItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? "bg-emerald-500/20 text-emerald-400 font-bold"
                              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                          }`
                        }
                      >
                        <span className="text-sm shrink-0">{item.icon}</span>
                        <span className="truncate">{item.name}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Contributions & Special Drives */}
          <div>
            {!isCollapsed && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                Contributions
              </p>
            )}

            {isCollapsed && <div className="h-px bg-slate-800/70 my-2 mx-2" />}

            <NavLink
              to="/resident/special-collections"
              onClick={() => setMobileDrawerOpen(false)}
              title={isCollapsed ? "Special Collections" : undefined}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-pink-600 text-white font-bold shadow-md shadow-pink-600/20"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                } ${isCollapsed ? "justify-center px-0 py-3" : ""}`
              }
            >
              <span className="text-base flex items-center justify-center shrink-0 text-pink-400 group-hover:text-white">
                <FaHandHoldingHeart />
              </span>
              {!isCollapsed && <span className="truncate">Special Drives</span>}

              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-slate-800">
                  Special Drives & Funds
                </div>
              )}
            </NavLink>
          </div>

          {/* 4. Society & Community Services */}
          <div>
            {!isCollapsed && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                Society & Services
              </p>
            )}

            {isCollapsed && <div className="h-px bg-slate-800/70 my-2 mx-2" />}

            <div className="space-y-0.5">
              {societyItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileDrawerOpen(false)}
                  title={isCollapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                    } ${isCollapsed ? "justify-center px-0 py-3" : ""}`
                  }
                >
                  <span className="text-base flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.name}</span>}

                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-slate-800">
                      {item.name}
                    </div>
                  )}
                </NavLink>
              ))}
            </div>
          </div>

          {/* 5. Profile & Settings */}
          <div>
            {!isCollapsed && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                My Account
              </p>
            )}

            {isCollapsed && <div className="h-px bg-slate-800/70 my-2 mx-2" />}

            <NavLink
              to="/resident/profile"
              onClick={() => setMobileDrawerOpen(false)}
              title={isCollapsed ? "Profile & Settings" : undefined}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                    : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                } ${isCollapsed ? "justify-center px-0 py-3" : ""}`
              }
            >
              <span className="text-base flex items-center justify-center shrink-0 text-sky-400 group-hover:text-white">
                <FaUser />
              </span>
              {!isCollapsed && <span className="truncate">Profile & Flat</span>}

              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-950 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-slate-800">
                  Profile & Flat
                </div>
              )}
            </NavLink>
          </div>
        </nav>

        {/* Footer: User Monogram & Logout */}
        <div className="border-t border-slate-800/80 p-3">
          <button
            type="button"
            onClick={logout}
            title={isCollapsed ? "Logout" : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition text-xs font-semibold group ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <FaSignOutAlt className="text-base shrink-0 group-hover:-translate-x-0.5 transition-transform" />
            {!isCollapsed && <span>Logout Account</span>}
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 items-center justify-between shadow-xs transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Resident Workspace
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-sm font-bold text-slate-800 dark:text-white">
              D BLOCK RWA INDRAPRASTHA
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <FaSun className="text-yellow-500" /> : <FaMoon />}
            </button>

            <NotificationBell isDark={darkMode} />
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 h-16 bg-slate-900 text-white flex items-center justify-between px-4 shadow-md border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
              aria-label="Open menu"
            >
              <FaBars className="text-lg" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">
                <FaBuilding />
              </div>
              <h1 className="text-sm font-bold">Resident Portal</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs bg-slate-800 text-slate-300 hover:text-white transition"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <FaSun className="text-yellow-500" /> : <FaMoon />}
            </button>
            <NotificationBell isDark={true} />
            <button
              type="button"
              onClick={logout}
              className="text-xs bg-red-600/80 hover:bg-red-600 text-white px-2.5 py-1.5 rounded-lg transition font-semibold"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around py-2 shadow-lg">
          <NavLink
            to="/resident/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium transition ${
                isActive ? "text-blue-600 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-white"
              }`
            }
          >
            <span className="text-lg"><FaHome /></span>
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/resident/garbage"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium transition ${
                isActive || isGarbageActive
                  ? "text-emerald-600 font-bold"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-white"
              }`
            }
          >
            <span className="text-lg"><FaRecycle /></span>
            <span>Garbage</span>
          </NavLink>

          <NavLink
            to="/resident/special-collections"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium transition ${
                isActive ? "text-pink-600 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-white"
              }`
            }
          >
            <span className="text-lg"><FaHandHoldingHeart /></span>
            <span>Special</span>
          </NavLink>

          <NavLink
            to="/resident/committee"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium transition ${
                isActive ? "text-amber-600 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-white"
              }`
            }
          >
            <span className="text-lg"><FaUserTie /></span>
            <span>RWA</span>
          </NavLink>

          <NavLink
            to="/resident/profile"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium transition ${
                isActive ? "text-blue-600 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-white"
              }`
            }
          >
            <span className="text-lg"><FaUser /></span>
            <span>Profile</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}

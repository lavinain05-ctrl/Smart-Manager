import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
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
  FaChevronDown,
  FaChevronRight,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import NotificationBell from "../notifications/NotificationBell";

export default function ResidentLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Mobile drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Check if current route is part of Garbage Collection module
  const isGarbageActive =
    location.pathname === "/resident/garbage" ||
    location.pathname === "/resident/bills" ||
    location.pathname === "/resident/payments" ||
    location.pathname === "/resident/receipts";

  // Garbage accordion state (default open, especially when active)
  const [garbageOpen, setGarbageOpen] = useState(true);

  const garbageItems = [
    { name: "Garbage Overview", icon: <FaRecycle />, path: "/resident/garbage", subtitle: "Status & Service" },
    { name: "My Bills", icon: <FaFileInvoiceDollar />, path: "/resident/bills", subtitle: "Monthly GC Bills" },
    { name: "Payment History", icon: <FaHistory />, path: "/resident/payments", subtitle: "Collections Record" },
    { name: "Receipts", icon: <FaReceipt />, path: "/resident/receipts", subtitle: "Download Receipts" },
  ];

  const societyItems = [
    { name: "RWA Committee", icon: <FaUserTie />, path: "/resident/committee" },
    { name: "Notices", icon: <FaBell />, path: "/resident/notices" },
    { name: "Complaints", icon: <FaExclamationCircle />, path: "/resident/complaints" },
    { name: "Events", icon: <FaCalendarAlt />, path: "/resident/events" },
    { name: "Activities", icon: <FaLeaf />, path: "/resident/activities" },
    { name: "Emergency", icon: <FaPhone />, path: "/resident/emergency" },
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* Desktop & Mobile Drawer Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950 text-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-blue-600/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white text-blue-700 flex items-center justify-center text-2xl shadow-md">
              <FaBuilding />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Resident Portal</h1>
              <p className="text-xs text-blue-200 truncate max-w-[130px]">
                {user?.name || "Resident"}
              </p>
            </div>
          </div>
          {/* Close mobile drawer button */}
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="lg:hidden text-blue-200 hover:text-white p-1 rounded-lg"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4 custom-scrollbar">

          {/* 1. Dashboard */}
          <div>
            <NavLink
              to="/resident/dashboard"
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-white text-blue-800 font-bold shadow-lg"
                    : "text-white/90 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span className="text-lg"><FaHome /></span>
              <span className="font-medium text-sm">Dashboard</span>
            </NavLink>
          </div>

          {/* 2. GARBAGE COLLECTION MODULE (Distinct Module Card) */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-950/40 to-blue-950/60 border border-emerald-500/30 p-2 shadow-inner">
            {/* Module Accordion Header */}
            <button
              onClick={() => setGarbageOpen(!garbageOpen)}
              type="button"
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                isGarbageActive ? "text-emerald-300" : "text-emerald-200 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center text-sm shadow-sm">
                  <FaRecycle />
                </div>
                <div className="text-left">
                  <span className="font-bold text-xs uppercase tracking-wider block">
                    Garbage Module
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  4 Tabs
                </span>
                <span className="text-xs text-emerald-300/80">
                  {garbageOpen ? <FaChevronDown /> : <FaChevronRight />}
                </span>
              </div>
            </button>

            {/* Sub-Items */}
            {garbageOpen && (
              <div className="mt-1.5 space-y-1 pl-1">
                {garbageItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-emerald-500 text-white shadow-md font-bold"
                          : "text-emerald-100/90 hover:bg-emerald-500/20 hover:text-white"
                      }`
                    }
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* 3. Special Collections Module */}
          <div>
            <div className="px-3 pb-1 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/70">
                Contributions
              </span>
            </div>
            <NavLink
              to="/resident/special-collections"
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-white text-blue-800 font-bold shadow-lg"
                    : "text-white/90 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span className="text-lg text-pink-300"><FaHandHoldingHeart /></span>
              <span className="font-medium text-sm">Special Collections</span>
            </NavLink>
          </div>

          {/* 4. Society & Services */}
          <div>
            <div className="px-3 pb-1 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/70">
                Society & Services
              </span>
            </div>
            <div className="space-y-1">
              {societyItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-white text-blue-800 font-bold shadow-lg"
                        : "text-white/90 hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  <span className="text-base text-blue-200">{item.icon}</span>
                  <span className="font-medium text-sm">{item.name}</span>
                </NavLink>
              ))}
            </div>
          </div>

          {/* 5. Account */}
          <div>
            <div className="px-3 pb-1 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/70">
                Account
              </span>
            </div>
            <NavLink
              to="/resident/profile"
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-white text-blue-800 font-bold shadow-lg"
                    : "text-white/90 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span className="text-lg text-blue-200"><FaUser /></span>
              <span className="font-medium text-sm">Profile & Settings</span>
            </NavLink>
          </div>

        </nav>

        {/* Footer Logout */}
        <div className="border-t border-blue-600/50 p-3.5">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold transition shadow-sm"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Main Layout Area */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-8 items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Resident Workspace
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-sm font-bold text-slate-800">
              D BLOCK RWA INDRAPRASTHA
            </span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 h-16 bg-gradient-to-r from-blue-700 to-blue-800 text-white flex items-center justify-between px-4 shadow-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              aria-label="Open menu"
            >
              <FaBars className="text-lg" />
            </button>
            <div className="flex items-center gap-2">
              <FaBuilding className="text-xl" />
              <h1 className="text-base font-bold">Resident Portal</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <NotificationBell isDark={true} />
            <button
              onClick={logout}
              className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden bg-white border-t border-slate-200 flex justify-around py-2 shadow-lg">
          <NavLink
            to="/resident/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium ${
                isActive ? "text-blue-700 font-bold" : "text-gray-500 hover:text-gray-700"
              }`
            }
          >
            <span className="text-lg"><FaHome /></span>
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/resident/garbage"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium ${
                isGarbageActive ? "text-emerald-600 font-bold" : "text-gray-500 hover:text-gray-700"
              }`
            }
          >
            <span className="text-lg text-emerald-600"><FaRecycle /></span>
            <span>Garbage</span>
          </NavLink>

          <NavLink
            to="/resident/special-collections"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium ${
                isActive ? "text-pink-600 font-bold" : "text-gray-500 hover:text-gray-700"
              }`
            }
          >
            <span className="text-lg text-pink-500"><FaHandHoldingHeart /></span>
            <span>Special</span>
          </NavLink>

          <NavLink
            to="/resident/committee"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium ${
                isActive ? "text-blue-700 font-bold" : "text-gray-500 hover:text-gray-700"
              }`
            }
          >
            <span className="text-lg"><FaUserTie /></span>
            <span>RWA</span>
          </NavLink>

          <NavLink
            to="/resident/profile"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[11px] px-2 py-1 font-medium ${
                isActive ? "text-blue-700 font-bold" : "text-gray-500 hover:text-gray-700"
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

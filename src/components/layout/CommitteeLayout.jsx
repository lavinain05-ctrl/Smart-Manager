import { useState, useEffect, useMemo } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
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
  FaTrash,
  FaMoneyBillWave,
  FaUserTie,
  FaUserPlus,
  FaEdit,
  FaKey,
  FaHistory,
  FaShieldAlt,
} from "react-icons/fa";
import NotificationBell from "../notifications/NotificationBell";

export default function CommitteeLayout() {
  const { user, logout } = useAuth();
  const [livePermissions, setLivePermissions] = useState(user?.permissions || {});

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

  const permissions = livePermissions || user?.permissions || {};

  const menuItems = useMemo(() => {
    const items = [
      { name: "Dashboard", icon: <FaHome />, path: "/committee/dashboard" },
    ];

    // Delegated Society Management Powers
    if (permissions.canManageResidents) {
      items.push({ name: "Residents", icon: <FaUsers />, path: "/committee/residents", power: true });
    }
    if (permissions.canManageCollectors) {
      items.push({ name: "Collectors", icon: <FaUserTie />, path: "/committee/collectors", power: true });
    }
    if (permissions.canManageRegistrations) {
      items.push({ name: "Registrations", icon: <FaUserPlus />, path: "/committee/registrations", power: true });
    }
    if (permissions.canManageProfileRequests) {
      items.push({ name: "Profile Requests", icon: <FaEdit />, path: "/committee/profile-requests", power: true });
    }
    if (permissions.canManageAccountRecovery) {
      items.push({ name: "Account Recovery", icon: <FaKey />, path: "/committee/account-recovery", power: true });
    }

    // Delegated Collection Powers
    if (permissions.canCollectGarbage || permissions.canCollectSpecial) {
      items.push({ name: "Collect Payments", icon: <FaMoneyBillWave />, path: "/committee/collect", power: true });
      items.push({ name: "My Collections", icon: <FaHistory />, path: "/committee/history", power: true });
    }

    // Standard Committee Tabs
    items.push(
      { name: "Notices", icon: <FaBell />, path: "/committee/notices" },
      { name: "Events", icon: <FaCalendarAlt />, path: "/committee/events" },
      { name: "Complaints", icon: <FaExclamationCircle />, path: "/committee/complaints" },
      { name: "Committee", icon: <FaUsers />, path: "/committee/directory" },
      { name: "Activities", icon: <FaLeaf />, path: "/committee/activities" },
      { name: "Emergency", icon: <FaPhone />, path: "/committee/emergency" },
      { name: "Garbage", icon: <FaTrash />, path: "/committee/garbage" },
      { name: "Profile", icon: <FaUser />, path: "/committee/profile" }
    );

    return items;
  }, [permissions]);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 h-full bg-gradient-to-b from-indigo-700 to-indigo-900 text-white flex flex-col shadow-2xl hidden lg:flex">
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-indigo-600 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white text-indigo-700 flex items-center justify-center text-2xl shadow-md">
              <FaBuilding />
            </div>
            <div>
              <h1 className="text-xl font-bold">Committee</h1>
              <p className="text-xs text-indigo-200">{user?.designation || "Official"}</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 border-b border-indigo-600 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-lg font-bold">
              {user?.name?.charAt(0) || "C"}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{user?.name || "Committee Official"}</p>
              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/50 mt-0.5 truncate max-w-[170px]">
                🏛️ {user?.designation || "Member"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-white text-indigo-700 shadow-md font-semibold"
                    : "text-indigo-100 hover:bg-indigo-600 hover:text-white"
                }`
              }
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.name}</span>
              </div>
              {item.power && (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300">
                  Power
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-indigo-700 p-4 shrink-0">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-indigo-200 hover:bg-red-600 hover:text-white transition text-sm font-medium"
          >
            <FaSignOutAlt />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-8 items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Committee Workspace
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-sm font-bold text-slate-800">
              {user?.designation ? `${user.designation} Console` : "Executive Console"}
            </span>
            {Object.values(permissions).some(Boolean) && (
              <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <FaShieldAlt className="text-emerald-600 text-[10px]" /> Delegated Powers Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 h-16 bg-indigo-700 text-white flex items-center justify-between px-4 shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <FaBuilding className="text-2xl" />
            <div>
              <h1 className="text-base font-bold">Committee Portal</h1>
              <p className="text-xs text-indigo-200">{user?.designation || "Official"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell isDark={true} />
            <button
              onClick={logout}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition font-medium"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden bg-white border-t flex justify-around py-2 shrink-0 overflow-x-auto">
          {menuItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-[11px] px-2 py-1 transition ${
                  isActive ? "text-indigo-700 font-bold" : "text-gray-500"
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span className="truncate max-w-[64px]">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

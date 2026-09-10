import { Outlet } from "react-router-dom";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FaHome,
  FaFileInvoiceDollar,
  FaReceipt,
  FaBell,
  FaExclamationCircle,
  FaCalendarAlt,
  FaUser,
  FaSignOutAlt,
  FaBuilding,
  FaLeaf,
  FaPhone,
  FaTrash,
} from "react-icons/fa";
import NotificationBell from "../notifications/NotificationBell";

const menuItems = [
  { name: "Dashboard", icon: <FaHome />, path: "/family/dashboard" },
  { name: "Bills", icon: <FaFileInvoiceDollar />, path: "/family/bills" },
  { name: "Receipts", icon: <FaReceipt />, path: "/family/receipts" },
  { name: "Notices", icon: <FaBell />, path: "/family/notices" },
  { name: "Complaints", icon: <FaExclamationCircle />, path: "/family/complaints" },
  { name: "Events", icon: <FaCalendarAlt />, path: "/family/events" },
  { name: "Activities", icon: <FaLeaf />, path: "/family/activities" },
  { name: "Emergency", icon: <FaPhone />, path: "/family/emergency" },
  { name: "Garbage", icon: <FaTrash />, path: "/family/garbage" },
  { name: "Profile", icon: <FaUser />, path: "/family/profile" },
];

export default function FamilyLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* Sidebar */}
      <aside className="w-72 h-full bg-gradient-to-b from-sky-600 to-sky-800 text-white flex flex-col shadow-2xl hidden lg:flex">

        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-sky-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white text-sky-700 flex items-center justify-center text-2xl shadow-md">
              <FaBuilding />
            </div>
            <div>
              <h1 className="text-xl font-bold">Family Portal</h1>
              <p className="text-xs text-sky-200">{user?.name || "Family Member"}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-xl mb-2 transition-all duration-300 ${
                  isActive
                    ? "bg-white text-sky-700 shadow-lg"
                    : "hover:bg-sky-500"
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sky-600 p-4">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-600 transition"
          >
            <FaSignOutAlt />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-8 items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Family Portal
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-sm font-bold text-slate-800">
              D-Block Society
            </span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 h-16 bg-sky-700 text-white flex items-center justify-between px-4 shadow-md">
          <div className="flex items-center gap-3">
            <FaBuilding className="text-2xl" />
            <h1 className="text-lg font-bold">Family Portal</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell isDark={true} />
            <button onClick={logout} className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition">Logout</button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden bg-white border-t flex justify-around py-2">
          {menuItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-xs px-2 py-1 ${
                  isActive ? "text-sky-700 font-bold" : "text-gray-500"
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.name.split(" ")[0]}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FaHome,
  FaUsers,
  FaMoneyBillWave,
  FaUserTie,
  FaChartBar,
  FaCog,
  FaSignOutAlt,
  FaHistory,
  FaReceipt,
  FaFileInvoiceDollar,
  FaTimes,
  FaBullhorn,
  FaExclamationCircle,
  FaCalendarAlt,
  FaEdit,
  FaBuilding,
  FaLeaf,
  FaPhone,
  FaUserPlus,
  FaUserSlash,
  FaBan,
  FaInbox,
  FaClipboardList,
  FaTachometerAlt,
  FaKey,
  FaHandHoldingHeart,
  FaHeadset,
  FaLightbulb,
  FaLaptop,
} from "react-icons/fa";

// =============================================
// Navigation Structure — Grouped ERP Layout
// =============================================

const navSections = [
  {
    // Dashboard — no group header, always visible
    items: [
      { name: "Dashboard", icon: <FaHome />, path: "/admin/dashboard" },
    ],
  },
  {
    label: "Society Management",
    items: [
      { name: "Residents", icon: <FaUsers />, path: "/admin/residents" },
      { name: "Family Members", icon: <FaUsers />, path: "/admin/family-members" },
      { name: "Blocks & Flats", icon: <FaBuilding />, path: "/admin/blocks-flats" },
      { name: "Committee", icon: <FaUserTie />, path: "/admin/committee" },
      { name: "Collectors", icon: <FaUserTie />, path: "/admin/collectors" },
      { name: "Registrations", icon: <FaUserPlus />, path: "/admin/registrations" },
      { name: "Profile Requests", icon: <FaEdit />, path: "/admin/profile-requests" },
      { name: "Account Recovery", icon: <FaKey />, path: "/admin/account-recovery" },
    ],
  },
  {
    label: "Garbage Collection",
    items: [
      { name: "Overview", icon: <FaTachometerAlt />, path: "/admin/garbage/dashboard" },
      { name: "Bills", icon: <FaFileInvoiceDollar />, path: "/admin/bills" },
      { name: "Collections", icon: <FaMoneyBillWave />, path: "/admin/collections" },
      { name: "Payment History", icon: <FaHistory />, path: "/admin/payment-history" },
      { name: "Receipts", icon: <FaReceipt />, path: "/admin/receipts" },
      { name: "Daily Report", icon: <FaChartBar />, path: "/admin/collector-daily-report" },
      { name: "Reports", icon: <FaClipboardList />, path: "/admin/garbage/reports" },
      { name: "Requests", icon: <FaInbox />, path: "/admin/garbage/requests" },
      { name: "Settings", icon: <FaCog />, path: "/admin/garbage/settings" },
    ],
  },
  {
    label: "Special Collections",
    items: [
      { name: "Special Collections", icon: <FaHandHoldingHeart />, path: "/admin/special-collections" },
    ],
  },
  {
    label: "Services",
    items: [
      { name: "Notices", icon: <FaBullhorn />, path: "/admin/notices" },
      { name: "Complaints", icon: <FaExclamationCircle />, path: "/admin/complaints" },
      { name: "Suggestions", icon: <FaLightbulb />, path: "/admin/suggestions" },
      { name: "Events", icon: <FaCalendarAlt />, path: "/admin/events" },
      { name: "Activities", icon: <FaLeaf />, path: "/admin/activities" },
      { name: "Emergency Contacts", icon: <FaPhone />, path: "/admin/emergency-contacts" },
      { name: "Support & FAQs", icon: <FaHeadset />, path: "/admin/support" },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Settings", icon: <FaCog />, path: "/admin/settings" },
      { name: "Activity Logs", icon: <FaHistory />, path: "/admin/activity-logs" },
      { name: "Active Devices", icon: <FaLaptop />, path: "/admin/devices" },
      { name: "Blocked Accounts", icon: <FaBan />, path: "/admin/blocked-accounts" },
      { name: "Deleted Accounts", icon: <FaUserSlash />, path: "/admin/deleted-accounts" },
    ],
  },
];

export default function Sidebar({ onClose }) {
  const { logout } = useAuth();

  return (
    <aside className="w-72 h-full bg-gradient-to-b from-slate-800 to-slate-900 text-white flex flex-col shadow-2xl">

      {/* Logo / Branding */}
      <div className="h-20 flex items-center justify-between px-6 border-b border-slate-700">

        <Link
          to="/admin/dashboard"
          onClick={onClose}
          title="Go to Dashboard"
          className="flex items-center gap-3 group cursor-pointer hover:opacity-90 transition"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center text-xl shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
            <FaBuilding />
          </div>

          <div>
            <h1 className="text-sm font-bold tracking-tight leading-snug group-hover:text-emerald-300 transition-colors">
              D BLOCK RWA INDRAPRASTHA
            </h1>
            <p className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase">
              Society Portal
            </p>
          </div>
        </Link>

        <button
          onClick={onClose}
          className="lg:hidden text-xl text-slate-400 hover:text-white transition"
        >
          <FaTimes />
        </button>

      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">

        {navSections.map((section, sIdx) => (
          <div key={sIdx}>

            {/* Section Label */}
            {section.label && (
              <p className="px-4 pt-5 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]">
                {section.label}
              </p>
            )}

            {/* Section Items */}
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg mb-0.5 text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 shadow-sm"
                      : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                  }`
                }
              >
                <span className="text-base w-5 flex justify-center shrink-0">
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </NavLink>
            ))}

          </div>
        ))}

      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 p-3">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-500/15 hover:text-red-400 transition text-sm font-medium"
        >
          <FaSignOutAlt />
          Logout
        </button>
      </div>

    </aside>
  );
}
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  FaBars,
  FaMoon,
  FaSun,
} from "react-icons/fa";

import NotificationBell from "../notifications/NotificationBell";
import ProfileMenu from "../profile/ProfileMenu";
import RoleBadge from "../common/RoleBadge";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import GlobalSearch from "../common/GlobalSearch";

const pageTitles = {
  "/admin/dashboard": { title: "D BLOCK RWA INDRAPRASTHA", subtitle: "Society Dashboard — Complete overview" },
  "/admin/registrations": { title: "Registration Requests", subtitle: "Review new resident registrations" },
  "/admin/residents": { title: "Residents", subtitle: "Manage all residents" },
  "/admin/blocks-flats": { title: "Blocks & Flats", subtitle: "Manage society blocks and flat allocation" },
  "/admin/pending-registrations": { title: "Pending Registrations", subtitle: "Review and approve resident registrations" },
  "/admin/family-members": { title: "Family Members", subtitle: "Manage family member accounts" },
  "/admin/profile-requests": { title: "Profile Requests", subtitle: "Review profile update requests" },
  "/admin/bills": { title: "Bills", subtitle: "Manage monthly maintenance bills" },
  "/admin/collections": { title: "Collections", subtitle: "Collect maintenance payments" },
  "/admin/collectors": { title: "Collectors", subtitle: "Manage payment collectors" },
  "/admin/collector-daily-report": { title: "Collector Daily Report", subtitle: "Daily performance analysis" },
  "/admin/notices": { title: "Notice Board", subtitle: "Manage announcements and circulars" },
  "/admin/complaints": { title: "Complaints", subtitle: "Manage resident complaints and grievances" },
  "/admin/events": { title: "Events", subtitle: "Manage society events" },
  "/admin/activities": { title: "Activities", subtitle: "Manage RWA activities and drives" },
  "/admin/activity-logs": { title: "Portal Activity & Login Audit", subtitle: "Real-time logins, system updates & user work tracker" },
  "/admin/emergency-contacts": { title: "Emergency Contacts", subtitle: "Manage emergency and utility contacts" },
  "/admin/committee": { title: "RWA Committee", subtitle: "Manage committee member accounts" },
  "/admin/payment-history": { title: "Payment History", subtitle: "View all transactions" },
  "/admin/receipts": { title: "Receipts", subtitle: "Print payment receipts" },
  "/admin/reports": { title: "Reports", subtitle: "Collection and financial reports" },
  "/admin/settings": { title: "Settings", subtitle: "Application settings" },
  "/admin/blocked-accounts": { title: "Blocked Accounts", subtitle: "Access control & login suspensions" },
  "/admin/deleted-accounts": { title: "Deleted Accounts", subtitle: "Archive of removed accounts" },
  "/admin/reset-data": { title: "Reset Test Data", subtitle: "Wipe testing data & prepare for fresh launch" },
  // Garbage Collection
  "/admin/garbage/dashboard": { title: "Garbage Collection", subtitle: "Overview and analytics" },
  "/admin/garbage/accounts": { title: "Garbage Accounts", subtitle: "Manage garbage collection accounts" },
  "/admin/garbage/bills": { title: "Garbage Bills", subtitle: "Monthly garbage billing" },
  "/admin/garbage/collectors": { title: "Garbage Collectors", subtitle: "Manage collector assignments" },
  "/admin/garbage/reports": { title: "Garbage Reports", subtitle: "Collection and financial reports" },
  "/admin/garbage/requests": { title: "Garbage Requests", subtitle: "Opt-in and opt-out requests" },
  "/admin/garbage/settings": { title: "Garbage Settings", subtitle: "Configure garbage collection" },
};

export default function Navbar({ onToggleSidebar }) {
  const location = useLocation();
  const { darkMode, toggleTheme } = useTheme();
  const { user } = useAuth();

  const pageInfo = useMemo(() => {
    return pageTitles[location.pathname] || {
      title: "Dashboard",
      subtitle: "Welcome back 👋",
    };
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 h-20 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-4 md:px-6">

      {/* Left */}

      <div className="flex items-center gap-4">

        <button
          onClick={onToggleSidebar}
          className="lg:hidden text-2xl text-gray-600 hover:text-emerald-600 transition"
        >
          <FaBars />
        </button>

        <div>

          <h1 className="text-2xl font-bold text-gray-800">
            {pageInfo.title}
          </h1>

          <p className="text-sm text-gray-500">
            {pageInfo.subtitle}
          </p>

        </div>

      </div>

      {/* Right */}

      <div className="flex items-center gap-3">

        {/* Global Search */}
        <GlobalSearch isAdmin={user?.role === "admin"} />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-gray-100 hover:bg-gray-200 transition"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <FaSun className="text-yellow-500" /> : <FaMoon className="text-gray-600" />}
        </button>

        {/* Role Badge */}
        {user && (
          <div className="hidden md:flex items-center gap-2">
            <RoleBadge role={user.role} designation={user.designation} size="md" />
          </div>
        )}

        {/* Notification */}

        <NotificationBell />

        {/* Profile */}

        <ProfileMenu />

      </div>

    </header>
  );
}
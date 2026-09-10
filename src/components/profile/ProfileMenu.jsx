import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FaChevronDown,
  FaCog,
  FaSignOutAlt,
  FaUserCircle,
  FaUserShield,
  FaSlidersH,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const { user, logout } = useAuth();

  const displayName = user?.name || user?.email || "User";
  const displayRole =
    user?.role === "admin"
      ? "Administrator"
      : user?.role === "resident"
      ? "Resident"
      : user?.role === "committee"
      ? "Committee Member"
      : user?.role === "collector"
      ? "Collector"
      : user?.role || "";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 hover:bg-gray-100 rounded-xl px-3 py-2 transition text-left"
        aria-expanded={open}
      >
        <FaUserCircle className="text-4xl text-emerald-600 shrink-0" />

        <div className="hidden md:block">
          <h3 className="font-semibold text-gray-800 text-sm leading-tight">
            {displayName}
          </h3>
          <p className="text-xs text-gray-500">{displayRole}</p>
        </div>

        <FaChevronDown
          className={`hidden md:block text-gray-500 text-xs transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 divide-y divide-gray-100 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header Info */}
          <div className="px-4 py-3 bg-gray-50/80">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Signed in as
            </p>
            <p className="text-sm font-bold text-gray-800 truncate mt-0.5">
              {displayName}
            </p>
            <p className="text-xs text-emerald-600 font-medium">
              {user?.email || user?.phone || displayRole}
            </p>
          </div>

          {/* Navigation Links based on Role */}
          <div className="py-1">
            {user?.role === "admin" && (
              <>
                <Link
                  to="/admin/settings?tab=general"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <FaCog className="text-gray-400 text-base" />
                  <span>Society Settings</span>
                </Link>

                <Link
                  to="/admin/settings?tab=system"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <FaUserShield className="text-emerald-500 text-base" />
                  <span>Admin Account & Access</span>
                </Link>
              </>
            )}

            {user?.role === "resident" && (
              <Link
                to="/resident/profile"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <FaUserCircle className="text-emerald-500 text-base" />
                <span>My Profile & Flat</span>
              </Link>
            )}

            {user?.role === "committee" && (
              <Link
                to="/committee/dashboard"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <FaSlidersH className="text-purple-500 text-base" />
                <span>Committee Portal</span>
              </Link>
            )}

            {user?.role === "collector" && (
              <Link
                to="/collector/dashboard"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <FaSlidersH className="text-blue-500 text-base" />
                <span>Collector Portal</span>
              </Link>
            )}
          </div>

          {/* Logout Action */}
          <div className="py-1">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition font-medium text-left"
            >
              <FaSignOutAlt className="text-base" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
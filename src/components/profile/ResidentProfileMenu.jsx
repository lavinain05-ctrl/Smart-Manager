import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FaChevronDown,
  FaUserCircle,
  FaSlidersH,
  FaSun,
  FaMoon,
  FaSignOutAlt,
  FaBuilding,
  FaShieldAlt,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function ResidentProfileMenu({ resident }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, logout } = useAuth();
  const { darkMode, toggleTheme } = useTheme();

  const displayName = resident?.owner || user?.name || user?.email || "Resident";

  // Compute initials (e.g. "Rahul Sharma" -> "RS")
  const initials = (() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase() || "RS";
  })();

  // Compute subtitle (e.g. "90 METRE Block | Plot D571 | 1st Floor")
  const subtitle = (() => {
    const rawBlock = String(resident?.block || "").trim();
    const block = rawBlock
      ? (rawBlock.toLowerCase().includes("block") ? rawBlock : `${rawBlock} Block`)
      : "D Block";

    const rawPlot = String(resident?.plotNumber || resident?.plot || "").trim();
    const rawFlat = String(resident?.unitNumber || resident?.unit || resident?.flat || resident?.flatNo || "").trim();

    const plotStr = rawPlot
      ? (rawPlot.toLowerCase().startsWith("plot") ? rawPlot : `Plot ${rawPlot}`)
      : "";

    // If flat/unit is missing, or is identical to plot, or is '-' or 'n/a', leave it blank!
    const isSameAsPlot = rawPlot && rawFlat && rawFlat.toLowerCase() === rawPlot.toLowerCase();
    const isInvalidFlat = !rawFlat || rawFlat === "-" || rawFlat.toLowerCase() === "n/a" || isSameAsPlot;

    const flatStr = !isInvalidFlat
      ? (rawFlat.toLowerCase().startsWith("flat") || rawFlat.toLowerCase().startsWith("unit")
          ? rawFlat
          : `Flat ${rawFlat}`)
      : "";

    const floorStr = resident?.floor ? String(resident.floor).trim() : "";

    const parts = [block, plotStr, flatStr, floorStr].filter(Boolean);
    return parts.length > 0 ? parts.join(" | ") : "D Block | Resident";
  })();

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      {/* Trigger Button Matching Mockup */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 sm:gap-2.5 px-2 py-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer focus:outline-hidden"
        aria-expanded={open}
      >
        {/* Blue Circle Initials Avatar */}
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/30">
          {initials}
        </div>

        {/* Text Container (Rahul Sharma / D Block | Plot 3 | Unit 301) */}
        <div className="hidden md:block min-w-0 pr-1 text-left">
          <p className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm leading-tight truncate">
            {displayName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
            {subtitle}
          </p>
        </div>

        <FaChevronDown
          className={`text-slate-400 text-[10px] transition-transform duration-200 hidden sm:block ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Profile Dropdown Menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header Info */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Resident Profile
              </span>
              {user?.role === "committee" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[9px] font-bold">
                  <FaShieldAlt className="text-[8px]" /> Committee
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {displayName}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium truncate">
              {subtitle}
            </p>
          </div>

          {/* Navigation Links */}
          <div className="py-1">
            {user?.role === "committee" && (
              <Link
                to="/committee/dashboard"
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-purple-700 dark:text-purple-300 bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-100/70 font-bold transition"
              >
                <FaSlidersH className="text-purple-600 text-sm" />
                <span>Switch to Committee Portal</span>
              </Link>
            )}

            <Link
              to="/resident/profile"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
            >
              <FaUserCircle className="text-blue-500 text-sm" />
              <span>My Profile & Flat Info</span>
            </Link>

            <Link
              to="/resident/garbage"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
            >
              <FaBuilding className="text-emerald-500 text-sm" />
              <span>Flat Garbage & Society Services</span>
            </Link>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                toggleTheme();
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
            >
              <div className="flex items-center gap-3">
                {darkMode ? <FaSun className="text-amber-400 text-sm" /> : <FaMoon className="text-indigo-400 text-sm" />}
                <span>{darkMode ? "Light Appearance" : "Dark Appearance"}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                {darkMode ? "Dark" : "Light"}
              </span>
            </button>
          </div>

          {/* Logout Action */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition font-bold text-left"
            >
              <FaSignOutAlt className="text-sm" />
              <span>Logout Account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

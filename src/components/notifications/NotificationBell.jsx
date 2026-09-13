import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaCheckDouble,
  FaInfoCircle,
  FaExclamationTriangle,
  FaCalendarAlt,
  FaBullhorn,
  FaMoneyBillWave,
  FaHandHoldingHeart,
  FaTimes,
  FaChevronRight,
} from "react-icons/fa";

import { useNotifications } from "../../context/NotificationContext";

const typeIcons = {
  info: <FaInfoCircle className="text-blue-500" />,
  warning: <FaExclamationTriangle className="text-amber-500" />,
  notice: <FaBullhorn className="text-indigo-500" />,
  event: <FaCalendarAlt className="text-emerald-500" />,
  payment: <FaMoneyBillWave className="text-green-500" />,
  special_collection: <FaHandHoldingHeart className="text-rose-500" />,
  complaint: <FaExclamationTriangle className="text-red-500" />,
};

export default function NotificationBell({ isDark = false }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click (mouse & touch)
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
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

  function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }

  function handleNotificationClick(notif) {
    if (!notif.read) {
      markRead(notif.id);
    }
    if (notif.link) {
      setOpen(false);
      navigate(notif.link);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={open}
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
          isDark
            ? "bg-white/10 hover:bg-white/20 text-white"
            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
        }`}
      >
        <FaBell className="text-base" />

        {/* Unread Badge Counter with Pulse effect */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-600 text-white text-[10px] font-extrabold items-center justify-center shadow-md">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Mobile Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Dropdown Panel */}
      {open && (
        <div className="fixed inset-x-2.5 top-16 sm:inset-auto sm:absolute sm:right-0 sm:top-12 sm:w-96 max-w-sm sm:max-w-none mx-auto sm:mx-0 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[80vh] sm:max-h-[520px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0">
            <div className="flex items-center gap-2">
              <FaBell className="text-amber-400 text-sm" />
              <h3 className="font-bold text-sm">Society Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white transition px-2 py-1 rounded-md hover:bg-white/10"
                  title="Mark all as read"
                >
                  <FaCheckDouble className="text-[10px]" />
                  <span>Mark read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
                aria-label="Close notifications"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>
          </div>

          {/* List of Notifications */}
          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-[65vh] sm:max-h-96 custom-scrollbar flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-300 dark:text-slate-600">
                  <FaBell className="text-xl" />
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No notifications yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Society updates will appear here in real-time</p>
              </div>
            ) : (
              notifications.slice(0, 25).map((notif) => {
                const icon = typeIcons[notif.type] || typeIcons.info;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                      !notif.read
                        ? "bg-indigo-50/70 hover:bg-indigo-50 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60"
                        : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    {/* Type Icon */}
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 text-sm">
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs sm:text-sm leading-snug truncate ${
                            !notif.read
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-medium text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0" />
                        )}
                      </div>

                      {notif.message && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {formatTime(notif.createdAt)}
                        </span>
                        {notif.link && (
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5 hover:underline">
                            View <FaChevronRight className="text-[8px]" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
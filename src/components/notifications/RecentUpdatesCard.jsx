import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBell,
  FaCheckDouble,
  FaBullhorn,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaInfoCircle,
  FaHandHoldingHeart,
  FaChevronRight,
  FaChevronDown,
  FaChevronUp,
  FaClock,
} from "react-icons/fa";
import { useNotifications } from "../../context/NotificationContext";

const typeConfig = {
  notice: {
    icon: <FaBullhorn className="text-indigo-600" />,
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    label: "Notice",
  },
  event: {
    icon: <FaCalendarAlt className="text-emerald-600" />,
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    label: "Event",
  },
  payment: {
    icon: <FaMoneyBillWave className="text-green-600" />,
    bg: "bg-green-50",
    border: "border-green-100",
    label: "Payment",
  },
  special_collection: {
    icon: <FaHandHoldingHeart className="text-rose-600" />,
    bg: "bg-rose-50",
    border: "border-rose-100",
    label: "Special Fund",
  },
  warning: {
    icon: <FaExclamationTriangle className="text-amber-600" />,
    bg: "bg-amber-50",
    border: "border-amber-100",
    label: "Alert",
  },
  info: {
    icon: <FaInfoCircle className="text-blue-600" />,
    bg: "bg-blue-50",
    border: "border-blue-100",
    label: "Update",
  },
};

export default function RecentUpdatesCard({ initialLimit = 3, maxItems, title = "Recent Updates & Announcements" }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const limit = maxItems !== undefined ? maxItems : initialLimit;
  const hasMore = notifications.length > limit;
  const displayed = showAll ? notifications : notifications.slice(0, limit);

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

  function handleClick(notif) {
    if (!notif.read) {
      markRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-base">
            <FaBell />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              {title}
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold tracking-wide uppercase">
                  {unreadCount} New
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">Official updates, circulars, and payment confirmations</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100"
            >
              {showAll ? (
                <>Show Latest ({limit}) <FaChevronUp className="text-[10px]" /></>
              ) : (
                <>View All ({notifications.length}) <FaChevronDown className="text-[10px]" /></>
              )}
            </button>
          )}

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-slate-600 hover:text-slate-800 transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
            >
              <FaCheckDouble className="text-[10px]" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Unread Alert Strip */}
      {unreadCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-rose-500 px-6 py-2.5 text-white flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>
              <strong>Mandatory Notification:</strong> You have {unreadCount} unread society update{unreadCount > 1 ? "s" : ""}. Please review.
            </span>
          </span>
          <span className="text-[10px] text-white/80 hidden sm:inline">Real-time alerts</span>
        </div>
      )}

      {/* Feed List */}
      <div className="p-4 sm:p-6 divide-y divide-slate-100">
        {displayed.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
              <FaBell className="text-xl text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-700">All caught up!</p>
            <p className="text-xs text-slate-400 mt-0.5">No recent notifications or announcements at this time.</p>
          </div>
        ) : (
          displayed.map((notif) => {
            const cfg = typeConfig[notif.type] || typeConfig.info;

            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`py-3.5 first:pt-0 last:pb-0 flex items-start gap-3.5 cursor-pointer rounded-xl px-3 transition-colors ${
                  !notif.read ? "bg-indigo-50/50 hover:bg-indigo-50" : "hover:bg-slate-50"
                }`}
              >
                {/* Type Icon */}
                <div
                  className={`w-9 h-9 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 mt-0.5`}
                >
                  {cfg.icon}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      {cfg.label}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <FaClock className="text-[9px]" /> {formatTime(notif.createdAt)}
                    </span>
                  </div>

                  <h3
                    className={`text-sm mt-0.5 leading-snug ${
                      !notif.read ? "font-bold text-slate-900" : "font-medium text-slate-800"
                    }`}
                  >
                    {notif.title}
                  </h3>

                  {notif.message && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>
                  )}

                  {notif.link && (
                    <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                      <span>View details</span>
                      <FaChevronRight className="text-[9px]" />
                    </div>
                  )}
                </div>

                {/* Unread indicator */}
                {!notif.read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-2 shadow-sm" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Card Footer: View All / Show Less Toggle */}
      {hasMore && (
        <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Showing {showAll ? notifications.length : limit} of {notifications.length} updates
          </span>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 shadow-sm"
          >
            {showAll ? (
              <>
                Show Less <FaChevronUp className="text-[10px]" />
              </>
            ) : (
              <>
                View All ({notifications.length}) <FaChevronDown className="text-[10px]" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

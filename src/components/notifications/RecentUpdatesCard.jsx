import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "react-icons/fa";
import { useNotifications } from "../../context/NotificationContext";

const typeConfig = {
  notice: {
    icon: <FaBullhorn className="text-indigo-600 dark:text-indigo-400 text-xs" />,
    bg: "bg-indigo-50 dark:bg-indigo-950/50",
    border: "border-indigo-100 dark:border-indigo-900/40",
    label: "Notice",
  },
  event: {
    icon: <FaCalendarAlt className="text-emerald-600 dark:text-emerald-400 text-xs" />,
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    border: "border-emerald-100 dark:border-emerald-900/40",
    label: "Event",
  },
  payment: {
    icon: <FaMoneyBillWave className="text-green-600 dark:text-green-400 text-xs" />,
    bg: "bg-green-50 dark:bg-green-950/50",
    border: "border-green-100 dark:border-green-900/40",
    label: "Payment",
  },
  special_collection: {
    icon: <FaHandHoldingHeart className="text-rose-600 dark:text-rose-400 text-xs" />,
    bg: "bg-rose-50 dark:bg-rose-950/50",
    border: "border-rose-100 dark:border-rose-900/40",
    label: "Special Fund",
  },
  warning: {
    icon: <FaExclamationTriangle className="text-amber-600 dark:text-amber-400 text-xs" />,
    bg: "bg-amber-50 dark:bg-amber-950/50",
    border: "border-amber-100 dark:border-amber-900/40",
    label: "Alert",
  },
  info: {
    icon: <FaInfoCircle className="text-blue-600 dark:text-blue-400 text-xs" />,
    bg: "bg-blue-50 dark:bg-blue-950/50",
    border: "border-blue-100 dark:border-blue-900/40",
    label: "Update",
  },
};

export default function RecentUpdatesCard({
  initialLimit = 2,
  maxItems,
  title = "Recent Updates & Announcements",
}) {
  const { notifications = [], unreadCount = 0, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  // If there are no notifications, show a very slim placeholder or null
  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden transition-all duration-200">
      {/* Sleek Compact Header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-850/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm shrink-0">
            <FaBell />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h2>

            {unreadCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                {unreadCount} New
              </span>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition px-2 py-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center gap-1"
              title="Mark all as read"
            >
              <FaCheckDouble className="text-[9px]" />
              <span className="hidden sm:inline">Mark read</span>
            </button>
          )}

          {/* Expand/Collapse Card Content Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center gap-1"
            title={isCollapsed ? "Expand updates" : "Collapse updates"}
          >
            {isCollapsed ? (
              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <span>Show</span> <FaChevronDown className="text-[9px]" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span>Hide</span> <FaChevronUp className="text-[9px]" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Body List (Only shown when not collapsed) */}
      {!isCollapsed && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {displayed.map((notif) => {
            const cfg = typeConfig[notif.type] || typeConfig.info;

            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`group px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors duration-150 ${
                  !notif.read
                    ? "bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40"
                    : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                }`}
              >
                {/* Type Icon Badge */}
                <div
                  className={`w-7 h-7 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}
                >
                  {cfg.icon}
                </div>

                {/* Title & Preview In 1 Line */}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs sm:text-sm truncate leading-snug ${
                        !notif.read
                          ? "font-bold text-slate-900 dark:text-white"
                          : "font-medium text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {notif.title}
                    </p>
                    {notif.message && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {notif.message}
                      </p>
                    )}
                  </div>

                  {/* Category Pill & Time on the right */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-[10px] text-slate-400">
                    <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase">
                      {cfg.label}
                    </span>
                    <span>{formatTime(notif.createdAt)}</span>
                    <FaChevronRight className="text-[8px] text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {/* Unread indicator */}
                {!notif.read && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-xs" />
                )}
              </div>
            );
          })}

          {/* Compact View All / Show Less footer toggle if more items exist */}
          {hasMore && (
            <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-850/20 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 font-medium">
                {showAll ? `Showing all ${notifications.length}` : `Showing 2 of ${notifications.length} updates`}
              </span>
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {showAll ? (
                  <>Show Less <FaChevronUp className="text-[8px]" /></>
                ) : (
                  <>View All ({notifications.length}) <FaChevronDown className="text-[8px]" /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

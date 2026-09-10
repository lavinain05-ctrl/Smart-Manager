import { useState, useMemo, useCallback } from "react";
import {
  FaBell,
  FaSearch,
  FaFilter,
  FaBookmark,
  FaRegBookmark,
  FaCalendarAlt,
  FaFilePdf,
  FaExclamationTriangle,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import jsPDF from "jspdf";

import { useNotices } from "../../context/NoticeContext";

const CATEGORIES = [
  "Notice",
  "Circular",
  "Meeting",
  "Festival",
  "Maintenance",
  "Emergency",
];

const categoryColors = {
  Notice: "bg-blue-100 text-blue-700",
  Circular: "bg-purple-100 text-purple-700",
  Meeting: "bg-indigo-100 text-indigo-700",
  Festival: "bg-pink-100 text-pink-700",
  Maintenance: "bg-yellow-100 text-yellow-700",
  Emergency: "bg-red-100 text-red-700",
};

const priorityColors = {
  Low: "bg-gray-100 text-gray-600",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

const STORAGE_KEY = "rwa-bookmarked-notices";

function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ResidentNotices() {
  const { notices } = useNotices();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [bookmarks, setBookmarks] = useState(getBookmarks);
  const [expandedNotice, setExpandedNotice] = useState(null);

  const toggleBookmark = useCallback((noticeId) => {
    setBookmarks((prev) => {
      const next = prev.includes(noticeId)
        ? prev.filter((id) => id !== noticeId)
        : [...prev, noticeId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      const matchesSearch =
        !search ||
        notice.title?.toLowerCase().includes(search.toLowerCase()) ||
        notice.body?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        !filterCategory || notice.category === filterCategory;

      const matchesBookmark =
        !showBookmarkedOnly || bookmarks.includes(notice.id);

      return matchesSearch && matchesCategory && matchesBookmark;
    });
  }, [notices, search, filterCategory, showBookmarkedOnly, bookmarks]);

  function downloadNoticePDF(notice) {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129);
    doc.text("SOCIETY NOTICE", 105, 20, { align: "center" });

    doc.setDrawColor(16, 185, 129);
    doc.line(15, 28, 195, 28);

    // Category & Priority
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(
      `Category: ${notice.category}   |   Priority: ${notice.priority}`,
      105,
      38,
      { align: "center" }
    );

    // Title
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(notice.title, 15, 52);

    // Date
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Published: ${formatDateShort(notice.createdAt)}`, 15, 60);
    doc.text(`By: ${notice.createdByName || "Admin"}`, 15, 66);

    // Body
    doc.setFontSize(12);
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(notice.body || "", 175);
    doc.text(lines, 15, 78);

    // Footer
    const endY = Math.min(78 + lines.length * 7 + 20, 280);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("This is a computer-generated notice.", 105, endY, {
      align: "center",
    });

    doc.save(`Notice-${notice.title.substring(0, 30)}.pdf`);
  }

  // Emergency notices at top
  const emergencyNotices = filteredNotices.filter(
    (n) => n.category === "Emergency" || n.priority === "Urgent"
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Notices</h1>
        <p className="text-gray-500">Important announcements from your society</p>
      </div>

      {/* Emergency Banner */}
      {emergencyNotices.length > 0 && !showBookmarkedOnly && !search && !filterCategory && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
            <FaExclamationTriangle />
            <span>Urgent / Emergency Notices</span>
          </div>
          <div className="space-y-2">
            {emergencyNotices.slice(0, 3).map((n) => (
              <div
                key={`emg-${n.id}`}
                className="text-sm text-red-800 cursor-pointer hover:underline"
                onClick={() => setExpandedNotice(n.id)}
              >
                • {n.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
              className={`px-4 py-2.5 rounded-xl border font-medium transition flex items-center gap-2 ${
                showBookmarkedOnly
                  ? "bg-yellow-50 border-yellow-300 text-yellow-700"
                  : "hover:bg-gray-50"
              }`}
            >
              <FaBookmark className="text-sm" />
              <span className="hidden sm:inline">Saved</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notices List */}
      {filteredNotices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaBell className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Notices</h2>
          <p className="mt-2">
            {notices.length === 0
              ? "When your admin posts notices, they will appear here."
              : showBookmarkedOnly
              ? "You haven't bookmarked any notices yet."
              : "No notices match your search criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotices.map((notice) => {
            const isExpanded = expandedNotice === notice.id;
            const isBookmarked = bookmarks.includes(notice.id);

            return (
              <div
                key={notice.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${
                  notice.priority === "Urgent" ? "border-l-4 border-l-red-500" :
                  notice.priority === "High" ? "border-l-4 border-l-orange-500" :
                  notice.category === "Emergency" ? "border-l-4 border-l-red-500" :
                  "border-l-4 border-l-blue-500"
                }`}
              >
                <div className="p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryColors[notice.category] || "bg-gray-100 text-gray-600"}`}>
                          {notice.category}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[notice.priority] || "bg-gray-100 text-gray-600"}`}>
                          {notice.priority}
                        </span>
                      </div>

                      {/* Title */}
                      <h3
                        className="text-lg font-bold cursor-pointer hover:text-blue-600 transition"
                        onClick={() => setExpandedNotice(isExpanded ? null : notice.id)}
                      >
                        {notice.title}
                      </h3>

                      {/* Meta */}
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <FaCalendarAlt className="text-xs" />
                          {formatDate(notice.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleBookmark(notice.id)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg transition ${
                          isBookmarked
                            ? "bg-yellow-50 text-yellow-600"
                            : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                        }`}
                        title={isBookmarked ? "Remove bookmark" : "Bookmark"}
                      >
                        {isBookmarked ? <FaBookmark /> : <FaRegBookmark />}
                      </button>
                      <button
                        onClick={() => downloadNoticePDF(notice)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                        title="Download PDF"
                      >
                        <FaFilePdf />
                      </button>
                      <button
                        onClick={() => setExpandedNotice(isExpanded ? null : notice.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
                      >
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                    </div>
                  </div>

                  {/* Body (collapsible) */}
                  <div
                    className={`mt-3 text-gray-700 leading-relaxed transition-all duration-300 overflow-hidden ${
                      isExpanded ? "max-h-[2000px]" : "max-h-12"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{notice.body}</p>
                  </div>

                  {notice.body && notice.body.length > 100 && !isExpanded && (
                    <button
                      onClick={() => setExpandedNotice(notice.id)}
                      className="text-blue-600 text-sm font-medium mt-1 hover:underline"
                    >
                      Read More
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

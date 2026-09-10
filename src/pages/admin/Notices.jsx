import { useState, useMemo } from "react";
import {
  FaBell,
  FaPlus,
  FaTimes,
  FaEdit,
  FaTrash,
  FaSearch,
  FaFilter,
  FaExclamationTriangle,
  FaBullhorn,
  FaCalendarAlt,
  FaShareAlt,
  FaWhatsapp,
  FaLink,
  FaGlobe,
  FaUsers,
  FaUserShield,
  FaFacebook,
  FaTelegram,
} from "react-icons/fa";

import toast from "react-hot-toast";
import { useNotices } from "../../context/NoticeContext";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { createNotification } from "../../services/notificationService";

const CATEGORIES = [
  "Notice",
  "Circular",
  "Meeting",
  "Festival",
  "Maintenance",
  "Emergency",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

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

const audienceLabels = {
  public: { label: "Public", icon: <FaGlobe />, color: "bg-green-100 text-green-700" },
  all_residents: { label: "All Residents", icon: <FaUsers />, color: "bg-blue-100 text-blue-700" },
  committee_only: { label: "Committee Only", icon: <FaUserShield />, color: "bg-purple-100 text-purple-700" },
};

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

function getShareUrl(noticeId) {
  return `${window.location.origin}/share/notice/${noticeId}`;
}

function getWhatsAppText(notice) {
  const url = getShareUrl(notice.id);
  return encodeURIComponent(
    `D BLOCK RWA INDRAPRASTHA\n\n📢 ${notice.title}\n\n${(notice.body || "").slice(0, 200)}${notice.body?.length > 200 ? "..." : ""}\n\nView details:\n${url}`
  );
}

export default function Notices() {
  // Admin uses allNotices to see everything
  const { allNotices: notices, addNotice, updateNotice, deleteNotice } = useNotices();
  const { user } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedNotice, setExpandedNotice] = useState(null);
  const [shareDropdown, setShareDropdown] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Notice");
  const [priority, setPriority] = useState("Medium");
  const [audience, setAudience] = useState(["all_residents"]);
  const [loading, setLoading] = useState(false);

  // Filtered and searched notices
  const filteredNotices = useMemo(() => {
    return (notices || []).filter((notice) => {
      const matchesSearch =
        !search ||
        notice.title?.toLowerCase().includes(search.toLowerCase()) ||
        notice.body?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        !filterCategory || notice.category === filterCategory;

      const matchesPriority =
        !filterPriority || notice.priority === filterPriority;

      return matchesSearch && matchesCategory && matchesPriority;
    });
  }, [notices, search, filterCategory, filterPriority]);

  function toggleAudience(value) {
    setAudience((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((v) => v !== value);
        // Must have at least one selected
        return next.length > 0 ? next : prev;
      }
      return [...prev, value];
    });
  }

  function resetForm() {
    setTitle("");
    setBody("");
    setCategory("Notice");
    setPriority("Medium");
    setAudience(["all_residents"]);
    setEditingNotice(null);
    setShowForm(false);
  }

  function openEditForm(notice) {
    setTitle(notice.title);
    setBody(notice.body);
    setCategory(notice.category);
    setPriority(notice.priority);
    setAudience(notice.audience || ["all_residents"]);
    setEditingNotice(notice);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    if (audience.length === 0) {
      toast.error("Please select at least one audience.");
      return;
    }

    setLoading(true);

    const data = {
      title: title.trim(),
      body: body.trim(),
      category,
      priority,
      audience,
      createdBy: user?.uid || "",
      createdByName: user?.name || user?.email || "Admin",
    };

    let success;

    if (editingNotice) {
      success = await updateNotice(editingNotice.id, data);
    } else {
      success = await addNotice(data);
      if (success) {
        try {
          await createNotification({
            userId: "all",
            title: `📢 Notice: ${data.title}`,
            message: data.body?.slice(0, 140) || "A new official notice has been posted on the society board.",
            type: "notice",
            link: "/resident/notices",
          });
        } catch (err) {
          console.warn("Could not dispatch notice notification:", err);
        }
      }
    }

    if (success) resetForm();
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteNotice(confirmDelete.id);
    setConfirmDelete(null);
  }

  function handleCopyLink(notice) {
    navigator.clipboard.writeText(getShareUrl(notice.id));
    toast.success("Link copied to clipboard!");
    setShareDropdown(null);
  }

  function handleNativeShare(notice) {
    if (navigator.share) {
      navigator.share({
        title: notice.title,
        text: `${notice.title} — D BLOCK RWA INDRAPRASTHA`,
        url: getShareUrl(notice.id),
      }).catch(() => {});
    } else {
      handleCopyLink(notice);
    }
    setShareDropdown(null);
  }

  // Stats
  const totalNotices = (notices || []).length;
  const emergencyCount = (notices || []).filter((n) => n.category === "Emergency").length;
  const thisMonthCount = (notices || []).filter((n) => {
    if (!n.createdAt) return false;
    const d = n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notice Board</h1>
          <p className="text-gray-500">Manage announcements and circulars</p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg"
        >
          <FaPlus />
          New Notice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-emerald-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FaBullhorn className="text-emerald-600 text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalNotices}</p>
              <p className="text-sm text-gray-500">Total Notices</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <FaExclamationTriangle className="text-red-600 text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold">{emergencyCount}</p>
              <p className="text-sm text-gray-500">Emergency Notices</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FaCalendarAlt className="text-blue-600 text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold">{thisMonthCount}</p>
              <p className="text-sm text-gray-500">This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notice List */}
      {filteredNotices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaBell className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Notices Found</h2>
          <p className="mt-2">
            {(notices || []).length === 0
              ? "Create your first notice to get started."
              : "No notices match your search criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotices.map((notice) => {
            const noticeAudience = notice.audience || ["all_residents"];
            const isPublic = noticeAudience.includes("public");

            return (
              <div
                key={notice.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${
                  notice.priority === "Urgent" ? "border-l-4 border-l-red-500" :
                  notice.priority === "High" ? "border-l-4 border-l-orange-500" :
                  "border-l-4 border-l-emerald-500"
                }`}
              >
                <div className="p-5">
                  {/* Notice Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      {/* Category + Priority + Audience Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryColors[notice.category] || "bg-gray-100 text-gray-600"}`}>
                          {notice.category}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[notice.priority] || "bg-gray-100 text-gray-600"}`}>
                          {notice.priority}
                        </span>

                        {/* Audience Badges */}
                        {noticeAudience.map((a) => {
                          const info = audienceLabels[a];
                          if (!info) return null;
                          return (
                            <span
                              key={a}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${info.color}`}
                            >
                              {info.icon}
                              {info.label}
                            </span>
                          );
                        })}
                      </div>

                      <h3
                        className="text-lg font-bold cursor-pointer hover:text-emerald-600 transition"
                        onClick={() =>
                          setExpandedNotice(expandedNotice === notice.id ? null : notice.id)
                        }
                      >
                        {notice.title}
                      </h3>

                      <p className="text-sm text-gray-500 mt-1">
                        By {notice.createdByName} · {formatDate(notice.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Share Button (only for public notices) */}
                      {isPublic && (
                        <div className="relative">
                          <button
                            onClick={() => setShareDropdown(shareDropdown === notice.id ? null : notice.id)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
                            title="Share"
                          >
                            <FaShareAlt />
                          </button>

                          {/* Share Dropdown */}
                          {shareDropdown === notice.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border z-20 py-1">
                              <button
                                onClick={() => handleCopyLink(notice)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition"
                              >
                                <FaLink className="text-gray-500" /> Copy Link
                              </button>
                              <a
                                href={`https://wa.me/?text=${getWhatsAppText(notice)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setShareDropdown(null)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition"
                              >
                                <FaWhatsapp className="text-green-600" /> WhatsApp
                              </a>
                              <a
                                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl(notice.id))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setShareDropdown(null)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition"
                              >
                                <FaFacebook className="text-blue-600" /> Facebook
                              </a>
                              <a
                                href={`https://t.me/share/url?url=${encodeURIComponent(getShareUrl(notice.id))}&text=${encodeURIComponent(notice.title)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setShareDropdown(null)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition"
                              >
                                <FaTelegram className="text-blue-400" /> Telegram
                              </a>
                              {navigator.share && (
                                <button
                                  onClick={() => handleNativeShare(notice)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition"
                                >
                                  <FaShareAlt className="text-gray-500" /> More...
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => openEditForm(notice)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(notice)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  {/* Notice Body */}
                  <div
                    className={`mt-3 text-gray-700 leading-relaxed transition-all duration-300 ${
                      expandedNotice === notice.id
                        ? ""
                        : "line-clamp-2"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{notice.body}</p>
                  </div>

                  {notice.body && notice.body.length > 150 && (
                    <button
                      onClick={() =>
                        setExpandedNotice(expandedNotice === notice.id ? null : notice.id)
                      }
                      className="text-emerald-600 text-sm font-medium mt-2 hover:underline"
                    >
                      {expandedNotice === notice.id ? "Show Less" : "Read More"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Notice Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">
                {editingNotice ? "Edit Notice" : "Create New Notice"}
              </h2>
              <button
                onClick={resetForm}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Title */}
              <div>
                <label className="block mb-2 font-medium">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter notice title"
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Audience / Visibility */}
              <div>
                <label className="block mb-2 font-medium">
                  Audience / Visibility <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Select who can see this notice. You can select multiple options.
                </p>
                <div className="space-y-2">
                  {[
                    { value: "public", label: "Public Share", desc: "Anyone with the link can view (no login required)", icon: <FaGlobe className="text-green-600" /> },
                    { value: "all_residents", label: "All Residents", desc: "Visible to all registered residents in-app", icon: <FaUsers className="text-blue-600" /> },
                    { value: "committee_only", label: "Committee Members Only", desc: "Only committee members can see this", icon: <FaUserShield className="text-purple-600" /> },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition select-none ${
                        audience.includes(opt.value)
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={audience.includes(opt.value)}
                        onChange={() => toggleAudience(opt.value)}
                        className="w-4 h-4 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-medium text-sm">
                          {opt.icon}
                          {opt.label}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block mb-2 font-medium">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write notice content here..."
                  rows={8}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 rounded-xl border hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold transition"
                >
                  {loading
                    ? "Publishing..."
                    : editingNotice
                    ? "Update Notice"
                    : "Publish Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Notice"
          message={`Are you sure you want to delete "${confirmDelete.title}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

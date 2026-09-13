import { useState, useEffect, useMemo } from "react";
import {
  FaLightbulb,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaClock,
  FaTimes,
  FaUserSecret,
  FaCommentDots,
  FaPaperPlane,
  FaTrash,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";
import toast from "react-hot-toast";

import {
  subscribeSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUSES,
  SUGGESTION_STATUS_CONFIG,
} from "../../services/suggestionService";
import { subscribeSettings, saveSettings } from "../../services/settingsService";
import ConfirmDialog from "../../components/common/ConfirmDialog";

export default function Suggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    enableSuggestions: true,
    enableComplaints: true,
  });
  const [updatingSetting, setUpdatingSetting] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Review Modal State
  const [activeItem, setActiveItem] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("Under Review");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // Delete Confirm State
  const [itemToDelete, setItemToDelete] = useState(null);

  // Subscribe to Suggestions
  useEffect(() => {
    const unsub = subscribeSuggestions((data) => {
      setSuggestions(data || []);
      setLoading(false);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Subscribe to Settings
  useEffect(() => {
    const unsub = subscribeSettings((data) => {
      if (data) {
        setSettings({
          enableSuggestions: data.enableSuggestions !== false,
          enableComplaints: data.enableComplaints !== false,
        });
      }
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Toggle Suggestion Box Enable / Disable
  async function handleToggleSuggestions() {
    setUpdatingSetting(true);
    const nextVal = !settings.enableSuggestions;
    try {
      await saveSettings({ enableSuggestions: nextVal });
      setSettings((prev) => ({ ...prev, enableSuggestions: nextVal }));
      toast.success(
        nextVal
          ? "Suggestion Box is now ENABLED for residents."
          : "Suggestion Box is now PAUSED for residents."
      );
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error("Could not update settings.");
    } finally {
      setUpdatingSetting(false);
    }
  }

  // Toggle Complaints Enable / Disable
  async function handleToggleComplaints() {
    setUpdatingSetting(true);
    const nextVal = !settings.enableComplaints;
    try {
      await saveSettings({ enableComplaints: nextVal });
      setSettings((prev) => ({ ...prev, enableComplaints: nextVal }));
      toast.success(
        nextVal
          ? "Complaints system is now ENABLED for residents."
          : "Complaints registration is now PAUSED for residents."
      );
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error("Could not update settings.");
    } finally {
      setUpdatingSetting(false);
    }
  }

  // Open Review Modal
  function openReviewModal(item) {
    setActiveItem(item);
    setSelectedStatus(item.status || "Under Review");
    setAdminRemarks(item.adminRemarks || "");
  }

  // Save Status & Remarks
  async function handleSaveStatus(e) {
    e.preventDefault();
    if (!activeItem) return;

    setSavingStatus(true);
    try {
      await updateSuggestionStatus(activeItem.id, selectedStatus, adminRemarks);
      toast.success("Suggestion status & response updated successfully.");
      setActiveItem(null);
    } catch (err) {
      console.error("Error updating suggestion:", err);
      toast.error("Failed to update suggestion.");
    } finally {
      setSavingStatus(false);
    }
  }

  // Delete Suggestion
  async function handleDelete() {
    if (!itemToDelete) return;
    try {
      await deleteSuggestion(itemToDelete.id);
      toast.success("Suggestion removed.");
      setItemToDelete(null);
    } catch (err) {
      console.error("Error deleting suggestion:", err);
      toast.error("Could not delete suggestion.");
    }
  }

  // Statistics
  const stats = useMemo(() => {
    const total = suggestions.length;
    const underReview = suggestions.filter((s) => s.status === "Under Review").length;
    const approved = suggestions.filter((s) => s.status === "Approved" || s.status === "Acknowledged").length;
    const implemented = suggestions.filter((s) => s.status === "Implemented").length;
    return { total, underReview, approved, implemented };
  }, [suggestions]);

  // Filtered list
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      if (statusFilter !== "All" && s.status !== statusFilter) return false;
      if (categoryFilter !== "All" && s.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = s.title?.toLowerCase().includes(q);
        const matchDesc = s.description?.toLowerCase().includes(q);
        const matchResident = s.residentName?.toLowerCase().includes(q);
        const matchFlat = s.flatNumber?.toLowerCase().includes(q);
        return matchTitle || matchDesc || matchResident || matchFlat;
      }
      return true;
    });
  }, [suggestions, statusFilter, categoryFilter, search]);

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ═══════════ Top Header & Instant Submission Toggles ═══════════ */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <FaLightbulb className="text-amber-500" />
              Resident Suggestion Box & Feedback
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Suggestions & Citizen Ideas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Review resident proposals, provide official committee responses, and toggle submission availability.
          </p>
        </div>

        {/* Instant Feature Switches */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Suggestion Box Switch */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Suggestion Box
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${settings.enableSuggestions ? "text-emerald-600" : "text-rose-600"}`}>
                {settings.enableSuggestions ? "● Enabled" : "○ Paused"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleSuggestions}
              disabled={updatingSetting}
              className="text-2xl text-slate-700 hover:text-blue-600 transition disabled:opacity-50"
              title={settings.enableSuggestions ? "Click to Pause" : "Click to Enable"}
            >
              {settings.enableSuggestions ? (
                <FaToggleOn className="text-emerald-600" />
              ) : (
                <FaToggleOff className="text-slate-400" />
              )}
            </button>
          </div>

          {/* Complaints System Switch */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Complaints System
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${settings.enableComplaints ? "text-emerald-600" : "text-rose-600"}`}>
                {settings.enableComplaints ? "● Enabled" : "○ Paused"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleComplaints}
              disabled={updatingSetting}
              className="text-2xl text-slate-700 hover:text-blue-600 transition disabled:opacity-50"
              title={settings.enableComplaints ? "Click to Pause" : "Click to Enable"}
            >
              {settings.enableComplaints ? (
                <FaToggleOn className="text-emerald-600" />
              ) : (
                <FaToggleOff className="text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ KPI Metric Cards ═══════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Ideas</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
            <p className="text-xs text-slate-500 mt-0.5">All received submissions</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
            <FaLightbulb />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Under Review</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{stats.underReview}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Awaiting decision</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
            <FaClock />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Approved</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{stats.approved}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Accepted for society</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <FaCheckCircle />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Implemented</p>
            <h3 className="text-2xl font-black text-purple-600 mt-1">{stats.implemented}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Completed improvements</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
            <FaCheckCircle />
          </div>
        </div>
      </div>

      {/* ═══════════ Search & Filters ═══════════ */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search by title, resident name, flat number, or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <FaFilter className="text-[10px]" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="All">All Statuses</option>
            {SUGGESTION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 text-xs text-slate-500 ml-2">
            <span>Category:</span>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="All">All Categories</option>
            {SUGGESTION_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ═══════════ Suggestions Feed ═══════════ */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          Loading suggestions...
        </div>
      ) : filteredSuggestions.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200 shadow-sm space-y-2">
          <FaLightbulb className="text-4xl text-slate-300 mx-auto" />
          <h3 className="font-bold text-base text-slate-700">No suggestions found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search || statusFilter !== "All" || categoryFilter !== "All"
              ? "No proposals matched your active search or filter criteria."
              : "Resident suggestions and ideas will appear here once submitted."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuggestions.map((item) => {
            const statusCfg =
              SUGGESTION_STATUS_CONFIG[item.status] || SUGGESTION_STATUS_CONFIG["Under Review"];

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Category & Status Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                      {item.category}
                    </span>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.color}`}
                      >
                        {item.status}
                      </span>

                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition"
                        title="Delete suggestion"
                      >
                        <FaTrash className="text-xs" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                      {item.description}
                    </p>
                  </div>

                  {/* Admin Remarks if already provided */}
                  {item.adminRemarks && (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                      <span className="font-bold text-emerald-800 flex items-center gap-1">
                        <FaCommentDots /> Admin Response:
                      </span>
                      <p className="text-emerald-950 leading-relaxed">
                        {item.adminRemarks}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer: Resident info + Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-slate-500">
                    {item.isAnonymous ? (
                      <span className="font-bold text-amber-700 flex items-center gap-1.5">
                        <FaUserSecret /> Anonymous Resident
                      </span>
                    ) : (
                      <div>
                        <span className="font-bold text-slate-800">{item.residentName}</span>
                        {item.flatNumber && <span> • Flat {item.flatNumber}</span>}
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400 block">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openReviewModal(item)}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                  >
                    Review & Reply
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ Review & Status Update Modal ═══════════ */}
      {activeItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5 border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                  <FaLightbulb />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Review Suggestion & Respond
                  </h3>
                  <p className="text-xs text-slate-400">
                    Update status and reply to resident
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl transition"
              >
                <FaTimes />
              </button>
            </div>

            {/* Proposal Details Snippet */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Category: <strong className="text-slate-700">{activeItem.category}</strong></span>
                <span>{activeItem.isAnonymous ? "Submitted Anonymously" : `Flat ${activeItem.flatNumber || "—"}`}</span>
              </div>
              <h4 className="font-bold text-sm text-slate-900">{activeItem.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto">
                {activeItem.description}
              </p>
            </div>

            {/* Update Form */}
            <form onSubmit={handleSaveStatus} className="space-y-4">
              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Update Status
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SUGGESTION_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSelectedStatus(st)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        selectedStatus === st
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin Remarks / Reply */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Official Committee Remarks / Reply (Visible to Resident)
                </label>
                <textarea
                  rows={3}
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  placeholder="e.g. Approved in the monthly RWA meeting. Scheduled for execution next week..."
                  className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  disabled={savingStatus}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
                >
                  <FaPaperPlane className="text-[10px]" />
                  {savingStatus ? "Saving..." : "Save Status & Reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {itemToDelete && (
        <ConfirmDialog
          open={Boolean(itemToDelete)}
          title="Delete Suggestion"
          message="Are you sure you want to remove this suggestion? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setItemToDelete(null)}
        />
      )}
    </div>
  );
}

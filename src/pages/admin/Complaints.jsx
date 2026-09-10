import { useState, useMemo } from "react";
import {
  FaExclamationCircle,
  FaSearch,
  FaFilter,
  FaTrash,
  FaCheckCircle,
  FaClock,
  FaSpinner,
  FaTimesCircle,
  FaChevronDown,
  FaChevronUp,
  FaCommentDots,
  FaPaperPlane,
  FaUserTag,
} from "react-icons/fa";

import { useComplaints } from "../../context/ComplaintContext";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";

const CATEGORIES = [
  "Garbage",
  "Water",
  "Drainage",
  "Street Light",
  "Electricity",
  "Road",
  "Cleaning",
  "Other",
];

const STATUSES = ["Pending", "In Progress", "Resolved", "Rejected"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const statusColors = {
  Pending: "bg-yellow-100 text-yellow-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Resolved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

const statusIcons = {
  Pending: <FaClock />,
  "In Progress": <FaSpinner className="animate-spin" />,
  Resolved: <FaCheckCircle />,
  Rejected: <FaTimesCircle />,
};

const priorityColors = {
  Low: "bg-gray-100 text-gray-600",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Urgent: "bg-red-100 text-red-700",
};

const categoryIcons = {
  Garbage: "🗑️",
  Water: "💧",
  Drainage: "🚰",
  "Street Light": "💡",
  Electricity: "⚡",
  Road: "🛣️",
  Cleaning: "🧹",
  Other: "📋",
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

function getResolutionTime(createdAt, resolvedAt) {
  if (!createdAt || !resolvedAt) return null;
  const start = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const end = resolvedAt.toDate ? resolvedAt.toDate() : new Date(resolvedAt);
  const diffMs = end - start;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays > 0) return `${diffDays}d ${diffHrs % 24}h`;
  return `${diffHrs}h`;
}

export default function Complaints() {
  const { complaints, updateComplaintStatus, addComment, deleteComplaint } =
    useComplaints();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Status update modal state
  const [statusModal, setStatusModal] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  // Comment state
  const [commentText, setCommentText] = useState("");

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchesSearch =
        !search ||
        c.description?.toLowerCase().includes(search.toLowerCase()) ||
        c.residentName?.toLowerCase().includes(search.toLowerCase()) ||
        c.flat?.toLowerCase().includes(search.toLowerCase()) ||
        c.category?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = !filterStatus || c.status === filterStatus;
      const matchesCategory = !filterCategory || c.category === filterCategory;
      const matchesPriority = !filterPriority || c.priority === filterPriority;

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
    });
  }, [complaints, search, filterStatus, filterCategory, filterPriority]);

  // Stats
  const pending = complaints.filter((c) => c.status === "Pending").length;
  const inProgress = complaints.filter((c) => c.status === "In Progress").length;
  const resolved = complaints.filter((c) => c.status === "Resolved").length;
  const total = complaints.length;

  const avgResolutionTime = useMemo(() => {
    const resolvedComplaints = complaints.filter(
      (c) => c.status === "Resolved" && c.createdAt && c.resolvedAt
    );
    if (resolvedComplaints.length === 0) return "—";

    const totalMs = resolvedComplaints.reduce((sum, c) => {
      const start = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
      const end = c.resolvedAt.toDate ? c.resolvedAt.toDate() : new Date(c.resolvedAt);
      return sum + (end - start);
    }, 0);

    const avgHrs = Math.round(totalMs / resolvedComplaints.length / (1000 * 60 * 60));
    if (avgHrs >= 24) return `${Math.round(avgHrs / 24)}d`;
    return `${avgHrs}h`;
  }, [complaints]);

  async function handleStatusUpdate() {
    if (!statusModal || !newStatus) return;

    const updateData = {};
    if (assignedTo) {
      updateData.assignedTo = assignedTo;
      updateData.assignedToName = assignedTo;
    }

    if (Object.keys(updateData).length > 0) {
      const { updateComplaint } = await import("../../context/ComplaintContext").then(() => {
        // We use the context function via updateComplaintStatus which handles timeline
        return {};
      });
    }

    // If there's assignment data, update it separately
    if (assignedTo && assignedTo !== statusModal.assignedTo) {
      const { updateComplaint: updateFn } = await import("../../services/complaintService");
      await updateFn(statusModal.id, {
        assignedTo,
        assignedToName: assignedTo,
      });
    }

    await updateComplaintStatus(
      statusModal.id,
      statusModal.timeline || [],
      newStatus,
      statusNote || undefined
    );

    setStatusModal(null);
    setNewStatus("");
    setStatusNote("");
    setAssignedTo("");
  }

  async function handleAddComment(complaint) {
    if (!commentText.trim()) return;

    await addComment(complaint.id, complaint.comments || [], {
      text: commentText.trim(),
      by: user?.name || user?.email || "Admin",
      byRole: "admin",
    });

    setCommentText("");
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteComplaint(confirmDelete.id);
    setConfirmDelete(null);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Complaints</h1>
        <p className="text-gray-500">Manage resident complaints and grievances</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-emerald-500">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-sm text-gray-500">Total</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-yellow-500">
          <p className="text-2xl font-bold">{pending}</p>
          <p className="text-sm text-gray-500">Pending</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-blue-500">
          <p className="text-2xl font-bold">{inProgress}</p>
          <p className="text-sm text-gray-500">In Progress</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-green-500">
          <p className="text-2xl font-bold">{resolved}</p>
          <p className="text-sm text-gray-500">Resolved</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-purple-500 col-span-2 lg:col-span-1">
          <p className="text-2xl font-bold">{avgResolutionTime}</p>
          <p className="text-sm text-gray-500">Avg. Resolution</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search complaints..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
            >
              <option value="">All Status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <div className="relative">
              <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="pl-9 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
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

      {/* Complaint List */}
      {filteredComplaints.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaExclamationCircle className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Complaints Found</h2>
          <p className="mt-2">
            {complaints.length === 0
              ? "No complaints have been submitted yet."
              : "No complaints match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredComplaints.map((complaint) => {
            const isExpanded = expandedId === complaint.id;

            return (
              <div
                key={complaint.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${
                  complaint.priority === "Urgent"
                    ? "border-l-4 border-l-red-500"
                    : complaint.priority === "High"
                    ? "border-l-4 border-l-orange-500"
                    : complaint.status === "Resolved"
                    ? "border-l-4 border-l-green-500"
                    : "border-l-4 border-l-yellow-500"
                }`}
              >
                <div className="p-5">
                  {/* Top Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${statusColors[complaint.status]}`}>
                          {statusIcons[complaint.status]}
                          {complaint.status}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          {categoryIcons[complaint.category]} {complaint.category}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[complaint.priority]}`}>
                          {complaint.priority}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-gray-800 font-medium">
                        {complaint.description?.substring(0, 150)}
                        {complaint.description?.length > 150 && !isExpanded ? "..." : ""}
                      </p>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-2">
                        <span>🏠 {complaint.flat}{complaint.block ? `, ${complaint.block}` : ""}</span>
                        <span>👤 {complaint.residentName}</span>
                        <span>📅 {formatDate(complaint.createdAt)}</span>
                        {complaint.assignedTo && (
                          <span className="text-blue-600">
                            <FaUserTag className="inline mr-1" />
                            {complaint.assignedToName || complaint.assignedTo}
                          </span>
                        )}
                        {complaint.status === "Resolved" && complaint.resolvedAt && (
                          <span className="text-green-600">
                            ✅ Resolved in {getResolutionTime(complaint.createdAt, complaint.resolvedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setStatusModal(complaint);
                          setNewStatus(complaint.status);
                          setAssignedTo(complaint.assignedTo || "");
                        }}
                        className="px-3 py-2 text-sm rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition font-medium"
                        title="Update Status"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : complaint.id)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
                      >
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(complaint)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Section */}
                  {isExpanded && (
                    <div className="mt-5 pt-5 border-t space-y-5">

                      {/* Full Description */}
                      {complaint.description?.length > 150 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Full Description</h4>
                          <p className="text-gray-700 whitespace-pre-wrap">{complaint.description}</p>
                        </div>
                      )}

                      {/* Timeline */}
                      {complaint.timeline && complaint.timeline.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Timeline</h4>
                          <div className="space-y-3">
                            {complaint.timeline.map((entry, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                                  entry.status === "Resolved" ? "bg-green-500" :
                                  entry.status === "In Progress" ? "bg-blue-500" :
                                  entry.status === "Rejected" ? "bg-red-500" :
                                  "bg-yellow-500"
                                }`} />
                                <div>
                                  <p className="text-sm font-medium">{entry.status}</p>
                                  <p className="text-xs text-gray-500">{entry.note}</p>
                                  <p className="text-xs text-gray-400">
                                    {new Date(entry.date).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Comments */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                          <FaCommentDots /> Comments ({(complaint.comments || []).length})
                        </h4>

                        {(complaint.comments || []).length > 0 && (
                          <div className="space-y-3 mb-4">
                            {complaint.comments.map((comment, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-xl text-sm ${
                                  comment.byRole === "admin"
                                    ? "bg-emerald-50 border border-emerald-200"
                                    : "bg-gray-50 border border-gray-200"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-sm">
                                    {comment.by}
                                    {comment.byRole === "admin" && (
                                      <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Admin</span>
                                    )}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {new Date(comment.date).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <p className="text-gray-700">{comment.text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Comment */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Write a comment..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddComment(complaint);
                            }}
                            className="flex-1 border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                          />
                          <button
                            onClick={() => handleAddComment(complaint)}
                            disabled={!commentText.trim()}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white transition"
                          >
                            <FaPaperPlane />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold">Update Complaint</h2>
              <p className="text-sm text-gray-500 mt-1">
                {statusModal.category} — {statusModal.flat}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block mb-2 font-medium text-sm">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">Assign To (optional)</label>
                <input
                  type="text"
                  placeholder="Person name"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">Note (optional)</label>
                <textarea
                  placeholder="Add a note about this status change..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={3}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => {
                  setStatusModal(null);
                  setNewStatus("");
                  setStatusNote("");
                  setAssignedTo("");
                }}
                className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Complaint"
          message={`Are you sure you want to delete this complaint from ${confirmDelete.residentName}? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import {
  FaPlus,
  FaTimes,
  FaExclamationCircle,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaClock,
  FaSpinner,
  FaTimesCircle,
  FaChevronDown,
  FaChevronUp,
  FaCommentDots,
  FaPaperPlane,
} from "react-icons/fa";

import { useComplaints } from "../../context/ComplaintContext";
import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";

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

export default function ResidentComplaints() {
  const { complaints, addComplaint, addComment } = useComplaints();
  const { user } = useAuth();
  const { residents = [] } = useResidents();

  const canonicalResident = useMemo(() => {
    return (
      residents.find((r) => r.id === user?.residentId || r.id === user?.uid) ||
      residents.find((r) => user?.phone && r.mobile === user?.phone) ||
      residents.find((r) => user?.email && r.email?.toLowerCase() === user?.email?.toLowerCase()) ||
      null
    );
  }, [residents, user]);

  const canonicalResidentId = canonicalResident?.id || user?.residentId || user?.uid;

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(false);

  // Form state
  const [category, setCategory] = useState("Garbage");
  const [priority, setPriority] = useState("Medium");
  const [description, setDescription] = useState("");

  // Only this resident's complaints
  const myComplaints = useMemo(() => {
    return complaints.filter(
      (c) =>
        c.residentId === canonicalResidentId ||
        c.residentId === user?.residentId ||
        c.residentId === user?.uid
    );
  }, [complaints, canonicalResidentId, user]);

  const filteredComplaints = useMemo(() => {
    return myComplaints.filter((c) => {
      const matchesSearch =
        !search ||
        c.description?.toLowerCase().includes(search.toLowerCase()) ||
        c.category?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = !filterStatus || c.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [myComplaints, search, filterStatus]);

  // Stats
  const pending = myComplaints.filter((c) => c.status === "Pending").length;
  const inProgress = myComplaints.filter((c) => c.status === "In Progress").length;
  const resolved = myComplaints.filter((c) => c.status === "Resolved").length;

  function resetForm() {
    setCategory("Garbage");
    setPriority("Medium");
    setDescription("");
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);

    const success = await addComplaint({
      residentId: canonicalResidentId || user?.uid || "",
      residentName: canonicalResident?.owner || user?.name || user?.email || "Resident",
      flat: canonicalResident?.flat || user?.flat || "",
      block: canonicalResident?.block || user?.block || "",
      category,
      priority,
      description: description.trim(),
    });

    if (success) resetForm();
    setLoading(false);
  }

  async function handleAddComment(complaint) {
    if (!commentText.trim()) return;

    await addComment(complaint.id, complaint.comments || [], {
      text: commentText.trim(),
      by: canonicalResident?.owner || user?.name || user?.email || "Resident",
      byRole: "resident",
    });

    setCommentText("");
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Complaints</h1>
          <p className="text-gray-500">Submit and track your complaints</p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg"
        >
          <FaPlus />
          New Complaint
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-yellow-500 text-center">
          <p className="text-2xl font-bold">{pending}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-blue-500 text-center">
          <p className="text-2xl font-bold">{inProgress}</p>
          <p className="text-xs text-gray-500">In Progress</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-green-500 text-center">
          <p className="text-2xl font-bold">{resolved}</p>
          <p className="text-xs text-gray-500">Resolved</p>
        </div>
      </div>

      {/* Search & Filters */}
      {myComplaints.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search your complaints..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      )}

      {/* Complaint List */}
      {filteredComplaints.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaExclamationCircle className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">
            {myComplaints.length === 0 ? "No Complaints" : "No Results"}
          </h2>
          <p className="mt-2">
            {myComplaints.length === 0
              ? "You haven't submitted any complaints yet."
              : "No complaints match your search."}
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
                  complaint.status === "Resolved"
                    ? "border-l-4 border-l-green-500"
                    : complaint.status === "Rejected"
                    ? "border-l-4 border-l-red-500"
                    : complaint.status === "In Progress"
                    ? "border-l-4 border-l-blue-500"
                    : "border-l-4 border-l-yellow-500"
                }`}
              >
                <div className="p-5">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
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

                      <p className="text-gray-800 font-medium">
                        {isExpanded
                          ? complaint.description
                          : complaint.description?.substring(0, 120) +
                            (complaint.description?.length > 120 ? "..." : "")}
                      </p>

                      <p className="text-sm text-gray-500 mt-2">
                        📅 {formatDate(complaint.createdAt)}
                        {complaint.assignedToName && (
                          <span className="ml-3 text-blue-600">
                            👷 {complaint.assignedToName}
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : complaint.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition shrink-0"
                    >
                      {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                  </div>

                  {/* Expanded: Timeline + Comments */}
                  {isExpanded && (
                    <div className="mt-5 pt-5 border-t space-y-5">

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
                                    : "bg-blue-50 border border-blue-200"
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
                            className="flex-1 border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                          <button
                            onClick={() => handleAddComment(complaint)}
                            disabled={!commentText.trim()}
                            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white transition"
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

      {/* New Complaint Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">Submit Complaint</h2>
              <button
                onClick={resetForm}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              {/* Category */}
              <div>
                <label className="block mb-2 font-medium">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`p-3 rounded-xl border text-sm font-medium transition text-left ${
                        category === cat
                          ? "bg-blue-50 border-blue-500 text-blue-700"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {categoryIcons[cat]} {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block mb-2 font-medium">Priority</label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 p-2.5 rounded-xl border text-sm font-medium transition ${
                        priority === p
                          ? "bg-blue-50 border-blue-500 text-blue-700"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block mb-2 font-medium">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your complaint in detail..."
                  rows={5}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
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
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold transition"
                >
                  {loading ? "Submitting..." : "Submit Complaint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

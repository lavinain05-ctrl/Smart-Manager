import { useState, useMemo } from "react";
import {
  FaPlus,
  FaTimes,
  FaEdit,
  FaTrash,
  FaSearch,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUser,
  FaLeaf,
  FaTree,
  FaHandshake,
  FaStar,
  FaBullhorn,
  FaTint,
  FaEllipsisH,
  FaFilter,
} from "react-icons/fa";

import { useActivities } from "../../context/ActivityContext";
import { ACTIVITY_CATEGORIES } from "../../services/activityService";
import ConfirmDialog from "../../components/common/ConfirmDialog";

const categoryIcons = {
  "Cleaning Drive": <FaLeaf className="text-green-500" />,
  "Tree Plantation": <FaTree className="text-emerald-600" />,
  "Meeting": <FaHandshake className="text-blue-500" />,
  "Festival Celebration": <FaStar className="text-yellow-500" />,
  "Social Activity": <FaHandshake className="text-purple-500" />,
  "Awareness Campaign": <FaBullhorn className="text-orange-500" />,
  "Blood Donation": <FaTint className="text-red-500" />,
  "Other": <FaEllipsisH className="text-gray-400" />,
};

const categoryColors = {
  "Cleaning Drive": "bg-green-50 border-green-200",
  "Tree Plantation": "bg-emerald-50 border-emerald-200",
  "Meeting": "bg-blue-50 border-blue-200",
  "Festival Celebration": "bg-yellow-50 border-yellow-200",
  "Social Activity": "bg-purple-50 border-purple-200",
  "Awareness Campaign": "bg-orange-50 border-orange-200",
  "Blood Donation": "bg-red-50 border-red-200",
  "Other": "bg-gray-50 border-gray-200",
};

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming", color: "bg-blue-100 text-blue-700" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
];

export default function Activities() {
  const { activities, addActivity, updateActivity, deleteActivity } = useActivities();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [highlights, setHighlights] = useState("");

  function resetForm() {
    setTitle(""); setDescription(""); setCategory("Other");
    setDate(""); setTime(""); setLocation("");
    setOrganizer(""); setStatus("upcoming"); setHighlights("");
    setEditing(null); setShowForm(false);
  }

  function openEdit(activity) {
    setTitle(activity.title || "");
    setDescription(activity.description || "");
    setCategory(activity.category || "Other");
    setDate(activity.date || "");
    setTime(activity.time || "");
    setLocation(activity.location || "");
    setOrganizer(activity.organizer || "");
    setStatus(activity.status || "upcoming");
    setHighlights(activity.highlights || "");
    setEditing(activity);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);

    const data = { title: title.trim(), description, category, date, time, location, organizer, status, highlights };

    if (editing) {
      await updateActivity(editing.id, data);
    } else {
      await addActivity(data);
    }

    resetForm();
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteActivity(confirmDelete.id);
    setConfirmDelete(null);
  }

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (filterCategory !== "All" && a.category !== filterCategory) return false;
      if (filterStatus !== "All" && a.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          a.title?.toLowerCase().includes(s) ||
          a.category?.toLowerCase().includes(s) ||
          a.organizer?.toLowerCase().includes(s) ||
          a.location?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [activities, search, filterCategory, filterStatus]);

  // Stats
  const upcoming = activities.filter((a) => a.status === "upcoming").length;
  const completed = activities.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">RWA Activities</h1>
          <p className="text-gray-500">Manage society activities and events timeline</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg"
        >
          <FaPlus /> Add Activity
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-blue-500">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold">{activities.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-indigo-500">
          <p className="text-xs text-gray-500">Upcoming</p>
          <p className="text-2xl font-bold">{upcoming}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-green-500">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="text-2xl font-bold">{completed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <FaFilter className="text-gray-400 text-sm" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="All">All Categories</option>
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="All">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Activities List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaCalendarAlt className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">{activities.length === 0 ? "No Activities Yet" : "No Results"}</h2>
          <p className="mt-2">Create your first activity to start building the timeline.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((activity) => {
            const statusConfig = STATUS_OPTIONS.find((s) => s.value === activity.status) || STATUS_OPTIONS[0];
            const bgClass = categoryColors[activity.category] || categoryColors.Other;

            return (
              <div
                key={activity.id}
                className={`rounded-2xl shadow-sm border p-5 ${bgClass} transition hover:shadow-md`}
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{categoryIcons[activity.category] || categoryIcons.Other}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/70">
                        {activity.category}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-gray-800">{activity.title}</h3>

                    {activity.description && (
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{activity.description}</p>
                    )}

                    <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                      {activity.date && (
                        <span className="flex items-center gap-1">
                          <FaCalendarAlt className="text-xs" /> {activity.date}
                          {activity.time && ` at ${activity.time}`}
                        </span>
                      )}
                      {activity.location && (
                        <span className="flex items-center gap-1">
                          <FaMapMarkerAlt className="text-xs" /> {activity.location}
                        </span>
                      )}
                      {activity.organizer && (
                        <span className="flex items-center gap-1">
                          <FaUser className="text-xs" /> {activity.organizer}
                        </span>
                      )}
                    </div>

                    {activity.highlights && (
                      <p className="text-sm text-gray-500 mt-2 italic">✨ {activity.highlights}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(activity)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-blue-600 hover:bg-blue-50 transition shadow-sm"
                    >
                      <FaEdit className="text-sm" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(activity)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-white text-red-500 hover:bg-red-50 transition shadow-sm"
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold">{editing ? "Edit Activity" : "Add Activity"}</h2>
              <button onClick={resetForm} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block mb-2 font-medium">Title <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Activity title" value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block mb-2 font-medium">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none">
                  {ACTIVITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block mb-2 font-medium">Time</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Location</label>
                  <input type="text" placeholder="Venue" value={location} onChange={(e) => setLocation(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block mb-2 font-medium">Organizer</label>
                  <input type="text" placeholder="Organized by" value={organizer} onChange={(e) => setOrganizer(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block mb-2 font-medium">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-2 font-medium">Description</label>
                <textarea placeholder="Describe the activity..." value={description} onChange={(e) => setDescription(e.target.value)}
                  rows={3} className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
              </div>
              <div>
                <label className="block mb-2 font-medium">Highlights</label>
                <input type="text" placeholder="Key highlights or achievements" value={highlights} onChange={(e) => setHighlights(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={resetForm} className="px-6 py-3 rounded-xl border hover:bg-gray-50 font-medium transition">Cancel</button>
                <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold transition">
                  {loading ? "Saving..." : editing ? "Update" : "Create Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Activity"
          message={`Are you sure you want to delete "${confirmDelete.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

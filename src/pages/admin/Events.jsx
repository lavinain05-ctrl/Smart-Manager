import { useState, useMemo } from "react";
import {
  FaCalendarAlt,
  FaPlus,
  FaTimes,
  FaEdit,
  FaTrash,
  FaSearch,
  FaFilter,
  FaUsers,
  FaMapMarkerAlt,
  FaClock,
  FaChevronDown,
  FaChevronUp,
  FaShareAlt,
  FaWhatsapp,
  FaLink,
  FaGlobe,
  FaUserShield,
  FaFacebook,
  FaTelegram,
} from "react-icons/fa";

import toast from "react-hot-toast";
import { useEvents } from "../../context/EventContext";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";

const CATEGORIES = [
  "Meeting",
  "Festival",
  "Blood Donation",
  "Cleaning Drive",
  "Sports",
  "Social Activity",
  "Awareness Campaign",
  "Other",
];

const categoryIcons = {
  Meeting: "📋",
  Festival: "🎉",
  "Blood Donation": "🩸",
  "Cleaning Drive": "🧹",
  Sports: "🏏",
  "Social Activity": "🤝",
  "Awareness Campaign": "📢",
  Other: "📌",
};

const categoryColors = {
  Meeting: "bg-blue-100 text-blue-700",
  Festival: "bg-pink-100 text-pink-700",
  "Blood Donation": "bg-red-100 text-red-700",
  "Cleaning Drive": "bg-green-100 text-green-700",
  Sports: "bg-orange-100 text-orange-700",
  "Social Activity": "bg-purple-100 text-purple-700",
  "Awareness Campaign": "bg-yellow-100 text-yellow-700",
  Other: "bg-gray-100 text-gray-600",
};

const audienceLabels = {
  public: { label: "Public", icon: <FaGlobe />, color: "bg-green-100 text-green-700" },
  all_residents: { label: "All Residents", icon: <FaUsers />, color: "bg-blue-100 text-blue-700" },
  committee_only: { label: "Committee Only", icon: <FaUserShield />, color: "bg-purple-100 text-purple-700" },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isUpcoming(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) >= new Date(new Date().toDateString());
}

function getShareUrl(eventId) {
  return `${window.location.origin}/share/event/${eventId}`;
}

function getWhatsAppText(event) {
  const url = getShareUrl(event.id);
  return encodeURIComponent(
    `D BLOCK RWA INDRAPRASTHA\n\n📅 ${event.title}\n${event.date ? `Date: ${formatDate(event.date)}` : ""}${event.time ? ` at ${event.time}` : ""}${event.venue ? `\nVenue: ${event.venue}` : ""}\n\n${(event.description || "").slice(0, 200)}${event.description?.length > 200 ? "..." : ""}\n\nView details:\n${url}`
  );
}

export default function Events() {
  // Admin uses allEvents to see everything
  const { allEvents: events, addEvent, updateEvent, deleteEvent } = useEvents();
  const { user } = useAuth();

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTime, setFilterTime] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shareDropdown, setShareDropdown] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Meeting");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [audience, setAudience] = useState(["all_residents"]);

  const filteredEvents = useMemo(() => {
    return (events || []).filter((event) => {
      const matchesSearch =
        !search ||
        event.title?.toLowerCase().includes(search.toLowerCase()) ||
        event.description?.toLowerCase().includes(search.toLowerCase()) ||
        event.venue?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        !filterCategory || event.category === filterCategory;

      const matchesTime =
        filterTime === "all" ||
        (filterTime === "upcoming" && isUpcoming(event.date)) ||
        (filterTime === "past" && !isUpcoming(event.date));

      return matchesSearch && matchesCategory && matchesTime;
    });
  }, [events, search, filterCategory, filterTime]);

  // Stats
  const upcoming = (events || []).filter((e) => isUpcoming(e.date)).length;
  const past = (events || []).filter((e) => !isUpcoming(e.date)).length;
  const totalRegistrations = (events || []).reduce(
    (sum, e) => sum + (e.registrations?.length || 0),
    0
  );

  function toggleAudience(value) {
    setAudience((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((v) => v !== value);
        return next.length > 0 ? next : prev;
      }
      return [...prev, value];
    });
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("Meeting");
    setDate("");
    setTime("");
    setVenue("");
    setMaxCapacity("");
    setAudience(["all_residents"]);
    setEditingEvent(null);
    setShowForm(false);
  }

  function openEdit(event) {
    setTitle(event.title);
    setDescription(event.description || "");
    setCategory(event.category);
    setDate(event.date || "");
    setTime(event.time || "");
    setVenue(event.venue || "");
    setMaxCapacity(event.maxCapacity || "");
    setAudience(event.audience || ["all_residents"]);
    setEditingEvent(event);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !date) return;

    if (audience.length === 0) {
      toast.error("Please select at least one audience.");
      return;
    }

    setLoading(true);

    const data = {
      title: title.trim(),
      description: description.trim(),
      category,
      date,
      time: time || "",
      venue: venue.trim(),
      maxCapacity: maxCapacity ? Number(maxCapacity) : null,
      audience,
      createdBy: user?.uid || "",
      createdByName: user?.name || user?.email || "Admin",
    };

    let success;
    if (editingEvent) {
      success = await updateEvent(editingEvent.id, data);
    } else {
      success = await addEvent(data);
    }

    if (success) resetForm();
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    await deleteEvent(confirmDelete.id);
    setConfirmDelete(null);
  }

  function handleCopyLink(event) {
    navigator.clipboard.writeText(getShareUrl(event.id));
    toast.success("Link copied to clipboard!");
    setShareDropdown(null);
  }

  function handleNativeShare(event) {
    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: `${event.title} — D BLOCK RWA INDRAPRASTHA`,
        url: getShareUrl(event.id),
      }).catch(() => {});
    } else {
      handleCopyLink(event);
    }
    setShareDropdown(null);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-gray-500">Manage society events and activities</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-lg"
        >
          <FaPlus /> New Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-emerald-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FaCalendarAlt className="text-emerald-600 text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcoming}</p>
              <p className="text-sm text-gray-500">Upcoming Events</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-gray-400">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <FaClock className="text-gray-500 text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold">{past}</p>
              <p className="text-sm text-gray-500">Past Events</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FaUsers className="text-blue-600 text-xl" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalRegistrations}</p>
              <p className="text-sm text-gray-500">Total Registrations</p>
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
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
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
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value)}
              className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none appearance-none bg-white"
            >
              <option value="all">All Events</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </div>
        </div>
      </div>

      {/* Event List */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaCalendarAlt className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Events Found</h2>
          <p className="mt-2">
            {(events || []).length === 0
              ? "Create your first event to get started."
              : "No events match your search criteria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredEvents.map((event) => {
            const isExpanded = expandedId === event.id;
            const eventUpcoming = isUpcoming(event.date);
            const regCount = event.registrations?.length || 0;
            const eventAudience = event.audience || ["all_residents"];
            const isPublic = eventAudience.includes("public");

            return (
              <div
                key={event.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${
                  eventUpcoming ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-gray-300"
                }`}
              >
                <div className="p-5">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryColors[event.category] || "bg-gray-100 text-gray-600"}`}>
                      {categoryIcons[event.category]} {event.category}
                    </span>
                    {eventUpcoming ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        Upcoming
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                        Past
                      </span>
                    )}

                    {/* Audience Badges */}
                    {eventAudience.map((a) => {
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

                  {/* Title */}
                  <h3 className="text-lg font-bold mb-2">{event.title}</h3>

                  {/* Meta */}
                  <div className="space-y-1.5 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <FaCalendarAlt className="text-emerald-500" />
                      {formatDate(event.date)}
                      {event.time && <span className="text-gray-400">at {event.time}</span>}
                    </p>
                    {event.venue && (
                      <p className="flex items-center gap-2">
                        <FaMapMarkerAlt className="text-red-400" />
                        {event.venue}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <FaUsers className="text-blue-500" />
                      {regCount} registered
                      {event.maxCapacity && (
                        <span className="text-gray-400">/ {event.maxCapacity} max</span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => openEdit(event)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition font-medium"
                    >
                      <FaEdit /> Edit
                    </button>

                    {/* Share Button (only for public) */}
                    {isPublic && (
                      <div className="relative">
                        <button
                          onClick={() => setShareDropdown(shareDropdown === event.id ? null : event.id)}
                          className="px-3 py-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
                          title="Share"
                        >
                          <FaShareAlt />
                        </button>

                        {shareDropdown === event.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border z-20 py-1">
                            <button
                              onClick={() => handleCopyLink(event)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition"
                            >
                              <FaLink className="text-gray-500" /> Copy Link
                            </button>
                            <a
                              href={`https://wa.me/?text=${getWhatsAppText(event)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setShareDropdown(null)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition"
                            >
                              <FaWhatsapp className="text-green-600" /> WhatsApp
                            </a>
                            <a
                              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl(event.id))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setShareDropdown(null)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition"
                            >
                              <FaFacebook className="text-blue-600" /> Facebook
                            </a>
                            <a
                              href={`https://t.me/share/url?url=${encodeURIComponent(getShareUrl(event.id))}&text=${encodeURIComponent(event.title)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setShareDropdown(null)}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition"
                            >
                              <FaTelegram className="text-blue-400" /> Telegram
                            </a>
                            {navigator.share && (
                              <button
                                onClick={() => handleNativeShare(event)}
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
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                      className="px-3 py-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
                    >
                      {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(event)}
                      className="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                    >
                      <FaTrash />
                    </button>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {event.description && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-1">Description</h4>
                          <p className="text-gray-700 whitespace-pre-wrap text-sm">{event.description}</p>
                        </div>
                      )}

                      {regCount > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                            Registrations ({regCount})
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {event.registrations.map((reg, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                              >
                                <div>
                                  <span className="font-medium">{reg.residentName}</span>
                                  <span className="text-gray-400 ml-2">
                                    {reg.flat}{reg.block ? `, ${reg.block}` : ""}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-400">
                                  {new Date(reg.registeredAt).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-gray-400">
                        Created {formatTimestamp(event.createdAt)} by {event.createdByName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-bold">
                {editingEvent ? "Edit Event" : "Create New Event"}
              </h2>
              <button
                onClick={resetForm}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block mb-2 font-medium">
                  Event Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter event title"
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-2 font-medium">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 font-medium">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-2 font-medium">Max Capacity</label>
                  <input
                    type="number"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    min="1"
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2 font-medium">Venue</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Event venue / location"
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Audience / Visibility */}
              <div>
                <label className="block mb-2 font-medium">
                  Audience / Visibility <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Select who can see this event. You can select multiple options.
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

              <div>
                <label className="block mb-2 font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Event details..."
                  rows={5}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

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
                  {loading ? "Saving..." : editingEvent ? "Update Event" : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Event"
          message={`Are you sure you want to delete "${confirmDelete.title}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

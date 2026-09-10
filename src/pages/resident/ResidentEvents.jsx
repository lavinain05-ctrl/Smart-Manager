import { useState, useMemo } from "react";
import {
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaMapMarkerAlt,
  FaClock,
  FaUsers,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

import { useEvents } from "../../context/EventContext";
import { useAuth } from "../../context/AuthContext";

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

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isUpcoming(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) >= new Date(new Date().toDateString());
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil(
    (new Date(dateStr) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 0) return `In ${diff} days`;
  return null;
}

export default function ResidentEvents() {
  const { events, registerForEvent, unregisterFromEvent } = useEvents();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTime, setFilterTime] = useState("upcoming");
  const [expandedId, setExpandedId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
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

  function isRegistered(event) {
    return (event.registrations || []).some(
      (r) => r.residentId === user?.uid
    );
  }

  function isFull(event) {
    if (!event.maxCapacity) return false;
    return (event.registrations?.length || 0) >= event.maxCapacity;
  }

  async function handleRegister(event) {
    if (isRegistered(event)) return;
    if (isFull(event)) return;

    setLoadingId(event.id);

    await registerForEvent(event.id, event.registrations || [], {
      residentId: user?.uid || "",
      residentName: user?.name || user?.email || "Resident",
      flat: user?.flat || "",
      block: user?.block || "",
    });

    setLoadingId(null);
  }

  async function handleUnregister(event) {
    setLoadingId(event.id);
    await unregisterFromEvent(event.id, event.registrations || [], user?.uid);
    setLoadingId(null);
  }

  // Stats
  const upcomingCount = events.filter((e) => isUpcoming(e.date)).length;
  const myRegistrations = events.filter((e) => isRegistered(e)).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Events</h1>
        <p className="text-gray-500">Society events and activities</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-blue-500 text-center">
          <p className="text-2xl font-bold">{upcomingCount}</p>
          <p className="text-xs text-gray-500">Upcoming Events</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-green-500 text-center">
          <p className="text-2xl font-bold">{myRegistrations}</p>
          <p className="text-xs text-gray-500">My Registrations</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
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
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <select
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value)}
              className="px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
            >
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Event List */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaCalendarAlt className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Events</h2>
          <p className="mt-2">
            {events.length === 0
              ? "No events have been created yet."
              : filterTime === "upcoming"
              ? "No upcoming events at the moment."
              : "No events match your criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const isExp = expandedId === event.id;
            const upcoming = isUpcoming(event.date);
            const registered = isRegistered(event);
            const full = isFull(event);
            const regCount = event.registrations?.length || 0;
            const daysUntil = getDaysUntil(event.date);
            const isLoading = loadingId === event.id;

            return (
              <div
                key={event.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${
                  registered
                    ? "border-l-4 border-l-green-500"
                    : upcoming
                    ? "border-l-4 border-l-blue-500"
                    : "border-l-4 border-l-gray-300"
                }`}
              >
                <div className="p-5">
                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryColors[event.category] || "bg-gray-100 text-gray-600"}`}>
                      {categoryIcons[event.category]} {event.category}
                    </span>
                    {upcoming && daysUntil && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        {daysUntil}
                      </span>
                    )}
                    {registered && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 inline-flex items-center gap-1">
                        <FaCheckCircle /> Registered
                      </span>
                    )}
                    {!upcoming && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                        Past
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3
                    className="text-lg font-bold cursor-pointer hover:text-blue-600 transition"
                    onClick={() => setExpandedId(isExp ? null : event.id)}
                  >
                    {event.title}
                  </h3>

                  {/* Meta */}
                  <div className="space-y-1.5 text-sm text-gray-600 mt-2">
                    <p className="flex items-center gap-2">
                      <FaCalendarAlt className="text-blue-500" />
                      {formatDate(event.date)}
                      {event.time && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <FaClock className="text-xs" /> {event.time}
                        </span>
                      )}
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
                      {full && !registered && (
                        <span className="text-red-500 text-xs font-semibold">FULL</span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4">
                    {upcoming && (
                      registered ? (
                        <button
                          onClick={() => handleUnregister(event)}
                          disabled={isLoading}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 font-medium transition disabled:opacity-50 text-sm"
                        >
                          {isLoading ? "Cancelling..." : "Cancel Registration"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRegister(event)}
                          disabled={isLoading || full}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium transition text-sm"
                        >
                          {isLoading ? "Registering..." : full ? "Event Full" : "Register"}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setExpandedId(isExp ? null : event.id)}
                      className="px-3 py-2.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
                    >
                      {isExp ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {isExp && (
                    <div className="mt-4 pt-4 border-t">
                      {event.description ? (
                        <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                          {event.description}
                        </p>
                      ) : (
                        <p className="text-gray-400 text-sm italic">No additional details provided.</p>
                      )}
                    </div>
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

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaClock,
  FaBuilding,
  FaExclamationTriangle,
  FaArrowLeft,
} from "react-icons/fa";

import { getEventById } from "../../services/eventService";

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
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  try {
    const [h, m] = timeStr.split(":");
    const date = new Date();
    date.setHours(parseInt(h), parseInt(m));
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return timeStr;
  }
}

export default function PublicEvent() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEvent() {
      try {
        setLoading(true);
        const data = await getEventById(eventId);

        if (!data) {
          setError("Event not found.");
          return;
        }

        // Verify it's marked as public
        const audience = data.audience || [];
        if (!audience.includes("public")) {
          setError("This event is not publicly accessible.");
          return;
        }

        setEvent(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load this event.");
      } finally {
        setLoading(false);
      }
    }

    if (eventId) loadEvent();
  }, [eventId]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading event...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-3xl mb-4">
            <FaExclamationTriangle />
          </div>
          <h2 className="text-xl font-bold mb-2">Not Available</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
          >
            <FaArrowLeft /> Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Public event view
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-8 py-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-lg">
              <FaBuilding />
            </div>
            <div>
              <p className="font-bold text-base">D BLOCK RWA INDRAPRASTHA</p>
              <p className="text-emerald-200 text-xs">Society Event</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">

          {/* Category Badge */}
          {event.category && (
            <div className="mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryColors[event.category] || "bg-gray-100 text-gray-600"}`}>
                {categoryIcons[event.category]} {event.category}
              </span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl font-bold mb-5">{event.title}</h1>

          {/* Event Details */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-gray-700">
              <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FaCalendarAlt className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-medium">{formatDate(event.date)}</p>
              </div>
            </div>

            {event.time && (
              <div className="flex items-center gap-3 text-gray-700">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FaClock className="text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Time</p>
                  <p className="font-medium">{formatTime(event.time)}</p>
                </div>
              </div>
            )}

            {event.venue && (
              <div className="flex items-center gap-3 text-gray-700">
                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                  <FaMapMarkerAlt className="text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Venue</p>
                  <p className="font-medium">{event.venue}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="border-t pt-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Details</h3>
              <div className="prose max-w-none text-gray-700 leading-relaxed">
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-400">
            This event is shared by D BLOCK RWA INDRAPRASTHA Society
          </p>
        </div>
      </div>
    </div>
  );
}

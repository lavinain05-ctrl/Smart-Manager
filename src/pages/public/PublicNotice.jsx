import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

import {
  FaBullhorn,
  FaCalendarAlt,
  FaBuilding,
  FaExclamationTriangle,
  FaArrowLeft,
} from "react-icons/fa";

import { getNoticeById } from "../../services/noticeService";

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

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PublicNotice() {
  const { noticeId } = useParams();
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadNotice() {
      try {
        setLoading(true);
        const data = await getNoticeById(noticeId);

        if (!data) {
          setError("Notice not found.");
          return;
        }

        // Verify it's marked as public
        const audience = data.audience || [];
        if (!audience.includes("public")) {
          setError("This notice is not publicly accessible.");
          return;
        }

        setNotice(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load this notice.");
      } finally {
        setLoading(false);
      }
    }

    if (noticeId) loadNotice();
  }, [noticeId]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading notice...</p>
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

  // Public notice view
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
              <p className="text-emerald-200 text-xs">Society Notice</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {notice.category && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${categoryColors[notice.category] || "bg-gray-100 text-gray-600"}`}>
                {notice.category}
              </span>
            )}
            {notice.priority && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[notice.priority] || "bg-gray-100 text-gray-600"}`}>
                {notice.priority}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold mb-3">{notice.title}</h1>

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
            <FaCalendarAlt />
            <span>Published {formatDate(notice.createdAt)}</span>
          </div>

          {/* Body */}
          <div className="prose max-w-none text-gray-700 leading-relaxed">
            <p className="whitespace-pre-wrap">{notice.body}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-400">
            This notice is shared by D BLOCK RWA INDRAPRASTHA Society
          </p>
        </div>
      </div>
    </div>
  );
}

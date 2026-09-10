import { useState, useEffect } from "react";
import {
  FaHome,
  FaBell,
  FaCalendarAlt,
  FaExclamationCircle,
  FaFileInvoiceDollar,
  FaUser,
  FaUsers,
} from "react-icons/fa";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

import { useAuth } from "../../context/AuthContext";
import { useNotices } from "../../context/NoticeContext";
import { useEvents } from "../../context/EventContext";
import { useComplaints } from "../../context/ComplaintContext";
import RecentUpdatesCard from "../../components/notifications/RecentUpdatesCard";

export default function FamilyDashboard() {
  const { user } = useAuth();
  const { notices } = useNotices();
  const { events } = useEvents();
  const { complaints } = useComplaints();

  const [parentResident, setParentResident] = useState(null);

  // Fetch parent resident data
  useEffect(() => {
    async function fetchParent() {
      if (!user?.parentResidentId) return;
      try {
        const parentDoc = await getDoc(
          doc(db, "residents", user.parentResidentId)
        );
        if (parentDoc.exists()) {
          setParentResident({ id: parentDoc.id, ...parentDoc.data() });
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchParent();
  }, [user?.parentResidentId]);

  const myComplaints = complaints.filter((c) => c.residentId === user?.uid);
  const recentNotices = notices.slice(0, 3);
  const upcomingEvents = events
    .filter((e) => {
      if (!e.date) return false;
      return new Date(e.date) >= new Date(new Date().toDateString());
    })
    .slice(0, 3);

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  }

  return (
    <div className="space-y-6">

      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">
            <FaUser />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              Welcome, {user?.name || "Family Member"}
            </h1>
            <p className="text-sky-200 mt-1">
              <span className="bg-white/20 px-3 py-0.5 rounded-full text-xs font-semibold">
                👨‍👩‍👧 Family Member
              </span>
              {parentResident && (
                <span className="ml-3">
                  Flat {parentResident.flat}
                  {parentResident.block ? `, Block ${parentResident.block}` : ""}
                </span>
              )}
            </p>
            {user?.relation && (
              <p className="text-sky-200 text-sm mt-1">
                Relation: {user.relation}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory Notifications & Recent Society Updates */}
      <RecentUpdatesCard />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-sky-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
              <FaBell className="text-sky-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{notices.length}</p>
              <p className="text-xs text-gray-500">Notices</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <FaCalendarAlt className="text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{upcomingEvents.length}</p>
              <p className="text-xs text-gray-500">Upcoming</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <FaExclamationCircle className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{myComplaints.length}</p>
              <p className="text-xs text-gray-500">My Complaints</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <FaUsers className="text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{parentResident?.owner?.split(" ")[0] || "—"}</p>
              <p className="text-xs text-gray-500">Primary Owner</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Notices */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <FaBell className="text-sky-600" /> Recent Notices
        </h2>
        {recentNotices.length === 0 ? (
          <p className="text-gray-400 text-sm">No notices yet.</p>
        ) : (
          <div className="space-y-3">
            {recentNotices.map((notice) => (
              <div
                key={notice.id}
                className="flex items-start justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{notice.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {notice.category} · {formatDate(notice.createdAt)}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ml-2 ${
                  notice.priority === "Urgent" ? "bg-red-100 text-red-700" :
                  notice.priority === "High" ? "bg-orange-100 text-orange-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {notice.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <FaCalendarAlt className="text-green-600" /> Upcoming Events
        </h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-400 text-sm">No upcoming events.</p>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div>
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {event.category} · {new Date(event.date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                    {event.time ? ` at ${event.time}` : ""}
                  </p>
                </div>
                {event.venue && (
                  <span className="text-xs text-gray-400 shrink-0 ml-2">📍 {event.venue}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

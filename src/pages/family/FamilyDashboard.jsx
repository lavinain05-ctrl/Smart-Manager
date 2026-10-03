import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaHome,
  FaBell,
  FaCalendarAlt,
  FaExclamationCircle,
  FaFileInvoiceDollar,
  FaUser,
  FaUsers,
  FaFileAlt,
  FaReceipt,
  FaUserTie,
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

      {/* ═══════════ Scenic Society Hero Banner ═══════════ */}
      <div className="relative group overflow-hidden rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-800 bg-slate-900 transition-all duration-300">
        <div className="relative h-60 sm:h-64 md:h-72 w-full overflow-hidden">
          <img
            src="/society-banner.jpg"
            alt="D Block RWA Society"
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-1000 ease-out"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/40" />

          {/* Top Floating Society Badge */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white text-[11px] sm:text-xs font-bold tracking-wide shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>D BLOCK RWA • INDRAPRASTHA</span>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/30 text-sky-200 backdrop-blur-md border border-sky-400/40 text-[10px] font-extrabold uppercase tracking-wider">
              👨‍👩‍👧 Family Member
            </span>
          </div>

          {/* Welcome Text */}
          <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7 z-10 pb-6 sm:pb-7">
            <div className="space-y-1 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
                Welcome
              </h1>
              <p className="text-sm sm:text-base font-semibold text-emerald-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                Your Society, Our Community
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md border border-white/25 text-white text-xs font-bold shadow-sm">
                  <FaUser className="text-sky-300 text-xs" />
                  <span>{user?.name || "Family Member"}</span>
                  {user?.relation && <span className="text-white/80 font-normal">({user.relation})</span>}
                </div>

                {parentResident && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 text-slate-200 text-xs font-medium">
                    <FaHome className="text-emerald-300 text-xs" />
                    <span>Flat {parentResident.flat}</span>
                    {parentResident.block && <span>({parentResident.block})</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="p-3 sm:p-4 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-white/10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
            <Link
              to="/family/notices"
              className="bg-white dark:bg-slate-800 hover:bg-blue-50/90 dark:hover:bg-slate-700/90 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm transition-all duration-200 flex flex-col items-center text-center active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400 flex items-center justify-center text-lg mb-1.5">
                <FaFileAlt />
              </div>
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Notices</span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{notices.length} Active</span>
            </Link>

            <Link
              to="/family/events"
              className="bg-white dark:bg-slate-800 hover:bg-emerald-50/90 dark:hover:bg-slate-700/90 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm transition-all duration-200 flex flex-col items-center text-center active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 flex items-center justify-center text-lg mb-1.5">
                <FaCalendarAlt />
              </div>
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Events</span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{upcomingEvents.length} Upcoming</span>
            </Link>

            <Link
              to="/family/receipts"
              className="bg-white dark:bg-slate-800 hover:bg-amber-50/90 dark:hover:bg-slate-700/90 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm transition-all duration-200 flex flex-col items-center text-center active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-400 flex items-center justify-center text-lg mb-1.5">
                <FaReceipt />
              </div>
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Receipts</span>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Payment Records</span>
            </Link>

            {/* Executive Committee */}
            <Link
              to="/family/committee"
              className="bg-white dark:bg-slate-800 hover:bg-indigo-50/90 dark:hover:bg-slate-700/90 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm transition-all duration-200 flex flex-col items-center text-center active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400 flex items-center justify-center text-lg mb-1.5">
                <FaUserTie />
              </div>
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">Executive Committee</span>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">Office Bearers</span>
            </Link>

            <Link
              to="/family/complaints"
              className="bg-white dark:bg-slate-800 hover:bg-purple-50/90 dark:hover:bg-slate-700/90 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm transition-all duration-200 flex flex-col items-center text-center active:scale-[0.98] col-span-2 sm:col-span-1"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/70 dark:text-purple-400 flex items-center justify-center text-lg mb-1.5">
                <FaExclamationCircle />
              </div>
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">Complaints</span>
              <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">{myComplaints.length} Logged</span>
            </Link>
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

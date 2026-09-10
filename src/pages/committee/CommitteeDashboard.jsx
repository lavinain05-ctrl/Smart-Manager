import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaUser,
  FaBell,
  FaCalendarAlt,
  FaExclamationCircle,
  FaUsers,
  FaPhone,
  FaEnvelope,
  FaClock,
  FaMoneyBillWave,
  FaUserCheck,
  FaIdCard,
  FaKey,
  FaTrash,
  FaReceipt,
  FaShieldAlt,
  FaArrowRight,
} from "react-icons/fa";

import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";

import { useAuth } from "../../context/AuthContext";
import { useNotices } from "../../context/NoticeContext";
import { useEvents } from "../../context/EventContext";
import { useComplaints } from "../../context/ComplaintContext";
import { useCommittee } from "../../context/CommitteeContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import RecentUpdatesCard from "../../components/notifications/RecentUpdatesCard";

export default function CommitteeDashboard() {
  const { user } = useAuth();
  const { notices } = useNotices();
  const { events } = useEvents();
  const { complaints } = useComplaints();
  const { committee } = useCommittee();
  const { payments = [] } = usePayments();
  const { residents = [] } = useResidents();

  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(user?.permissions || {});

  // Fetch committee profile doc & listen for real-time permissions
  useEffect(() => {
    if (!user?.uid) return;
    async function fetchProfile() {
      try {
        const profileDoc = await getDoc(doc(db, "committee", user.uid));
        if (profileDoc.exists()) {
          setProfile({ id: profileDoc.id, ...profileDoc.data() });
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchProfile();

    const unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.permissions) setPermissions(d.permissions);
      }
    });

    return () => unsubUser();
  }, [user?.uid]);

  const hasAnyPower = Object.values(permissions).some(Boolean);
  const canCollect = permissions.canCollectGarbage || permissions.canCollectSpecial;

  // Personal collection stats
  const myCollections = useMemo(() => {
    return payments.filter(
      (p) => p.collectorId === user?.uid || p.collector === user?.name
    );
  }, [payments, user?.uid, user?.name]);

  const todayStr = new Date().toLocaleDateString("en-IN");
  const myTodayTotal = useMemo(() => {
    return myCollections
      .filter((p) => p.paymentDate === todayStr)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
  }, [myCollections, todayStr]);

  const myLifetimeTotal = useMemo(() => {
    return myCollections.reduce((s, p) => s + Number(p.amount || 0), 0);
  }, [myCollections]);

  const recentNotices = notices.slice(0, 3);
  const upcomingEvents = events
    .filter((e) => e.date && new Date(e.date) >= new Date(new Date().toDateString()))
    .slice(0, 3);
  const pendingComplaints = complaints.filter((c) => c.status === "Pending" || c.status === "In Progress");

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }

  return (
    <div className="space-y-6">

      {/* Profile Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          {profile?.profilePhotoUrl ? (
            <img
              src={profile.profilePhotoUrl}
              alt={user?.name || "Profile"}
              className="w-20 h-20 rounded-full object-cover shrink-0 border-2 border-white/30"
              onError={(e) => { e.target.style.display = "none"; e.target.nextSibling && (e.target.nextSibling.style.display = "flex"); }}
            />
          ) : null}
          <div
            className={`w-20 h-20 rounded-full bg-white/20 items-center justify-center text-4xl font-bold shrink-0 border-2 border-white/30 ${
              profile?.profilePhotoUrl ? "hidden" : "flex"
            }`}
          >
            {user?.name?.charAt(0) || "C"}
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold">{user?.name || "Committee Member"}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
                🏛️ {user?.designation || "Member"}
              </span>
              {profile?.tenure && (
                <span className="bg-white/10 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                  <FaClock className="text-xs" /> {profile.tenure}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-4 mt-3 text-sm text-indigo-200">
              {user?.email && (
                <span className="flex items-center gap-1.5">
                  <FaEnvelope className="text-xs" /> {user.email}
                </span>
              )}
              {user?.phone && (
                <span className="flex items-center gap-1.5">
                  <FaPhone className="text-xs" /> {user.phone}
                </span>
              )}
            </div>

            {hasAnyPower && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-white/10">
                <span className="text-xs text-indigo-200 font-semibold flex items-center gap-1 mr-1">
                  <FaShieldAlt className="text-amber-300" /> Delegated Powers:
                </span>
                {permissions.canCollectGarbage && (
                  <span className="bg-emerald-500/30 border border-emerald-300/40 text-emerald-100 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    🗑️ Garbage Collection
                  </span>
                )}
                {permissions.canCollectSpecial && (
                  <span className="bg-amber-500/30 border border-amber-300/40 text-amber-100 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    ⭐ Special Funds
                  </span>
                )}
                {permissions.canManageResidents && (
                  <span className="bg-purple-500/30 border border-purple-300/40 text-purple-100 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    👥 Residents
                  </span>
                )}
                {permissions.canManageCollectors && (
                  <span className="bg-blue-500/30 border border-blue-300/40 text-blue-100 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    👤 Collectors
                  </span>
                )}
                {permissions.canManageRegistrations && (
                  <span className="bg-pink-500/30 border border-pink-300/40 text-pink-100 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    📋 Registrations
                  </span>
                )}
                {permissions.canManageProfileRequests && (
                  <span className="bg-cyan-500/30 border border-cyan-300/40 text-cyan-100 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    📝 Profiles
                  </span>
                )}
                {permissions.canManageAccountRecovery && (
                  <span className="bg-rose-500/30 border border-rose-300/40 text-rose-100 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    🔑 Recovery
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {profile?.introduction && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-sm text-indigo-100 leading-relaxed">{profile.introduction}</p>
          </div>
        )}
      </div>

      {/* Financial Collection Operations (if collection powers assigned) */}
      {canCollect && (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FaMoneyBillWave className="text-emerald-600" />
                Fee Collection Operations
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Authorized society fee collection counter for Garbage and Special Campaign funds
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/committee/history"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <FaReceipt /> My Receipts
              </Link>
              <Link
                to="/committee/collect"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
              >
                <FaMoneyBillWave /> Collect Fees
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Today's Collections</p>
              <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">₹{myTodayTotal.toLocaleString()}</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Collected by you today</p>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">Total Collected by You</p>
              <p className="text-2xl font-black text-indigo-700 mt-1 font-mono">₹{myLifetimeTotal.toLocaleString()}</p>
              <p className="text-[11px] text-indigo-600 mt-0.5">Cumulative lifetime collections</p>
            </div>

            <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide">Receipts Issued</p>
              <p className="text-2xl font-black text-purple-700 mt-1 font-mono">{myCollections.length}</p>
              <p className="text-[11px] text-purple-600 mt-0.5">Transactions recorded by you</p>
            </div>
          </div>
        </div>
      )}

      {/* Delegated Society Management Portals (if executive powers assigned) */}
      {hasAnyPower && (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FaShieldAlt className="text-indigo-600" />
              Delegated Administrative Workspaces
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Access society management tools granted to your committee profile by the administrator
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {permissions.canManageResidents && (
              <Link
                to="/committee/residents"
                className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-50 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-purple-950 flex items-center gap-2">
                    <FaUsers className="text-purple-600" /> Society Residents
                  </p>
                  <p className="text-xs text-purple-700 mt-1">Manage society residents, flats, and records</p>
                </div>
                <FaArrowRight className="text-purple-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {permissions.canManageCollectors && (
              <Link
                to="/committee/collectors"
                className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-blue-950 flex items-center gap-2">
                    <FaIdCard className="text-blue-600" /> Field Collectors
                  </p>
                  <p className="text-xs text-blue-700 mt-1">Manage collector accounts and status</p>
                </div>
                <FaArrowRight className="text-blue-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {permissions.canManageRegistrations && (
              <Link
                to="/committee/registrations"
                className="p-4 rounded-xl border border-pink-200 bg-pink-50/40 hover:bg-pink-50 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-pink-950 flex items-center gap-2">
                    <FaUserCheck className="text-pink-600" /> Registrations
                  </p>
                  <p className="text-xs text-pink-700 mt-1">Review and approve new resident signups</p>
                </div>
                <FaArrowRight className="text-pink-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {permissions.canManageProfileRequests && (
              <Link
                to="/committee/profile-requests"
                className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/40 hover:bg-cyan-50 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-cyan-950 flex items-center gap-2">
                    <FaUser className="text-cyan-600" /> Profile Requests
                  </p>
                  <p className="text-xs text-cyan-700 mt-1">Verify resident info change requests</p>
                </div>
                <FaArrowRight className="text-cyan-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {permissions.canManageAccountRecovery && (
              <Link
                to="/committee/account-recovery"
                className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-rose-950 flex items-center gap-2">
                    <FaKey className="text-rose-600" /> Account Recovery
                  </p>
                  <p className="text-xs text-rose-700 mt-1">Assist residents with logins & resets</p>
                </div>
                <FaArrowRight className="text-rose-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}

            {canCollect && (
              <Link
                to="/committee/collect"
                className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition group flex items-start justify-between"
              >
                <div>
                  <p className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                    <FaMoneyBillWave className="text-emerald-600" /> Fee Counter
                  </p>
                  <p className="text-xs text-emerald-700 mt-1">Collect Garbage & Special Funds</p>
                </div>
                <FaArrowRight className="text-emerald-400 group-hover:translate-x-1 transition text-xs mt-1" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Mandatory Notifications & Recent Society Updates */}
      <RecentUpdatesCard />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-indigo-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FaBell className="text-indigo-600" />
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
              <p className="text-xs text-gray-500">Upcoming Events</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <FaExclamationCircle className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{pendingComplaints.length}</p>
              <p className="text-xs text-gray-500">Active Complaints</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <FaUsers className="text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{committee.length}</p>
              <p className="text-xs text-gray-500">Committee Members</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Notices */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FaBell className="text-indigo-600" /> Recent Notices
          </h2>
          {recentNotices.length === 0 ? (
            <p className="text-gray-400 text-sm">No notices yet.</p>
          ) : (
            <div className="space-y-3">
              {recentNotices.map((notice) => (
                <div key={notice.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl">
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
                <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {event.category} · {new Date(event.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
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

      {/* Committee Members Quick View */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <FaUsers className="text-purple-600" /> Committee Members
        </h2>
        {committee.length === 0 ? (
          <p className="text-gray-400 text-sm">No committee members added yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {committee.map((member) => (
              <div
                key={member.id}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  member.id === user?.uid ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50"
                }`}
              >
                {member.profilePhotoUrl ? (
                  <img
                    src={member.profilePhotoUrl}
                    alt={member.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    onError={(e) => { e.target.style.display = "none"; e.target.nextSibling && (e.target.nextSibling.style.display = "flex"); }}
                  />
                ) : null}
                <div
                  className={`w-10 h-10 rounded-full bg-indigo-100 items-center justify-center text-indigo-700 font-bold shrink-0 ${
                    member.profilePhotoUrl ? "hidden" : "flex"
                  }`}
                >
                  {member.name?.charAt(0) || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {member.name}
                    {member.id === user?.uid && (
                      <span className="text-indigo-500 text-xs ml-1">(You)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{member.designation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

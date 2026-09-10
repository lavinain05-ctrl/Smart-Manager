import { useState, useEffect, useMemo } from "react";
import {
  FaUserSlash,
  FaSearch,
  FaFilter,
  FaCalendarAlt,
  FaEnvelope,
  FaPhone,
  FaHome,
  FaUser,
  FaShieldAlt,
  FaClock,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
  FaArchive,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { subscribeDeletedAccounts } from "../../services/deletedAccountsService";

const roleColors = {
  resident: "bg-blue-100 text-blue-700",
  family: "bg-sky-100 text-sky-700",
  committee: "bg-purple-100 text-purple-700",
  collector: "bg-amber-100 text-amber-700",
  pending_registration: "bg-yellow-100 text-yellow-700",
  unknown: "bg-gray-100 text-gray-600",
};

const typeColors = {
  rejected: "bg-red-100 text-red-700",
  admin_deleted: "bg-orange-100 text-orange-700",
  deactivated: "bg-gray-100 text-gray-600",
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

export default function DeletedAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setAccounts([]);
      return;
    }

    const unsubscribe = subscribeDeletedAccounts(setAccounts);
    return () => unsubscribe();
  }, [user]);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      // Role filter
      if (filterRole !== "all" && a.role !== filterRole) return false;

      // Type filter
      if (filterType !== "all" && a.deletionType !== filterType) return false;

      // Search
      if (search) {
        const s = search.toLowerCase();
        return (
          a.name?.toLowerCase().includes(s) ||
          a.email?.toLowerCase().includes(s) ||
          a.phone?.includes(s) ||
          a.flat?.toLowerCase().includes(s) ||
          a.originalUid?.includes(s)
        );
      }

      return true;
    });
  }, [accounts, search, filterRole, filterType]);

  // Stats
  const rejectedCount = accounts.filter((a) => a.deletionType === "rejected").length;
  const deletedCount = accounts.filter((a) => a.deletionType === "admin_deleted").length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FaArchive className="text-gray-600" /> Deleted Accounts
        </h1>
        <p className="text-gray-500">
          Read-only archive of all deleted and rejected accounts
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-gray-400">
          <p className="text-sm text-gray-500">Total Archived</p>
          <p className="text-2xl font-bold">{accounts.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-red-400">
          <p className="text-sm text-gray-500">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-orange-400">
          <p className="text-sm text-gray-500">Deleted</p>
          <p className="text-2xl font-bold text-orange-600">{deletedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, flat, or UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-300 focus:outline-none"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-300 focus:outline-none appearance-none bg-white"
            >
              <option value="all">All Roles</option>
              <option value="resident">Resident</option>
              <option value="family">Family</option>
              <option value="committee">Committee</option>
              <option value="collector">Collector</option>
              <option value="pending_registration">Pending</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <FaTrash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-300 focus:outline-none appearance-none bg-white"
            >
              <option value="all">All Types</option>
              <option value="rejected">Rejected</option>
              <option value="admin_deleted">Admin Deleted</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Account List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <FaUserSlash className="text-gray-300 text-5xl mx-auto mb-3" />
          <p className="text-gray-400 text-lg">No deleted accounts found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Summary Row */}
              <button
                onClick={() => setExpandedId(expandedId === account.id ? null : account.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 transition"
              >
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  account.deletionType === "rejected"
                    ? "bg-red-100 text-red-600"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  <FaUserSlash className="text-lg" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 truncate">
                      {account.name || "Unknown"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      roleColors[account.role] || roleColors.unknown
                    }`}>
                      {account.role?.replace("_", " ") || "Unknown"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      typeColors[account.deletionType] || typeColors.deactivated
                    }`}>
                      {account.deletionType?.replace("_", " ") || "Unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    {account.email && (
                      <span className="flex items-center gap-1">
                        <FaEnvelope className="text-xs" /> {account.email}
                      </span>
                    )}
                    {account.flat && (
                      <span className="flex items-center gap-1">
                        <FaHome className="text-xs" /> {account.flat} {account.block}
                      </span>
                    )}
                  </div>
                </div>

                {/* Date + Expand */}
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-sm text-gray-500">{formatDate(account.deletedAt)}</p>
                    <p className="text-xs text-gray-400">by {account.deletedBy}</p>
                  </div>
                  {expandedId === account.id
                    ? <FaChevronUp className="text-gray-400" />
                    : <FaChevronDown className="text-gray-400" />
                  }
                </div>
              </button>

              {/* Expanded Details */}
              {expandedId === account.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">

                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-1">
                        <FaUser className="text-xs" /> Identity
                      </h4>
                      <p><span className="text-gray-400">Name:</span> {account.name || "—"}</p>
                      <p><span className="text-gray-400">Email:</span> {account.email || "—"}</p>
                      <p><span className="text-gray-400">Phone:</span> {account.phone || "—"}</p>
                      <p><span className="text-gray-400">UID:</span> <span className="font-mono text-xs">{account.originalUid || "—"}</span></p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-1">
                        <FaShieldAlt className="text-xs" /> Account
                      </h4>
                      <p><span className="text-gray-400">Role:</span> {account.role?.replace("_", " ") || "—"}</p>
                      <p><span className="text-gray-400">Flat:</span> {account.flat || "—"} {account.block || ""}</p>
                      <p><span className="text-gray-400">Lifetime:</span> {account.accountLifetime || "—"}</p>
                      <p><span className="text-gray-400">Deletion Type:</span> {account.deletionType?.replace("_", " ") || "—"}</p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-1">
                        <FaCalendarAlt className="text-xs" /> Timeline
                      </h4>
                      <p><span className="text-gray-400">Registered:</span> {formatDate(account.registeredAt)}</p>
                      <p><span className="text-gray-400">Approved:</span> {formatDate(account.approvedAt)}</p>
                      <p><span className="text-gray-400">Deleted:</span> {formatDate(account.deletedAt)}</p>
                      <p><span className="text-gray-400">Deleted By:</span> {account.deletedBy || "—"}</p>
                    </div>

                    {/* Reason */}
                    <div className="md:col-span-2 lg:col-span-3 space-y-2">
                      <h4 className="font-semibold text-gray-700 flex items-center gap-1">
                        <FaClock className="text-xs" /> Reason
                      </h4>
                      <p className="bg-white rounded-xl p-3 border border-gray-200 text-gray-600">
                        {account.reason || "No reason provided"}
                      </p>
                    </div>

                    {/* Cleanup Results */}
                    {account.cleanupResults && (
                      <div className="md:col-span-2 lg:col-span-3 space-y-2">
                        <h4 className="font-semibold text-gray-700">Cleanup Results</h4>
                        <div className="bg-white rounded-xl p-3 border border-gray-200 text-xs space-y-1">
                          {account.cleanupResults.cleaned?.length > 0 && (
                            <p className="text-emerald-600">
                              ✓ {account.cleanupResults.cleaned.join(" • ")}
                            </p>
                          )}
                          {account.cleanupResults.errors?.length > 0 && (
                            <p className="text-red-500">
                              ✗ {account.cleanupResults.errors.join(" • ")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import {
  FaBan,
  FaSearch,
  FaFilter,
  FaShieldAlt,
  FaClock,
  FaUser,
  FaMobileAlt,
  FaCheckCircle,
  FaPlus,
  FaTimes,
  FaUnlock,
  FaCalendarAlt,
  FaUserTie,
  FaExclamationTriangle,
  FaHistory,
} from "react-icons/fa";

import {
  subscribeBlockedAccounts,
  blockAccount,
  unblockAccount,
} from "../../services/blockService";
import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { subscribeCollectors } from "../../services/collectorService";
import { subscribeCommittee } from "../../services/committeeService";
import { normalizeMobile } from "../../services/authService";
import toast from "react-hot-toast";

function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeRemaining(untilTimestamp) {
  if (!untilTimestamp) return "";
  const until = untilTimestamp.toDate ? untilTimestamp.toDate() : new Date(untilTimestamp);
  if (isNaN(until.getTime())) return "";
  const now = new Date();
  const diffMs = until - now;

  if (diffMs <= 0) return "Expired (Pending unblock)";
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return `${diffDays}d ${remHours}h remaining`;
  }
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHours}h ${diffMins}m remaining`;
}

const COMMON_REASONS = [
  "Maintenance / Garbage Dues Pending",
  "Code of Conduct / Society Rule Violation",
  "Security Concern / Suspicious Activity",
  "Disciplinary Temporary Suspension",
  "Misuse of Portal / Spam",
  "Account Verification Required",
  "Other / Custom Reason",
];

export default function BlockedAccounts() {
  const [blockedList, setBlockedList] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all" | "permanent" | "temporary"
  const [filterRole, setFilterRole] = useState("all");

  // Modal State
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockFormMode, setBlockFormMode] = useState("existing"); // "existing" | "custom"
  const [selectedUserKey, setSelectedUserKey] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [customMobile, setCustomMobile] = useState("");
  const [customName, setCustomName] = useState("");
  const [customRole, setCustomRole] = useState("resident");
  const [blockType, setBlockType] = useState("temporary"); // "temporary" | "permanent"
  const [tempDurationDays, setTempDurationDays] = useState(3);
  const [customUntilDate, setCustomUntilDate] = useState("");
  const [reasonCategory, setReasonCategory] = useState(COMMON_REASONS[0]);
  const [reasonDetails, setReasonDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Unblock Confirm State
  const [unblockTarget, setUnblockTarget] = useState(null);
  const [unblockReason, setUnblockReason] = useState("");
  const [unblocking, setUnblocking] = useState(false);

  const { user: adminUser } = useAuth();
  const { residents } = useResidents();
  const [collectors, setCollectors] = useState([]);
  const [committeeMembers, setCommitteeMembers] = useState([]);

  // Subscribe to blocked accounts list
  useEffect(() => {
    if (!adminUser || adminUser.role !== "admin") return;

    const unsub = subscribeBlockedAccounts((data) => {
      setBlockedList(data);
    });

    const unsubCols = subscribeCollectors((cols) => setCollectors(cols));
    const unsubComm = subscribeCommittee((mems) => setCommitteeMembers(mems));

    return () => {
      unsub();
      unsubCols();
      unsubComm();
    };
  }, [adminUser]);

  // Combined searchable existing users for the dropdown
  const existingUsers = useMemo(() => {
    const list = [];
    (residents || []).forEach((r) => {
      list.push({
        key: `resident_${r.id}`,
        id: r.id,
        name: r.owner || "Resident",
        mobile: r.mobile || "",
        flat: r.flat || "",
        block: r.block || "",
        role: "resident",
        displayLabel: `🏠 [Resident] ${r.owner || "Resident"} • Flat: ${r.flat || "—"} (${r.mobile || "No Mobile"})`,
      });
    });

    (collectors || []).forEach((c) => {
      list.push({
        key: `collector_${c.id}`,
        id: c.id,
        name: c.name || "Collector",
        mobile: c.mobile || "",
        role: "collector",
        displayLabel: `👤 [Collector] ${c.name} (${c.mobile || "No Mobile"})`,
      });
    });

    (committeeMembers || []).forEach((m) => {
      list.push({
        key: `committee_${m.id}`,
        id: m.id,
        name: m.name || "Committee Member",
        mobile: m.phone || "",
        role: "committee",
        displayLabel: `👥 [Committee] ${m.name} • ${m.designation || ""} (${m.phone || "No Phone"})`,
      });
    });

    return list;
  }, [residents, collectors, committeeMembers]);

  // Filtered members matching search input in modal
  const filteredExistingUsers = useMemo(() => {
    if (!memberSearchQuery.trim()) return existingUsers;
    const q = memberSearchQuery.toLowerCase().trim();
    return existingUsers.filter((u) => {
      return (
        u.name?.toLowerCase().includes(q) ||
        u.mobile?.includes(q) ||
        u.flat?.toLowerCase().includes(q) ||
        u.block?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    });
  }, [existingUsers, memberSearchQuery]);

  const selectedMemberObj = useMemo(() => {
    return existingUsers.find((u) => u.key === selectedUserKey) || null;
  }, [existingUsers, selectedUserKey]);

  // Filtered List
  const filteredBlocked = useMemo(() => {
    return blockedList
      .filter((item) => item.status === "blocked")
      .filter((item) => {
        if (filterType !== "all" && item.blockType !== filterType) return false;
        if (filterRole !== "all" && item.role !== filterRole) return false;

        if (search) {
          const s = search.toLowerCase();
          return (
            item.name?.toLowerCase().includes(s) ||
            item.mobile?.includes(s) ||
            item.reason?.toLowerCase().includes(s) ||
            item.role?.toLowerCase().includes(s)
          );
        }
        return true;
      });
  }, [blockedList, search, filterType, filterRole]);

  // Metrics
  const metrics = useMemo(() => {
    const activeBlocked = blockedList.filter((item) => item.status === "blocked");
    const temporary = activeBlocked.filter((item) => item.blockType === "temporary");
    const permanent = activeBlocked.filter((item) => item.blockType === "permanent");
    return {
      total: activeBlocked.length,
      temporary: temporary.length,
      permanent: permanent.length,
    };
  }, [blockedList]);

  // Handle Form Submission for Blocking
  async function handleBlockSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      let targetMobile = "";
      let targetName = "";
      let targetRole = "resident";
      let targetUserId = "";

      if (blockFormMode === "existing") {
        const found = existingUsers.find((u) => u.key === selectedUserKey);
        if (!found) {
          toast.error("Please select a user to block");
          setSubmitting(false);
          return;
        }
        targetMobile = found.mobile;
        targetName = found.name;
        targetRole = found.role;
        targetUserId = found.id;
      } else {
        const clean = normalizeMobile(customMobile);
        if (!clean || clean.length !== 10) {
          toast.error("Please enter a valid 10-digit mobile number");
          setSubmitting(false);
          return;
        }
        targetMobile = clean;
        targetName = customName || "Custom Mobile";
        targetRole = customRole;
      }

      // Determine blockedUntil
      let blockedUntil = null;
      if (blockType === "temporary") {
        if (tempDurationDays === "custom") {
          if (!customUntilDate) {
            toast.error("Please select the expiration date for temporary suspension");
            setSubmitting(false);
            return;
          }
          blockedUntil = new Date(customUntilDate);
        } else {
          const d = new Date();
          d.setDate(d.getDate() + Number(tempDurationDays));
          blockedUntil = d;
        }
      }

      const fullReason =
        reasonCategory === "Other / Custom Reason"
          ? reasonDetails
          : reasonDetails
          ? `${reasonCategory}: ${reasonDetails}`
          : reasonCategory;

      await blockAccount({
        mobile: targetMobile,
        userId: targetUserId,
        name: targetName,
        role: targetRole,
        blockType,
        blockedUntil,
        reason: fullReason,
        adminUser,
      });

      toast.success(
        `Successfully ${blockType === "temporary" ? "temporarily suspended" : "permanently blocked"} ${targetName}`
      );

      // Reset
      setShowBlockModal(false);
      setSelectedUserKey("");
      setCustomMobile("");
      setCustomName("");
      setReasonDetails("");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to block account");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Unblocking
  async function handleConfirmUnblock() {
    if (!unblockTarget) return;
    setUnblocking(true);

    try {
      await unblockAccount(unblockTarget.mobile, adminUser, unblockReason);
      toast.success(`Access restored for ${unblockTarget.name || unblockTarget.mobile}`);
      setUnblockTarget(null);
      setUnblockReason("");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to unblock account");
    } finally {
      setUnblocking(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold flex items-center gap-2.5 text-slate-800">
              <FaBan className="text-red-600" /> Blocked Accounts & Access Control
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Enforcement Active
            </span>
          </div>
          <p className="text-gray-500 mt-1 text-sm">
            Block or temporarily suspend portal login access for any resident, collector, committee member, or mobile number
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedUserKey("");
            setMemberSearchQuery("");
            setCustomMobile("");
            setCustomName("");
            setBlockType("temporary");
            setTempDurationDays(3);
            setReasonCategory(COMMON_REASONS[0]);
            setReasonDetails("");
            setBlockFormMode("existing");
            setShowBlockModal(true);
          }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-semibold transition shadow-md text-sm"
        >
          <FaPlus /> Block Mobile / User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Blocked */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Total Blocked
              </p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">
                {metrics.total}
              </h3>
              <p className="text-xs text-gray-400 mt-2">Active restrictions</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600 text-xl shrink-0">
              <FaBan />
            </div>
          </div>
        </div>

        {/* Temporarily Suspended */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Temporarily Suspended
              </p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">
                {metrics.temporary}
              </h3>
              <p className="text-xs text-gray-400 mt-2">Will auto-expire on schedule</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 text-xl shrink-0">
              <FaClock />
            </div>
          </div>
        </div>

        {/* Permanently Blocked */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Permanently Blocked
              </p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">
                {metrics.permanent}
              </h3>
              <p className="text-xs text-gray-400 mt-2">Requires manual admin lift</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700 text-xl shrink-0">
              <FaShieldAlt />
            </div>
          </div>
        </div>

        {/* Login Protection Status */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Portal Security
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                Protected
              </h3>
              <p className="text-xs text-gray-400 mt-2">All portals enforced</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 text-xl shrink-0">
              <FaCheckCircle />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, mobile number, reason, role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none font-medium bg-white"
          >
            <option value="all">All Block Types</option>
            <option value="temporary">⏳ Temporary</option>
            <option value="permanent">🚫 Permanent</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none font-medium bg-white"
          >
            <option value="all">All Roles</option>
            <option value="resident">Resident</option>
            <option value="collector">Collector</option>
            <option value="committee">Committee</option>
            <option value="other">Custom Mobile</option>
          </select>
        </div>
      </div>

      {/* Blocked Accounts Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        {filteredBlocked.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <FaCheckCircle className="text-6xl text-emerald-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-700">No Blocked Accounts Found</h3>
            <p className="text-sm mt-1">All society residents, staff, and mobile numbers currently have normal access.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead className="bg-slate-50 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4 text-left">User / Mobile</th>
                  <th className="p-4 text-left">Role</th>
                  <th className="p-4 text-left">Block Type & Expiry</th>
                  <th className="p-4 text-left">Reason</th>
                  <th className="p-4 text-left">Blocked On</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredBlocked.map((item) => {
                  const isTemp = item.blockType === "temporary";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      {/* Name & Mobile */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {item.name ? item.name.charAt(0).toUpperCase() : <FaBan />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{item.name || "User"}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                              <FaMobileAlt className="text-gray-400" />
                              <span className="font-mono font-semibold">{item.mobile}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize bg-slate-100 text-slate-700 border border-slate-200">
                          {item.role || "User"}
                        </span>
                      </td>

                      {/* Block Type */}
                      <td className="p-4">
                        {isTemp ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                              <FaClock className="text-[10px]" /> Temporary
                            </span>
                            <p className="text-xs font-semibold text-amber-800 mt-1">
                              Until: {formatDate(item.blockedUntil)}
                            </p>
                            <p className="text-[11px] text-gray-500 font-medium">
                              ({timeRemaining(item.blockedUntil)})
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-semibold">
                            <FaBan className="text-[10px]" /> Permanent
                          </span>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="p-4 max-w-xs">
                        <p className="text-xs text-slate-700 font-medium bg-slate-50 p-2 rounded-lg border border-slate-200 line-clamp-2">
                          {item.reason || "No reason specified"}
                        </p>
                      </td>

                      {/* Blocked On & By */}
                      <td className="p-4 text-xs text-gray-500">
                        <p className="font-semibold text-slate-700">{formatDate(item.blockedAt)}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          By: {item.blockedByName || "Admin"}
                        </p>
                      </td>

                      {/* Action: Unblock */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => {
                            setUnblockTarget(item);
                            setUnblockReason("");
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
                        >
                          <FaUnlock /> Unblock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: BLOCK MOBILE / USER                                */}
      {/* ========================================================= */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  <FaBan />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-red-700">
                    Block or Suspend Access
                  </h3>
                  <p className="text-xs text-red-500">
                    Prevent user or mobile from logging into portals
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBlockModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-100 transition text-red-700"
              >
                <FaTimes />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleBlockSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Target Mode Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1.5">
                  Select Target
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setBlockFormMode("existing")}
                    className={`py-2 text-xs font-bold rounded-lg transition ${
                      blockFormMode === "existing"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-gray-500 hover:text-slate-800"
                    }`}
                  >
                    Existing Society Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockFormMode("custom")}
                    className={`py-2 text-xs font-bold rounded-lg transition ${
                      blockFormMode === "custom"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-gray-500 hover:text-slate-800"
                    }`}
                  >
                    Direct Mobile Number
                  </button>
                </div>
              </div>

              {/* Mode 1: Searchable Existing Member Selector */}
              {blockFormMode === "existing" ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
                    Search & Choose Member <span className="text-red-500">*</span>
                  </label>

                  {selectedMemberObj ? (
                    /* Selected Member Preview Card */
                    <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white border border-red-200 flex items-center justify-center text-lg shrink-0 shadow-xs">
                          {selectedMemberObj.role === "resident" ? "🏠" : selectedMemberObj.role === "collector" ? "👤" : "👥"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-sm truncate">
                              {selectedMemberObj.name}
                            </h4>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              selectedMemberObj.role === "resident"
                                ? "bg-blue-100 text-blue-800"
                                : selectedMemberObj.role === "collector"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-purple-100 text-purple-800"
                            }`}>
                              {selectedMemberObj.role}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {selectedMemberObj.flat && (
                              <span className="font-medium text-slate-700">
                                Flat {selectedMemberObj.flat}{selectedMemberObj.block ? `, ${selectedMemberObj.block}` : ""} •{" "}
                              </span>
                            )}
                            <span>📞 {selectedMemberObj.mobile || "No Mobile"}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserKey("");
                          setMemberSearchQuery("");
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-red-700 bg-white hover:bg-red-100 border border-red-200 rounded-lg transition shrink-0 shadow-xs"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    /* Search Input and Live Results */
                    <div className="space-y-2">
                      <div className="relative">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                        <input
                          type="text"
                          placeholder="Search by member name, flat number, mobile, or role..."
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          autoFocus
                          className="w-full border border-gray-300 rounded-xl pl-9 pr-8 py-2.5 text-sm bg-white focus:ring-2 focus:ring-red-500 outline-none"
                        />
                        {memberSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setMemberSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                          >
                            <FaTimes />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                        <span>
                          {memberSearchQuery
                            ? `Found ${filteredExistingUsers.length} matching member${filteredExistingUsers.length === 1 ? "" : "s"}`
                            : `Showing all ${existingUsers.length} society members (type to search)`}
                        </span>
                      </div>

                      {/* Dropdown list of members */}
                      <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white shadow-xs">
                        {filteredExistingUsers.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-xs">
                            <p className="font-semibold text-gray-700">
                              No members found matching &quot;{memberSearchQuery}&quot;
                            </p>
                            <p className="mt-1 text-[11px] text-gray-400">
                              Tip: You can switch to &quot;Direct Mobile Number&quot; above to block any unlisted number.
                            </p>
                          </div>
                        ) : (
                          filteredExistingUsers.map((u) => (
                            <button
                              key={u.key}
                              type="button"
                              onClick={() => {
                                setSelectedUserKey(u.key);
                                setMemberSearchQuery("");
                              }}
                              className="w-full text-left p-3 hover:bg-red-50/60 transition flex items-center justify-between gap-2 group cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-base shrink-0">
                                  {u.role === "resident" ? "🏠" : u.role === "collector" ? "👤" : "👥"}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 group-hover:text-red-700 transition truncate">
                                    {u.name}
                                  </p>
                                  <p className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                                    {u.flat && (
                                      <span className="font-medium text-slate-600">
                                        Flat {u.flat}{u.block ? `, ${u.block}` : ""} •
                                      </span>
                                    )}
                                    <span>📞 {u.mobile || "No Mobile"}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  u.role === "resident"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : u.role === "collector"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-purple-50 text-purple-700 border border-purple-200"
                                }`}>
                                  {u.role}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Hidden input for native validation */}
                  <input
                    type="text"
                    value={selectedUserKey}
                    onChange={() => {}}
                    required
                    className="sr-only"
                    tabIndex={-1}
                  />
                </div>
              ) : (
                /* Mode 2: Direct Mobile Number */
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1">
                      10-Digit Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={customMobile}
                      onChange={(e) => setCustomMobile(e.target.value.replace(/\D/g, ""))}
                      required
                      className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1">
                        Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="User name"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1">
                        Assumed Role
                      </label>
                      <select
                        value={customRole}
                        onChange={(e) => setCustomRole(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-500 outline-none font-medium"
                      >
                        <option value="resident">Resident</option>
                        <option value="collector">Collector</option>
                        <option value="committee">Committee</option>
                        <option value="other">Other / Custom</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Block Type: Temporary vs Permanent */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1.5">
                  Block Duration / Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBlockType("temporary")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      blockType === "temporary"
                        ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <FaClock /> Temporary Suspension
                  </button>

                  <button
                    type="button"
                    onClick={() => setBlockType("permanent")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      blockType === "permanent"
                        ? "bg-red-50 border-red-300 text-red-800 shadow-sm"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <FaBan /> Permanent Block
                  </button>
                </div>
              </div>

              {/* Temporary Duration Options */}
              {blockType === "temporary" && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
                  <label className="text-xs font-bold text-amber-900 block">
                    Choose Suspension Period:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "24 Hours", days: 1 },
                      { label: "3 Days", days: 3 },
                      { label: "7 Days", days: 7 },
                      { label: "15 Days", days: 15 },
                    ].map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setTempDurationDays(opt.days)}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                          tempDurationDays === opt.days
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                            : "bg-white text-slate-700 border-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setTempDurationDays("custom")}
                      className={`text-xs font-bold underline transition ${
                        tempDurationDays === "custom" ? "text-amber-800" : "text-amber-600"
                      }`}
                    >
                      Or select specific custom date & time
                    </button>

                    {tempDurationDays === "custom" && (
                      <input
                        type="datetime-local"
                        value={customUntilDate}
                        onChange={(e) => setCustomUntilDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        required={tempDurationDays === "custom"}
                        className="mt-1.5 w-full border border-amber-300 rounded-lg p-2 text-xs bg-white outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1">
                  Reason for Block <span className="text-red-500">*</span>
                </label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-red-500 outline-none font-medium mb-2"
                >
                  {COMMON_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <textarea
                  placeholder="Provide additional details or explanation to be presented to user on login attempt..."
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  <FaBan /> {submitting ? "Applying..." : "Confirm & Block Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: UNBLOCK CONFIRMATION                               */}
      {/* ========================================================= */}
      {unblockTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl shrink-0">
                <FaUnlock />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  Restore Portal Access?
                </h3>
                <p className="text-xs text-gray-500">
                  User will immediately be able to log in to their portal
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p>
                <span className="font-bold text-slate-700">Account:</span> {unblockTarget.name}
              </p>
              <p>
                <span className="font-bold text-slate-700">Mobile:</span> {unblockTarget.mobile}
              </p>
              <p>
                <span className="font-bold text-slate-700">Original Reason:</span> {unblockTarget.reason}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block mb-1">
                Unblock Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Dues cleared / Disciplinary period completed"
                value={unblockReason}
                onChange={(e) => setUnblockReason(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnblockTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmUnblock}
                disabled={unblocking}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                <FaUnlock /> {unblocking ? "Unblocking..." : "Confirm Unblock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

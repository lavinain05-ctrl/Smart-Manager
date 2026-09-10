import { useState, useEffect, useMemo } from "react";
import {
  FaUserPlus,
  FaCheck,
  FaTimes,
  FaUser,
  FaHome,
  FaClock,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaTimesCircle,
  FaEnvelope,
  FaPhone,
  FaBuilding,
  FaCalendarAlt,
  FaShieldAlt,
  FaExclamationTriangle,
} from "react-icons/fa";

import toast from "react-hot-toast";

import {
  subscribeRegistrationRequests,
  approveRegistration,
  rejectAndDeleteRegistration,
} from "../../services/registrationService";

import { logActivity } from "../../services/activityLogService";
import { useResidents } from "../../context/ResidentContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { useSettings } from "../../context/SettingsContext";
import { useAuth } from "../../context/AuthContext";
import Pagination from "../../components/common/Pagination";

import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

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

export default function RegistrationRequests() {
  const [allRequests, setAllRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [loadingId, setLoadingId] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [charge, setCharge] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // Block/flat override state for approval
  const [approveBlockId, setApproveBlockId] = useState("");
  const [approveBlock, setApproveBlock] = useState("");
  const [approveFlat, setApproveFlat] = useState("");
  const [approveFloor, setApproveFloor] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { residents } = useResidents();
  const { blocks } = useBlockFlat();
  const { settings } = useSettings();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setAllRequests([]);
      return;
    }

    const unsubscribe = subscribeRegistrationRequests(setAllRequests);
    return () => unsubscribe();
  }, [user]);

  const pendingCount = allRequests.filter((r) => r.status === "pending").length;
  const approvedCount = allRequests.filter((r) => r.status === "approved").length;
  const rejectedCount = allRequests.filter((r) => r.status === "rejected").length;

  // Duplicate detection — uses block + floor + flat
  function getDuplicateWarnings(req) {
    const warnings = [];

    const dupFlat = residents.find(
      (r) =>
        r.flat === req.flat &&
        r.block === req.block &&
        (r.floor || "") === (req.floor || "") &&
        r.status !== "rejected"
    );
    if (dupFlat) warnings.push(`Flat ${req.flat} Floor ${req.floor || "—"} Block ${req.block} already assigned to ${dupFlat.owner}`);

    const dupMobile = residents.find((r) => r.mobile === req.mobile);
    if (dupMobile) warnings.push(`Mobile ${req.mobile} already belongs to ${dupMobile.owner}`);

    const dupEmail = residents.find((r) => r.email === req.email);
    if (dupEmail) warnings.push(`Email ${req.email} already belongs to ${dupEmail.owner}`);

    return warnings;
  }

  const filtered = useMemo(() => {
    return allRequests.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.name?.toLowerCase().includes(s) ||
          r.email?.toLowerCase().includes(s) ||
          r.mobile?.includes(s) ||
          r.flat?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [allRequests, search, filterStatus]);

  useEffect(() => {
    setPage(1);
  }, [filtered.length]);

  const pagedRequests = useMemo(() => {
    if (pageSize === "all" || pageSize === "All" || Number(pageSize) >= filtered.length) {
      return filtered;
    }
    const numericSize = Number(pageSize) || 25;
    const start = (page - 1) * numericSize;
    return filtered.slice(start, start + numericSize);
  }, [filtered, page, pageSize]);

  async function handleApprove() {
    if (!approveModal) return;
    setLoadingId(approveModal.id);
    try {
      await approveRegistration(approveModal.id, approveModal, charge, {
        block: approveBlock || approveModal.block,
        blockId: approveBlockId || approveModal.blockId || "",
        flat: approveFlat || approveModal.flat,
        floor: approveFloor || approveModal.floor || "",
      });

      // Notification
      await addDoc(collection(db, "notifications"), {
        userId: approveModal.uid || approveModal.id,
        title: "Registration Approved ✅",
        message: "Your registration has been approved. You can now login to your account.",
        type: "registration_approved",
        read: false,
        createdAt: serverTimestamp(),
      });

      // Activity Log
      await logActivity({
        action: `Approved registration for ${approveModal.name}`,
        category: "auth",
        performedBy: "admin",
        performedByName: "Admin",
        targetId: approveModal.uid || approveModal.id,
        targetName: approveModal.name,
        details: `Flat: ${approveModal.flat}, Block: ${approveModal.block}, Charge: ₹${charge || 0}`,
      });

      toast.success("Registration approved — resident account created");
      setApproveModal(null);
      setCharge("");
      setApproveBlockId("");
      setApproveBlock("");
      setApproveFlat("");
      setApproveFloor("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve registration");
    }
    setLoadingId(null);
  }

  async function handleReject() {
    if (!rejectModal) return;
    setLoadingId(rejectModal.id);
    try {
      const result = await rejectAndDeleteRegistration({
        requestId: rejectModal.id,
        requestData: rejectModal,
        reason: rejectReason,
        adminName: user?.name || "Admin",
        adminUid: user?.uid || "",
      });

      if (result.authDeleted) {
        toast.success("Registration rejected — registered phone number & login details permanently deleted from Firebase");
      } else {
        toast.success("Registration request and phone number mapping removed");
      }

      setRejectModal(null);
      setRejectReason("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject registration");
    }
    setLoadingId(null);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FaUserPlus className="text-emerald-600" /> Registration Requests
        </h1>
        <p className="text-gray-500">Review and approve new resident registrations</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setFilterStatus("pending")}
          className={`rounded-2xl shadow-sm p-4 border-l-4 border-yellow-500 text-left transition ${
            filterStatus === "pending" ? "bg-yellow-50 ring-2 ring-yellow-300" : "bg-white hover:bg-gray-50"
          }`}
        >
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-2xl font-bold">{pendingCount}</p>
        </button>
        <button
          onClick={() => setFilterStatus("approved")}
          className={`rounded-2xl shadow-sm p-4 border-l-4 border-green-500 text-left transition ${
            filterStatus === "approved" ? "bg-green-50 ring-2 ring-green-300" : "bg-white hover:bg-gray-50"
          }`}
        >
          <p className="text-xs text-gray-500">Approved</p>
          <p className="text-2xl font-bold">{approvedCount}</p>
        </button>
        <button
          onClick={() => setFilterStatus("rejected")}
          className={`rounded-2xl shadow-sm p-4 border-l-4 border-red-500 text-left transition ${
            filterStatus === "rejected" ? "bg-red-50 ring-2 ring-red-300" : "bg-white hover:bg-gray-50"
          }`}
        >
          <p className="text-xs text-gray-500">Rejected</p>
          <p className="text-2xl font-bold">{rejectedCount}</p>
        </button>
      </div>

      {/* Search + Filter */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, mobile, flat..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaUserPlus className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">
            {allRequests.length === 0 ? "No Registration Requests" : "No Matching Requests"}
          </h2>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            {allRequests.length === 0
              ? "When new residents register through the resident registration portal, their pending verification requests will appear here for approval."
              : "Try adjusting your search keywords or filter status to find what you're looking for."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagedRequests.map((req) => {
            const isPending = req.status === "pending";
            const warnings = isPending ? getDuplicateWarnings(req) : [];

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                  isPending ? "border-l-4 border-l-yellow-500" :
                  req.status === "approved" ? "border-l-4 border-l-green-500" :
                  "border-l-4 border-l-red-500"
                }`}
              >
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Resident Info */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                          <FaUser className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-bold text-lg">{req.name}</p>
                          {req.fatherHusbandName && (
                            <p className="text-xs text-gray-500">S/o / D/o: {req.fatherHusbandName}</p>
                          )}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                        <div className="bg-gray-50 rounded-xl p-2.5">
                          <span className="text-gray-400 text-xs flex items-center gap-1"><FaBuilding className="text-[10px]" /> Block</span>
                          <p className="font-semibold">{req.block || "—"}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5">
                          <span className="text-gray-400 text-xs flex items-center gap-1">Floor</span>
                          <p className="font-semibold">{req.floor || "—"}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5">
                          <span className="text-gray-400 text-xs flex items-center gap-1"><FaHome className="text-[10px]" /> Flat</span>
                          <p className="font-semibold">{req.flat || "—"}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5">
                          <span className="text-gray-400 text-xs flex items-center gap-1"><FaPhone className="text-[10px]" /> Mobile</span>
                          <p className="font-semibold">{req.mobile || "—"}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5">
                          <span className="text-gray-400 text-xs flex items-center gap-1"><FaEnvelope className="text-[10px]" /> Email</span>
                          <p className="font-semibold text-xs truncate">{req.email || "—"}</p>
                        </div>
                      </div>

                      {req.gender && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          {req.gender && <span>Gender: {req.gender}</span>}
                          {req.dob && <span>DOB: {req.dob}</span>}
                          {req.occupation && <span>Occupation: {req.occupation}</span>}
                        </div>
                      )}

                      {/* Duplicate Warnings */}
                      {warnings.length > 0 && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <p className="text-xs font-bold text-amber-700 flex items-center gap-1 mb-1">
                            <FaExclamationTriangle /> Duplicate Warnings
                          </p>
                          {warnings.map((w, i) => (
                            <p key={i} className="text-xs text-amber-600">• {w}</p>
                          ))}
                        </div>
                      )}

                      {req.rejectionReason && (
                        <div className="mt-2 bg-red-50 rounded-xl p-3">
                          <p className="text-xs text-red-600"><strong>Rejection Reason:</strong> {req.rejectionReason}</p>
                        </div>
                      )}

                      <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                        <FaClock /> Registered: {formatDate(req.registeredAt)}
                        {req.approvedAt && <span>• Approved: {formatDate(req.approvedAt)}</span>}
                        {req.rejectedAt && <span>• Rejected: {formatDate(req.rejectedAt)}</span>}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isPending ? (
                        <>
                          <button
                            onClick={() => {
                              setApproveModal(req);
                              setCharge(settings?.monthlyCharge ? String(settings.monthlyCharge) : "200");
                              const matched = blocks.find((b) => b.id === req.blockId || b.name === req.block);
                              setApproveBlockId(matched?.id || req.blockId || "");
                              setApproveBlock(matched?.name || req.block || "");
                              setApproveFlat(req.flat || "");
                              setApproveFloor(req.floor || "");
                            }}
                            disabled={loadingId === req.id}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 font-medium transition text-sm disabled:opacity-50 shadow-sm"
                          >
                            <FaCheck /> Approve
                          </button>
                          <button
                            onClick={() => { setRejectModal(req); setRejectReason(""); }}
                            disabled={loadingId === req.id}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-medium transition text-sm disabled:opacity-50"
                          >
                            <FaTimes /> Reject
                          </button>
                        </>
                      ) : (
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                          req.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {req.status === "approved" ? <FaCheckCircle /> : <FaTimesCircle />}
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <Pagination
            currentPage={page}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100, "all"]}
          />
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-green-600 flex items-center gap-2">
                <FaCheckCircle /> Approve Registration
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="font-bold">{approveModal.name}</p>
                <p className="text-sm text-gray-600">Block {approveModal.block} • Floor {approveModal.floor || "—"} • Flat {approveModal.flat}</p>
                <p className="text-sm text-gray-600">{approveModal.email}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${approveModal.garbageParticipation === "participating" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                    GC: {approveModal.garbageParticipation === "participating" ? "Participating" : "Not Participating"}
                  </span>
                </div>
              </div>

              {/* Block / Flat Override */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-blue-700 flex items-center gap-1">
                  <FaBuilding /> Override Block & Flat (optional)
                </p>
                <p className="text-xs text-blue-600">Leave empty to keep the resident's selection.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-600">Block</label>
                    <select
                      value={approveBlockId}
                      onChange={(e) => {
                        const bid = e.target.value;
                        const blk = blocks.find((b) => b.id === bid);
                        setApproveBlockId(bid);
                        setApproveBlock(blk?.name || "");
                      }}
                      className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="">— Keep: {approveModal.block || "None"} —</option>
                      {blocks.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-600">Flat Number</label>
                    <input
                      type="text"
                      placeholder={approveModal.flat || "Keep existing"}
                      value={approveFlat}
                      onChange={(e) => setApproveFlat(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-xs font-medium text-gray-600">Floor</label>
                    <input
                      type="text"
                      placeholder={approveModal.floor || "Keep existing"}
                      value={approveFloor}
                      onChange={(e) => setApproveFloor(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  Monthly Charge (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 200"
                  value={charge}
                  onChange={(e) => setCharge(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Monthly maintenance/garbage charge for this resident</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => { setApproveModal(null); setApproveBlockId(""); setApproveBlock(""); setApproveFlat(""); setApproveFloor(""); }} className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition">Cancel</button>
              <button
                onClick={handleApprove}
                disabled={loadingId === approveModal.id}
                className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition disabled:bg-gray-400"
              >
                {loadingId === approveModal.id ? "Approving..." : "Approve & Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">Reject Registration</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-sm text-gray-700">
                  Reject <strong>{rejectModal.name}</strong>'s registration for Flat {rejectModal.flat}?
                </p>
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm">Rejection Reason</label>
                <textarea
                  placeholder="Provide a reason..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setRejectModal(null)} className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition">Cancel</button>
              <button
                onClick={handleReject}
                disabled={loadingId === rejectModal.id}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition disabled:bg-gray-400"
              >
                {loadingId === rejectModal.id ? "Rejecting..." : "Reject Registration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

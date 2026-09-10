import { useState, useEffect, useMemo } from "react";
import {
  FaEdit,
  FaCheck,
  FaTimes,
  FaUser,
  FaHome,
  FaClock,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaTimesCircle,
  FaArrowRight,
  FaShieldAlt,
} from "react-icons/fa";

import toast from "react-hot-toast";

import { logActivity } from "../../services/activityLogService";

import {
  subscribeAllProfileRequests,
  approveProfileRequest,
  rejectProfileRequest,
} from "../../services/profileRequestService";

import { useAuth } from "../../context/AuthContext";

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

export default function ProfileRequests() {
  const [allRequests, setAllRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [loadingId, setLoadingId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setAllRequests([]);
      return;
    }

    const unsubscribe = subscribeAllProfileRequests(setAllRequests);
    return () => unsubscribe();
  }, [user]);

  const pendingCount = allRequests.filter((r) => r.status === "pending").length;
  const approvedCount = allRequests.filter((r) => r.status === "approved").length;
  const rejectedCount = allRequests.filter((r) => r.status === "rejected").length;

  const filtered = useMemo(() => {
    return allRequests.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.userName?.toLowerCase().includes(s) ||
          r.flat?.toLowerCase().includes(s) ||
          r.changes?.field?.toLowerCase().includes(s) ||
          r.changes?.newValue?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [allRequests, search, filterStatus]);

  async function handleApprove(request) {
    setLoadingId(request.id);
    try {
      await approveProfileRequest(request.id, request);

      // Notify the resident
      await addDoc(collection(db, "notifications"), {
        userId: request.userId,
        title: "Profile Update Approved ✅",
        message: `Your request to change ${request.changes?.field} to "${request.changes?.newValue}" has been approved.`,
        type: "profile_approved",
        read: false,
        createdAt: serverTimestamp(),
      });

      // Activity Log
      await logActivity({
        action: `Approved profile change: ${request.changes?.field} → "${request.changes?.newValue}"`,
        category: "profile",
        performedBy: "admin",
        performedByName: "Admin",
        targetId: request.userId,
        targetName: request.userName,
        details: `Changed from "${request.changes?.currentValue}" to "${request.changes?.newValue}"`,
      });

      toast.success("Request approved — profile updated & resident notified");
    } catch (error) {
      console.error(error);
      toast.error("Failed to approve request");
    }
    setLoadingId(null);
  }

  async function handleReject() {
    if (!rejectModal) return;
    setLoadingId(rejectModal.id);
    try {
      await rejectProfileRequest(rejectModal.id, rejectReason);

      // Notify the resident
      await addDoc(collection(db, "notifications"), {
        userId: rejectModal.userId,
        title: "Profile Update Rejected ❌",
        message: `Your request to change ${rejectModal.changes?.field} was rejected.${rejectReason ? ` Reason: ${rejectReason}` : ""}`,
        type: "profile_rejected",
        read: false,
        createdAt: serverTimestamp(),
      });

      toast.success("Request rejected & resident notified");
      setRejectModal(null);
      setRejectReason("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to reject request");
    }
    setLoadingId(null);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FaShieldAlt className="text-purple-600" /> Profile Update Requests
        </h1>
        <p className="text-gray-500">Review, approve or reject resident profile changes</p>
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
            placeholder="Search by name, flat, field..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <FaFilter className="text-gray-400 text-sm" />
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
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaEdit className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">
            {allRequests.length === 0 ? "No Requests Yet" : "No Results"}
          </h2>
          <p className="mt-2">
            {filterStatus === "pending" ? "All profile update requests have been processed." : "No matching requests found."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const isPending = req.status === "pending";

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
                    {/* Resident Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <FaUser className="text-gray-400" />
                        </div>
                        <div>
                          <p className="font-bold">{req.userName}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {req.flat && (
                              <span className="flex items-center gap-1">
                                <FaHome className="text-[10px]" /> {req.flat}
                              </span>
                            )}
                            {req.block && <span>• {req.block}</span>}
                            {req.userEmail && !req.userEmail.includes("firebaseapp.com") && (
                              <span>• {req.userEmail}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Change Details */}
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400 font-medium w-20">Field:</span>
                          <span className="font-bold text-blue-600">{req.changes?.field}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-400 font-medium w-20">Current:</span>
                          <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
                            {req.changes?.currentValue || "—"}
                          </span>
                          <FaArrowRight className="text-gray-300 text-xs" />
                          <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-bold">
                            {req.changes?.newValue}
                          </span>
                        </div>

                        {req.changes?.reason && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-gray-400 font-medium w-20 shrink-0">Reason:</span>
                            <span className="text-gray-600">{req.changes.reason}</span>
                          </div>
                        )}

                        {req.rejectionReason && (
                          <div className="flex items-start gap-2 text-sm">
                            <span className="text-red-400 font-medium w-20 shrink-0">Rejected:</span>
                            <span className="text-red-600">{req.rejectionReason}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <FaClock /> Submitted: {formatDate(req.createdAt)}
                        </span>
                        {req.processedAt && (
                          <span className="flex items-center gap-1">
                            • Processed: {formatDate(req.processedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions / Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isPending ? (
                        <>
                          <button
                            onClick={() => handleApprove(req)}
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
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-bold text-red-600">Reject Request</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-sm text-gray-700">
                  Reject <strong>{rejectModal.userName}</strong>'s request to change{" "}
                  <strong>{rejectModal.changes?.field}</strong> to "{rejectModal.changes?.newValue}"?
                </p>
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm">Rejection Reason</label>
                <textarea
                  placeholder="Provide a reason for the resident..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => setRejectModal(null)}
                className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={loadingId === rejectModal.id}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition disabled:bg-gray-400"
              >
                {loadingId === rejectModal.id ? "Rejecting..." : "Reject Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

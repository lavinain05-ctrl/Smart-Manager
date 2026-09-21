import { useMemo, useState } from "react";
import {
  FaInbox,
  FaCheck,
  FaTimes,
  FaFilter,
  FaSpinner,
} from "react-icons/fa";

import { useGarbage } from "../../context/GarbageContext";

export default function GarbageRequests() {
  const { garbageRequests, approveRequest, rejectRequest } = useGarbage();

  const [statusFilter, setStatusFilter] = useState("pending");
  const [processingId, setProcessingId] = useState(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return garbageRequests;
    return garbageRequests.filter((r) => r.status === statusFilter);
  }, [garbageRequests, statusFilter]);

  const pendingCount = garbageRequests.filter((r) => r.status === "pending").length;

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await approveRequest(id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    setProcessingId(id);
    try {
      await rejectRequest(id);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FaInbox className="text-emerald-600" />
            Garbage Requests
          </h1>
          <p className="text-gray-500 mt-1">
            {pendingCount} pending request{pendingCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <FaFilter className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-xl px-4 py-2.5 bg-white shadow-sm text-sm outline-none"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests */}
      <div className="space-y-4">
        {filtered.map((req) => (
          <div
            key={req.id}
            className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg">{req.residentName || "Resident"}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    req.requestType === "opt_in"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-orange-100 text-orange-700"
                  }`}>
                    {req.requestType === "opt_in" ? "Opt-In" : "Opt-Out"}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    req.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : req.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {req.status}
                  </span>
                </div>

                <p className="text-gray-600 text-sm">
                  Flat: {req.flat || "—"} • Block: {req.block || "—"}
                </p>

                {req.reason && (
                  <p className="text-gray-500 text-sm mt-2 bg-gray-50 rounded-lg p-3">
                    {req.reason}
                  </p>
                )}

                {req.processedBy && (
                  <p className="text-xs text-gray-400 mt-2">
                    Processed by: {req.processedBy}
                  </p>
                )}
              </div>

              {req.status === "pending" && (
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={processingId === req.id}
                    onClick={() => handleApprove(req.id)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition disabled:opacity-50"
                  >
                    {processingId === req.id ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaCheck />
                    )}
                    Approve
                  </button>
                  <button
                    disabled={processingId === req.id}
                    onClick={() => handleReject(req.id)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition disabled:opacity-50"
                  >
                    {processingId === req.id ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaTimes />
                    )}
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-400">
            No requests found
          </div>
        )}
      </div>
    </div>
  );
}

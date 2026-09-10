import { useState, useEffect, useMemo } from "react";
import {
  FaKey,
  FaSearch,
  FaFilter,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaShieldAlt,
  FaChevronDown,
  FaChevronUp,
  FaUser,
  FaPhone,
  FaBuilding,
  FaHome,
  FaLayerGroup,
  FaCopy,
  FaEye,
  FaEyeSlash,
  FaExternalLinkAlt,
  FaHeadset,
  FaMobileAlt,
  FaCheck,
} from "react-icons/fa";

import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { adminResetPasswordFn, db } from "../../firebase/firebase";
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { createNotification } from "../../services/notificationService";
import {
  normalizeMobile,
  writeAuthLookup,
  deleteAuthLookup,
  mobileToAuthEmail,
} from "../../services/authService";

import {
  subscribeRecoveryRequests,
  updateRecoveryRequest,
  RECOVERY_REQUEST_TYPES,
  STATUS_LABELS,
} from "../../services/recoveryService";

// =============================
// Status UI config
// =============================

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  verified: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-700",
};

const statusIcons = {
  pending: <FaClock />,
  verified: <FaShieldAlt />,
  rejected: <FaTimesCircle />,
  completed: <FaCheckCircle />,
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

function getRequestTypeLabel(type) {
  const found = RECOVERY_REQUEST_TYPES.find((t) => t.value === type);
  return found ? found.label : type;
}

export default function AccountRecovery() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  // Detail modal state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Temp password display (one-time view)
  const [tempPassword, setTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [customTempPassword, setCustomTempPassword] = useState("");
  const [copied, setCopied] = useState(false);

  // Mobile recovery & record matching state
  const [matchedResident, setMatchedResident] = useState(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [newMobileInput, setNewMobileInput] = useState("");
  const [showUpdateMobileForm, setShowUpdateMobileForm] = useState(false);
  const [resolvedMobile, setResolvedMobile] = useState("");

  // Subscribe to recovery requests
  useEffect(() => {
    const unsubscribe = subscribeRecoveryRequests(setRequests);
    return () => unsubscribe();
  }, []);

  // Filtered + searched requests
  const filteredRequests = useMemo(() => {
    let result = requests;

    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter((r) =>
        (r.residentName || "").toLowerCase().includes(term) ||
        (r.mobile || "").includes(term) ||
        (r.flatNumber || "").toLowerCase().includes(term) ||
        (r.block || "").toLowerCase().includes(term) ||
        (r.id || "").toLowerCase().includes(term)
      );
    }

    return result;
  }, [requests, statusFilter, search]);

  // Stats
  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    verified: requests.filter((r) => r.status === "verified").length,
    completed: requests.filter((r) => r.status === "completed").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  }), [requests]);

  // =============================
  // Admin Actions
  // =============================

  async function handleVerify(req) {
    try {
      setProcessing(true);
      await updateRecoveryRequest(req.id, {
        status: "verified",
        adminNotes: adminNotes || req.adminNotes || "",
        processedBy: user.uid,
      });

      // Notify resident
      if (req.residentId || matchedResident?.id) {
        try {
          await createNotification({
            userId: req.residentId || matchedResident?.id,
            title: "Recovery Request Verified",
            message: "Your account recovery request has been verified by the Admin. The resolution will be provided shortly.",
            type: "info",
          });
        } catch { /* non-fatal */ }
      }

      toast.success("Request verified successfully.");
      setSelectedRequest({ ...req, status: "verified", adminNotes });
    } catch (error) {
      toast.error(error.message || "Failed to verify request.");
    } finally {
      setProcessing(false);
    }
  }

  // 1. Password Reset Handler
  async function handleResetPassword(req) {
    const targetUid = req.residentId || matchedResident?.id;
    if (!targetUid) {
      toast.error("No resident UID found for this request.");
      return;
    }

    const chosenPassword =
      customTempPassword.trim() ||
      "RWA@" + Math.floor(100000 + Math.random() * 900000);

    if (chosenPassword.length < 6) {
      toast.error("Temporary password must be at least 6 characters.");
      return;
    }

    try {
      setProcessing(true);

      // Try Cloud Function (if deployed or on Blaze)
      try {
        await adminResetPasswordFn({
          targetUid,
          requestId: req.id,
          password: chosenPassword,
        });
      } catch (fnErr) {
        console.warn("[AccountRecovery] Cloud Function reset unavailable on Spark plan:", fnErr.message);
      }

      // Mark user document for forced password change upon next login
      try {
        await updateDoc(doc(db, "users", targetUid), {
          mustChangePassword: true,
          tempPasswordSetAt: serverTimestamp(),
        });
      } catch (uErr) {
        console.warn("[AccountRecovery] users doc update error:", uErr.message);
      }

      // Update recovery request status to completed
      try {
        await updateRecoveryRequest(req.id, {
          status: "completed",
          adminNotes: adminNotes ? `${adminNotes} | Temp password set` : `Temporary password set: ${chosenPassword}`,
          mustChangePassword: true,
          processedBy: user.uid,
        });
      } catch (rErr) {
        console.warn("[AccountRecovery] recovery request update error:", rErr.message);
      }

      // Notify resident
      try {
        await createNotification({
          userId: targetUid,
          title: "Password Reset Complete",
          message: "Your password has been reset by the Admin. Please contact Admin for your temporary password, then log in and set a new password.",
          type: "success",
        });
      } catch { /* non-fatal */ }

      setTempPassword(chosenPassword);
      setShowTempPassword(true);
      toast.success("Password reset registered! Share temporary password with resident.");
      setSelectedRequest((prev) => (prev ? { ...prev, status: "completed" } : null));
    } catch (error) {
      console.error("[AccountRecovery] Reset error:", error);
      toast.error(error.message || "Failed to reset password.");
    } finally {
      setProcessing(false);
    }
  }

  // 2. Share Registered Mobile Handler (Procedure for Forgot Mobile)
  async function handleShareRegisteredMobile(req) {
    const targetMobile = req.mobile || matchedResident?.mobile;
    if (!targetMobile) {
      toast.error("No registered mobile number found in records.");
      return;
    }

    try {
      setProcessing(true);

      const resName = req.residentName || matchedResident?.owner || "Resident";
      const message =
        `Smart Manager Portal - Registered Mobile Information:\n` +
        `Resident: ${resName}\n` +
        `Flat: ${req.flatNumber || matchedResident?.flat || ""}, ${req.block || matchedResident?.block || ""}\n` +
        `Your Registered Mobile: ${targetMobile}\n` +
        `Portal Login: ${window.location.origin}/resident/login\n` +
        `Use this registered mobile number and your password to log in.`;

      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);

      // Update recovery request
      await updateRecoveryRequest(req.id, {
        status: "completed",
        adminNotes: adminNotes
          ? `${adminNotes} | Provided registered mobile: ${targetMobile}`
          : `Provided registered mobile: ${targetMobile}`,
        processedBy: user.uid,
        resolvedMobile: targetMobile,
      });

      // Send notification if residentId is available
      const rUid = req.residentId || matchedResident?.id;
      if (rUid) {
        try {
          await createNotification({
            userId: rUid,
            title: "Mobile Recovery Completed",
            message: `Your account recovery has been completed. Your registered login mobile is ${targetMobile}.`,
            type: "success",
          });
        } catch { /* non-fatal */ }
      }

      setResolvedMobile(targetMobile);
      toast.success("Request completed! Registered mobile details copied to clipboard.");
      setSelectedRequest((prev) =>
        prev ? { ...prev, status: "completed", mobile: targetMobile } : null
      );
    } catch (error) {
      console.error("[AccountRecovery] Share mobile error:", error);
      toast.error(error.message || "Failed to complete request.");
    } finally {
      setProcessing(false);
    }
  }

  // 3. Update Registered Mobile Handler (Procedure when resident changes mobile)
  async function handleUpdateRegisteredMobile(req) {
    const cleanNew = normalizeMobile(newMobileInput);
    if (!cleanNew || cleanNew.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    const rUid = req.residentId || matchedResident?.id;
    if (!rUid) {
      toast.error("Cannot find resident account to update.");
      return;
    }

    try {
      setProcessing(true);

      const oldMobile = req.mobile || matchedResident?.mobile || "";

      // 1. Update residents collection
      try {
        await updateDoc(doc(db, "residents", rUid), {
          mobile: cleanNew,
          phone: cleanNew,
          updatedAt: serverTimestamp(),
        });
      } catch (rErr) {
        console.warn("Could not update residents doc:", rErr.message);
      }

      // 2. Update users collection
      try {
        await updateDoc(doc(db, "users", rUid), {
          phone: cleanNew,
          mobile: cleanNew,
          updatedAt: serverTimestamp(),
        });
      } catch (uErr) {
        console.warn("Could not update users doc:", uErr.message);
      }

      // 3. Update authLookup
      const authEmail = mobileToAuthEmail(cleanNew);
      await writeAuthLookup(cleanNew, authEmail, rUid);
      if (oldMobile && oldMobile !== cleanNew) {
        await deleteAuthLookup(oldMobile);
      }

      // 4. Update recovery request
      await updateRecoveryRequest(req.id, {
        status: "completed",
        adminNotes: adminNotes
          ? `${adminNotes} | Mobile updated from ${oldMobile || "unknown"} to ${cleanNew}`
          : `Mobile updated from ${oldMobile || "unknown"} to ${cleanNew}`,
        processedBy: user.uid,
        resolvedMobile: cleanNew,
      });

      // 5. Copy confirmation message
      const resName = req.residentName || matchedResident?.owner || "Resident";
      const message =
        `Smart Manager Portal - Registered Mobile Updated:\n` +
        `Resident: ${resName}\n` +
        `Flat: ${req.flatNumber || ""}, ${req.block || ""}\n` +
        `Your New Registered Mobile: ${cleanNew}\n` +
        `Portal Login: ${window.location.origin}/resident/login`;

      navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);

      // 6. Notify
      try {
        await createNotification({
          userId: rUid,
          title: "Registered Mobile Number Updated",
          message: `Your registered mobile number for Smart Manager has been updated to ${cleanNew}.`,
          type: "success",
        });
      } catch { /* non-fatal */ }

      setResolvedMobile(cleanNew);
      setShowUpdateMobileForm(false);
      toast.success(`Registered mobile updated to ${cleanNew}! Copied to clipboard.`);
      setSelectedRequest((prev) =>
        prev ? { ...prev, status: "completed", mobile: cleanNew } : null
      );
    } catch (error) {
      console.error("[AccountRecovery] Update mobile error:", error);
      toast.error(error.message || "Failed to update mobile number.");
    } finally {
      setProcessing(false);
    }
  }

  // 4. General Support Resolve Handler
  async function handleGeneralResolve(req) {
    try {
      setProcessing(true);
      await updateRecoveryRequest(req.id, {
        status: "completed",
        adminNotes: adminNotes || "Issue resolved by Admin",
        processedBy: user.uid,
      });

      const rUid = req.residentId || matchedResident?.id;
      if (rUid) {
        try {
          await createNotification({
            userId: rUid,
            title: "Support Request Resolved",
            message: "Your support request has been reviewed and resolved by the Admin.",
            type: "success",
          });
        } catch { /* non-fatal */ }
      }

      toast.success("Request marked as resolved and completed.");
      setSelectedRequest((prev) => (prev ? { ...prev, status: "completed" } : null));
    } catch (error) {
      toast.error(error.message || "Failed to resolve request.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject(req) {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    try {
      setProcessing(true);
      await updateRecoveryRequest(req.id, {
        status: "rejected",
        adminNotes: rejectReason,
        processedBy: user.uid,
      });

      // Notify resident
      const rUid = req.residentId || matchedResident?.id;
      if (rUid) {
        try {
          await createNotification({
            userId: rUid,
            title: "Recovery Request Rejected",
            message: `Your account recovery request was rejected. Reason: ${rejectReason}`,
            type: "error",
          });
        } catch { /* non-fatal */ }
      }

      toast.success("Request rejected.");
      closeModal();
    } catch (error) {
      toast.error(error.message || "Failed to reject request.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleSaveNotes(req) {
    try {
      await updateRecoveryRequest(req.id, {
        adminNotes,
      });
      toast.success("Notes saved.");
    } catch (error) {
      toast.error("Failed to save notes.");
    }
  }

  // =============================
  // Modal
  // =============================

  async function openModal(req) {
    setSelectedRequest(req);
    setAdminNotes(req.adminNotes || "");
    setRejectReason("");
    setTempPassword("");
    setShowTempPassword(false);
    setCustomTempPassword("RWA@" + Math.floor(100000 + Math.random() * 900000));
    setCopied(false);
    setNewMobileInput("");
    setShowUpdateMobileForm(false);
    setResolvedMobile(req.resolvedMobile || "");
    setMatchedResident(null);

    // Auto-search for society resident record by mobile, flat, or UID
    setMatchingLoading(true);
    try {
      const resCol = collection(db, "residents");
      let found = null;

      // 1. Try mobile first if available
      if (req.mobile && req.mobile.length === 10) {
        const qM = query(resCol, where("mobile", "==", req.mobile));
        const sM = await getDocs(qM);
        if (!sM.empty) {
          found = { id: sM.docs[0].id, ...sM.docs[0].data() };
        }
      }

      // 2. Try flatNumber / flat
      if (!found && req.flatNumber) {
        const flatClean = (req.flatNumber || "").trim().toUpperCase();
        let sF = await getDocs(query(resCol, where("flatNumber", "==", flatClean)));
        if (sF.empty) {
          sF = await getDocs(query(resCol, where("flat", "==", flatClean)));
        }
        if (!sF.empty) {
          let list = sF.docs.map((d) => ({ id: d.id, ...d.data() }));
          if (req.block) {
            const bMatch = list.find((r) =>
              (r.block || "").toLowerCase().includes(req.block.toLowerCase())
            );
            if (bMatch) list = [bMatch];
          }
          found = list[0];
        }
      }

      // 3. Try residentId
      if (!found && req.residentId) {
        const rDoc = await getDoc(doc(db, "residents", req.residentId));
        if (rDoc.exists()) {
          found = { id: rDoc.id, ...rDoc.data() };
        }
      }

      if (found) {
        setMatchedResident(found);
      }
    } catch (err) {
      console.warn("[AccountRecovery] Auto-match resident error:", err.message);
    } finally {
      setMatchingLoading(false);
    }
  }

  function closeModal() {
    setSelectedRequest(null);
    setAdminNotes("");
    setRejectReason("");
    setTempPassword("");
    setShowTempPassword(false);
    setCustomTempPassword("");
    setCopied(false);
    setMatchedResident(null);
    setNewMobileInput("");
    setShowUpdateMobileForm(false);
    setResolvedMobile("");
  }

  function copyTempPassword() {
    navigator.clipboard.writeText(tempPassword);
    toast.success("Temporary password copied!");
  }

  // =============================
  // Render
  // =============================

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FaKey className="text-emerald-600" />
            Account Recovery
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage password recovery and support requests
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", count: stats.total, color: "bg-gray-100 text-gray-700" },
          { label: "Pending", count: stats.pending, color: "bg-yellow-100 text-yellow-700" },
          { label: "Verified", count: stats.verified, color: "bg-blue-100 text-blue-700" },
          { label: "Completed", count: stats.completed, color: "bg-green-100 text-green-700" },
          { label: "Rejected", count: stats.rejected, color: "bg-red-100 text-red-700" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.count}</p>
            <p className="text-xs font-medium mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, mobile, flat, request ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>
        <div className="relative">
          <FaFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
          <FaKey className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No recovery requests found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-4 font-semibold text-gray-600">Request ID</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Resident</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Mobile</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Block / Floor / Flat</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Type</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Date</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Status</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b last:border-b-0 hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => openModal(req)}
                  >
                    <td className="p-4 font-mono text-xs text-gray-500">
                      {req.id.slice(0, 8)}...
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{req.residentName || "—"}</div>
                    </td>
                    <td className="p-4 text-gray-600">{req.mobile || "—"}</td>
                    <td className="p-4 text-gray-600">
                      {req.block || "—"} / {req.floor || "—"} / {req.flatNumber || "—"}
                    </td>
                    <td className="p-4">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                        {getRequestTypeLabel(req.requestType)}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 text-xs">{formatDate(req.createdAt)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${statusColors[req.status] || "bg-gray-100 text-gray-600"}`}>
                        {statusIcons[req.status]}
                        {STATUS_LABELS[req.status] || req.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); openModal(req); }}
                        className="text-emerald-600 hover:text-emerald-700 font-medium text-xs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <FaKey className="text-emerald-600" />
                  Recovery Request
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  ID: {selectedRequest.id}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${statusColors[selectedRequest.status] || "bg-gray-100"}`}>
                {statusIcons[selectedRequest.status]}
                {STATUS_LABELS[selectedRequest.status] || selectedRequest.status}
              </span>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">

              {/* Request Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <FaUser className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Resident Name</p>
                    <p className="font-medium">{selectedRequest.residentName || matchedResident?.owner || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FaPhone className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Mobile</p>
                    <p className="font-medium">
                      {selectedRequest.mobile || resolvedMobile || (matchedResident?.mobile ? `${matchedResident.mobile} (on record)` : "—")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FaBuilding className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Block</p>
                    <p className="font-medium">{selectedRequest.block || matchedResident?.block || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FaLayerGroup className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Floor</p>
                    <p className="font-medium">{selectedRequest.floor || matchedResident?.floor || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FaHome className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Flat Number</p>
                    <p className="font-medium">
                      {selectedRequest.flatNumber || matchedResident?.flatNumber || matchedResident?.flat || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {selectedRequest.requestType === "forgot_mobile" ? (
                    <FaPhone className="text-amber-500 mt-0.5" />
                  ) : selectedRequest.requestType === "forgot_both" ? (
                    <FaShieldAlt className="text-purple-500 mt-0.5" />
                  ) : selectedRequest.requestType === "forgot_password" ? (
                    <FaKey className="text-emerald-500 mt-0.5" />
                  ) : (
                    <FaHeadset className="text-blue-500 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Request Type</p>
                    <p className="font-medium">{getRequestTypeLabel(selectedRequest.requestType)}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedRequest.description && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Description</p>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
              )}

              {/* Dates */}
              <div className="flex gap-6 text-xs text-gray-500">
                <span>Submitted: {formatDate(selectedRequest.createdAt)}</span>
                {selectedRequest.processedAt && (
                  <span>Processed: {formatDate(selectedRequest.processedAt)}</span>
                )}
              </div>

              {/* Resident UID */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Resident UID</p>
                <p className="font-mono text-xs">{selectedRequest.residentId || matchedResident?.id || "—"}</p>
              </div>

              {/* ==================================================== */}
              {/* PROCEDURE 1: FORGOT MOBILE NUMBER                    */}
              {/* ==================================================== */}
              {(selectedRequest.requestType === "forgot_mobile" || selectedRequest.requestType === "forgot_both") && (
                <div className="space-y-3">
                  {/* Society Records Match Card */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-blue-900 flex items-center gap-2">
                        <FaPhone className="text-blue-600" /> Society Records — Registered Mobile
                      </p>
                      {matchingLoading && (
                        <span className="text-xs text-blue-600 animate-pulse">Searching records...</span>
                      )}
                    </div>

                    {matchedResident ? (
                      <div className="space-y-3 text-sm text-blue-950">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white rounded-lg p-3 border border-blue-100">
                          <div>
                            <span className="text-xs text-gray-500 block">Registered Owner</span>
                            <span className="font-semibold">{matchedResident.owner || "—"}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Flat & Block</span>
                            <span className="font-semibold">
                              {matchedResident.flat || matchedResident.flatNumber || "—"}, {matchedResident.block || "—"}
                            </span>
                          </div>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-xs text-emerald-700 font-medium block">
                              Registered Mobile on Record:
                            </span>
                            <span className="text-xl font-mono font-bold text-emerald-900 tracking-wider">
                              {matchedResident.mobile || "Not set"}
                            </span>
                          </div>
                          {matchedResident.mobile && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(matchedResident.mobile);
                                toast.success("Registered mobile copied!");
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto shadow-sm"
                            >
                              <FaCopy /> Copy Mobile
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600 bg-white rounded-lg p-3">
                        {matchingLoading
                          ? "Searching database..."
                          : "No existing resident record automatically matched this flat. You can enter and assign a new registered mobile number below."}
                      </div>
                    )}
                  </div>

                  {/* Actions: Reveal or Update */}
                  {selectedRequest.status !== "completed" && (
                    <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-gray-900">Choose Resolution Action:</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Action 1: Share registered mobile */}
                        <button
                          type="button"
                          onClick={() => handleShareRegisteredMobile(selectedRequest)}
                          disabled={processing || (!selectedRequest.mobile && !matchedResident?.mobile)}
                          className="p-3 border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-100 rounded-xl text-left transition flex flex-col justify-between gap-2 group disabled:opacity-50"
                        >
                          <div>
                            <p className="font-bold text-sm text-emerald-900 flex items-center gap-1.5">
                              <FaCheckCircle className="text-emerald-600" /> Share Registered Mobile
                            </p>
                            <p className="text-xs text-emerald-700 mt-1">
                              Resident simply forgot which number was registered. Copy details to share with them.
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-emerald-700 underline group-hover:text-emerald-900">
                            📋 Share & Complete Request →
                          </span>
                        </button>

                        {/* Action 2: Update to new mobile */}
                        <button
                          type="button"
                          onClick={() => setShowUpdateMobileForm(!showUpdateMobileForm)}
                          className="p-3 border-2 border-blue-400 bg-blue-50/50 hover:bg-blue-100 rounded-xl text-left transition flex flex-col justify-between gap-2 group"
                        >
                          <div>
                            <p className="font-bold text-sm text-blue-900 flex items-center gap-1.5">
                              <FaPhone className="text-blue-600" /> Update to New Mobile
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              Resident got a new SIM card or wants to change their registered mobile.
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-blue-700 underline group-hover:text-blue-900">
                            {showUpdateMobileForm ? "Hide Form ↑" : "📱 Enter New Mobile →"}
                          </span>
                        </button>
                      </div>

                      {/* Update Mobile Form */}
                      {showUpdateMobileForm && (
                        <div className="bg-white border-2 border-blue-300 rounded-xl p-3.5 space-y-2.5 mt-2">
                          <label className="text-xs font-bold text-gray-700 block">
                            New 10-Digit Registered Mobile Number
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="tel"
                              placeholder="e.g. 9810123456"
                              value={newMobileInput}
                              onChange={(e) => setNewMobileInput(normalizeMobile(e.target.value))}
                              className="flex-1 border rounded-lg p-2 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              maxLength={10}
                            />
                            <button
                              type="button"
                              disabled={processing || newMobileInput.length !== 10}
                              onClick={() => handleUpdateRegisteredMobile(selectedRequest)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-xs font-bold transition whitespace-nowrap"
                            >
                              {processing ? "Updating..." : "Save & Complete"}
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            This will update the resident profile, auth lookup, and portal login to this new number.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Completed Mobile Recovery Card */}
                  {(selectedRequest.status === "completed" || resolvedMobile) && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                        <FaCheckCircle className="text-emerald-600" /> Mobile Recovery Resolved
                      </p>
                      <p className="text-xs text-emerald-700">
                        The registered login mobile for <strong>{selectedRequest.residentName || matchedResident?.owner}</strong> is:
                      </p>
                      <div className="bg-white rounded-lg p-3 border border-emerald-200 flex items-center justify-between gap-2">
                        <span className="font-mono text-lg font-bold text-gray-900">
                          {resolvedMobile || selectedRequest.mobile || matchedResident?.mobile}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const num = resolvedMobile || selectedRequest.mobile || matchedResident?.mobile;
                            const msg = `Smart Manager Portal:\nResident: ${selectedRequest.residentName || matchedResident?.owner}\nRegistered Mobile: ${num}\nLogin: ${window.location.origin}/resident/login`;
                            navigator.clipboard.writeText(msg);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                            toast.success("Credentials copied!");
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                        >
                          <FaCopy /> {copied ? "Copied!" : "Copy Details"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* PROCEDURE 2: FORGOT PASSWORD (or FORGOT BOTH)        */}
              {/* ==================================================== */}
              {(selectedRequest.requestType === "forgot_password" || selectedRequest.requestType === "forgot_both") && (
                <div className="space-y-3">
                  {/* Temporary Password Input for Verified Request */}
                  {selectedRequest.status === "verified" && !tempPassword && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                          <FaKey className="text-amber-600" /> Set Temporary Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setCustomTempPassword("RWA@" + Math.floor(100000 + Math.random() * 900000))}
                          className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline"
                        >
                          🎲 Generate Random
                        </button>
                      </div>
                      <input
                        type="text"
                        value={customTempPassword}
                        onChange={(e) => setCustomTempPassword(e.target.value)}
                        placeholder="e.g. 123456 or RWA@583921"
                        className="w-full bg-white border border-amber-300 rounded-lg p-2.5 font-mono text-base font-bold text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                        minLength={6}
                      />
                      <p className="text-xs text-amber-700">
                        The resident will use their mobile <strong>{selectedRequest.mobile || matchedResident?.mobile}</strong> and this temporary password to log in, and will be prompted to set a permanent password.
                      </p>
                    </div>
                  )}

                  {/* Temp Password Display (one-time view) */}
                  {tempPassword && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
                          <FaCheckCircle className="text-emerald-600" /> Temporary Password Ready
                        </p>
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-semibold">
                          Completed
                        </span>
                      </div>

                      <p className="text-xs text-emerald-700">
                        Share this temporary password with <strong>{selectedRequest.residentName || matchedResident?.owner}</strong>. On login, they will be required to set their private password.
                      </p>

                      <div className="flex items-center justify-between gap-3 bg-white rounded-lg p-3 border border-emerald-200">
                        <span className="font-mono text-xl font-bold text-gray-900 tracking-wider select-all">
                          {tempPassword}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const mob = selectedRequest.mobile || matchedResident?.mobile || "";
                            const message = `Smart Manager Portal Login:\nMobile: ${mob}\nTemporary Password: ${tempPassword}\nLogin: ${window.location.origin}/resident/login`;
                            navigator.clipboard.writeText(message);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                            toast.success("Credentials copied!");
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                        >
                          <FaCopy /> {copied ? "Copied!" : "Copy Credentials"}
                        </button>
                      </div>

                      {/* Spark plan guide & console link */}
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1.5">
                        <p className="font-semibold text-blue-900">💡 Firebase Spark Plan Note:</p>
                        <p>
                          If direct Cloud Functions are not active on your Firebase plan, you can also paste this temporary password directly in Firebase Auth:
                        </p>
                        <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-blue-200 font-mono text-xs text-gray-700">
                          <span>Auth Email: {(selectedRequest.mobile || matchedResident?.mobile)}@smart-manager-aad4d.firebaseapp.com</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`${selectedRequest.mobile || matchedResident?.mobile}@smart-manager-aad4d.firebaseapp.com`);
                              toast.success("Auth email copied!");
                            }}
                            className="text-blue-600 hover:underline font-bold text-[11px] ml-2"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="pt-0.5">
                          <a
                            href="https://console.firebase.google.com/project/smart-manager-aad4d/authentication/users"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold underline"
                          >
                            Open Firebase Console Users <FaExternalLinkAlt className="text-[10px]" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Admin Notes */}
              {selectedRequest.status !== "completed" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">Admin Notes / Resolution Details</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this request..."
                    rows={3}
                    className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  />
                  <button
                    onClick={() => handleSaveNotes(selectedRequest)}
                    className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Save Notes
                  </button>
                </div>
              )}

              {/* Existing Admin Notes (for completed/rejected) */}
              {(selectedRequest.status === "completed" || selectedRequest.status === "rejected") && selectedRequest.adminNotes && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Admin Notes</p>
                  <p className="text-sm">{selectedRequest.adminNotes}</p>
                </div>
              )}

              {/* Reject Reason Input */}
              {selectedRequest.status === "pending" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-red-600">
                    Rejection Reason (required to reject)
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejecting this request..."
                    rows={2}
                    className="w-full border border-red-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-400 outline-none resize-none"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl border hover:bg-gray-100 font-medium transition text-sm"
              >
                {selectedRequest.status === "completed" ? "Done" : "Close"}
              </button>

              <div className="flex items-center gap-2">
                {/* Pending → Verify */}
                {selectedRequest.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleReject(selectedRequest)}
                      disabled={processing || !rejectReason.trim()}
                      className="px-4 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleVerify(selectedRequest)}
                      disabled={processing}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition disabled:opacity-50"
                    >
                      {processing ? "Processing..." : "Verify Identity"}
                    </button>
                  </>
                )}

                {/* Verified → Action depends on Request Type */}
                {selectedRequest.status === "verified" && (
                  <>
                    {/* For Forgot Mobile: Share Mobile & Complete */}
                    {selectedRequest.requestType === "forgot_mobile" && (
                      <button
                        onClick={() => handleShareRegisteredMobile(selectedRequest)}
                        disabled={processing || (!selectedRequest.mobile && !matchedResident?.mobile)}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <FaPhone />
                        {processing ? "Processing..." : "Share Mobile & Complete"}
                      </button>
                    )}

                    {/* For Forgot Password: Reset Password */}
                    {selectedRequest.requestType === "forgot_password" && !tempPassword && (
                      <button
                        onClick={() => handleResetPassword(selectedRequest)}
                        disabled={processing}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <FaKey />
                        {processing ? "Resetting..." : "Reset Password"}
                      </button>
                    )}

                    {/* For Forgot Both: Resolve Mobile & Reset Password */}
                    {selectedRequest.requestType === "forgot_both" && !tempPassword && (
                      <button
                        onClick={() => handleResetPassword(selectedRequest)}
                        disabled={processing}
                        className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center gap-2"
                      >
                        <FaKey />
                        {processing ? "Resetting..." : "Resolve Mobile & Reset Password"}
                      </button>
                    )}

                    {/* For General Support: Mark Resolved */}
                    {selectedRequest.requestType !== "forgot_mobile" &&
                      selectedRequest.requestType !== "forgot_password" &&
                      selectedRequest.requestType !== "forgot_both" && (
                        <button
                          onClick={() => handleGeneralResolve(selectedRequest)}
                          disabled={processing}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center gap-2"
                        >
                          <FaCheck />
                          {processing ? "Saving..." : "Mark Resolved & Completed"}
                        </button>
                      )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  FaPhoneAlt,
  FaBuilding,
  FaCalendarAlt,
  FaShieldAlt,
  FaExclamationTriangle,
  FaTrash,
  FaKey,
  FaLeaf,
  FaVenusMars,
  FaBriefcase,
  FaAmbulance,
  FaSyncAlt,
} from "react-icons/fa";

import toast from "react-hot-toast";

import {
  subscribeRegistrationRequests,
  approveRegistration,
  rejectRegistration,
  rejectAndDeleteRegistration,
} from "../../services/registrationService";

import { logActivity } from "../../services/activityLogService";
import { useResidents } from "../../context/ResidentContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { useSettings } from "../../context/SettingsContext";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import Pagination from "../../components/common/Pagination";
import { TableLoadingSkeleton, StatCardsSkeleton } from "../../components/common/TableLoadingSkeleton";
import {
  normalizePlotNumber,
  normalizeFloor,
  normalizeUnitNumber,
  formatPropertyDisplay,
  AVAILABLE_FLOORS,
  generateFlatId,
  parseFlatId,
  cleanUnitNumber,
} from "../../services/propertyService";
import { migrateAllExistingFlatIds } from "../../utils/propertyMigration";

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [loadingId, setLoadingId] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [charge, setCharge] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // Canonical Property override state for approval
  const [approveBlockId, setApproveBlockId] = useState("");
  const [approveBlock, setApproveBlock] = useState("");
  const [approvePlot, setApprovePlot] = useState("");
  const [approveFloor, setApproveFloor] = useState("Ground Floor");
  const [approveUnit, setApproveUnit] = useState("");
  const [approvePersonType, setApprovePersonType] = useState("OWNER");
  const [approveGarbageParticipation, setApproveGarbageParticipation] = useState("participating");
  const [approveFlat, setApproveFlat] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [migratingFlatIds, setMigratingFlatIds] = useState(false);

  const { residents } = useResidents();
  const { blocks } = useBlockFlat();
  const { settings } = useSettings();
  const { user } = useAuth();
  const { markPathRead, notifications, markRead } = useNotifications();

  useEffect(() => {
    markPathRead("/admin/registrations");
  }, [markPathRead]);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      setAllRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const safetyTimer = setTimeout(() => setLoading(false), 2000);
    const unsubscribe = subscribeRegistrationRequests((data) => {
      clearTimeout(safetyTimer);
      setAllRequests(data || []);
      setLoading(false);
    });
    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [user]);

  const pendingCount = allRequests.filter((r) => r.status === "pending").length;
  const approvedCount = allRequests.filter((r) => r.status === "approved").length;
  const rejectedCount = allRequests.filter((r) => r.status === "rejected").length;

  const outdatedRequestsCount = useMemo(() => {
    return allRequests.filter((req) => {
      const canonical = generateFlatId({
        plotNumber: req.plotNumber,
        floor: req.floor,
        unitNumber: req.unitNumber,
        flat: req.flat,
      });
      return (req.flat || "") !== canonical;
    }).length;
  }, [allRequests]);

  async function handleUpdateExistingFlatIds() {
    setMigratingFlatIds(true);
    try {
      const res = await migrateAllExistingFlatIds({ adminUserId: user?.uid || "admin" });
      toast.success(
        `Flat IDs upgraded! Updated ${res.registrationRequestsUpdated} requests, ${res.residentsUpdated} residents, and ${res.usersUpdated} accounts to Plot-FloorCode-Flat format.`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update Flat IDs: " + err.message);
    }
    setMigratingFlatIds(false);
  }

  // Canonical Property duplicate & occupancy detection
  function getDuplicateWarnings(req) {
    const warnings = [];
    const reqUid = req.uid || req.id;
    const reqPlot = normalizePlotNumber(req.plotNumber || req.flat || "");
    const reqFloorObj = normalizeFloor(req.floor);
    const reqUnit = normalizeUnitNumber(req.unitNumber || "");
    const reqPersonType = (req.personType || "OWNER").toUpperCase();
    const reqBlock = (req.block || "").trim().toLowerCase();

    if (reqPlot) {
      // Find residents in same block, plot, and floor
      const samePropertyResidents = residents.filter(
        (r) =>
          r.id !== reqUid &&
          (r.block || "").trim().toLowerCase() === reqBlock &&
          normalizePlotNumber(r.plotNumber || r.flat || r.flatNumber || "") === reqPlot &&
          normalizeFloor(r.floor).code === reqFloorObj.code &&
          normalizeUnitNumber(r.unitNumber) === reqUnit &&
          (r.status || "").toLowerCase() !== "rejected"
      );

      if (samePropertyResidents.length > 0) {
        const existingOwner = samePropertyResidents.find(
          (r) => (r.personType || "OWNER").toUpperCase() === "OWNER"
        );

        if (reqPersonType === "OWNER" && existingOwner) {
          warnings.push(
            `Property Block ${req.block}, Plot ${reqPlot}, ${reqFloorObj.label}${reqUnit ? `, Unit ${reqUnit}` : ""} already has a registered Owner (${existingOwner.owner || existingOwner.name}). Multiple owners require review.`
          );
        } else if ((reqPersonType === "TENANT" || reqPersonType === "RENTED") && existingOwner) {
          warnings.push(
            `ℹ️ Note: Existing Owner on this property is ${existingOwner.owner || existingOwner.name}. Approving will register this applicant as Rented.`
          );
        } else {
          warnings.push(
            `Property Block ${req.block}, Plot ${reqPlot}, ${reqFloorObj.label}${reqUnit ? `, Unit ${reqUnit}` : ""} already occupied by ${samePropertyResidents[0].owner || samePropertyResidents[0].name}.`
          );
        }
      }
    }

    // Mobile duplicate check
    const reqMobile = (req.mobile || "").trim();
    if (reqMobile) {
      const dupMobile = residents.find(
        (r) => r.id !== reqUid && (r.mobile || "").trim() === reqMobile
      );
      if (dupMobile) {
        warnings.push(`Mobile ${req.mobile} already belongs to ${dupMobile.owner || dupMobile.name || "another resident"}`);
      }
    }

    // Email duplicate check
    const reqEmail = (req.email || "").trim().toLowerCase();
    if (reqEmail) {
      const dupEmail = residents.find(
        (r) =>
          r.id !== reqUid &&
          (r.email || "").trim().toLowerCase() === reqEmail
      );
      if (dupEmail) {
        warnings.push(`Email ${req.email} already belongs to ${dupEmail.owner || dupEmail.name || "another resident"}`);
      }
    }

    return warnings;
  }

  const filtered = useMemo(() => {
    return allRequests.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.name?.toLowerCase().includes(s) ||
          r.fatherHusbandName?.toLowerCase().includes(s) ||
          r.email?.toLowerCase().includes(s) ||
          r.mobile?.includes(s) ||
          r.alternateMobile?.includes(s) ||
          r.emergencyContact?.includes(s) ||
          r.flat?.toLowerCase().includes(s) ||
          r.plotNumber?.toLowerCase().includes(s) ||
          r.unitNumber?.toLowerCase().includes(s) ||
          r.block?.toLowerCase().includes(s) ||
          r.floor?.toLowerCase().includes(s) ||
          r.personType?.toLowerCase().includes(s) ||
          r.occupation?.toLowerCase().includes(s)
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
      await approveRegistration(
        approveModal.id,
        approveModal,
        charge,
        {
          block: approveBlock || approveModal.block,
          blockId: approveBlockId || approveModal.blockId || "",
          plotNumber: approvePlot || approveModal.plotNumber || approveModal.flat,
          floor: approveFloor || approveModal.floor || "Ground Floor",
          unitNumber: approveUnit !== undefined ? approveUnit : (approveModal.unitNumber || ""),
          personType: approvePersonType || approveModal.personType || "OWNER",
          garbageParticipation: approveGarbageParticipation || approveModal.garbageParticipation || "not_participating",
          flat: generateFlatId({
            plotNumber: approvePlot || approveModal.plotNumber,
            floor: approveFloor || approveModal.floor,
            unitNumber: approveUnit !== undefined ? approveUnit : approveModal.unitNumber,
            flat: approveFlat || approveModal.flat,
          }),
        },
        {
          uid: user?.uid || "",
          name: user?.name || "Admin",
          role: "admin",
        }
      );

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
        details: `Plot: ${approvePlot || approveModal.plotNumber || approveModal.flat}, Floor: ${approveFloor || approveModal.floor}, Block: ${approveBlock || approveModal.block}, Role: ${approvePersonType}, Garbage: ${approveGarbageParticipation}, Charge: ₹${charge || 0}`,
      });

      toast.success("Registration approved — resident account created");
      markPathRead("/admin/registrations");
      setApproveModal(null);
      setCharge("");
      setApproveBlockId("");
      setApproveBlock("");
      setApprovePlot("");
      setApproveFloor("Ground Floor");
      setApproveUnit("");
      setApprovePersonType("OWNER");
      setApproveGarbageParticipation("participating");
      setApproveFlat("");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to approve registration");
    }
    setLoadingId(null);
  }

  async function handleReject() {
    if (!rejectModal) return;
    setLoadingId(rejectModal.id);
    try {
      await rejectRegistration(
        rejectModal.id || rejectModal.uid,
        rejectModal,
        rejectReason,
        {
          uid: user?.uid || "",
          name: user?.name || "Admin",
          role: user?.role || "admin",
        }
      );

      toast.success("Registration rejected — saved to Rejected list");
      markPathRead("/admin/registrations");
      setRejectModal(null);
      setRejectReason("");
    } catch (error) {
      console.error("[handleReject] Error:", error);
      toast.error(error?.message ? `Failed to reject: ${error.message}` : "Failed to reject registration");
    }
    setLoadingId(null);
  }

  async function handlePermanentDelete(req) {
    if (!window.confirm(`Permanently delete the registration record for ${req.name}? This cannot be undone.`)) {
      return;
    }
    setLoadingId(req.id);
    try {
      await rejectAndDeleteRegistration({
        requestId: req.id,
        requestData: req,
        reason: req.rejectionReason || "Admin permanently removed rejected request",
        adminName: user?.name || "Admin",
        adminUid: user?.uid || "",
      });
      toast.success("Registration record permanently deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete registration record");
    }
    setLoadingId(null);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FaUserPlus className="text-emerald-600" /> Registration Requests
          </h1>
          <p className="text-gray-500">Review and approve new resident registrations</p>
        </div>

        {outdatedRequestsCount > 0 && (
          <button
            onClick={handleUpdateExistingFlatIds}
            disabled={migratingFlatIds}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl shadow-xs text-xs font-semibold transition active:scale-95 disabled:opacity-60 shrink-0 self-start sm:self-auto"
            title="Update legacy flat IDs to canonical format (Plot-FloorCode-Flat)"
          >
            <FaSyncAlt className={`text-amber-600 ${migratingFlatIds ? "animate-spin" : ""}`} />
            <span>{migratingFlatIds ? "Updating Flat IDs..." : `Update Legacy Flat IDs (${outdatedRequestsCount})`}</span>
          </button>
        )}
      </div>

      {/* Stats */}
      {loading ? (
        <StatCardsSkeleton count={3} className="grid grid-cols-3 gap-4" />
      ) : (
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
      )}

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
      {loading ? (
        <TableLoadingSkeleton cols={5} rows={4} message="Loading registration requests..." subMessage="Fetching pending resident onboarding applications" />
      ) : filtered.length === 0 ? (
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
            const isApproved = req.status === "approved";
            const isRejected = req.status === "rejected";
            const warnings = isPending ? getDuplicateWarnings(req) : [];
            const isTenant = (req.personType || "").toUpperCase() === "TENANT" || (req.personType || "").toUpperCase() === "RENTED";
            const isGC = req.garbageParticipation === "participating";
            const parsed = parseFlatId(req.flat, req.plotNumber, req.floor);
            const plotDisplay = parsed.plotNumber || normalizePlotNumber(req.plotNumber) || (req.flat || "—");
            const unitDisplay = cleanUnitNumber(req.unitNumber !== undefined && req.unitNumber !== null && req.unitNumber !== "" ? req.unitNumber : parsed.unitNumber, plotDisplay);
            const fullFlatCode = generateFlatId({
              plotNumber: plotDisplay !== "—" ? plotDisplay : "",
              floor: req.floor,
              unitNumber: unitDisplay,
              flat: req.flat,
            });

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition duration-200 hover:shadow-md ${
                  isPending ? "border-l-4 border-l-amber-500 border-slate-200" :
                  isApproved ? "border-l-4 border-l-emerald-500 border-slate-200" :
                  "border-l-4 border-l-rose-500 border-slate-200"
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Top Header: Applicant Name, Badges & Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 shadow-sm ${
                        isPending ? "bg-amber-100 text-amber-800" :
                        isApproved ? "bg-emerald-100 text-emerald-800" :
                        "bg-rose-100 text-rose-800"
                      }`}>
                        {req.name ? req.name.charAt(0).toUpperCase() : <FaUser />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-slate-900 truncate">{req.name}</h3>
                          {/* Occupancy Role Badge */}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isTenant
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}>
                            <FaKey className="text-[10px]" />
                            {isTenant ? "Tenant (Rented)" : "Property Owner"}
                          </span>
                          {/* Garbage Service Badge */}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isGC
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            <FaLeaf className="text-[10px]" />
                            {isGC ? "GC: Participating" : "GC: Opted-Out"}
                          </span>
                          {/* Status Badge */}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isPending
                              ? "bg-amber-100 text-amber-800"
                              : isApproved
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {isPending && <FaClock className="text-[10px]" />}
                            {isApproved && <FaCheckCircle className="text-[10px]" />}
                            {isRejected && <FaTimesCircle className="text-[10px]" />}
                            {isPending ? "Pending Approval" : isApproved ? "Approved" : "Rejected"}
                          </span>
                        </div>
                        {req.fatherHusbandName && (
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Father / Husband: <strong className="text-slate-800">{req.fatherHusbandName}</strong>
                          </p>
                        )}
                      </div>
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
                              const pNum = plotDisplay !== "—" ? plotDisplay : normalizePlotNumber(req.plotNumber || "");
                              setApprovePlot(pNum);
                              setApproveFloor(req.floor || "Ground Floor");
                              setApproveUnit(unitDisplay || "");
                              setApprovePersonType(req.personType || "OWNER");
                              setApproveGarbageParticipation(req.garbageParticipation || "participating");
                              setApproveFlat(fullFlatCode);
                            }}
                            disabled={loadingId === req.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-semibold transition text-sm disabled:opacity-50 shadow-sm"
                          >
                            <FaCheck /> Approve
                          </button>
                          <button
                            onClick={() => { setRejectModal(req); setRejectReason(""); }}
                            disabled={loadingId === req.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition text-sm disabled:opacity-50 border border-red-200"
                          >
                            <FaTimes /> Reject
                          </button>
                        </>
                      ) : isApproved ? (
                        <span className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 bg-green-100 text-green-700 border border-green-200">
                          <FaCheckCircle /> Account Created
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 bg-red-100 text-red-700 border border-red-200">
                            <FaTimesCircle /> Rejected
                          </span>
                          <button
                            onClick={() => handlePermanentDelete(req)}
                            disabled={loadingId === req.id}
                            title="Permanently remove rejected record"
                            className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition text-xs"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 1: Property & Residence Details (Hierarchy) */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <FaBuilding className="text-emerald-600" /> Property & Residence Hierarchy
                      </span>
                      <span className="text-xs font-mono font-bold bg-white border border-slate-200 text-emerald-800 px-2.5 py-0.5 rounded-md">
                        Flat ID: {fullFlatCode}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-white border border-slate-200/60 rounded-lg p-2.5">
                        <span className="text-slate-400 text-[10px] font-semibold block uppercase">1. Block</span>
                        <p className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 truncate">{req.block || "—"}</p>
                      </div>
                      <div className="bg-white border border-slate-200/60 rounded-lg p-2.5">
                        <span className="text-slate-400 text-[10px] font-semibold block uppercase">2. Plot / Building No.</span>
                        <p className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 truncate">{plotDisplay}</p>
                      </div>
                      <div className="bg-white border border-slate-200/60 rounded-lg p-2.5">
                        <span className="text-slate-400 text-[10px] font-semibold block uppercase">3. Floor</span>
                        <p className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 truncate">{req.floor || "—"}</p>
                      </div>
                      <div className="bg-white border border-slate-200/60 rounded-lg p-2.5">
                        <span className="text-slate-400 text-[10px] font-semibold block uppercase">4. Flat / Unit No.</span>
                        <p className="font-bold text-slate-800 text-xs sm:text-sm mt-0.5 truncate">
                          {unitDisplay || "Single / Full Floor"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Contact Information Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* Primary Mobile */}
                    <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3">
                      <span className="text-blue-700 font-bold text-[10px] uppercase tracking-wide flex items-center gap-1.5">
                        <FaPhone className="text-blue-600 text-[11px]" /> Registered Mobile (Login ID) *
                      </span>
                      <p className="font-extrabold text-slate-900 text-sm mt-1">{req.mobile || "—"}</p>
                    </div>

                    {/* Alternate Mobile */}
                    <div className="bg-white border border-slate-200/70 rounded-xl p-3">
                      <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide flex items-center gap-1.5">
                        <FaPhoneAlt className="text-slate-400 text-[10px]" /> Alternate Mobile
                      </span>
                      <p className="font-bold text-slate-800 text-xs sm:text-sm mt-1">
                        {req.alternateMobile || <span className="text-slate-400 font-normal italic">None specified</span>}
                      </p>
                    </div>

                    {/* Emergency Contact */}
                    <div className="bg-white border border-slate-200/70 rounded-xl p-3">
                      <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide flex items-center gap-1.5">
                        <FaAmbulance className="text-rose-500 text-[10px]" /> Emergency Contact
                      </span>
                      <p className="font-bold text-slate-800 text-xs sm:text-sm mt-1">
                        {req.emergencyContact || <span className="text-slate-400 font-normal italic">None specified</span>}
                      </p>
                    </div>

                    {/* Email */}
                    <div className="bg-white border border-slate-200/70 rounded-xl p-3">
                      <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide flex items-center gap-1.5">
                        <FaEnvelope className="text-slate-400 text-[10px]" /> Email Address
                      </span>
                      <p className="font-bold text-slate-800 text-xs sm:text-sm truncate mt-1" title={req.email || "Not Provided"}>
                        {req.email || <span className="text-slate-400 font-normal italic">Not provided</span>}
                      </p>
                    </div>
                  </div>

                  {/* Section 3: Personal Information & Preferences */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* Father / Husband Name */}
                    <div className="bg-white border border-slate-200/70 rounded-xl p-2.5">
                      <span className="text-slate-400 text-[10px] font-semibold block uppercase">Father / Husband</span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">{req.fatherHusbandName || "—"}</p>
                    </div>

                    {/* Gender */}
                    <div className="bg-white border border-slate-200/70 rounded-xl p-2.5">
                      <span className="text-slate-400 text-[10px] font-semibold flex items-center gap-1 uppercase">
                        <FaVenusMars className="text-[10px]" /> Gender
                      </span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{req.gender || "—"}</p>
                    </div>

                    {/* DOB */}
                    <div className="bg-white border border-slate-200/70 rounded-xl p-2.5">
                      <span className="text-slate-400 text-[10px] font-semibold flex items-center gap-1 uppercase">
                        <FaCalendarAlt className="text-[10px]" /> Date of Birth
                      </span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5">{req.dob || "—"}</p>
                    </div>

                    {/* Occupation */}
                    <div className="bg-white border border-slate-200/70 rounded-xl p-2.5">
                      <span className="text-slate-400 text-[10px] font-semibold flex items-center gap-1 uppercase">
                        <FaBriefcase className="text-[10px]" /> Occupation
                      </span>
                      <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">{req.occupation || "—"}</p>
                    </div>
                  </div>

                  {/* Duplicate Warnings */}
                  {warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-bold text-amber-700 flex items-center gap-1 mb-1">
                        <FaExclamationTriangle /> Duplicate Property / Identity Warnings
                      </p>
                      {warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600">• {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {req.rejectionReason && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-xs text-red-600"><strong>Rejection Reason:</strong> {req.rejectionReason}</p>
                    </div>
                  )}

                  {/* Footer Timestamps */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <FaClock /> Submitted: {formatDate(req.registeredAt)}
                    </span>
                    <div className="flex items-center gap-3">
                      {req.approvedAt && <span className="text-emerald-600 font-medium">✓ Approved: {formatDate(req.approvedAt)}</span>}
                      {req.rejectedAt && <span className="text-rose-600 font-medium">✕ Rejected: {formatDate(req.rejectedAt)}</span>}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-emerald-600 flex items-center gap-2">
                <FaCheckCircle /> Approve Resident Registration
              </h2>
              <button
                onClick={() => {
                  setApproveModal(null);
                  setApproveBlockId("");
                  setApproveBlock("");
                  setApprovePlot("");
                  setApproveFloor("Ground Floor");
                  setApproveUnit("");
                  setApprovePersonType("OWNER");
                  setApproveGarbageParticipation("participating");
                  setApproveFlat("");
                }}
                className="text-slate-400 hover:text-slate-600 text-lg p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Applicant Profile Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{approveModal.name}</h3>
                    {approveModal.fatherHusbandName && (
                      <p className="text-xs text-slate-500 font-medium">
                        Father / Husband: <strong className="text-slate-700">{approveModal.fatherHusbandName}</strong>
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    (approveModal.personType === "TENANT" || approveModal.personType === "RENTED")
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`}>
                    {(approveModal.personType === "TENANT" || approveModal.personType === "RENTED") ? "Tenant" : "Property Owner"}
                  </span>
                </div>

                {/* Contact & Personal Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-white border rounded-lg p-2">
                    <span className="text-slate-400 text-[10px] block">Mobile (Login ID)</span>
                    <span className="font-bold text-slate-800">{approveModal.mobile || "—"}</span>
                  </div>
                  <div className="bg-white border rounded-lg p-2">
                    <span className="text-slate-400 text-[10px] block">Alternate Mobile</span>
                    <span className="font-bold text-slate-800">{approveModal.alternateMobile || "—"}</span>
                  </div>
                  <div className="bg-white border rounded-lg p-2">
                    <span className="text-slate-400 text-[10px] block">Emergency Contact</span>
                    <span className="font-bold text-slate-800">{approveModal.emergencyContact || "—"}</span>
                  </div>
                  <div className="bg-white border rounded-lg p-2">
                    <span className="text-slate-400 text-[10px] block">Email</span>
                    <span className="font-bold text-slate-800 truncate block">{approveModal.email || "—"}</span>
                  </div>
                  <div className="bg-white border rounded-lg p-2">
                    <span className="text-slate-400 text-[10px] block">DOB / Gender</span>
                    <span className="font-bold text-slate-800">{approveModal.dob || "—"} ({approveModal.gender || "—"})</span>
                  </div>
                  <div className="bg-white border rounded-lg p-2">
                    <span className="text-slate-400 text-[10px] block">Occupation</span>
                    <span className="font-bold text-slate-800 truncate block">{approveModal.occupation || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Garbage Collection Service Toggle */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <FaLeaf className="text-emerald-600" /> Garbage Collection Service Preference
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setApproveGarbageParticipation("participating")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      approveGarbageParticipation === "participating"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <FaCheck className="text-[10px]" /> Participating (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setApproveGarbageParticipation("not_participating")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      approveGarbageParticipation === "not_participating"
                        ? "bg-slate-700 text-white border-slate-700 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <FaTimes className="text-[10px]" /> Not Participating (Opt-out)
                  </button>
                </div>
              </div>

              {/* Canonical Property Details & Override */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                  <FaBuilding className="text-blue-600" /> Verify Canonical Property Identity
                </p>
                <p className="text-xs text-blue-700">Ensure Block, Plot, Floor, and Unit are accurate before creating official resident account.</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-700">Block *</label>
                    <select
                      value={approveBlockId}
                      onChange={(e) => {
                        const bid = e.target.value;
                        const blk = blocks.find((b) => b.id === bid);
                        setApproveBlockId(bid);
                        setApproveBlock(blk?.name || "");
                      }}
                      className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">— Keep: {approveModal.block || "None"} —</option>
                      {blocks.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-700">Plot / Building Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. 572, 12, 104"
                      value={approvePlot}
                      onChange={(e) => setApprovePlot(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-700">Floor *</label>
                    <select
                      value={approveFloor}
                      onChange={(e) => setApproveFloor(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {AVAILABLE_FLOORS.map((fl) => (
                        <option key={fl} value={fl}>
                          {fl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-700">
                      Flat / Unit Number <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1, A, 2 (leave blank if full floor)"
                      value={approveUnit}
                      onChange={(e) => setApproveUnit(e.target.value)}
                      className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-700">Person Role / Occupancy</label>
                  <select
                    value={approvePersonType === "TENANT" ? "RENTED" : approvePersonType}
                    onChange={(e) => setApprovePersonType(e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="OWNER">Property Owner</option>
                    <option value="RENTED">Tenant (Rented)</option>
                  </select>
                </div>

                {/* Address Hierarchy Preview Pill */}
                <div className="bg-white border border-blue-200/80 rounded-lg p-2.5 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 font-medium">Hierarchy Preview:</span>
                    <span className="font-semibold text-slate-800">
                      {approveBlock || approveModal.block || "Block"} ➔ Plot {approvePlot || "—"} ➔ {approveFloor} ➔ {approveUnit ? `Unit ${approveUnit}` : "Full Floor"}
                    </span>
                  </div>
                  <span className="font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded text-[11px] shrink-0">
                    Flat ID: {generateFlatId({ plotNumber: approvePlot, floor: approveFloor, unitNumber: approveUnit })}
                  </span>
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
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Monthly maintenance / garbage charge for this resident</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => {
                  setApproveModal(null);
                  setApproveBlockId("");
                  setApproveBlock("");
                  setApprovePlot("");
                  setApproveFloor("Ground Floor");
                  setApproveUnit("");
                  setApprovePersonType("OWNER");
                  setApproveGarbageParticipation("participating");
                  setApproveFlat("");
                }}
                className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={loadingId === approveModal.id}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition disabled:bg-gray-400 shadow-sm"
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

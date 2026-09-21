import { useMemo, useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaLock,
  FaHome,
  FaBuilding,
  FaCalendarAlt,
  FaEdit,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaShieldAlt,
  FaBriefcase,
  FaVenusMars,
  FaUserFriends,
  FaExclamationTriangle,
  FaRecycle,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail } from "firebase/auth";
import { terminateAllOtherSessions, getOrCreateSessionId } from "../../services/sessionService";
import { auth } from "../../firebase/firebase";

import RoleBadge from "../../components/common/RoleBadge";

import {
  submitProfileUpdateRequest,
  subscribeMyProfileRequests,
  UPDATABLE_FIELDS,
} from "../../services/profileRequestService";

import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

const GC_STATUS_LABELS = {
  participating: "Participating",
  not_participating: "Not Participating",
  temporary_stopped: "Temporarily Stopped",
  inactive: "Inactive",
};

export function getDisplayEmail(resident, user) {
  const isDummy = (em) =>
    !em ||
    em.includes("@smart-manager-aad4d.firebaseapp.com") ||
    em.includes("firebaseapp.com");

  if (resident?.email && !isDummy(resident.email)) return resident.email;
  if (user?.personalEmail && !isDummy(user.personalEmail)) return user.personalEmail;
  if (user?.email && !isDummy(user.email)) return user.email;
  return "";
}

export default function ResidentProfile() {
  const { user } = useAuth();
  const { residents } = useResidents();

  const resident = useMemo(() => {
    const lookupId = user?.role === "family" ? user?.parentResidentId : user?.residentId;
    return (
      residents.find(
        (r) =>
          r.id === lookupId ||
          r.id === user?.uid ||
          (user?.phone && r.mobile === user?.phone)
      ) || null
    );
  }, [residents, user]);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [sendingResetLink, setSendingResetLink] = useState(false);

  // Profile update request
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestField, setRequestField] = useState("");
  const [requestCurrentValue, setRequestCurrentValue] = useState("");
  const [requestNewValue, setRequestNewValue] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // My requests
  const [myRequests, setMyRequests] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeMyProfileRequests(user.uid, setMyRequests);
    return () => unsubscribe();
  }, [user?.uid]);

  // Set of field keys that currently have a pending request
  const pendingFieldsSet = useMemo(() => {
    const set = new Set();
    (myRequests || []).forEach((r) => {
      if (r.status === "pending" && r.changes?.field) {
        set.add(r.changes.field);
      }
    });
    return set;
  }, [myRequests]);

  // Auto-fill current value when field is selected
  const displayEmail = getDisplayEmail(resident, user);

  useEffect(() => {
    if (!requestField || !resident) {
      setRequestCurrentValue("");
      return;
    }
    const fieldDef = UPDATABLE_FIELDS.find((f) => f.key === requestField);
    if (fieldDef?.key === "Email") {
      setRequestCurrentValue(displayEmail || "");
    } else if (fieldDef?.residentField) {
      setRequestCurrentValue(resident[fieldDef.residentField] || "");
    } else {
      setRequestCurrentValue("");
    }
  }, [requestField, resident, displayEmail]);

  // Check if current action is adding a new missing detail vs updating an existing detail
  const isAddingDetail = useMemo(() => {
    if (!requestField) return false;
    const val = requestCurrentValue;
    return (
      !val ||
      val === "—" ||
      val === "Not provided" ||
      val === "null" ||
      val === "undefined" ||
      String(val).trim() === ""
    );
  }, [requestField, requestCurrentValue]);

  function openRequestForField(fieldKey) {
    if (!canRequest) return;
    if (pendingFieldsSet.has(fieldKey)) {
      toast.error(`A request for ${fieldKey} is already pending admin approval.`);
      return;
    }
    setRequestField(fieldKey);
    setRequestNewValue("");
    setRequestReason("");
    setShowRequestForm(true);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (changingPw) return;

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setChangingPw(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      try {
        const currentSessionId = getOrCreateSessionId();
        await terminateAllOtherSessions(
          auth.currentUser.uid,
          currentSessionId,
          "Your password was changed. You were logged out from other devices."
        );
      } catch (sessErr) {
        console.warn("[ResidentProfile] Failed to terminate other sessions:", sessErr.message);
      }

      toast.success("Password changed successfully! Other devices have been logged out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to change password");
    } finally {
      setChangingPw(false);
    }
  }

  async function handleSendProfileResetLink() {
    if (!displayEmail) {
      toast.error("No registered email address found. Please request to add an email address above.");
      return;
    }
    setSendingResetLink(true);
    try {
      await sendPasswordResetEmail(auth, displayEmail);
      toast.success(`Password reset email link sent to ${displayEmail}`);
    } catch (err) {
      console.error("[ResidentProfile] Reset link error:", err);
      toast.error(err.message || "Failed to send reset link.");
    } finally {
      setSendingResetLink(false);
    }
  }

  async function handleSubmitRequest(e) {
    e.preventDefault();
    if (!requestField || !requestNewValue.trim()) {
      toast.error("Please enter the required details");
      return;
    }

    if (!isAddingDetail && !requestReason.trim()) {
      toast.error("Reason is mandatory when updating existing details");
      return;
    }

    // Check if there's already a pending request for this field
    if (pendingFieldsSet.has(requestField)) {
      toast.error(`A request for ${requestField} is already pending admin approval`);
      return;
    }

    setSubmittingRequest(true);
    try {
      await submitProfileUpdateRequest({
        userId: user.uid,
        residentId: resident?.id || user?.residentId || user.uid,
        userName: user.name || resident?.owner || "",
        userEmail: displayEmail || "",
        flat: resident?.flat || user?.flat || "",
        block: resident?.block || user?.block || "",
        changes: {
          field: requestField,
          currentValue: requestCurrentValue || "Not provided",
          newValue: requestNewValue.trim(),
          reason: isAddingDetail
            ? (requestReason.trim() || "Providing missing profile details")
            : requestReason.trim(),
        },
      });

      // Create notification for the resident
      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        title: isAddingDetail ? "Profile Detail Submitted" : "Profile Update Requested",
        message: `Your request for ${requestField} has been submitted and is pending admin approval.`,
        type: "profile_request",
        read: false,
        createdAt: serverTimestamp(),
      });

      toast.success(
        isAddingDetail
          ? "Profile details submitted — awaiting admin approval"
          : "Profile update request submitted — awaiting admin approval"
      );
      setShowRequestForm(false);
      setRequestField("");
      setRequestNewValue("");
      setRequestReason("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit request");
    } finally {
      setSubmittingRequest(false);
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  if (!resident && user?.role !== "family" && user?.role !== "committee") {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <p>Profile not linked. Contact admin.</p>
      </div>
    );
  }

  const isFamily = user?.role === "family";
  const isCommittee = user?.role === "committee";
  const canRequest = !isFamily && !isCommittee;
  const pendingRequests = myRequests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Security Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <FaExclamationTriangle className="text-amber-500 text-xl shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-800 text-sm">Profile Security Enabled</p>
          <p className="text-amber-700 text-xs mt-1">
            Personal information is read-only for security. To update any existing field or add missing details,
            use the <strong>"Request Profile Update & Add Details"</strong> button or the <strong>+ Add / Update</strong> button on any field. Changes require admin approval.
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className={`h-24 ${
          user?.role === "committee" ? "bg-gradient-to-r from-indigo-600 to-indigo-700" :
          user?.role === "family" ? "bg-gradient-to-r from-sky-600 to-sky-700" :
          "bg-gradient-to-r from-blue-600 to-blue-700"
        }`} />

        <div className="px-6 pb-6">
          <div className="-mt-12 mb-4">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center text-5xl border-4 border-white">
              <FaUser className={
                user?.role === "committee" ? "text-indigo-500" :
                user?.role === "family" ? "text-sky-500" : "text-blue-500"
              } />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{resident?.owner || user?.name || "User"}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <RoleBadge role={user?.role} designation={user?.designation} size="md" />
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1">
                  <FaCheckCircle className="text-[10px]" /> Active
                </span>
                {pendingRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 flex items-center gap-1">
                    <FaClock className="text-[10px]" /> {pendingRequests.length} Pending
                  </span>
                )}
              </div>
            </div>

            {canRequest && (
              <button
                onClick={() => {
                  setRequestField("");
                  setRequestNewValue("");
                  setRequestReason("");
                  setShowRequestForm(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium transition text-sm shadow-lg shadow-blue-500/20"
              >
                <FaEdit /> Request Profile Update & Add Details
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account Authorization & Access Provenance */}
      {(resident?.accessProvenance || user?.accessProvenance || resident?.createdBy) && (
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/50 border border-slate-200/90 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FaShieldAlt className="text-indigo-600" /> Account Authorization & Provenance
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
              <FaCheckCircle className="text-[11px] text-emerald-600" /> Verified Resident Account
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Access Approved / Onboarded By</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5 flex items-center gap-1.5">
                <span>
                  {resident?.accessProvenance?.grantedByName ||
                    user?.accessProvenance?.grantedByName ||
                    resident?.createdByName ||
                    "Society Administration"}
                </span>
                {(resident?.accessProvenance?.grantedByDesignation || user?.accessProvenance?.grantedByDesignation) && (
                  <span className="text-slate-500 font-normal text-xs">
                    ({resident?.accessProvenance?.grantedByDesignation || user?.accessProvenance?.grantedByDesignation})
                  </span>
                )}
              </p>
            </div>

            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Authorizing Official Role</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5 capitalize">
                {(resident?.accessProvenance?.grantedByRole || user?.accessProvenance?.grantedByRole) === "committee"
                  ? "🏛️ Executive Committee"
                  : (resident?.accessProvenance?.grantedByRole || user?.accessProvenance?.grantedByRole) === "collector"
                  ? "👤 Field Collector"
                  : "🛡️ Society Administration"}
              </p>
            </div>

            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Onboarding Channel</p>
              <p className="font-semibold text-slate-700 mt-0.5">
                {(resident?.accessProvenance?.channel || user?.accessProvenance?.channel) === "registration_approval"
                  ? "Resident Self-Registration (Verified & Approved)"
                  : (resident?.accessProvenance?.channel || user?.accessProvenance?.channel) === "committee_portal"
                  ? "Committee Member Portal Onboarding"
                  : (resident?.accessProvenance?.channel || user?.accessProvenance?.channel) === "collector_creation"
                  ? "Field Collector Onboarding"
                  : "Direct Administrative Registration"}
              </p>
            </div>

            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Access Granted Date</p>
              <p className="font-semibold text-slate-700 mt-0.5">
                {resident?.accessProvenance?.grantedAt ||
                user?.accessProvenance?.grantedAt ||
                resident?.approvedAt ||
                resident?.registeredAt
                  ? new Date(
                      resident?.accessProvenance?.grantedAt ||
                        user?.accessProvenance?.grantedAt ||
                        resident?.approvedAt ||
                        resident?.registeredAt
                    ).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "Verified Onboarding"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Personal Information — ALL LOCKED */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <FaUser className="text-blue-600" /> Personal Information
          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1"><FaLock className="text-[10px]" /> All fields locked</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LockedField
            icon={<FaUser />}
            label="Full Name"
            value={resident?.owner || user?.name}
            onEdit={() => openRequestForField("Name")}
            canRequest={canRequest}
            isPending={pendingFieldsSet.has("Name")}
          />
          <LockedField
            icon={<FaEnvelope />}
            label="Email"
            value={displayEmail}
            onEdit={() => openRequestForField("Email")}
            canRequest={canRequest}
            isPending={pendingFieldsSet.has("Email")}
          />
          <LockedField
            icon={<FaPhone />}
            label="Mobile Number"
            value={resident?.mobile || user?.phone}
            onEdit={() => openRequestForField("Mobile Number")}
            canRequest={canRequest}
            isPending={pendingFieldsSet.has("Mobile Number")}
          />
          <LockedField
            icon={<FaPhone />}
            label="Alternate Mobile"
            value={resident?.alternateMobile}
            onEdit={() => openRequestForField("Alternate Mobile")}
            canRequest={canRequest}
            isPending={pendingFieldsSet.has("Alternate Mobile")}
          />
          <LockedField
            icon={<FaCalendarAlt />}
            label="Date of Birth"
            value={resident?.dob}
            onEdit={() => openRequestForField("Date of Birth")}
            canRequest={canRequest}
            isPending={pendingFieldsSet.has("Date of Birth")}
          />
          <LockedField
            icon={<FaVenusMars />}
            label="Gender"
            value={resident?.gender}
            onEdit={() => openRequestForField("Gender")}
            canRequest={canRequest}
            isPending={pendingFieldsSet.has("Gender")}
          />
          <LockedField
            icon={<FaBriefcase />}
            label="Occupation"
            value={resident?.occupation}
            onEdit={() => openRequestForField("Occupation")}
            canRequest={canRequest}
            isPending={pendingFieldsSet.has("Occupation")}
          />
          <LockedField
            icon={<FaUserFriends />}
            label="Emergency Contact"
            value={resident?.emergencyContact}
            onEdit={() => openRequestForField("Emergency Contact")}
            canRequest={canRequest}
            isPending={pendingFieldsSet.has("Emergency Contact")}
          />
          <LockedField
            icon={<FaUser />}
            label="Father/Husband Name"
            value={resident?.fatherHusbandName}
            onEdit={() => openRequestForField("Father/Husband Name")}
            canRequest={canRequest}
            isPending={pendingFieldsSet.has("Father/Husband Name")}
          />
          {user?.relation && (
            <LockedField icon={<FaUser />} label="Relation" value={user.relation} />
          )}
        </div>
      </div>

      {/* Flat Information — ALL LOCKED */}
      {resident && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FaHome className="text-emerald-600" /> Flat Information
            <span className="ml-auto text-xs text-gray-400 flex items-center gap-1"><FaLock className="text-[10px]" /> All fields locked</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <LockedField icon={<FaHome />} label="Flat Number" value={resident.flat} />
            <LockedField icon={<FaBuilding />} label="Block" value={resident.block} />
            <LockedField icon={<FaBuilding />} label="Floor" value={resident.floor} />
            <LockedField icon={<FaShieldAlt />} label="Monthly Charge" value={resident.charge ? `₹${Number(resident.charge).toLocaleString()}` : null} />
          </div>
        </div>
      )}

      {/* Garbage Collection Status — LOCKED */}
      {resident && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FaRecycle className="text-green-600" /> Garbage Collection
            <span className="ml-auto text-xs text-gray-400 flex items-center gap-1"><FaLock className="text-[10px]" /> Admin managed</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LockedField
              icon={<FaRecycle />}
              label="Participation Status"
              value={GC_STATUS_LABELS[resident.garbageStatus] || "Not Participating"}
            />
          </div>
        </div>
      )}

      {/* My Update Requests */}
      {myRequests.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FaEdit className="text-purple-600" /> My Update Requests
          </h2>
          <div className="space-y-3">
            {myRequests.slice(0, 10).map((req) => (
              <div
                key={req.id}
                className="flex items-start justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">
                    <span className="text-blue-600">{req.changes?.field}</span>
                    {" → "}
                    <span className="font-bold">"{req.changes?.newValue}"</span>
                  </p>
                  {req.changes?.currentValue && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Current: {req.changes.currentValue}
                    </p>
                  )}
                  {req.changes?.reason && (
                    <p className="text-xs text-gray-400 mt-0.5">Reason: {req.changes.reason}</p>
                  )}
                  {req.rejectionReason && (
                    <p className="text-xs text-red-500 mt-0.5">Rejection: {req.rejectionReason}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatDate(req.createdAt)}</p>
                </div>
                <StatusBadge status={req.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change Password */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><FaLock className="text-red-600" /> Change Password</h3>
        <p className="text-xs text-gray-500 mb-3">Password changes take effect immediately. No admin approval needed.</p>
        <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current Password"
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            required
            disabled={changingPw}
            autoComplete="current-password"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password"
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            required
            disabled={changingPw}
            autoComplete="new-password"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm New Password"
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            required
            disabled={changingPw}
            autoComplete="new-password"
          />
          <button type="submit" disabled={changingPw} className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl font-medium transition">
            {changingPw ? "Changing..." : "Change Password"}
          </button>
        </form>

        {displayEmail ? (
          <div className="pt-4 border-t mt-5 max-w-md">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FaEnvelope className="text-blue-500" /> Forgot Current Password?
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  Send reset link to: <span className="font-mono text-slate-700">{displayEmail}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleSendProfileResetLink}
                disabled={sendingResetLink}
                className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-xs font-semibold transition shadow-xs"
              >
                {sendingResetLink ? "Sending..." : "Send Reset Link"}
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t mt-5 max-w-md">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <p className="font-medium">⚠️ No Registered Personal Email</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                To receive self-service password reset links, click <strong>"Request Profile Update"</strong> above to add your personal email address, or contact Society Admin.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Request Update & Add Details Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-800">Request Profile Update & Add Details</h2>
              <p className="text-xs text-slate-500 mt-1">
                Submit updates to your existing details or provide missing profile information. All submissions require admin approval.
              </p>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
              <div>
                <label className="block mb-2 font-medium text-sm text-slate-700">
                  Field to Update or Add <span className="text-red-500">*</span>
                </label>
                <select
                  value={requestField}
                  onChange={(e) => {
                    setRequestField(e.target.value);
                    setRequestNewValue("");
                    setRequestReason("");
                  }}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  required
                >
                  <option value="">Select field...</option>
                  {UPDATABLE_FIELDS.map((f) => {
                    const currentVal = f.key === "Email" ? displayEmail : (f.residentField ? resident?.[f.residentField] : null);
                    const isMissing = !currentVal || currentVal === "—" || currentVal === "Not provided";
                    const isFieldPending = pendingFieldsSet.has(f.key);
                    return (
                      <option key={f.key} value={f.key} disabled={isFieldPending}>
                        {f.key} {isFieldPending ? "⏳ (Pending Approval)" : isMissing ? "(Add Missing Details)" : "(Update)"}
                      </option>
                    );
                  })}
                </select>
              </div>

              {requestField && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-slate-500 font-medium">Current Value</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAddingDetail
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}>
                      {isAddingDetail ? "+ Adding Details" : "✏️ Updating Details"}
                    </span>
                  </div>
                  <p className={`text-sm mt-0.5 ${isAddingDetail ? "text-slate-400 italic" : "font-semibold text-slate-800"}`}>
                    {requestCurrentValue || "Not provided (Add new detail)"}
                  </p>
                </div>
              )}

              <div>
                <label className="block mb-2 font-medium text-sm text-slate-700">
                  {isAddingDetail ? "Enter Details" : "New Value"} <span className="text-red-500">*</span>
                </label>
                {requestField === "Gender" ? (
                  <select
                    value={requestNewValue}
                    onChange={(e) => setRequestNewValue(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                ) : requestField === "Date of Birth" ? (
                  <input
                    type="date"
                    value={requestNewValue}
                    onChange={(e) => setRequestNewValue(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    required
                  />
                ) : (
                  <input
                    type={requestField === "Email" ? "email" : "text"}
                    placeholder={
                      requestField === "Email"
                        ? "e.g. personal.email@gmail.com"
                        : requestField === "Alternate Mobile" || requestField === "Mobile Number" || requestField === "Emergency Contact"
                        ? "10-digit mobile number"
                        : "Enter details"
                    }
                    value={requestNewValue}
                    onChange={(e) => setRequestNewValue(e.target.value)}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    required
                  />
                )}
              </div>

              {!isAddingDetail && (
                <div>
                  <label className="block mb-2 font-medium text-sm text-slate-700">
                    Reason for Update <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    placeholder="Why do you need this change? (Mandatory for admin review)"
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    rows={2}
                    className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                    required
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestForm(false)}
                  className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 font-medium transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest || (requestField && pendingFieldsSet.has(requestField))}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold transition text-sm shadow-md shadow-blue-500/20"
                >
                  {submittingRequest
                    ? "Submitting..."
                    : isAddingDetail
                    ? "Submit Details"
                    : "Submit Update Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===============================
   LockedField — Always Read-Only
================================ */

function LockedField({ icon, label, value, onEdit, canRequest, isPending }) {
  const isEmpty = !value || value === "—" || value === "null" || value === "undefined";

  return (
    <div className="bg-gray-50 rounded-xl p-3 flex flex-col justify-between hover:bg-slate-100/80 transition group border border-slate-100 min-h-[74px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-gray-500 text-xs font-medium">
          {icon} {label}
        </span>
        <div className="flex items-center gap-1.5">
          {isPending ? (
            <span
              className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300/80 flex items-center gap-1 shadow-2xs cursor-not-allowed select-none"
              title="A request for this field has already been sent and is pending admin approval"
            >
              <FaClock className="text-[9px]" /> Pending
            </span>
          ) : canRequest && onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition shadow-xs ${
                isEmpty
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
              }`}
              title={isEmpty ? `Add ${label}` : `Update ${label}`}
            >
              {isEmpty ? "+ Add" : "Update"}
            </button>
          ) : null}
          <span className="flex items-center gap-0.5 text-[9px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200/50">
            <FaLock className="text-[7px]" /> Locked
          </span>
        </div>
      </div>
      <p className={`text-sm truncate ${isEmpty ? "text-gray-400 italic" : "font-semibold text-gray-800"}`}>
        {isEmpty ? "Not provided" : value}
      </p>
    </div>
  );
}

/* ===============================
   StatusBadge
================================ */

function StatusBadge({ status }) {
  const config = {
    pending: { color: "bg-yellow-100 text-yellow-700", icon: <FaClock className="text-[10px]" />, label: "Pending" },
    approved: { color: "bg-green-100 text-green-700", icon: <FaCheckCircle className="text-[10px]" />, label: "Approved" },
    rejected: { color: "bg-red-100 text-red-700", icon: <FaTimesCircle className="text-[10px]" />, label: "Rejected" },
  };

  const cfg = config[status] || config.pending;

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ml-2 flex items-center gap-1 ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

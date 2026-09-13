import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  FaBuilding,
  FaUser,
  FaPhone,
  FaHome,
  FaLayerGroup,
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHeadset,
  FaKey,
  FaQuestionCircle,
  FaUserShield,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaPaperPlane,
  FaRedo,
  FaLock,
  FaSpinner,
  FaBolt,
} from "react-icons/fa";

import toast from "react-hot-toast";

import {
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth, db } from "../../firebase/firebase";

import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
} from "firebase/firestore";

import {
  submitRecoveryRequest,
  RECOVERY_REQUEST_TYPES,
} from "../../services/recoveryService";

import { createNotification } from "../../services/notificationService";
import {
  normalizeMobile,
  isExactAdminEmail,
  findPersonalEmailForIdentifier,
} from "../../services/authService";
import { terminateAllOtherSessions } from "../../services/sessionService";

// Admin UID for notifications
const ADMIN_UID = "92jYvGPlKMexX37WEzs7MaDuc7U2";

// =============================
// Tab definitions
// =============================

const BASE_RESIDENT_TABS = [
  { id: "forgot_password", label: "Resident Password", icon: <FaKey /> },
  { id: "forgot_mobile", label: "Forgot Mobile", icon: <FaPhone /> },
  { id: "contact_admin", label: "Support", icon: <FaHeadset /> },
];

const ADMIN_TABS = [
  { id: "admin_reset", label: "Admin Password Reset", icon: <FaUserShield className="text-amber-500" /> },
  { id: "forgot_password", label: "Resident Recovery", icon: <FaKey /> },
  { id: "contact_admin", label: "Support", icon: <FaHeadset /> },
];

// Helper to extract oobCode from full URLs, query strings, or raw code
function parseOobCode(input) {
  if (!input) return "";
  let clean = String(input).trim();

  try {
    if (clean.startsWith("http://") || clean.startsWith("https://") || clean.includes("://") || clean.includes("?")) {
      const urlToParse = clean.includes("://") ? clean : `https://${clean}`;
      const parsedUrl = new URL(urlToParse);
      const fromParam = parsedUrl.searchParams.get("oobCode");
      if (fromParam) return fromParam.trim();
    }
  } catch {
    // Ignore URL parsing errors and fall through
  }

  const matchParam = clean.match(/[?&]oobCode=([A-Za-z0-9_-]+)/);
  if (matchParam && matchParam[1]) {
    return matchParam[1].trim();
  }

  const matchColon = clean.match(/oobCode\s*[:=]\s*([A-Za-z0-9_-]+)/i);
  if (matchColon && matchColon[1]) {
    return matchColon[1].trim();
  }

  return clean;
}

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();

  // Mode and code from email action link (e.g. ?mode=resetPassword&oobCode=XYZ)
  const rawOob = searchParams.get("oobCode") || "";
  const actionOobCode = parseOobCode(rawOob);
  const actionMode = searchParams.get("mode") || "";
  const tabParam = searchParams.get("tab") || "";
  const emailParam = searchParams.get("email") || "";
  const identifierParam = searchParams.get("identifier") || searchParams.get("mobile") || emailParam || "";

  const isResetActionActive = Boolean(actionMode === "resetPassword" || actionOobCode);
  const isExplicitAdminMode = Boolean(
    isResetActionActive ||
    (tabParam === "admin" && isExactAdminEmail(emailParam))
  );
  const visibleTabs = isExplicitAdminMode ? ADMIN_TABS : BASE_RESIDENT_TABS;

  // Tab state
  const [activeTab, setActiveTab] = useState(() => {
    if (isExplicitAdminMode && !actionOobCode) {
      return "admin_reset";
    }
    return "forgot_password";
  });

  // Target account email if arriving via action link
  const [resetAccountEmail, setResetAccountEmail] = useState("");

  useEffect(() => {
    if (actionOobCode) {
      verifyPasswordResetCode(auth, actionOobCode)
        .then((email) => {
          setResetAccountEmail(email || "");
        })
        .catch((err) => {
          console.warn("[ForgotPassword] Could not verify reset code:", err.message);
        });
    }
  }, [actionOobCode]);

  // ========== Admin Password Reset State ==========
  const [adminIdentifier, setAdminIdentifier] = useState(() => (isExactAdminEmail(emailParam) ? emailParam : ""));
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminEmailSent, setAdminEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // New password state (used only if arriving with direct URL action link)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [confirmingLoading, setConfirmingLoading] = useState(false);

  // ========== Resident Password Reset State (Email Link Mode) ==========
  // Mode toggle: "email_link" vs "admin_request"
  const [residentMode, setResidentMode] = useState("email_link");
  const [residentIdentifier, setResidentIdentifier] = useState(() => {
    if (isExactAdminEmail(identifierParam)) return "";
    return identifierParam;
  });
  const [residentEmailLoading, setResidentEmailLoading] = useState(false);
  const [residentEmailSent, setResidentEmailSent] = useState(false);
  const [residentSentToEmail, setResidentSentToEmail] = useState("");
  const [residentResendCooldown, setResidentResendCooldown] = useState(0);
  const [residentNoEmailWarning, setResidentNoEmailWarning] = useState(null);

  // ========== Resident Recovery Form state (Admin Permission Mode) ==========
  const [mobile, setMobile] = useState(() => {
    const clean = normalizeMobile(identifierParam);
    return clean.length === 10 ? clean : "";
  });
  const [name, setName] = useState("");
  const [blockId, setBlockId] = useState("");
  const [block, setBlock] = useState("");
  const [floor, setFloor] = useState("");
  const [flatNumber, setFlatNumber] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState("forgot_password");

  // "Forgot Both" toggle
  const [forgotBoth, setForgotBoth] = useState(false);

  // Available blocks from Firestore
  const [availableBlocks, setAvailableBlocks] = useState([]);

  // Loading/success state for resident request
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState("");

  // Load blocks from Firestore
  useEffect(() => {
    async function loadBlocks() {
      try {
        const q = query(collection(db, "blocks"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        const allBlocks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAvailableBlocks(allBlocks.filter((b) => b.status === "active" || !b.status));
      } catch (error) {
        console.warn("Could not load blocks:", error.message);
      }
    }
    loadBlocks();
  }, []);

  // Cooldown countdown for Admin
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Cooldown countdown for Resident
  useEffect(() => {
    if (residentResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResidentResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [residentResendCooldown]);

  // Sync request type with tab
  useEffect(() => {
    if (activeTab === "forgot_password") {
      setRequestType(forgotBoth ? "forgot_both" : "forgot_password");
    } else if (activeTab === "forgot_mobile") {
      setRequestType(forgotBoth ? "forgot_both" : "forgot_mobile");
    }
  }, [activeTab, forgotBoth]);

  // Reset form state when tab changes
  useEffect(() => {
    setName("");
    setBlockId("");
    setBlock("");
    setFloor("");
    setFlatNumber("");
    setDescription("");
    setForgotBoth(false);
    setSubmitted(false);
    setRequestId("");
    setResidentNoEmailWarning(null);
  }, [activeTab]);

  // =============================
  // Resident: Send Password Reset Link
  // =============================
  async function handleSendResidentReset(e) {
    if (e) e.preventDefault();
    const raw = (residentIdentifier || "").trim();
    if (!raw) {
      toast.error("Please enter your registered email address or 10-digit mobile number.");
      return;
    }

    setResidentEmailLoading(true);
    setResidentNoEmailWarning(null);

    try {
      const result = await findPersonalEmailForIdentifier(raw);

      if (!result.found) {
        if (result.mobile) {
          setResidentNoEmailWarning({
            mobile: result.mobile,
            message: "No registered personal email address was found for this mobile number.",
          });
        } else {
          toast.error(result.error || "No account found matching this identifier.");
        }
        return;
      }

      const targetEmail = result.email.toLowerCase();

      // Send password reset email via Firebase Auth
      await sendPasswordResetEmail(auth, targetEmail);

      setResidentSentToEmail(targetEmail);
      setResidentEmailSent(true);
      setResidentResendCooldown(45);
      toast.success(`Password reset email sent to ${targetEmail}`);
    } catch (error) {
      console.error("[ResidentPasswordReset]", error);
      if (error.code === "auth/user-not-found") {
        setResidentNoEmailWarning({
          mobile: normalizeMobile(raw) || "",
          message: "No authentication account was found matching this email. If you registered using only your mobile number, please use 'Request Admin Permission'.",
        });
        toast.error("No account found matching this email in the login system.");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please wait a few minutes before trying again.");
      } else {
        toast.error(error.message || "Failed to send password reset email.");
      }
    } finally {
      setResidentEmailLoading(false);
    }
  }

  // =============================
  // Admin: Send Password Reset Link
  // =============================
  async function handleSendAdminReset(e) {
    if (e) e.preventDefault();
    const raw = (adminIdentifier || "").trim();
    if (!raw) {
      toast.error("Please enter your admin email address.");
      return;
    }

    if (!isExactAdminEmail(raw)) {
      toast.error("Admin Password Reset is allowed only for verified administrator email IDs.");
      return;
    }

    setAdminLoading(true);
    try {
      const targetEmail = raw.toLowerCase();

      // Send Firebase password reset email
      await sendPasswordResetEmail(auth, targetEmail);

      setSentToEmail(targetEmail);
      setAdminEmailSent(true);
      setResendCooldown(45);
      toast.success(`Password reset email sent to ${targetEmail}`);
    } catch (error) {
      console.error("[AdminPasswordReset]", error);
      if (error.code === "auth/user-not-found") {
        toast.error("No administrator account found matching this email address.");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please wait a few minutes before trying again.");
      } else {
        toast.error(error.message || "Failed to send password reset email.");
      }
    } finally {
      setAdminLoading(false);
    }
  }

  // =============================
  // Confirm Password Reset (Email Link Action)
  // =============================
  async function handleConfirmReset(e) {
    if (e) e.preventDefault();
    const code = actionOobCode;

    if (!code) {
      toast.error("Invalid or missing reset link. Please click the reset link in your email.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    setConfirmingLoading(true);
    try {
      let resetEmail = "";
      try {
        resetEmail = await verifyPasswordResetCode(auth, code);
      } catch (cErr) {
        console.warn("[ConfirmReset] Could not read reset code email:", cErr.message);
      }

      await confirmPasswordReset(auth, code, newPassword);

      // Invalidate active sessions on other devices for security
      try {
        if (resetEmail && isExactAdminEmail(resetEmail)) {
          await terminateAllOtherSessions(
            ADMIN_UID,
            null,
            "Admin password was reset. Other devices have been logged out."
          );
        } else if (resetEmail) {
          // Look up user UID by email in users collection or residents collection
          const usersQ = query(collection(db, "users"), where("email", "==", resetEmail.toLowerCase()));
          const uSnap = await getDocs(usersQ);
          let targetUid = !uSnap.empty ? uSnap.docs[0].id : null;
          if (!targetUid) {
            const resQ = query(collection(db, "residents"), where("email", "==", resetEmail.toLowerCase()));
            const rSnap = await getDocs(resQ);
            if (!rSnap.empty) targetUid = rSnap.docs[0].id;
          }
          if (targetUid) {
            await terminateAllOtherSessions(
              targetUid,
              null,
              "Your password was reset. Other devices have been logged out."
            );
          }
        }
      } catch (sessErr) {
        console.warn("[ForgotPassword] Failed to terminate sessions:", sessErr.message);
      }

      setResetSuccess(true);
      toast.success("Password reset successfully! Other devices have been logged out.");
    } catch (error) {
      console.error("[ConfirmReset]", error);
      if (error.code === "auth/invalid-action-code") {
        toast.error("This reset link is invalid or has already been used. Please request a new link.");
      } else if (error.code === "auth/expired-action-code") {
        toast.error("This reset link has expired. Please request a new link.");
      } else {
        toast.error(error.message || "Failed to reset password.");
      }
    } finally {
      setConfirmingLoading(false);
    }
  }

  // =============================
  // Handle Resident Admin Request Submit
  // =============================
  async function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!blockId) {
      toast.error("Please select your block.");
      return;
    }
    if (!floor.trim()) {
      toast.error("Please enter your floor number.");
      return;
    }
    if (!flatNumber.trim()) {
      toast.error("Please enter your flat number.");
      return;
    }

    if (activeTab === "forgot_password" && !forgotBoth) {
      if (!mobile || mobile.length !== 10) {
        toast.error("Please enter a valid 10-digit mobile number.");
        return;
      }
    }

    try {
      setLoading(true);

      const id = await submitRecoveryRequest({
        mobile: mobile || "",
        name: name.trim(),
        blockId,
        block,
        floor: floor.trim(),
        flatNumber: flatNumber.trim(),
        requestType,
        description: description.trim(),
      });

      setRequestId(id);
      setSubmitted(true);

      try {
        await createNotification({
          userId: ADMIN_UID,
          title: "New Account Recovery Request",
          message: `${name.trim()} has submitted a ${requestType.replace(/_/g, " ")} request.`,
          type: "warning",
          link: "/admin/account-recovery",
        });
      } catch {
        // Non-fatal
      }

      toast.success("Recovery request submitted successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to submit recovery request.");
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // Contact Admin Submit
  // =============================
  async function handleContactAdmin(e) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!requestType) {
      toast.error("Please select a request type.");
      return;
    }

    try {
      setLoading(true);

      const id = await submitRecoveryRequest({
        mobile: mobile || "",
        name: name.trim(),
        blockId: blockId || "",
        block: block || "",
        floor: floor.trim() || "",
        flatNumber: flatNumber.trim() || "",
        requestType,
        description: description.trim(),
      });

      setRequestId(id);
      setSubmitted(true);

      try {
        await createNotification({
          userId: ADMIN_UID,
          title: "New Support Request",
          message: `${name.trim()} needs help: ${requestType.replace(/_/g, " ")}.`,
          type: "info",
          link: "/admin/account-recovery",
        });
      } catch {
        // Non-fatal
      }

      toast.success("Support request submitted successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // Reset Success View (Direct Action Link)
  // =============================
  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl mb-6 shadow-sm">
            <FaCheckCircle />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-gray-900">Password Updated!</h2>
          <p className="text-gray-600 mb-6 text-sm leading-relaxed">
            Your password has been changed successfully. All other active sessions on other devices have been signed out. You can now log in with your new password.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition shadow-md"
          >
            <FaArrowLeft /> Proceed to Login
          </Link>
        </div>
      </div>
    );
  }

  // =============================
  // Resident Admin Request Success View
  // =============================
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl mb-6 shadow-sm">
            <FaCheckCircle />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-gray-900">Request Submitted</h2>
          <p className="text-gray-600 mb-4 text-sm leading-relaxed">
            Your {requestType === "forgot_password" ? "password recovery" : requestType === "forgot_mobile" ? "mobile recovery" : requestType === "forgot_both" ? "account recovery" : "support"} request has been sent to Society Administration.
          </p>
          <p className="text-xs text-gray-500 mb-6">
            The society management will verify your flat details and assist you with your login.
          </p>
          {requestId && (
            <p className="text-xs text-gray-400 mb-6">
              Request ID: <span className="font-mono font-semibold text-gray-600">{requestId.slice(0, 10)}...</span>
            </p>
          )}
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition shadow-md"
          >
            <FaArrowLeft />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  // =============================
  // Main Render Form
  // =============================
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-3xl shadow-md mb-4">
            <FaQuestionCircle />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Account Recovery</h1>
          <p className="text-gray-500 text-sm mt-1">
            Reset your password or request account recovery assistance
          </p>
        </div>

        {/* Direct Action Link Notice / Mode */}
        {actionOobCode && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <FaKey className="text-blue-600 mt-1 shrink-0 text-base" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <span className="font-bold block text-sm">Official Password Reset Link</span>
              You opened a secure password reset link. Enter your new password below.
              {resetAccountEmail && (
                <div className="mt-1 font-mono font-semibold bg-blue-100/70 py-1 px-2.5 rounded-lg inline-block text-blue-950 break-all">
                  Account: {resetAccountEmail}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs (Only if not arriving via direct email reset link) */}
        {!actionOobCode && (
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id
                  ? "bg-white text-emerald-700 shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ======================================================== */}
        {/* CASE A: DIRECT ACTION LINK SET NEW PASSWORD FORM         */}
        {/* ======================================================== */}
        {actionOobCode ? (
          <form
            onSubmit={handleConfirmReset}
            className="space-y-4 animate-in fade-in duration-150"
            autoComplete="off"
            noValidate
          >
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
              <FaKey className="text-emerald-600 mt-0.5 shrink-0 text-sm" />
              <div className="leading-relaxed">
                <span className="font-bold block text-emerald-900">Set New Password</span>
                Enter your new password below. Once saved, all other devices logged into your account will be signed out automatically.
              </div>
            </div>

            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-700">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Toggle password visibility"
                >
                  {showNewPassword ? <FaEyeSlash className="text-sm" /> : <FaEye className="text-sm" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-700">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? <FaEyeSlash className="text-sm" /> : <FaEye className="text-sm" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={confirmingLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl font-semibold text-sm transition shadow-md flex items-center justify-center gap-2"
            >
              {confirmingLoading ? (
                <>
                  <FaSpinner className="animate-spin text-sm" />
                  <span>Updating Password...</span>
                </>
              ) : (
                "Save New Password"
              )}
            </button>
          </form>
        ) : null}

        {/* ======================================================== */}
        {/* TAB 1: ADMIN PASSWORD RESET TAB                          */}
        {/* ======================================================== */}
        {!actionOobCode && activeTab === "admin_reset" && (
          <div className="space-y-4">
            {adminEmailSent ? (
              /* Email Sent Confirmation View */
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mx-auto shadow-sm">
                    <FaCheckCircle />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Password Reset Link Sent!</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      We have sent an official password reset email to:
                    </p>
                    <p className="font-mono font-semibold text-emerald-800 text-sm mt-1 bg-emerald-100/70 py-1 px-3 rounded-lg inline-block break-all">
                      {sentToEmail}
                    </p>
                  </div>

                  <div className="text-left text-xs text-gray-700 bg-white/95 rounded-xl p-4 space-y-2.5 border border-emerald-100 leading-relaxed shadow-sm">
                    <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5 border-b border-gray-100 pb-2">
                      <FaEnvelope className="text-emerald-600 text-sm" />
                      <span>Next Steps:</span>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <div>Open your email inbox (and check Spam / Promotions if not found).</div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <div><strong>Click the blue reset link</strong> inside the email.</div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <div>Type your new password on that page and click <strong>SAVE</strong>. Done!</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <Link
                    to="/"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition shadow-md flex items-center justify-center gap-2"
                  >
                    <FaArrowLeft className="text-xs" />
                    <span>Back to Login</span>
                  </Link>

                  <div className="flex items-center justify-between text-xs pt-2">
                    <button
                      type="button"
                      onClick={handleSendAdminReset}
                      disabled={adminLoading || resendCooldown > 0}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold disabled:text-gray-400 transition flex items-center gap-1.5"
                    >
                      <FaRedo className="text-[10px]" />
                      <span>{resendCooldown > 0 ? `Resend email in ${resendCooldown}s` : "Resend email"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAdminEmailSent(false);
                        setAdminIdentifier("");
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Use different email
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Input Form for Admin */
              <form onSubmit={handleSendAdminReset} className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                  <FaUserShield className="text-amber-600 mt-0.5 shrink-0 text-base" />
                  <div className="leading-relaxed">
                    <span className="font-bold block text-amber-900">Administrator Password Reset</span>
                    Enter your verified administrator email ID. An official password reset link will be sent directly to your inbox.
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-700">
                    Admin Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="email"
                      placeholder="e.g. dharmendrasngh101@gmail.com"
                      value={adminIdentifier}
                      onChange={(e) => setAdminIdentifier(e.target.value)}
                      className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={adminLoading || !adminIdentifier.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold text-sm transition shadow-md flex items-center justify-center gap-2"
                  >
                    {adminLoading ? (
                      <>
                        <FaSpinner className="animate-spin text-sm" />
                        <span>Sending Reset Email...</span>
                      </>
                    ) : (
                      <>
                        <FaPaperPlane className="text-xs" />
                        <span>Send Password Reset Link</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: RESIDENT PASSWORD TAB (EMAIL LINK OR ADMIN REQ)   */}
        {/* ======================================================== */}
        {!actionOobCode && activeTab === "forgot_password" && (
          <div className="space-y-4">
            {/* Sub-mode selector: Email Link vs Admin Permission */}
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setResidentMode("email_link");
                  setResidentNoEmailWarning(null);
                }}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${residentMode === "email_link"
                  ? "bg-white text-emerald-700 shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                <FaBolt className="text-xs text-amber-500" />
                <span>Reset via Email Link</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setResidentMode("admin_request");
                  setResidentNoEmailWarning(null);
                  if (residentIdentifier) {
                    const clean = normalizeMobile(residentIdentifier);
                    if (clean.length === 10) setMobile(clean);
                  }
                }}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${residentMode === "admin_request"
                  ? "bg-white text-emerald-700 shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                <FaUserShield className="text-xs text-indigo-600" />
                <span>Request Admin Permission</span>
              </button>
            </div>

            {/* ---------------------------------------------------- */}
            {/* SUB-MODE 1: RESET VIA EMAIL LINK (INSTANT)           */}
            {/* ---------------------------------------------------- */}
            {residentMode === "email_link" && (
              <div>
                {residentEmailSent ? (
                  /* Resident Email Sent View */
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mx-auto shadow-sm">
                        <FaCheckCircle />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg">Password Reset Link Sent!</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          We sent an official password reset email link to:
                        </p>
                        <p className="font-mono font-semibold text-emerald-800 text-sm mt-1 bg-emerald-100/70 py-1 px-3 rounded-lg inline-block break-all">
                          {residentSentToEmail}
                        </p>
                      </div>

                      <div className="text-left text-xs text-gray-700 bg-white/95 rounded-xl p-4 space-y-2.5 border border-emerald-100 leading-relaxed shadow-sm">
                        <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5 border-b border-gray-100 pb-2">
                          <FaEnvelope className="text-emerald-600 text-sm" />
                          <span>Next Steps:</span>
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <div>Open your email inbox (and check Spam / Promotions folder).</div>
                          </div>

                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <div><strong>Click the reset link</strong> inside the email.</div>
                          </div>

                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <div>Enter your new password and click Save. Done!</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <Link
                        to="/"
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition shadow-md flex items-center justify-center gap-2"
                      >
                        <FaArrowLeft className="text-xs" />
                        <span>Back to Login</span>
                      </Link>

                      <div className="flex items-center justify-between text-xs pt-2">
                        <button
                          type="button"
                          onClick={handleSendResidentReset}
                          disabled={residentEmailLoading || residentResendCooldown > 0}
                          className="text-emerald-700 hover:text-emerald-800 font-semibold disabled:text-gray-400 transition flex items-center gap-1.5"
                        >
                          <FaRedo className="text-[10px]" />
                          <span>{residentResendCooldown > 0 ? `Resend email in ${residentResendCooldown}s` : "Resend email"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setResidentEmailSent(false);
                            setResidentIdentifier("");
                            setResidentNoEmailWarning(null);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          Use different email / mobile
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Form to enter Email or Mobile */
                  <form onSubmit={handleSendResidentReset} className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
                      <FaBolt className="text-emerald-600 mt-0.5 shrink-0 text-base" />
                      <div className="leading-relaxed">
                        <span className="font-bold block text-emerald-900">Instant Password Reset via Email</span>
                        If you have an email registered with your resident account, enter it below (or enter your registered mobile). We'll send an instant password reset link to your email.
                      </div>
                    </div>

                    {/* Warning if no email linked to mobile */}
                    {residentNoEmailWarning && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-2 animate-in fade-in">
                        <div className="flex items-start gap-2">
                          <FaExclamationTriangle className="text-amber-600 mt-0.5 shrink-0 text-sm" />
                          <div>
                            <p className="font-semibold text-amber-950">No Registered Email Found</p>
                            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                              {residentNoEmailWarning.message}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (residentNoEmailWarning.mobile) {
                              setMobile(residentNoEmailWarning.mobile);
                            }
                            setResidentMode("admin_request");
                          }}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <FaUserShield className="text-xs" />
                          <span>Request Admin Permission Instead</span>
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-700">
                        Registered Email or 10-Digit Mobile <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input
                          type="text"
                          placeholder="e.g. name@example.com or 9876543210"
                          value={residentIdentifier}
                          onChange={(e) => {
                            setResidentIdentifier(e.target.value);
                            setResidentNoEmailWarning(null);
                          }}
                          className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="pt-2 space-y-2.5">
                      <button
                        type="submit"
                        disabled={residentEmailLoading || !residentIdentifier.trim()}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold text-sm transition shadow-md flex items-center justify-center gap-2"
                      >
                        {residentEmailLoading ? (
                          <>
                            <FaSpinner className="animate-spin text-sm" />
                            <span>Looking up & Sending Reset Link...</span>
                          </>
                        ) : (
                          <>
                            <FaPaperPlane className="text-xs" />
                            <span>Send Password Reset Link</span>
                          </>
                        )}
                      </button>

                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (residentIdentifier) {
                              const clean = normalizeMobile(residentIdentifier);
                              if (clean.length === 10) setMobile(clean);
                            }
                            setResidentMode("admin_request");
                          }}
                          className="text-xs text-gray-500 hover:text-emerald-700 font-medium transition"
                        >
                          Don't have an email address? <span className="underline font-semibold">Request Admin Permission</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* SUB-MODE 2: REQUEST ADMIN PERMISSION (FALLBACK)       */}
            {/* ---------------------------------------------------- */}
            {residentMode === "admin_request" && (
              <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-150">
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800 flex items-start gap-2.5">
                  <FaUserShield className="text-indigo-600 mt-0.5 shrink-0 text-base" />
                  <div className="leading-relaxed">
                    <span className="font-bold block text-indigo-950">Admin Permission Account Recovery</span>
                    If you don't have an email registered or need manual identity verification, enter your flat details below. Society Administration will verify your identity from society records and assist you.
                  </div>
                </div>

                {/* Forgot Both toggle */}
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none mb-2">
                  <input
                    type="checkbox"
                    checked={forgotBoth}
                    onChange={(e) => setForgotBoth(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-gray-600 text-xs">I also forgot my registered mobile number</span>
                </label>

                {/* Mobile Number */}
                {!forgotBoth && (
                  <div>
                    <label className="block mb-1.5 text-xs font-medium text-gray-700">Registered Mobile Number <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                      <input
                        type="tel"
                        placeholder="Enter 10-digit mobile number"
                        value={mobile}
                        onChange={(e) => setMobile(normalizeMobile(e.target.value))}
                        className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        maxLength={10}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="block mb-1.5 text-xs font-medium text-gray-700">Full Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Block */}
                <div>
                  <label className="block mb-1.5 text-xs font-medium text-gray-700">Block <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <FaBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <select
                      value={blockId}
                      onChange={(e) => {
                        const selected = availableBlocks.find((b) => b.id === e.target.value);
                        setBlockId(e.target.value);
                        setBlock(selected?.name || "");
                      }}
                      className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white"
                      required
                    >
                      <option value="">Select your block</option>
                      {availableBlocks.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Floor & Flat */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1.5 text-xs font-medium text-gray-700">Floor <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <FaLayerGroup className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                      <input
                        type="text"
                        placeholder="Floor"
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5 text-xs font-medium text-gray-700">Flat Number <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <FaHome className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                      <input
                        type="text"
                        placeholder="e.g. 101"
                        value={flatNumber}
                        onChange={(e) => setFlatNumber(e.target.value)}
                        className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Description (optional) */}
                <div>
                  <label className="block mb-1.5 text-xs font-medium text-gray-700">
                    Additional Details <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Any additional information..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold text-sm transition shadow-md"
                >
                  {loading ? "Submitting..." : "Submit Resident Recovery Request"}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setResidentMode("email_link")}
                    className="text-xs text-gray-500 hover:text-emerald-700 font-medium transition"
                  >
                    Have registered email? <span className="underline font-semibold">Switch to Instant Email Reset</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: FORGOT MOBILE TAB                                 */}
        {/* ======================================================== */}
        {!actionOobCode && activeTab === "forgot_mobile" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2 mb-2">
              <FaExclamationTriangle className="mt-0.5 shrink-0" />
              <span>
                If you forgot your registered mobile number, provide your name and flat details. Admin will verify your identity from society records.
              </span>
            </div>

            <div>
              <label className="block mb-1.5 text-xs font-medium text-gray-700">
                Alternate Contact Mobile <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="tel"
                  placeholder="Enter contact number"
                  value={mobile}
                  onChange={(e) => setMobile(normalizeMobile(e.target.value))}
                  className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block mb-1.5 text-xs font-medium text-gray-700">Full Name</label>
              <div className="relative">
                <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  required
                />
              </div>
            </div>

            {/* Block */}
            <div>
              <label className="block mb-1.5 text-xs font-medium text-gray-700">Block</label>
              <div className="relative">
                <FaBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <select
                  value={blockId}
                  onChange={(e) => {
                    const selected = availableBlocks.find((b) => b.id === e.target.value);
                    setBlockId(e.target.value);
                    setBlock(selected?.name || "");
                  }}
                  className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white"
                  required
                >
                  <option value="">Select your block</option>
                  {availableBlocks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Floor & Flat */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1.5 text-xs font-medium text-gray-700">Floor</label>
                <div className="relative">
                  <FaLayerGroup className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    placeholder="Floor"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-xs font-medium text-gray-700">Flat Number</label>
                <div className="relative">
                  <FaHome className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    placeholder="e.g. 101"
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                    className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Description (optional) */}
            <div>
              <label className="block mb-1.5 text-xs font-medium text-gray-700">
                Additional Details <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                placeholder="Any additional information..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold text-sm transition shadow-md"
            >
              {loading ? "Submitting..." : "Submit Mobile Recovery Request"}
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 4: CONTACT ADMIN / SUPPORT                           */}
        {/* ======================================================== */}
        {!actionOobCode && activeTab === "contact_admin" && (
          <form onSubmit={handleContactAdmin} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2 mb-2">
              <FaHeadset className="mt-0.5 shrink-0 text-sm" />
              <span>
                Need help? Submit a support request and the Society Admin will assist you.
              </span>
            </div>

            {/* Request Type */}
            <div>
              <label className="block mb-1.5 text-xs font-medium text-gray-700">Request Type</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white"
                required
              >
                <option value="">Select request type</option>
                {RECOVERY_REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Full Name */}
            <div>
              <label className="block mb-1.5 text-xs font-medium text-gray-700">Full Name</label>
              <div className="relative">
                <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  required
                />
              </div>
            </div>

            {/* Mobile (optional for contact) */}
            <div>
              <label className="block mb-1.5 text-xs font-medium text-gray-700">Mobile Number <span className="text-gray-400 font-normal">(if known)</span></label>
              <div className="relative">
                <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="tel"
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full pl-10 pr-4 border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block mb-1.5 text-xs font-medium text-gray-700">Description</label>
              <textarea
                placeholder="Describe your problem in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold text-sm transition shadow-md"
            >
              {loading ? "Submitting..." : "Submit Support Request"}
            </button>
          </form>
        )}

        {/* Switch Between Resident and Admin Portal Link */}
        {!actionOobCode && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            {activeTab === "admin_reset" ? (
              <button
                type="button"
                onClick={() => setActiveTab("forgot_password")}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold transition flex items-center justify-center gap-1.5 mx-auto"
              >
                <FaKey className="text-xs" />
                <span>Are you a Society Resident? Click for Resident Account Recovery</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab("admin_reset")}
                className="text-xs text-amber-700 hover:text-amber-800 font-semibold transition flex items-center justify-center gap-1.5 mx-auto"
              >
                <FaUserShield className="text-xs" />
                <span>Society Administrator? Click here for Admin Password Reset</span>
              </button>
            )}
          </div>
        )}

        {/* Back to Login */}
        <div className="text-center mt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-semibold transition"
          >
            <FaArrowLeft />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FaClock,
  FaSignOutAlt,
  FaTimesCircle,
  FaCheckCircle,
  FaSignInAlt,
  FaSyncAlt,
  FaArrowRight,
  FaUser,
  FaPhone,
  FaHome,
  FaBuilding,
  FaShieldAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../services/authService";

// ══════════════════════════════════════════════════════════════════
// Official D BLOCK RWA Brand Header Logo (Matching New Theme)
// ══════════════════════════════════════════════════════════════════
function RwaBrandHeader({ className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Stylized Modern Buildings + Green Lawn Vector */}
      <div className="relative shrink-0 w-11 h-11 flex items-center justify-center">
        <svg viewBox="0 0 64 64" className="w-full h-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Back Building */}
          <rect x="8" y="24" width="14" height="30" rx="2" fill="#1e3a8a" />
          <rect x="12" y="28" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="16.5" y="28" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="12" y="34" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="16.5" y="34" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="12" y="40" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="16.5" y="40" width="2.5" height="3" rx="0.5" fill="#93c5fd" />

          {/* Center Tall Building */}
          <rect x="24" y="10" width="18" height="44" rx="2.5" fill="#0f172a" />
          <polygon points="33,4 23,10 43,10" fill="#1d4ed8" />
          {/* Windows Grid */}
          <rect x="28" y="15" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="15" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="28" y="21" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="21" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="28" y="27" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="27" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="28" y="33" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="33" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="28" y="39" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="39" width="3" height="3.5" rx="0.5" fill="#60a5fa" />

          {/* Right Mid Building */}
          <rect x="44" y="20" width="13" height="34" rx="2" fill="#1e3a8a" />
          <rect x="47.5" y="25" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="51.5" y="25" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="47.5" y="31" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="51.5" y="31" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="47.5" y="37" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="51.5" y="37" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />

          {/* Green Lawn Swath */}
          <path d="M4 52 C18 48, 38 49, 60 52 C52 56, 12 56, 4 52Z" fill="#15803d" />
          <path d="M6 53.5 C20 50, 42 51, 58 53.5 C48 57, 16 57, 6 53.5Z" fill="#22c55e" />
          <circle cx="10" cy="48" r="3" fill="#15803d" />
          <circle cx="22" cy="49" r="2.5" fill="#16a34a" />
          <circle cx="55" cy="49" r="3" fill="#15803d" />
        </svg>
      </div>

      {/* Brand Typography */}
      <div className="text-left leading-tight">
        <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
          D BLOCK RWA
        </div>
        <div className="text-[11px] sm:text-xs font-semibold text-slate-500 tracking-normal">
          Society Management System
        </div>
      </div>
    </div>
  );
}

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const role = (user?.role || "").toLowerCase();
  const status = (user?.status || "").toLowerCase();
  const isRejected = status === "rejected";
  const hasHandledApprovalRef = useRef(false);

  // Check if user is already approved and redirect
  useEffect(() => {
    const isNowApproved =
      user &&
      role !== "pending_registration" &&
      (status === "active" || role === "resident" || role === "committee");

    if (isNowApproved) {
      setIsApproved(true);
      if (!hasHandledApprovalRef.current) {
        hasHandledApprovalRef.current = true;
        toast.success("🎉 Registration approved! Opening dashboard...", { id: "reg-approval-status" });
      }
      const target = getHomeRouteForRole(role) || "/resident/dashboard";
      const timer = setTimeout(() => {
        toast.dismiss("reg-approval-status");
        navigate(target, { replace: true });
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [user, role, status, navigate]);

  // Real-time Firestore listener on user's registration status
  useEffect(() => {
    if (!user?.uid || hasHandledApprovalRef.current) return;

    let unsubReg = null;
    let unsubUser = null;

    function handleApprovalTrigger() {
      if (hasHandledApprovalRef.current) return;
      hasHandledApprovalRef.current = true;
      setIsApproved(true);

      // Clean up both listeners immediately
      if (unsubReg) { unsubReg(); unsubReg = null; }
      if (unsubUser) { unsubUser(); unsubUser = null; }

      toast.success("🎉 Registration approved by Admin!", { id: "reg-approval-status" });

      if (refreshUser) {
        refreshUser().catch(() => {});
      }

      setTimeout(() => {
        toast.dismiss("reg-approval-status");
        navigate("/resident/dashboard", { replace: true });
      }, 800);
    }

    try {
      // 1. Listen to registrationRequests doc
      unsubReg = onSnapshot(
        doc(db, "registrationRequests", user.uid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.status === "approved") {
              handleApprovalTrigger();
            }
          }
        },
        (err) => {
          console.warn("[PendingApproval] Reg listener error:", err.message);
        }
      );

      // 2. Listen to users doc
      unsubUser = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.status === "active" && (data.role === "resident" || data.role === "committee")) {
              handleApprovalTrigger();
            }
          }
        },
        (err) => {
          console.warn("[PendingApproval] Users listener error:", err.message);
        }
      );
    } catch (e) {
      console.warn("[PendingApproval] Listener setup error:", e.message);
    }

    return () => {
      if (unsubReg) unsubReg();
      if (unsubUser) unsubUser();
    };
  }, [user?.uid, navigate, refreshUser]);

  async function handleManualCheck() {
    try {
      setChecking(true);
      if (refreshUser) {
        const refreshed = await refreshUser();
        if (refreshed && (refreshed.status === "active" || refreshed.role === "resident" || refreshed.role === "committee")) {
          toast.success("Registration approved! Redirecting...", { id: "reg-approval-status" });
          setIsApproved(true);
          setTimeout(() => {
            toast.dismiss();
            navigate(getHomeRouteForRole(refreshed.role) || "/resident/dashboard", { replace: true });
          }, 600);
          return;
        }
      }
      toast("Still awaiting admin review. Please check back shortly.", { icon: "⏳" });
    } catch {
      toast.error("Could not check status. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDER: Modern Mobile-Friendly Card
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 sm:bg-gradient-to-br sm:from-slate-100 sm:via-blue-50/40 sm:to-slate-200 flex items-center justify-center p-0 sm:p-4 md:p-6">
      <div className="w-full min-h-screen sm:min-h-0 sm:my-6 max-w-[430px] bg-white sm:rounded-[36px] sm:shadow-2xl sm:border sm:border-slate-100 overflow-hidden flex flex-col justify-between transition-all duration-300">
        
        {/* Top Header */}
        <div className="pt-5 sm:pt-6 px-5 sm:px-6 pb-2 flex items-center justify-between">
          <RwaBrandHeader />
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200/70 px-3 py-1.5 rounded-xl transition cursor-pointer"
            title="Log out"
          >
            Logout
          </button>
        </div>

        {/* Top Scenic Banner with Curved Wave */}
        <div className="relative h-44 sm:h-48 w-full overflow-hidden mt-1 shrink-0">
          <img
            src="/society-banner.jpg"
            alt="D Block RWA Society"
            className="w-full h-full object-cover object-center"
          />

          {/* Sunlight & Gradient Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/20 to-transparent pointer-events-none" />

          {/* Banner Text Over Photo */}
          <div className="absolute bottom-9 left-5 sm:left-6 z-10 text-white">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-blue-600/90 text-white px-2.5 py-0.5 rounded-full mb-1">
              Application Status
            </span>
            <h1 className="text-xl font-black tracking-tight drop-shadow-sm">
              Membership Review
            </h1>
          </div>

          {/* Organic Bottom Wave SVG */}
          <div className="absolute -bottom-1 left-0 right-0 w-full overflow-hidden leading-none z-10">
            <svg
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              className="relative block w-full h-8 sm:h-10 text-white fill-current"
            >
              <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,60 L1200,120 L0,120 Z" />
            </svg>
          </div>
        </div>

        {/* Middle Content */}
        <div className="px-5 sm:px-7 pt-2 pb-6 text-center flex-1 flex flex-col justify-between">
          
          {isApproved ? (
            /* ─────────────────────────────────────────────────────────────
               APPROVED STATE
            ───────────────────────────────────────────────────────────── */
            <div className="my-auto space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl shadow-md border border-emerald-200">
                <FaCheckCircle className="animate-bounce" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Registration Approved! 🎉
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                  Your resident account has been verified and activated. Opening your dashboard...
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    toast.dismiss();
                    navigate(getHomeRouteForRole(role) || "/resident/dashboard", { replace: true });
                  }}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-2xl text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Go to Resident Dashboard</span>
                  <FaArrowRight className="text-sm" />
                </button>
              </div>
            </div>
          ) : isRejected ? (
            /* ─────────────────────────────────────────────────────────────
               REJECTED STATE
            ───────────────────────────────────────────────────────────── */
            <div className="my-auto space-y-4 animate-in fade-in duration-300">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center text-3xl shadow-xs border border-rose-200">
                <FaTimesCircle />
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Application Declined
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                  Your registration application could not be approved at this time.
                </p>
              </div>

              {user?.rejectionReason && (
                <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-4 text-xs sm:text-sm text-rose-800 text-left">
                  <strong className="font-bold text-rose-950">Feedback:</strong> {user.rejectionReason}
                </div>
              )}

              <p className="text-xs text-slate-400 font-medium">
                Please contact the society administration office for further details.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FaSignOutAlt />
                  <span>Return to Login</span>
                </button>
              </div>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               PENDING APPROVAL STATE
            ───────────────────────────────────────────────────────────── */
            <div className="space-y-4">
              
              {/* Pulsing Status Icon */}
              <div className="pt-1">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 text-amber-500 flex items-center justify-center text-3xl shadow-xs border border-amber-200/70">
                  <FaClock className="animate-pulse" />
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-3">
                  Pending Approval
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed px-2">
                  Your registration is being reviewed by the society admin. You will receive access once approved.
                </p>
              </div>

              {/* Resident Details Card with Soft Blue Pill Aesthetic */}
              {(user?.name || user?.mobile || user?.phone || user?.flat || user?.block) ? (
                <div className="bg-[#edf3ff] border border-blue-100/70 rounded-2xl p-4 text-left text-xs sm:text-sm space-y-2.5 shadow-xs">
                  {user?.name && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <FaUser className="text-slate-400 text-xs" /> Name
                      </span>
                      <span className="font-bold text-slate-800">{user.name}</span>
                    </div>
                  )}

                  {(user?.mobile || user?.phone) && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <FaPhone className="text-slate-400 text-xs" /> Mobile
                      </span>
                      <span className="font-bold text-slate-800 font-mono">
                        {user.mobile || user.phone}
                      </span>
                    </div>
                  )}

                  {(user?.flat || user?.flatNumber) && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <FaHome className="text-slate-400 text-xs" /> Flat / Plot
                      </span>
                      <span className="font-bold text-slate-800">
                        {user.flat || user.flatNumber}
                      </span>
                    </div>
                  )}

                  {user?.block && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1.5">
                        <FaBuilding className="text-slate-400 text-xs" /> Block
                      </span>
                      <span className="font-bold text-slate-800">{user.block}</span>
                    </div>
                  )}

                  {/* Status Indicator Row */}
                  <div className="pt-2 border-t border-blue-200/50 flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <FaShieldAlt className="text-slate-400 text-xs" /> Status
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Under Review
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                {/* Refresh / Check Status */}
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={checking}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-blue-400 text-white font-bold rounded-2xl text-sm sm:text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FaSyncAlt className={checking ? "animate-spin" : ""} />
                  <span>{checking ? "Checking Status..." : "Refresh / Check Status"}</span>
                </button>

                {/* Back to Login / Logout */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-3 bg-[#edf3ff] hover:bg-[#e2ecff] text-slate-700 font-bold rounded-2xl text-xs sm:text-sm border border-blue-200/50 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FaSignOutAlt className="text-slate-500" />
                  <span>Logout</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Bottom Scenic Society Illustration Footer */}
        <div className="relative h-20 sm:h-24 w-full overflow-hidden shrink-0 mt-1">
          <img
            src="/society-banner.jpg"
            alt="D Block Community"
            className="w-full h-full object-cover object-bottom"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/40 to-transparent" />
        </div>

      </div>
    </div>
  );
}

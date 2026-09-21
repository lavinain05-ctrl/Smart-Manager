import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBuilding,
  FaClock,
  FaSignOutAlt,
  FaTimesCircle,
  FaCheckCircle,
  FaSignInAlt,
  FaSyncAlt,
  FaArrowRight,
} from "react-icons/fa";
import toast from "react-hot-toast";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../services/authService";

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const role = (user?.role || "").toLowerCase();
  const status = (user?.status || "").toLowerCase();
  const isRejected = status === "rejected";

  // Check if user is already approved and redirect
  useEffect(() => {
    if (user && role !== "pending_registration" && status === "active") {
      setIsApproved(true);
      const target = getHomeRouteForRole(role) || "/resident/dashboard";
      const timer = setTimeout(() => {
        navigate(target, { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, role, status, navigate]);

  // Real-time Firestore listener on user's registration status
  useEffect(() => {
    if (!user?.uid) return;

    let unsubReg = null;
    let unsubUser = null;

    try {
      // 1. Listen to registrationRequests doc
      unsubReg = onSnapshot(doc(db, "registrationRequests", user.uid), async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === "approved") {
            setIsApproved(true);
            if (refreshUser) await refreshUser();
            toast.success("🎉 Registration approved by Admin!");
            setTimeout(() => {
              navigate("/resident/dashboard", { replace: true });
            }, 1200);
          }
        }
      }, (err) => {
        console.warn("[PendingApproval] Reg listener error:", err.message);
      });

      // 2. Listen to users doc
      unsubUser = onSnapshot(doc(db, "users", user.uid), async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === "active" && data.role === "resident") {
            setIsApproved(true);
            if (refreshUser) await refreshUser();
            setTimeout(() => {
              navigate("/resident/dashboard", { replace: true });
            }, 1200);
          }
        }
      }, (err) => {
        console.warn("[PendingApproval] Users listener error:", err.message);
      });
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
        if (refreshed && (refreshed.status === "active" || refreshed.role === "resident")) {
          toast.success("Registration approved! Redirecting...");
          setIsApproved(true);
          setTimeout(() => {
            navigate(getHomeRouteForRole(refreshed.role) || "/resident/dashboard", { replace: true });
          }, 800);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">

        {/* Logo */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-3xl shadow-lg shadow-emerald-700/20">
          <FaBuilding />
        </div>

        <h1 className="text-2xl font-bold mt-5 text-slate-800">D Block RWA Indraprastha</h1>

        {isApproved ? (
          /* Approved State */
          <div className="mt-8 animate-fadeIn">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <FaCheckCircle className="text-emerald-600 text-4xl animate-bounce" />
            </div>

            <h2 className="text-xl font-bold text-emerald-600">
              Registration Approved! 🎉
            </h2>

            <p className="text-gray-600 mt-3 leading-relaxed text-sm">
              Your resident account is now active. Redirecting you to the dashboard...
            </p>

            <button
              onClick={() => navigate(getHomeRouteForRole(role) || "/resident/dashboard", { replace: true })}
              className="mt-6 flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold shadow-lg shadow-emerald-600/30 transition"
            >
              Go to Dashboard <FaArrowRight />
            </button>
          </div>
        ) : isRejected ? (
          /* Rejected State */
          <div className="mt-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
              <FaTimesCircle className="text-red-500 text-4xl" />
            </div>

            <h2 className="text-xl font-bold text-red-600">
              Registration Rejected
            </h2>

            <p className="text-gray-500 mt-3 leading-relaxed text-sm">
              Your registration has been rejected by the admin.
            </p>

            {user?.rejectionReason && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 text-left">
                <strong>Reason:</strong> {user.rejectionReason}
              </div>
            )}

            <p className="text-gray-400 text-xs mt-4">
              Please contact the society admin for more information.
            </p>

            <button
              onClick={handleLogout}
              className="mt-6 flex items-center justify-center gap-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition"
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        ) : (
          /* Pending Approval State */
          <div className="mt-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <FaClock className="text-amber-500 text-4xl animate-pulse" />
            </div>

            <h2 className="text-xl font-bold text-amber-600">
              Pending Approval
            </h2>

            <p className="text-gray-600 mt-3 leading-relaxed text-sm">
              Your registration is being reviewed by the society admin. You will receive access once approved.
            </p>

            {/* Resident Details Card */}
            {(user?.name || user?.mobile || user?.phone || user?.flat) ? (
              <div className="mt-6 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-left space-y-2.5">
                {user?.name && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Name</span>
                    <span className="font-semibold text-slate-700">{user.name}</span>
                  </div>
                )}
                {(user?.mobile || user?.phone) && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mobile</span>
                    <span className="font-semibold text-slate-700">{user.mobile || user.phone}</span>
                  </div>
                )}
                {(user?.flat || user?.flatNumber) && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Flat</span>
                    <span className="font-semibold text-slate-700">{user.flat || user.flatNumber}</span>
                  </div>
                )}
                {user?.block && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Block</span>
                    <span className="font-semibold text-slate-700">{user.block}</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              {/* Check Status Button */}
              {user && (
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={checking}
                  className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium shadow-md shadow-emerald-600/20 transition disabled:opacity-60"
                >
                  <FaSyncAlt className={checking ? "animate-spin" : ""} />
                  {checking ? "Checking..." : "Refresh / Check Status"}
                </button>
              )}

              {/* If user not logged in or wants to return to login */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition"
              >
                {user ? (
                  <>
                    <FaSignOutAlt /> Logout
                  </>
                ) : (
                  <>
                    <FaSignInAlt /> Go to Login
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

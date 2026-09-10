import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FaLock,
  FaShieldAlt,
  FaCheckCircle,
} from "react-icons/fa";

import toast from "react-hot-toast";

import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";

export default function ForceChangePassword() {
  const navigate = useNavigate();
  const { user, clearMustChangePassword } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // =============================
  // Handle Password Change
  // =============================

  async function handleChangePassword(e) {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      // Update Firebase Auth password
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        toast.error("Session expired. Please login again.");
        navigate("/", { replace: true });
        return;
      }

      await updatePassword(firebaseUser, newPassword);

      // Clear the mustChangePassword flag in Firestore
      try {
        await updateDoc(doc(db, "users", firebaseUser.uid), {
          mustChangePassword: false,
        });
      } catch (err) {
        console.warn("[ForceChangePassword] Failed to clear flag in users:", err.message);
      }

      // Also clear from residents doc if it exists
      try {
        await updateDoc(doc(db, "residents", firebaseUser.uid), {
          mustChangePassword: false,
        });
      } catch {
        // Resident doc may not have this field — that's fine
      }

      // Update context
      clearMustChangePassword();

      toast.success("Password changed successfully! Welcome back.");

      // Redirect based on role
      if (user?.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (user?.role === "collector") {
        navigate("/collector/dashboard", { replace: true });
      } else if (user?.role === "resident") {
        navigate("/resident/dashboard", { replace: true });
      } else if (user?.role === "family") {
        navigate("/family/dashboard", { replace: true });
      } else if (user?.role === "committee") {
        navigate("/committee/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (error) {
      console.error(error);
      if (error.code === "auth/requires-recent-login") {
        toast.error("Session expired. Please login again with your temporary password.");
        navigate("/", { replace: true });
      } else {
        toast.error(error.message || "Failed to change password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center text-4xl shadow-md mb-4">
            <FaShieldAlt />
          </div>
          <h1 className="text-2xl font-bold">Set New Password</h1>
          <p className="text-gray-500 text-sm mt-2">
            You logged in with a temporary password. Please create a new secure password to continue.
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-start gap-2 mb-6">
          <FaLock className="mt-0.5 shrink-0" />
          <span>
            Your new password must be at least 6 characters long. Choose something secure that you can remember.
          </span>
        </div>

        {/* Password Form */}
        <form onSubmit={handleChangePassword} className="space-y-5">

          <div>
            <label className="block mb-2 font-medium">New Password</label>
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 font-medium">Confirm Password</label>
            <div className="relative">
              <FaCheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || newPassword !== confirmPassword}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition"
          >
            {loading ? "Changing Password..." : "Set New Password"}
          </button>

        </form>
      </div>
    </div>
  );
}

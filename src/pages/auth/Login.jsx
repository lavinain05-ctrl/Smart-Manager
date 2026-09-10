import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  FaBuilding,
  FaUser,
  FaLock,
  FaPhone,
  FaHeadset,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { normalizeMobile } from "../../services/authService";
import toast from "react-hot-toast";

export default function Login() {
  const navigate = useNavigate();

  const {
    user,
    login,
  } = useAuth();

  // Login state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect already-authenticated users
  useEffect(() => {
    if (user) {
      // Force change password takes priority
      if (user.mustChangePassword) {
        navigate("/change-password", { replace: true });
        return;
      }
      const role = (user.role || "").toLowerCase();
      const status = (user.status || "").toLowerCase();

      if (role === "pending_registration" || status === "pending" || status === "rejected") {
        navigate("/pending-approval", { replace: true });
        return;
      }
      if (role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (role === "collector") {
        navigate("/collector/dashboard", { replace: true });
      } else if (role === "resident") {
        navigate("/resident/dashboard", { replace: true });
      } else if (role === "family") {
        navigate("/family/dashboard", { replace: true });
      } else if (role === "committee") {
        navigate("/committee/dashboard", { replace: true });
      }
    }
  }, [user, navigate]);


  // =============================
  // Mobile / Email + Password Login
  // =============================

  async function handleLogin(e) {
    e.preventDefault();
    const raw = identifier.trim();
    const isEmail = raw.includes("@");
    const cleanMobile = normalizeMobile(raw);

    if (!isEmail && (!cleanMobile || cleanMobile.length !== 10)) {
      toast.error("Please enter a valid 10-digit mobile number or admin email.");
      return;
    }
    if (!password) {
      toast.error("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      const loginParam = isEmail ? raw : cleanMobile;
      const loggedInUser = await login(loginParam, password);

      // Force password change redirect
      if (loggedInUser.mustChangePassword) {
        navigate("/change-password", { replace: true });
        return;
      }

      if (loggedInUser.status === "pending") {
        navigate("/pending-approval", { replace: true });
        return;
      }

      if (loggedInUser.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (loggedInUser.role === "collector") {
        navigate("/collector/dashboard", { replace: true });
      } else if (loggedInUser.role === "resident") {
        navigate("/resident/dashboard", { replace: true });
      } else if (loggedInUser.role === "family") {
        navigate("/family/dashboard", { replace: true });
      } else if (loggedInUser.role === "committee") {
        navigate("/committee/dashboard", { replace: true });
      } else {
        alert("Invalid user role.");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleIdentifierChange(e) {
    const val = e.target.value;
    // If it's purely digits or phone format chars, normalize mobile
    if (/^[0-9+\s\-()]*$/.test(val)) {
      setIdentifier(normalizeMobile(val));
    } else {
      setIdentifier(val);
    }
  }

  // Don't render login form if already authenticated
  if (user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-600 text-white flex items-center justify-center text-4xl shadow-lg">
            <FaBuilding />
          </div>
          <h1 className="text-4xl font-bold mt-5">Smart Manager</h1>
          <p className="text-gray-500 mt-2">Society Management System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block mb-2 font-medium">Mobile Number</label>
            <div className="relative">
              <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Enter 10-digit mobile number"
                value={identifier}
                onChange={handleIdentifierChange}
                className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 font-medium">Password</label>
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition"
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition"
          >
            {loading ? "Signing In..." : "Login"}
          </button>
        </form>

        {/* Register Link */}
        <div className="text-center mt-6 pt-6 border-t">
          <p className="text-gray-500 text-sm">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-emerald-600 hover:text-emerald-700 font-semibold transition"
            >
              Register Here
            </Link>
          </p>
        </div>

        {/* Need Help Link */}
        <div className="text-center mt-3">
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition"
          >
            <FaHeadset />
            Need Help? Contact Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
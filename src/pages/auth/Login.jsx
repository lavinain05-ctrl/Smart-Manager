import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  FaBuilding,
  FaUser,
  FaLock,
  FaPhone,
  FaEnvelope,
  FaHeadset,
  FaEye,
  FaEyeSlash,
  FaUserShield,
  FaShieldAlt,
  FaCity,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { normalizeMobile, getHomeRouteForRole, isExactAdminEmail } from "../../services/authService";
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
  const [showPassword, setShowPassword] = useState(false);
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

      const targetPath = getHomeRouteForRole(role);
      if (targetPath && targetPath !== "/") {
        navigate(targetPath, { replace: true });
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

      const userStatus = (loggedInUser.status || "").toLowerCase();
      const userRole = (loggedInUser.role || "").toLowerCase();

      if (userStatus === "pending" || userRole === "pending_registration" || userStatus === "rejected") {
        navigate("/pending-approval", { replace: true });
        return;
      }

      if (userRole === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (userRole === "collector") {
        navigate("/collector/dashboard", { replace: true });
      } else if (userRole === "resident") {
        navigate("/resident/dashboard", { replace: true });
      } else if (userRole === "family") {
        navigate("/family/dashboard", { replace: true });
      } else if (userRole === "committee") {
        navigate("/committee/dashboard", { replace: true });
      } else {
        toast.error("Invalid user role. Please contact Admin.");
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-3.5 sm:p-6 py-6 sm:py-10">

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md p-5 sm:p-8">

        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24 mb-3 sm:mb-4 flex items-center justify-center">
            {/* Ambient soft glow */}
            <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 blur-lg opacity-35 transform scale-95" />
            {/* Badge */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white flex flex-col items-center justify-center shadow-xl shadow-emerald-900/25 border border-emerald-300/40 p-2">
              <div className="relative flex items-center justify-center">
                <FaCity className="text-3xl sm:text-4xl text-white drop-shadow-md" />
                <span className="absolute -bottom-1 -right-1.5 bg-white text-emerald-700 rounded-full p-0.5 sm:p-1 text-[9px] sm:text-[11px] shadow-md border border-emerald-100 flex items-center justify-center">
                  <FaShieldAlt />
                </span>
              </div>
              <div className="mt-1 px-2 py-0.5 rounded-full bg-emerald-950/40 text-[8px] sm:text-[9px] font-extrabold tracking-widest text-emerald-200 uppercase border border-emerald-400/30">
                RWA
              </div>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">D BLOCK RWA</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">Society Management System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          {(() => {
            const isAdminEmailEntered = isExactAdminEmail(identifier);

            return (
              <>
                <div>
                  <label className="block mb-1.5 sm:mb-2 text-sm font-medium text-slate-700">
                    {isAdminEmailEntered ? "Admin Email Address" : "Mobile Number"}
                  </label>
                  <div className="relative">
                    {isAdminEmailEntered ? (
                      <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    ) : (
                      <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    )}
                    <input
                      type="text"
                      placeholder="Enter 10-digit mobile or admin email"
                      value={identifier}
                      onChange={handleIdentifierChange}
                      className="w-full pl-10 pr-4 border rounded-xl p-3 text-base sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition"
                      required
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 sm:mb-2 text-sm font-medium text-slate-700">Password</label>
                  <div className="relative">
                    <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-11 border rounded-xl p-3 text-base sm:text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1.5 transition rounded-lg hover:bg-gray-100"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <FaEyeSlash className="text-base" /> : <FaEye className="text-base" />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Links */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5 min-h-[28px]">
                  {isAdminEmailEntered ? (
                    <Link
                      to={`/forgot-password?tab=admin&email=${encodeURIComponent(identifier.trim())}`}
                      className="text-amber-700 hover:text-amber-800 font-bold transition flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 animate-in fade-in duration-200"
                    >
                      <FaUserShield className="text-sm text-amber-600" />
                      <span>Admin Password Reset</span>
                    </Link>
                  ) : (
                    <span />
                  )}

                  <Link
                    to={
                      identifier.trim()
                        ? `/forgot-password?identifier=${encodeURIComponent(identifier.trim())}`
                        : "/forgot-password"
                    }
                    className="text-emerald-600 hover:text-emerald-700 font-medium transition ml-auto"
                  >
                    Forgot Password?
                  </Link>
                </div>
              </>
            );
          })()}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold text-sm sm:text-base transition shadow-sm"
          >
            {loading ? "Signing In..." : "Login"}
          </button>
        </form>

        {/* Register Link */}
        <div className="text-center mt-5 sm:mt-6 pt-5 sm:pt-6 border-t">
          <p className="text-gray-500 text-xs sm:text-sm">
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
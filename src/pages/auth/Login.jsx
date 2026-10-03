import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";

import {
  FaLock,
  FaPhone,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaUserShield,
  FaHome,
  FaUsers,
  FaArrowRight,
  FaArrowLeft,
  FaPhoneAlt,
  FaChevronLeft,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { normalizeMobile, getHomeRouteForRole, isExactAdminEmail } from "../../services/authService";
import BrandPageLoader from "../../components/common/BrandPageLoader";
import toast from "react-hot-toast";

// ══════════════════════════════════════════════════════════════════
// Official D BLOCK RWA Brand Header Logo (Matching Reference Design)
// ══════════════════════════════════════════════════════════════════
function RwaBrandHeader({ onBack = null, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          title="Back to Overview"
          aria-label="Back to Overview"
        >
          <FaChevronLeft className="text-sm" />
        </button>
      )}

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
        <div className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none sm:leading-tight">
          D BLOCK RWA INDRAPRASTHA
        </div>
        <div className="text-[11px] sm:text-xs font-semibold text-slate-500 tracking-normal mt-0.5">
          Society Management System
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user, login } = useAuth();

  // Screen state: FIRST show "welcome" (Image 1), THEN show "login" (Image 2)
  const initialView = searchParams.get("view") === "login" ? "login" : "welcome";
  const [activeView, setActiveView] = useState(initialView);

  // Form State
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Remember Me State
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("rwa_remember_me") === "true";
  });

  // Restore saved mobile/email if "Remember Me" was enabled
  useEffect(() => {
    const saved = localStorage.getItem("rwa_saved_identifier");
    if (saved) {
      setIdentifier(saved);
      setRememberMe(true);
    }
  }, []);

  // Redirect already-authenticated users
  useEffect(() => {
    if (user) {
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

  if (user) {
    return <BrandPageLoader message="Opening your portal..." />;
  }

  // ══════════════════════════════════════════════════════════════════
  // Submission Handler with Full Authentication & Validation
  // ══════════════════════════════════════════════════════════════════
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

      // Handle "Remember Me" storage
      if (rememberMe) {
        localStorage.setItem("rwa_remember_me", "true");
        localStorage.setItem("rwa_saved_identifier", loginParam);
      } else {
        localStorage.removeItem("rwa_remember_me");
        localStorage.removeItem("rwa_saved_identifier");
      }

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

      const targetPath = getHomeRouteForRole(userRole);
      if (targetPath && targetPath !== "/") {
        navigate(targetPath, { replace: true });
      } else {
        toast.error("Invalid user role. Please contact Admin.");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  function handleIdentifierChange(e) {
    const val = e.target.value;
    if (/^[0-9+\s\-()]*$/.test(val)) {
      setIdentifier(normalizeMobile(val));
    } else {
      setIdentifier(val);
    }
  }

  const isAdminEmailEntered = isExactAdminEmail(identifier);

  // ══════════════════════════════════════════════════════════════════
  // RENDER SCREEN 1: Welcome Screen (First Page)
  // ══════════════════════════════════════════════════════════════════
  const renderWelcomeScreen = () => (
    <div className="w-full flex-1 flex flex-col justify-between animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="pt-5 sm:pt-6 px-5 sm:px-6 pb-2">
        <RwaBrandHeader />
      </div>

      {/* Top Scenic Banner with Curved Wave */}
      <div className="relative h-60 sm:h-64 w-full overflow-hidden mt-1 shrink-0">
        <img
          src="/society-banner.jpg"
          alt="D Block RWA Indraprastha Society"
          className="w-full h-full object-cover object-center"
        />

        {/* Subtle Sunlight & Vignette Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Organic Bottom Wave SVG (Matching Screenshot) */}
        <div className="absolute -bottom-1 left-0 right-0 w-full overflow-hidden leading-none z-10">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="relative block w-full h-10 sm:h-12 text-white fill-current"
          >
            <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,60 L1200,120 L0,120 Z" />
          </svg>
        </div>
      </div>

      {/* Middle Content */}
      <div className="px-5 sm:px-7 pt-2 pb-6 space-y-4 text-left flex-1 flex flex-col justify-between">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-black text-slate-900 leading-[1.18] tracking-tight">
            Our Society<br />
            Our Community<br />
            <span className="text-blue-600">A Better Tomorrow</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2 leading-relaxed">
            A digital platform for a cleaner, safer and more connected D Block Indraprastha.
          </p>
        </div>

        {/* 3 Circular Feature Highlights (Matching Screenshot) */}
        <div className="grid grid-cols-3 gap-2.5 py-1">
          {/* Stay Informed */}
          <div className="flex flex-col items-center text-center">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl sm:text-2xl shadow-xs border border-blue-100">
              <FaHome />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 mt-2 leading-tight">
              Stay Informed
            </span>
          </div>

          {/* Raise Complaints */}
          <div className="flex flex-col items-center text-center">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-xl sm:text-2xl shadow-xs border border-rose-100">
              <FaPhoneAlt />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 mt-2 leading-tight">
              Raise Complaints
            </span>
          </div>

          {/* Stronger Community */}
          <div className="flex flex-col items-center text-center">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl sm:text-2xl shadow-xs border border-purple-100">
              <FaUsers />
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 mt-2 leading-tight">
              Stronger Community
            </span>
          </div>
        </div>

        {/* Action Buttons: Login -> & Register */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => setActiveView("login")}
            className="w-full py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-2xl text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Login</span>
            <FaArrowRight className="text-sm" />
          </button>

          <Link
            to="/register"
            className="w-full py-3 sm:py-3.5 bg-white hover:bg-slate-50 active:scale-[0.98] text-blue-600 font-bold rounded-2xl text-base border border-blue-200 transition-all flex items-center justify-center shadow-xs"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // RENDER SCREEN 2: Login Form Screen (Second Page)
  // ══════════════════════════════════════════════════════════════════
  const renderLoginForm = () => (
    <div className="w-full flex-1 flex flex-col justify-between animate-in fade-in duration-300">
      {/* Top Header with Back to Welcome Button */}
      <div className="pt-5 sm:pt-6 px-5 sm:px-6 pb-1">
        <RwaBrandHeader onBack={() => setActiveView("welcome")} />
      </div>

      {/* Main Form Body */}
      <div className="px-5 sm:px-7 pt-4 pb-2 text-left flex-1 flex flex-col justify-center">
        {/* Title */}
        <div className="text-center mb-5 sm:mb-6">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Welcome Back
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Login to access your resident portal
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-3.5 sm:space-y-4">
          {/* Mobile / Admin Email Input with Soft Blue Pill Background */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-600 text-base">
              {isAdminEmailEntered ? <FaEnvelope /> : <FaPhone />}
            </div>
            <input
              type="text"
              placeholder={isAdminEmailEntered ? "Enter admin email address" : "Enter your mobile number"}
              value={identifier}
              onChange={handleIdentifierChange}
              className="w-full pl-11 pr-4 py-3.5 sm:py-4 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
              required
              autoComplete="username"
            />
          </div>

          {/* Password Input with Soft Blue Pill Background */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-600 text-base">
              <FaLock />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-11 py-3.5 sm:py-4 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <FaEyeSlash className="text-lg" /> : <FaEye className="text-lg" />}
            </button>
          </div>

          {/* Options Row: Remember Me & Forgot Password */}
          <div className="flex items-center justify-between gap-2 pt-0.5 text-xs sm:text-sm">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
              />
              <span className="font-semibold text-slate-700">Remember me</span>
            </label>

            <Link
              to={
                identifier.trim()
                  ? `/forgot-password?identifier=${encodeURIComponent(identifier.trim())}`
                  : "/forgot-password"
              }
              className="font-bold text-blue-600 hover:text-blue-700 transition"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Admin Fast-Reset Badge if Admin Email Detected */}
          {isAdminEmailEntered && (
            <div className="pt-1">
              <Link
                to={`/forgot-password?tab=admin&email=${encodeURIComponent(identifier.trim())}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition"
              >
                <FaUserShield className="text-amber-600 text-sm" />
                <span>Admin Password Recovery</span>
              </Link>
            </div>
          )}

          {/* Primary Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-blue-400 text-white font-bold rounded-2xl text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Signing In...</span>
              </span>
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>

        {/* ─── OR Divider ─── */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-bold tracking-wider">
              OR
            </span>
          </div>
        </div>

        {/* Secondary: Create New Account */}
        <Link
          to="/register"
          className="w-full py-3 sm:py-3.5 bg-[#edf3ff] hover:bg-[#e2ecff] active:scale-[0.98] text-blue-700 font-bold rounded-2xl text-base border border-blue-200/60 transition-all flex items-center justify-center shadow-xs"
        >
          Create New Account
        </Link>
      </div>

      {/* Bottom Scenic Society Illustration Crop (Matching Screenshot) */}
      <div className="relative h-28 sm:h-32 w-full overflow-hidden shrink-0 mt-2">
        <img
          src="/society-banner.jpg"
          alt="D Block Community"
          className="w-full h-full object-cover object-bottom"
        />

        {/* Subtle Top Wave/Gradient Blend */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/30 to-transparent" />
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════
  // MAIN RETURN: Mobile-First Responsive App Container
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 sm:bg-gradient-to-br sm:from-slate-100 sm:via-blue-50/40 sm:to-slate-200 flex items-center justify-center p-0 sm:p-4 md:p-6">
      <div className="w-full min-h-screen sm:min-h-0 sm:my-6 max-w-[430px] bg-white sm:rounded-[36px] sm:shadow-2xl sm:border sm:border-slate-100 overflow-hidden flex flex-col justify-between transition-all duration-300">
        {activeView === "welcome" ? renderWelcomeScreen() : renderLoginForm()}
      </div>
    </div>
  );
}
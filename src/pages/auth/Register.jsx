import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaLock,
  FaHome,
  FaBuilding,
  FaBriefcase,
  FaCalendarAlt,
  FaUserShield,
  FaCheckCircle,
  FaLeaf,
  FaEye,
  FaEyeSlash,
  FaChevronLeft,
  FaChevronDown,
  FaChevronUp,
  FaArrowRight,
  FaShieldAlt,
  FaLayerGroup,
  FaSpinner,
  FaQuestionCircle,
  FaInfoCircle,
  FaExclamationCircle,
} from "react-icons/fa";

import toast from "react-hot-toast";

import { db } from "../../firebase/firebase";

import {
  collection,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";

import {
  submitRegistration,
} from "../../services/registrationService";
import { normalizeMobile, validateMobile } from "../../services/authService";
import { AVAILABLE_FLOORS } from "../../services/propertyService";

// ══════════════════════════════════════════════════════════════════
// Official D BLOCK RWA Brand Header Logo (Matching New Theme)
// ══════════════════════════════════════════════════════════════════
function RwaBrandHeader({ onBack = null, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          title="Back to Login"
          aria-label="Back to Login"
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

export default function Register() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  // ========== Credentials ==========
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ========== Resident Info ==========
  const [name, setName] = useState("");
  const [fatherHusbandName, setFatherHusbandName] = useState("");
  const [email, setEmail] = useState("");
  const [availableBlocks, setAvailableBlocks] = useState([]);
  const [blockId, setBlockId] = useState("");
  const [block, setBlock] = useState("");
  const [plotNumber, setPlotNumber] = useState("");
  const [floor, setFloor] = useState("Ground Floor");
  const [unitNumber, setUnitNumber] = useState("");
  const [personType, setPersonType] = useState("OWNER");
  const [flat, setFlat] = useState("");
  const [alternateMobile, setAlternateMobile] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [occupation, setOccupation] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [garbageParticipation, setGarbageParticipation] = useState("");
  const [garbageError, setGarbageError] = useState(false);
  const [showGarbageInfo, setShowGarbageInfo] = useState(false);

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

  function handleBlockChange(selectedBlockId) {
    setBlockId(selectedBlockId);
    const selectedBlock = availableBlocks.find((b) => b.id === selectedBlockId);
    setBlock(selectedBlock?.name || "");
  }

  // ========== Submit Registration ==========
  async function handleSubmitRegistration(e) {
    e.preventDefault();

    // 1. Validate mobile format
    const mobileError = validateMobile(mobile);
    if (mobileError) {
      toast.error(mobileError);
      return;
    }

    // 2. Validate password
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    // 3. Validate name
    if (!name.trim()) {
      toast.error("Please enter your full name");
      return;
    }

    // 4. Validate block selection
    if (!blockId) {
      toast.error("Please select your block");
      return;
    }

    // 5. Validate plot number
    const resolvedPlot = (plotNumber || flat || "").trim();
    if (!resolvedPlot) {
      toast.error("Please enter your plot number");
      return;
    }

    // 6. Validate floor
    if (!floor.trim()) {
      toast.error("Please select or enter your floor");
      return;
    }

    // 7. Validate email (optional)
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // 8. Validate Garbage Collection participation (compulsory)
    if (!garbageParticipation) {
      setGarbageError(true);
      toast.error("Please choose whether you want to participate in the Garbage Collection Service");
      const gcSection = document.getElementById("garbage-collection-section");
      if (gcSection) {
        gcSection.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    try {
      setLoading(true);

      await submitRegistration({
        name: name.trim(),
        fatherHusbandName: fatherHusbandName.trim(),
        plotNumber: resolvedPlot,
        floor,
        unitNumber: unitNumber.trim(),
        flat: unitNumber.trim() ? `${resolvedPlot}-${unitNumber.trim()}` : resolvedPlot,
        block,
        blockId,
        personType,
        mobile: normalizeMobile(mobile),
        alternateMobile: alternateMobile.trim(),
        email: trimmedEmail,
        password,
        dob,
        gender,
        occupation: occupation.trim(),
        emergencyContact: emergencyContact.trim(),
        garbageParticipation,
      });

      toast.success("Registration submitted! Waiting for admin approval.");
      navigate("/pending-approval", { replace: true });
    } catch (error) {
      console.error("[Registration] Error:", error.code || "", error.message);
      toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDER: Mobile-First Responsive Registration Page
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 sm:bg-gradient-to-br sm:from-slate-100 sm:via-blue-50/40 sm:to-slate-200 flex items-center justify-center p-0 sm:p-4 md:p-6">
      <div className="w-full min-h-screen sm:min-h-0 sm:my-6 max-w-2xl bg-white sm:rounded-[36px] sm:shadow-2xl sm:border sm:border-slate-100 overflow-hidden flex flex-col justify-between transition-all duration-300">
        
        {/* Top Header with Back to Login */}
        <div className="pt-4 sm:pt-6 px-4 sm:px-6 pb-2 flex items-center justify-between">
          <RwaBrandHeader onBack={() => navigate("/?view=welcome")} />
          <Link
            to="/?view=login"
            className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 px-3 py-1.5 rounded-xl transition"
          >
            Sign In
          </Link>
        </div>

        {/* Top Scenic Banner with Curved Wave (Matching Login Design) */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden mt-1 shrink-0">
          <img
            src="/society-banner.jpg"
            alt="D Block RWA Indraprastha Society"
            className="w-full h-full object-cover object-center"
          />

          {/* Sunlight & Gradient Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/20 to-transparent pointer-events-none" />

          {/* Banner Text Over Photo */}
          <div className="absolute bottom-10 left-5 sm:left-7 z-10 text-white">
            <span className="inline-block text-[11px] sm:text-xs font-bold uppercase tracking-wider bg-blue-600/90 text-white px-2.5 py-0.5 rounded-full mb-1">
              New Member Portal
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-sm">
              Resident Registration
            </h1>
            <p className="text-xs text-white/90 font-medium drop-shadow-xs">
              Apply for your official digital society account
            </p>
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

        {/* Form Container */}
        <div className="px-4 sm:px-8 pt-3 pb-8 text-left flex-1 flex flex-col justify-start">
          <form onSubmit={handleSubmitRegistration} className="space-y-5 sm:space-y-6">

            {/* ─────────────────────────────────────────────────────────────
                SECTION 1: Account Credentials
            ───────────────────────────────────────────────────────────── */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm shadow-xs">
                  <FaLock />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-800">
                    Account Credentials
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                    This mobile number will be your login ID
                  </p>
                </div>
              </div>

              {/* Mobile Number Input with Soft Blue Pill Background */}
              <div>
                <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-xs sm:text-sm font-bold text-slate-500 bg-white/80 px-1.5 py-0.5 rounded-lg border border-slate-200">
                      +91
                    </span>
                  </div>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(normalizeMobile(e.target.value))}
                    className="w-full pl-16 pr-4 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                    maxLength={10}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 text-sm">
                      <FaLock />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                      minLength={6}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <FaEyeSlash className="text-base" /> : <FaEye className="text-base" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 text-sm">
                      <FaLock />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-11 pr-11 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                      minLength={6}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition cursor-pointer"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <FaEyeSlash className="text-base" /> : <FaEye className="text-base" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 2: Personal Information
            ───────────────────────────────────────────────────────────── */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm shadow-xs">
                  <FaUser />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-800">
                    Personal Information
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                    Your official identity details for society records
                  </p>
                </div>
              </div>

              {/* Name & Father/Husband Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 text-sm">
                      <FaUser />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Father / Husband Name
                  </label>
                  <input
                    type="text"
                    placeholder="Father or husband's name"
                    value={fatherHusbandName}
                    onChange={(e) => setFatherHusbandName(e.target.value)}
                    className="w-full px-4 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                  Email Address <span className="text-slate-400 font-normal text-xs">(Optional — for notices & receipts)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 text-sm">
                    <FaEnvelope />
                  </div>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* DOB, Gender, Occupation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">Date of Birth</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                      <FaCalendarAlt />
                    </div>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full pl-10 pr-3 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3.5 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">Occupation</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                      <FaBriefcase />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Business, Engineer"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      className="w-full pl-10 pr-3 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 3: Property Identity & Hierarchy
            ───────────────────────────────────────────────────────────── */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm shadow-xs">
                    <FaHome />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-800">
                      Property & Residence Details
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                      Exact address within D Block society
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex text-[11px] bg-blue-100/70 text-blue-700 font-bold px-2.5 py-1 rounded-full">
                  Hierarchy: Block → Plot → Floor → Unit
                </span>
              </div>

              {/* Block & Plot Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Select Block <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={blockId}
                    onChange={(e) => handleBlockChange(e.target.value)}
                    className="w-full px-4 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                    required
                  >
                    <option value="">Select Block</option>
                    {availableBlocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {availableBlocks.length === 0 && (
                    <p className="text-[11px] text-amber-600 font-medium mt-1">
                      Loading available blocks...
                    </p>
                  )}
                </div>

                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Plot / Building Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 572, 12, 104"
                    value={plotNumber}
                    onChange={(e) => {
                      setPlotNumber(e.target.value);
                      setFlat(e.target.value);
                    }}
                    className="w-full px-4 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Your designated plot number within the selected block
                  </p>
                </div>
              </div>

              {/* Floor, Unit/Flat, and Resident Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Floor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full px-3.5 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                    required
                  >
                    {AVAILABLE_FLOORS.map((fl) => (
                      <option key={fl} value={fl}>
                        {fl}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Flat Number <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1, A, 2"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    className="w-full px-3.5 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave empty if full floor</p>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Registering As <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={personType === "TENANT" ? "RENTED" : personType}
                    onChange={(e) => setPersonType(e.target.value)}
                    className="w-full px-3.5 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-xs sm:text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                    required
                  >
                    <option value="OWNER">Property Owner</option>
                    <option value="RENTED">Tenant / Rented</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Live Property Identity Preview Pill */}
              {plotNumber && (
                <div className="bg-blue-50/90 border border-blue-200/80 rounded-2xl p-3.5 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    <span>
                      <strong className="text-blue-950 font-bold">Property Identity:</strong>{" "}
                      {block ? `Block ${block}` : "Block Selected"}, Plot {plotNumber}, {floor}
                      {unitNumber ? `, Unit ${unitNumber}` : " (Entire Floor)"}
                    </span>
                  </div>
                  <span className="font-extrabold uppercase tracking-wider px-2.5 py-0.5 bg-blue-600 text-white rounded-lg text-[10px] shadow-xs">
                    {personType === "TENANT" ? "RENTED" : personType}
                  </span>
                </div>
              )}
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 4: Alternate & Emergency Contacts
            ───────────────────────────────────────────────────────────── */}
            <div className="bg-slate-50/70 border border-slate-100 rounded-3xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm shadow-xs">
                  <FaPhone />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-800">
                    Additional Contacts
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                    Optional numbers for emergency alerts and family communication
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Alternate Mobile <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-xs font-bold text-slate-500 bg-white/80 px-1.5 py-0.5 rounded-lg border border-slate-200">
                        +91
                      </span>
                    </div>
                    <input
                      type="tel"
                      placeholder="10-digit number"
                      value={alternateMobile}
                      onChange={(e) => setAlternateMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="w-full pl-16 pr-4 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 text-xs sm:text-sm font-bold text-slate-700">
                    Emergency Contact <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 text-sm">
                      <FaUserShield />
                    </div>
                    <input
                      type="tel"
                      placeholder="Emergency contact number"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="w-full pl-11 pr-4 py-3.5 bg-[#edf3ff] hover:bg-[#e6eeff] focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-xs"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 5: Garbage Collection Service (Compulsory Selection)
            ───────────────────────────────────────────────────────────── */}
            <div
              id="garbage-collection-section"
              className={`rounded-3xl p-4 sm:p-5 space-y-3.5 transition-all duration-300 ${
                garbageError && !garbageParticipation
                  ? "bg-red-50/70 border-2 border-red-400 shadow-md shadow-red-100/60"
                  : "bg-slate-50/80 border border-slate-200/90"
              }`}
            >
              {/* Header with Title & Compulsory Status */}
              <div className="flex items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shadow-xs transition-colors ${
                      garbageParticipation === "participating"
                        ? "bg-emerald-100 text-emerald-700"
                        : garbageParticipation === "not_participating"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <FaLeaf />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Garbage Collection Service</span>
                      <span className="text-red-500 font-extrabold text-sm" title="Compulsory selection">*</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                      Do you want to participate in the society's door-to-door garbage service?
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                {garbageParticipation ? (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
                      garbageParticipation === "participating"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    <FaCheckCircle className="text-[10px]" />
                    {garbageParticipation === "participating" ? "Participating" : "Opted Out"}
                  </span>
                ) : (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 transition-colors ${
                      garbageError
                        ? "bg-red-100 text-red-700 border border-red-300 animate-pulse"
                        : "bg-slate-200/80 text-slate-700 border border-slate-300/60"
                    }`}
                  >
                    {garbageError && <FaExclamationCircle className="text-[11px] text-red-600" />}
                    Selection Required *
                  </span>
                )}
              </div>

              {/* Validation Alert if user tried to submit without selecting */}
              {garbageError && !garbageParticipation && (
                <div className="text-xs font-semibold text-red-700 bg-red-100/80 border border-red-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2 animate-fadeIn">
                  <FaExclamationCircle className="shrink-0 text-red-600 text-sm" />
                  <span>Please choose either "Participating" or "Not Participating" to proceed. Selection is compulsory.</span>
                </div>
              )}

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setGarbageParticipation("participating");
                    setGarbageError(false);
                  }}
                  className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all font-semibold flex items-center gap-3 cursor-pointer ${
                    garbageParticipation === "participating"
                      ? "border-emerald-500 bg-emerald-50/90 text-emerald-900 shadow-sm ring-2 ring-emerald-400/25"
                      : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 text-slate-700"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 transition-colors ${
                      garbageParticipation === "participating"
                        ? "bg-emerald-500 text-white shadow-xs"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <FaCheckCircle />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                      <span>Participating</span>
                      {garbageParticipation === "participating" && (
                        <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-normal text-slate-500 truncate">
                      Standard collection with monthly receipt
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGarbageParticipation("not_participating");
                    setGarbageError(false);
                  }}
                  className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all font-semibold flex items-center gap-3 cursor-pointer ${
                    garbageParticipation === "not_participating"
                      ? "border-amber-500 bg-amber-50/90 text-amber-900 shadow-sm ring-2 ring-amber-400/25"
                      : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/30 text-slate-700"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 transition-colors ${
                      garbageParticipation === "not_participating"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <FaCheckCircle />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                      <span>Not Participating</span>
                      {garbageParticipation === "not_participating" && (
                        <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-[11px] font-normal text-slate-500 truncate">
                      Opt-out of society waste pickup
                    </div>
                  </div>
                </button>
              </div>

              {/* Explanation Button & Details Panel */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowGarbageInfo((prev) => !prev)}
                  className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50/90 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer shadow-2xs"
                >
                  <span className="inline-flex items-center gap-2">
                    <FaQuestionCircle className="text-blue-600 text-sm shrink-0" />
                    <span>Why is this asked? What does this service mean?</span>
                  </span>
                  {showGarbageInfo ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 font-bold bg-blue-200/60 px-2 py-0.5 rounded-md">
                      Hide explanation <FaChevronUp className="text-[9px]" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 font-bold bg-blue-200/60 px-2 py-0.5 rounded-md">
                      Click to understand <FaChevronDown className="text-[9px]" />
                    </span>
                  )}
                </button>

                {/* Expandable Explanation Panel */}
                {showGarbageInfo && (
                  <div className="mt-3 p-4 sm:p-5 bg-white border border-blue-200/90 rounded-2xl shadow-sm space-y-3.5 text-xs text-slate-700 animate-fadeIn">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-sm border-b border-blue-100 pb-2.5">
                      <FaInfoCircle className="text-blue-600 text-base shrink-0" />
                      <span>About Door-to-Door Garbage Collection & Why We Ask</span>
                    </div>

                    <div className="space-y-3 leading-relaxed">
                      <div>
                        <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs sm:text-sm">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          Why is your selection compulsory during registration?
                        </h4>
                        <p className="text-slate-600 pl-3.5 pt-1 text-[11px] sm:text-xs">
                          The society organizes daily morning door-to-door waste collectors assigned to each block and flat. In order to plan collection routes and configure your flat's monthly maintenance ledger before approving your registration, we need your choice in advance.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 sm:p-3.5">
                          <div className="font-bold text-emerald-900 flex items-center gap-1.5 pb-1 text-xs">
                            <FaCheckCircle className="text-emerald-600 text-xs shrink-0" />
                            If you choose "Participating":
                          </div>
                          <ul className="list-disc list-inside text-[11px] sm:text-xs text-emerald-900/90 space-y-1">
                            <li>Society waste collectors visit your doorstep daily every morning.</li>
                            <li>Billed <strong>post-service</strong> at the end of each completed month (not taken in advance).</li>
                            <li>Instant digital payment receipt with complete payment history in your portal.</li>
                          </ul>
                        </div>

                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 sm:p-3.5">
                          <div className="font-bold text-amber-900 flex items-center gap-1.5 pb-1 text-xs">
                            <FaCheckCircle className="text-amber-600 text-xs shrink-0" />
                            If you choose "Not Participating":
                          </div>
                          <ul className="list-disc list-inside text-[11px] sm:text-xs text-amber-900/90 space-y-1">
                            <li>Collectors will not visit your flat for waste pickup.</li>
                            <li>No garbage collection charges will be billed to your flat.</li>
                            <li>You are responsible for safely disposing of household waste independently per municipal rules.</li>
                          </ul>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2.5 text-[11px] sm:text-xs text-slate-600">
                        <span className="text-base leading-none">💡</span>
                        <div>
                          <strong className="text-slate-800">Can you change your mind later?</strong> Yes! Residents can easily update their participation status at any time after registration via their Resident Portal profile or by informing the RWA committee.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 6: Security & Approval Notice
            ───────────────────────────────────────────────────────────── */}
            <div className="bg-blue-50/80 border border-blue-200/60 rounded-2xl p-4 text-xs sm:text-sm text-blue-900 flex items-start gap-3">
              <FaShieldAlt className="text-blue-600 text-lg shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-bold text-blue-950">Verification Note:</strong> Your application will be verified by the RWA executive committee to maintain resident security. You will be able to log in immediately upon approval.
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                SECTION 7: Submit Application & Action Buttons
            ───────────────────────────────────────────────────────────── */}
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-blue-400 text-white font-bold rounded-2xl text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <FaSpinner className="animate-spin text-lg" />
                    Submitting Application...
                  </span>
                ) : (
                  <>
                    <span>Submit Registration Application</span>
                    <FaArrowRight className="text-sm" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <p className="text-xs sm:text-sm font-semibold text-slate-500">
                  Already have an account?{" "}
                  <Link
                    to="/?view=login"
                    className="text-blue-600 hover:text-blue-700 font-bold transition inline-flex items-center gap-1"
                  >
                    <span>Sign In Here</span>
                    <FaChevronLeft className="text-[10px] rotate-180" />
                  </Link>
                </p>
              </div>
            </div>

          </form>
        </div>

        {/* Bottom Scenic Society Illustration Footer */}
        <div className="relative h-20 sm:h-24 w-full overflow-hidden shrink-0 mt-2">
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

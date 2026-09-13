import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaLock,
  FaHome,
  FaBuilding,
  FaArrowLeft,
  FaBriefcase,
  FaCalendarAlt,
  FaUserShield,
  FaCheckCircle,
  FaLeaf,
  FaExclamationCircle,
  FaEye,
  FaEyeSlash,
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
  validateFlatNumber,
  normalizeFlatNumber,
} from "../../services/registrationService";
import { normalizeMobile, validateMobile } from "../../services/authService";

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
  const [flat, setFlat] = useState("");
  const [floor, setFloor] = useState("");
  const [alternateMobile, setAlternateMobile] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [occupation, setOccupation] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [garbageParticipation, setGarbageParticipation] = useState("participating");

  // ========== Inline Validation Errors ==========
  const [flatError, setFlatError] = useState("");

  // Load blocks from Firestore (public read — allowed by rules)
  useEffect(() => {
    async function loadBlocks() {
      try {
        const q = query(collection(db, "blocks"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        // Only show ACTIVE blocks in registration
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

  // ========== Real-time flat validation ==========
  function handleFlatChange(value) {
    setFlat(value);

    // Only validate if user has typed something
    const trimmed = value.trim();
    if (trimmed) {
      const error = validateFlatNumber(trimmed);
      setFlatError(error || "");
    } else {
      setFlatError("");
    }
  }

  // ========== Submit Registration ==========

  async function handleSubmitRegistration(e) {
    e.preventDefault();

    // --- Client-side validation ---

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
      toast.error("Please enter your name");
      return;
    }

    // 4. Validate flat format
    const flatValidationError = validateFlatNumber(flat);
    if (flatValidationError) {
      toast.error(flatValidationError);
      setFlatError(flatValidationError);
      return;
    }

    // 5. Validate block selection
    if (!blockId) {
      toast.error("Please select a block");
      return;
    }

    // 6. Validate floor
    if (!floor.trim()) {
      toast.error("Please enter the floor number");
      return;
    }

    // 7. Validate email (optional)
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);

      // The service handles:
      // - Mobile normalization
      // - Flat normalization
      // - Server-side availability check (Cloud Function)
      // - Firebase Auth account creation
      // - Registration request doc creation
      await submitRegistration({
        name,
        fatherHusbandName,
        flat,
        block,
        blockId,
        floor,
        mobile: normalizeMobile(mobile),
        alternateMobile,
        email,
        password,
        dob,
        gender,
        occupation,
        emergencyContact,
        garbageParticipation,
      });

      toast.success("Registration submitted! Waiting for admin approval.");
      navigate("/pending-approval", { replace: true });
    } catch (error) {
      console.error("[Registration] Error:", error.code || "", error.message);

      // Display the error message from the service
      // (already user-friendly messages from getAvailabilityErrorMessage)
      toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  // ========== RENDER ==========

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[95vh] overflow-y-auto">

        {/* Back to Login */}
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition"
        >
          <FaArrowLeft /> Back to Login
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-3xl shadow-lg">
            <FaBuilding />
          </div>
          <h1 className="text-3xl font-bold mt-4">Resident Registration</h1>
          <p className="text-gray-500 mt-2">
            Register for your society management account
          </p>
        </div>

        <form onSubmit={handleSubmitRegistration} className="space-y-5">

          {/* Account Credentials */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FaLock className="text-emerald-600" /> Account Credentials
            </h3>

            <div>
              <label className="block mb-1.5 text-sm font-medium">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">+91</span>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(normalizeMobile(e.target.value))}
                  className="w-full pl-12 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  maxLength={10}
                  required
                  autoComplete="username"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">This will be your login ID (Mobile Number + Password)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    minLength={6}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FaEyeSlash className="text-sm" /> : <FaEye className="text-sm" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-10 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    minLength={6}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 transition"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <FaEyeSlash className="text-sm" /> : <FaEye className="text-sm" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FaUser className="text-emerald-600" /> Personal Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-medium">
                  Father / Husband Name
                </label>
                <input
                  type="text"
                  placeholder="Father or husband name"
                  value={fatherHusbandName}
                  onChange={(e) => setFatherHusbandName(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1.5 text-sm font-medium">
                Email Address <span className="text-gray-400 font-normal text-xs">(Optional — for notices & receipts)</span>
              </label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="email"
                  placeholder="Your email address (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium">Date of Birth</label>
                <div className="relative">
                  <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full pl-10 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium">Occupation</label>
                <div className="relative">
                  <FaBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="text"
                    placeholder="Occupation"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full pl-10 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Flat Information */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FaHome className="text-emerald-600" /> Flat Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium">
                  Block <span className="text-red-500">*</span>
                </label>
                <select
                  value={blockId}
                  onChange={(e) => handleBlockChange(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                >
                  <option value="">Select Block</option>
                  {availableBlocks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {availableBlocks.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No blocks are currently available. Please contact the society administrator.</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium">
                  Flat Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. A101"
                  value={flat}
                  onChange={(e) => handleFlatChange(e.target.value)}
                  className={`w-full border rounded-xl p-3 focus:ring-2 outline-none ${
                    flatError
                      ? "border-red-400 focus:ring-red-500"
                      : "focus:ring-emerald-500"
                  }`}
                  required
                />
                {flatError ? (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <FaExclamationCircle className="text-[10px] shrink-0" />
                    {flatError}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Enter your flat/house number (e.g. B-201, A101, 571)</p>
                )}
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium">
                  Floor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter floor number"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FaPhone className="text-emerald-600" /> Contact Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium">Alternate Mobile</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">+91</span>
                  <input
                    type="tel"
                    placeholder="10-digit number"
                    value={alternateMobile}
                    onChange={(e) => setAlternateMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full pl-12 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    maxLength={10}
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium">
                  Emergency Contact
                </label>
                <div className="relative">
                  <FaUserShield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="tel"
                    placeholder="Emergency contact number"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full pl-10 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Garbage Collection */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <FaLeaf className="text-emerald-600" /> Garbage Collection
            </h3>

            <p className="text-sm text-gray-500">
              Do you want to participate in the society's garbage collection service?
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGarbageParticipation("participating")}
                className={`p-4 rounded-xl border-2 text-center transition font-medium ${
                  garbageParticipation === "participating"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-500"
                }`}
              >
                <FaCheckCircle className={`mx-auto text-2xl mb-2 ${
                  garbageParticipation === "participating" ? "text-emerald-500" : "text-gray-300"
                }`} />
                Participating
              </button>
              <button
                type="button"
                onClick={() => setGarbageParticipation("not_participating")}
                className={`p-4 rounded-xl border-2 text-center transition font-medium ${
                  garbageParticipation === "not_participating"
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-500"
                }`}
              >
                <FaCheckCircle className={`mx-auto text-2xl mb-2 ${
                  garbageParticipation === "not_participating" ? "text-orange-500" : "text-gray-300"
                }`} />
                Not Participating
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <strong>Note:</strong> After registration, your account will be reviewed by the society admin. You will receive access once approved.
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !!flatError}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3.5 rounded-xl font-semibold transition text-lg"
          >
            {loading ? "Submitting..." : "Submit Registration"}
          </button>

          <p className="text-center text-gray-500 text-sm">
            Already have an account?{" "}
            <Link to="/" className="text-emerald-600 hover:text-emerald-700 font-semibold transition">
              Login Here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

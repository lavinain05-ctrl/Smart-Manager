import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

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
  submitRecoveryRequest,
  RECOVERY_REQUEST_TYPES,
} from "../../services/recoveryService";

import { createNotification } from "../../services/notificationService";
import { normalizeMobile } from "../../services/authService";

// Admin UID for notifications
const ADMIN_UID = "92jYvGPlKMexX37WEzs7MaDuc7U2";

// =============================
// Tab definitions
// =============================

const TABS = [
  { id: "forgot_password", label: "Forgot Password", icon: <FaKey /> },
  { id: "forgot_mobile", label: "Forgot Mobile", icon: <FaPhone /> },
  { id: "contact_admin", label: "Contact Admin", icon: <FaHeadset /> },
];

export default function ForgotPassword() {
  // Tab state
  const [activeTab, setActiveTab] = useState("forgot_password");

  // Form state
  const [mobile, setMobile] = useState("");
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

  // Loading/success state
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState("");

  // Load blocks from Firestore (public read)
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

  // Sync request type with tab
  useEffect(() => {
    if (activeTab === "forgot_password") {
      setRequestType(forgotBoth ? "forgot_both" : "forgot_password");
    } else if (activeTab === "forgot_mobile") {
      setRequestType(forgotBoth ? "forgot_both" : "forgot_mobile");
    }
    // contact_admin tab uses the dropdown
  }, [activeTab, forgotBoth]);

  // Reset form when tab changes
  useEffect(() => {
    setMobile("");
    setName("");
    setBlockId("");
    setBlock("");
    setFloor("");
    setFlatNumber("");
    setDescription("");
    setForgotBoth(false);
    setSubmitted(false);
    setRequestId("");
  }, [activeTab]);

  // =============================
  // Handle Submit
  // =============================

  async function handleSubmit(e) {
    e.preventDefault();

    // Validate
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

    // For forgot_password tab, mobile is required
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

      // Notify admin
      try {
        await createNotification({
          userId: ADMIN_UID,
          title: "New Account Recovery Request",
          message: `${name.trim()} has submitted a ${requestType.replace(/_/g, " ")} request.`,
          type: "warning",
          link: "/admin/account-recovery",
        });
      } catch {
        // Non-fatal — admin will still see it in the list
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

      // Notify admin
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
  // Success Screen
  // =============================

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl mb-6">
            <FaCheckCircle />
          </div>
          <h2 className="text-2xl font-bold mb-3">Request Submitted</h2>
          <p className="text-gray-600 mb-4">
            Your {requestType === "forgot_password" ? "password recovery" : requestType === "forgot_mobile" ? "mobile recovery" : requestType === "forgot_both" ? "account recovery" : "support"} request has been sent to the Society Admin.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Please wait for Admin verification. You will be notified once your request is processed.
          </p>
          {requestId && (
            <p className="text-xs text-gray-400 mb-6">
              Request ID: <span className="font-mono">{requestId.slice(0, 8)}...</span>
            </p>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition"
          >
            <FaArrowLeft />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  // =============================
  // Render Form
  // =============================

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-700 via-emerald-600 to-blue-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-3xl shadow-md mb-4">
            <FaQuestionCircle />
          </div>
          <h1 className="text-2xl font-bold">Account Recovery</h1>
          <p className="text-gray-500 text-sm mt-1">
            Submit a request to recover your account
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Forgot Password / Forgot Mobile Tab */}
        {(activeTab === "forgot_password" || activeTab === "forgot_mobile") && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Forgot Both toggle */}
            {activeTab === "forgot_password" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none mb-2">
                <input
                  type="checkbox"
                  checked={forgotBoth}
                  onChange={(e) => setForgotBoth(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-gray-600">I also forgot my mobile number</span>
              </label>
            )}

            {activeTab === "forgot_mobile" && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-start gap-2 mb-2">
                  <FaExclamationTriangle className="mt-0.5 shrink-0" />
                  <span>
                    If you forgot your registered mobile number, provide your name and flat details. Admin will verify your identity from society records and provide your registered mobile number.
                  </span>
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium">
                    Alternate Contact Mobile <span className="text-gray-400 font-normal">(optional — to reach you)</span>
                  </label>
                  <div className="relative">
                    <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="tel"
                      placeholder="Enter contact number where admin can call you"
                      value={mobile}
                      onChange={(e) => setMobile(normalizeMobile(e.target.value))}
                      className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      maxLength={10}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Mobile Number (only for forgot_password when not forgotBoth) */}
            {activeTab === "forgot_password" && !forgotBoth && (
              <div>
                <label className="block mb-1.5 text-sm font-medium">Registered Mobile Number</label>
                <div className="relative">
                  <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(normalizeMobile(e.target.value))}
                    className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label className="block mb-1.5 text-sm font-medium">Full Name</label>
              <div className="relative">
                <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  required
                />
              </div>
            </div>

            {/* Block */}
            <div>
              <label className="block mb-1.5 text-sm font-medium">Block</label>
              <div className="relative">
                <FaBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <select
                  value={blockId}
                  onChange={(e) => {
                    const selected = availableBlocks.find((b) => b.id === e.target.value);
                    setBlockId(e.target.value);
                    setBlock(selected?.name || "");
                  }}
                  className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white"
                  required
                >
                  <option value="">Select your block</option>
                  {availableBlocks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Floor */}
            <div>
              <label className="block mb-1.5 text-sm font-medium">Floor</label>
              <div className="relative">
                <FaLayerGroup className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  placeholder="Enter floor number"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  required
                />
              </div>
            </div>

            {/* Flat Number */}
            <div>
              <label className="block mb-1.5 text-sm font-medium">Flat Number</label>
              <div className="relative">
                <FaHome className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  placeholder="e.g. A101, B-201"
                  value={flatNumber}
                  onChange={(e) => setFlatNumber(e.target.value)}
                  className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  required
                />
              </div>
            </div>

            {/* Description (optional) */}
            <div>
              <label className="block mb-1.5 text-sm font-medium">Additional Details <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                placeholder="Any additional information..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition"
            >
              {loading ? "Submitting..." : "Submit Recovery Request"}
            </button>
          </form>
        )}

        {/* Contact Admin Tab */}
        {activeTab === "contact_admin" && (
          <form onSubmit={handleContactAdmin} className="space-y-4">

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 flex items-start gap-2 mb-2">
              <FaHeadset className="mt-0.5 shrink-0" />
              <span>
                Need help? Submit a support request and the Admin will assist you.
              </span>
            </div>

            {/* Request Type */}
            <div>
              <label className="block mb-1.5 text-sm font-medium">Request Type</label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white"
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
              <label className="block mb-1.5 text-sm font-medium">Full Name</label>
              <div className="relative">
                <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  required
                />
              </div>
            </div>

            {/* Mobile (optional for contact) */}
            <div>
              <label className="block mb-1.5 text-sm font-medium">Mobile Number <span className="text-gray-400 font-normal">(if known)</span></label>
              <div className="relative">
                <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="tel"
                  placeholder="Enter mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Block */}
            <div>
              <label className="block mb-1.5 text-sm font-medium">Block <span className="text-gray-400 font-normal">(if known)</span></label>
              <div className="relative">
                <FaBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <select
                  value={blockId}
                  onChange={(e) => {
                    const selected = availableBlocks.find((b) => b.id === e.target.value);
                    setBlockId(e.target.value);
                    setBlock(selected?.name || "");
                  }}
                  className="w-full pl-10 pr-4 border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none bg-white"
                >
                  <option value="">Select your block</option>
                  {availableBlocks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Floor & Flat (row) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1.5 text-sm font-medium">Floor</label>
                <input
                  type="text"
                  placeholder="Floor"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium">Flat Number</label>
                <input
                  type="text"
                  placeholder="e.g. A101"
                  value={flatNumber}
                  onChange={(e) => setFlatNumber(e.target.value)}
                  className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block mb-1.5 text-sm font-medium">Description</label>
              <textarea
                placeholder="Describe your problem in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition"
            >
              {loading ? "Submitting..." : "Submit Support Request"}
            </button>
          </form>
        )}

        {/* Back to Login */}
        <div className="text-center mt-6 pt-5 border-t">
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

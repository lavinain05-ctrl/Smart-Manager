import { useState, useEffect, useMemo, useRef } from "react";
import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaHome,
  FaBuilding,
  FaKey,
  FaEye,
  FaEyeSlash,
  FaCopy,
  FaCheck,
  FaCamera,
  FaTimes,
  FaSearch,
  FaShieldAlt,
  FaInfoCircle,
  FaCalendarAlt,
  FaSortNumericDown,
  FaMoneyBillWave,
  FaUserPlus,
  FaEdit,
  FaUserTie,
  FaUsers,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useResidents } from "../../context/ResidentContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { normalizeMobile, validateMobile } from "../../services/authService";
import { getResidents } from "../../services/residentService";
import { validateProfilePhoto } from "../../services/committeeService";

const DESIGNATIONS = [
  "President",
  "Vice President",
  "Secretary",
  "Joint Secretary",
  "Treasurer",
  "Executive Member",
];

export default function CommitteeForm({
  member,
  onSave,
  onCancel,
}) {
  const { residents: contextResidents = [] } = useResidents();
  const { activeBlocks = [] } = useBlockFlat();

  // Local state for residents to ensure they are available immediately
  const [residentList, setResidentList] = useState(contextResidents);
  const [loadingResidents, setLoadingResidents] = useState(false);

  useEffect(() => {
    if (contextResidents && contextResidents.length > 0) {
      setResidentList(contextResidents);
    } else {
      setLoadingResidents(true);
      getResidents()
        .then((data) => {
          if (data && data.length > 0) {
            setResidentList(data);
          }
        })
        .catch((err) => console.warn("Failed to fetch residents directly:", err))
        .finally(() => setLoadingResidents(false));
    }
  }, [contextResidents]);

  // Active / valid residents list
  const activeResidents = useMemo(() => {
    return (residentList || []).filter((r) => {
      const status = (r.status || "").toLowerCase();
      const isInactive = status === "inactive" || status === "deleted";
      return !isInactive && (r.owner || r.name || r.flat);
    });
  }, [residentList]);

  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [residentSearch, setResidentSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Form Fields
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("Executive Member");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [flat, setFlat] = useState("");
  const [block, setBlock] = useState("");
  const [tenure, setTenure] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [order, setOrder] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);

  // Delegated Powers & Collection Permissions
  const [permissions, setPermissions] = useState({
    canManageResidents: false,
    canManageCollectors: false,
    canManageRegistrations: false,
    canManageProfileRequests: false,
    canManageAccountRecovery: false,
    canCollectGarbage: false,
    canCollectSpecial: false,
  });

  // Photo
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInputRef = useRef(null);

  // Anti-autofill state: inputs start readOnly so browser managers skip them on page load
  const [emailReadOnly, setEmailReadOnly] = useState(true);
  const [pwReadOnly, setPwReadOnly] = useState(true);

  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setEmailReadOnly(true);
    setPwReadOnly(true);

    if (member) {
      setSelectedResidentId(member.residentId || "");
      setName(member.name || "");
      setDesignation(member.designation || "Executive Member");
      setPhone(normalizeMobile(member.phone || ""));
      setEmail(member.email || "");
      setFlat(member.flat || "");
      setBlock(member.block || "");
      setTenure(member.tenure || "");
      setIntroduction(member.introduction || "");
      setOrder(member.order !== undefined && member.order !== null ? String(member.order) : "");
      setPassword("");
      setMustChangePassword(member.mustChangePassword ?? false);
      setPermissions({
        canManageResidents: Boolean(member.permissions?.canManageResidents),
        canManageCollectors: Boolean(member.permissions?.canManageCollectors),
        canManageRegistrations: Boolean(member.permissions?.canManageRegistrations),
        canManageProfileRequests: Boolean(member.permissions?.canManageProfileRequests),
        canManageAccountRecovery: Boolean(member.permissions?.canManageAccountRecovery),
        canCollectGarbage: Boolean(member.permissions?.canCollectGarbage),
        canCollectSpecial: Boolean(member.permissions?.canCollectSpecial),
      });
      setPhotoFile(null);
      setPhotoPreview(member.profilePhotoUrl || "");
      setRemovePhoto(false);
      setResidentSearch("");
    } else {
      setSelectedResidentId("");
      setName("");
      setDesignation("Executive Member");
      setPhone("");
      setEmail("");
      setFlat("");
      setBlock("");
      setTenure("");
      setIntroduction("");
      setOrder("");
      setPassword("");
      setMustChangePassword(true);
      setPermissions({
        canManageResidents: false,
        canManageCollectors: false,
        canManageRegistrations: false,
        canManageProfileRequests: false,
        canManageAccountRecovery: false,
        canCollectGarbage: false,
        canCollectSpecial: false,
      });
      setPhotoFile(null);
      setPhotoPreview("");
      setRemovePhoto(false);
      setResidentSearch("");
    }
    setShowPassword(false);
    setCopied(false);
    setSubmitting(false);
  }, [member]);

  // When a resident is picked from the searchable list
  function handleSelectResident(res) {
    if (!res) {
      setSelectedResidentId("");
      setIsDropdownOpen(false);
      return;
    }
    setSelectedResidentId(res.id);
    setName(res.owner || res.name || "");
    const resPhone = res.mobile || res.phone || "";
    if (resPhone) setPhone(normalizeMobile(resPhone));
    if (res.email) setEmail(res.email);
    const resFlat = res.flat || res.flatNumber || "";
    if (resFlat) setFlat(resFlat);
    if (res.block) setBlock(res.block);

    setIsDropdownOpen(false);
    setResidentSearch("");
    toast.success(`Loaded details from ${res.owner || res.name}`);
  }

  function handleClearResident() {
    setSelectedResidentId("");
    setResidentSearch("");
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateProfilePhoto(file);
    if (validationError) {
      toast.error(validationError);
      e.target.value = "";
      return;
    }

    setPhotoFile(file);
    setRemovePhoto(false);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setPhotoFile(null);
    setPhotoPreview("");
    setRemovePhoto(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleGeneratePassword() {
    const randomPass = "RWA@" + Math.floor(100000 + Math.random() * 900000);
    setPwReadOnly(false);
    setPassword(randomPass);
    setShowPassword(true);
    toast.success("Generated secure password!");
  }

  function handleCopyPassword() {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedResidentObj = useMemo(() => {
    return activeResidents.find((r) => r.id === selectedResidentId);
  }, [activeResidents, selectedResidentId]);

  // Check if current phone belongs to an existing resident
  const isExistingResident = useMemo(() => {
    if (selectedResidentId) return true;
    const clean = normalizeMobile(phone);
    if (clean.length === 10) {
      return activeResidents.some(
        (r) => normalizeMobile(r.mobile || r.phone) === clean
      );
    }
    return false;
  }, [selectedResidentId, phone, activeResidents]);

  // Filter residents based on search
  const filteredResidents = useMemo(() => {
    if (!residentSearch.trim()) return activeResidents;
    const s = residentSearch.toLowerCase().trim();
    return activeResidents.filter((r) => {
      const nameMatch = (r.owner || r.name || "").toLowerCase().includes(s);
      const flatMatch = (r.flat || r.flatNumber || "").toLowerCase().includes(s);
      const blockMatch = (r.block || "").toLowerCase().includes(s);
      const mobileMatch = (r.mobile || r.phone || "").includes(s);
      return nameMatch || flatMatch || blockMatch || mobileMatch;
    });
  }, [activeResidents, residentSearch]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    if (!name.trim()) {
      toast.error("Please enter the committee member's full name");
      return;
    }

    const cleanPhone = normalizeMobile(phone);
    const phoneErr = validateMobile(cleanPhone);
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }

    if (!member && !isExistingResident && (!password || password.length < 6)) {
      toast.error("Initial password must be at least 6 characters.");
      return;
    }

    if (password && password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      // Find block ID if block is selected
      const matchedBlock = activeBlocks.find((b) => b.name === block);

      await onSave({
        name: name.trim(),
        designation,
        phone: cleanPhone,
        email: email.trim(),
        flat: flat.trim(),
        block: block.trim(),
        blockId: matchedBlock?.id || "",
        residentId: selectedResidentId,
        tenure: tenure.trim(),
        introduction: introduction.trim(),
        order: order !== "" ? Number(order) : 99,
        permissions,
        password: password || undefined,
        mustChangePassword,
        photoFile,
        removePhoto,
      });
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save committee member");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
      autoComplete="off"
      data-lpignore="true"
    >
      {/* SECTION 1: LINK TO RESIDENT (SEARCHABLE) */}
      {!member && (
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
              <FaHome className="text-emerald-600" />
              <span>Link to Society Resident (Optional)</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
              {activeResidents.length} Residents
            </span>
          </div>

          {selectedResidentObj ? (
            <div className="p-3.5 bg-white border-2 border-emerald-500/80 rounded-xl shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  {(selectedResidentObj.owner || selectedResidentObj.name || "R")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm truncate">
                      {selectedResidentObj.owner || selectedResidentObj.name}
                    </h4>
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                      Linked
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Flat {selectedResidentObj.flat || selectedResidentObj.flatNumber}
                    {selectedResidentObj.block ? ` • Block ${selectedResidentObj.block}` : ""}
                    {(selectedResidentObj.mobile || selectedResidentObj.phone) &&
                      ` • ${selectedResidentObj.mobile || selectedResidentObj.phone}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearResident}
                className="text-xs font-semibold text-gray-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 transition shrink-0 flex items-center gap-1"
              >
                <FaTimes /> Change
              </button>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <label className="block mb-1.5 text-xs font-medium text-gray-700">
                Search Resident to Auto-Fill Details
              </label>

              <div className="relative">
                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search resident by name, flat (e.g. 101), block, or phone..."
                  value={residentSearch}
                  onChange={(e) => {
                    setResidentSearch(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
                {residentSearch && (
                  <button
                    type="button"
                    onClick={() => setResidentSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>

              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-gray-100">
                  {loadingResidents ? (
                    <div className="p-4 text-center text-xs text-gray-400">
                      Loading residents...
                    </div>
                  ) : filteredResidents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">
                      {residentSearch
                        ? `No residents matching "${residentSearch}"`
                        : "No active residents found"}
                    </div>
                  ) : (
                    filteredResidents.map((r) => {
                      const rName = r.owner || r.name || "Resident";
                      const rFlat = r.flat || r.flatNumber || "—";
                      const rBlock = r.block || "";
                      const rPhone = r.mobile || r.phone || "";

                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleSelectResident(r)}
                          className="w-full text-left p-3 hover:bg-emerald-50/70 transition flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-gray-900 group-hover:text-emerald-800 truncate">
                                {rName}
                              </span>
                              <span className="bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded">
                                Flat {rFlat}
                                {rBlock ? `, ${rBlock}` : ""}
                              </span>
                            </div>
                            {rPhone && (
                              <p className="text-xs text-gray-400 group-hover:text-emerald-600 mt-0.5 font-mono">
                                {rPhone}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-emerald-600 opacity-0 group-hover:opacity-100 transition shrink-0">
                            Select →
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: OFFICIAL PROFILE & DESIGNATION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
          <FaUser className="text-indigo-600" />
          <span>Official Details</span>
        </div>

        {/* Profile Photo */}
        <div>
          <label className="block mb-2 text-xs font-medium text-gray-700">
            Profile Photo
          </label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center overflow-hidden shrink-0">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <FaUser className="text-2xl text-indigo-300" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoChange}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                id="committee-photo-upload"
              />
              <label
                htmlFor="committee-photo-upload"
                className="cursor-pointer px-3 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs font-semibold text-gray-700 flex items-center gap-1.5 transition"
              >
                <FaCamera className="text-gray-400" />
                <span>{photoPreview ? "Change Photo" : "Upload Photo"}</span>
              </label>

              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            JPG, PNG, or WebP. Max 5MB.
          </p>
        </div>

        {/* Name & Designation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <FaUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. Ramesh Chandra"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-3.5 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-700">
              Designation <span className="text-red-500">*</span>
            </label>
            <select
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-gray-800"
            >
              {DESIGNATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Flat & Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">
              Flat / House Number
            </label>
            <input
              type="text"
              placeholder="e.g. D-571 or 101"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">
              Block / Tower
            </label>
            {activeBlocks.length > 0 ? (
              <select
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="">Select Block (Optional)</option>
                {activeBlocks.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="e.g. Block D"
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              />
            )}
          </div>
        </div>

        {/* Tenure & Order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-700 flex items-center gap-1">
              <FaCalendarAlt className="text-gray-400 text-xs" />
              <span>Tenure / Term</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 2025 - 2027"
              value={tenure}
              onChange={(e) => setTenure(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            />
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-700 flex items-center gap-1">
              <FaSortNumericDown className="text-gray-400 text-xs" />
              <span>Display Order (Priority)</span>
            </label>
            <input
              type="number"
              min="1"
              max="99"
              placeholder="1 for President, 2 for VP..."
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            />
          </div>
        </div>

        {/* Bio / Introduction */}
        <div>
          <label className="block mb-1.5 text-xs font-medium text-gray-700">
            Brief Bio / Profile Summary <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Brief responsibilities or message to residents..."
            value={introduction}
            onChange={(e) => setIntroduction(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-white"
          />
        </div>
      </div>

      {/* SECTION 3: LOGIN & CREDENTIALS WITH ANTI-AUTOFILL */}
      <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-4.5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <FaShieldAlt className="text-indigo-600" />
            <span>Committee Portal Credentials</span>
          </div>
          <span className="text-[11px] bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
            Admin/Official Access
          </span>
        </div>

        {/* Mobile Number (Login ID) */}
        <div>
          <label className="block mb-1.5 text-xs font-medium text-gray-700">
            Mobile Number (Login ID) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
              +91
            </span>
            <input
              type="tel"
              name="committee_mobile_login_field"
              placeholder="10-digit mobile number"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(normalizeMobile(e.target.value))}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-mono"
              required
              autoComplete="off"
              data-form-type="other"
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Committee member logs in using this 10-digit mobile number.
          </p>
        </div>

        {/* Existing Resident Linked Banner */}
        {isExistingResident && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
            <FaCheck className="text-emerald-600 shrink-0 mt-0.5 text-sm" />
            <div>
              <span className="font-semibold">Existing Resident Account Detected:</span> This resident already has an active portal login. Setting a password here is optional — their current password will continue to work, or you can enter a new one to change it.
            </div>
          </div>
        )}

        {/* Contact Email (Anti-autofill) */}
        <div>
          <label className="block mb-1.5 text-xs font-medium text-gray-700">
            Official Email <span className="text-gray-400 font-normal">(Optional for communication)</span>
          </label>
          <div className="relative">
            <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
            <input
              type="text"
              inputMode="email"
              name="c_member_contact_email_protect"
              id="c_member_contact_email_protect"
              placeholder="official@society.com (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={emailReadOnly}
              onFocus={() => setEmailReadOnly(false)}
              onMouseDown={() => setEmailReadOnly(false)}
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            />
          </div>
        </div>

        {/* Password (Anti-autofill) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-700">
              {member
                ? "Update Password"
                : isExistingResident
                ? "New Login Password (Optional)"
                : "Initial Password"}{" "}
              {!member && !isExistingResident && <span className="text-red-500">*</span>}
              {isExistingResident && (
                <span className="text-emerald-700 font-normal">
                  (Optional - existing password remains active)
                </span>
              )}
              {member && (
                <span className="text-gray-400 font-normal"> (Leave blank to keep unchanged)</span>
              )}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-lg transition"
              >
                Generate Random
              </button>
              {password && (
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="text-[11px] font-semibold text-sky-700 hover:text-sky-800 bg-sky-100 hover:bg-sky-200 px-2 py-1 rounded-lg flex items-center gap-1 transition"
                >
                  {copied ? <FaCheck className="text-[10px]" /> : <FaCopy className="text-[10px]" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <FaKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
            <input
              type={showPassword ? "text" : "password"}
              name="c_member_secret_code_protect"
              id="c_member_secret_code_protect"
              placeholder={
                member
                  ? "New password (min 6 characters)"
                  : isExistingResident
                  ? "Leave blank to keep resident's existing password"
                  : "Min 6 characters"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              readOnly={pwReadOnly}
              onFocus={() => setPwReadOnly(false)}
              onMouseDown={() => setPwReadOnly(false)}
              autoComplete="new-password"
              data-form-type="other"
              data-lpignore="true"
              minLength={password ? 6 : undefined}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-mono"
              required={!member && !isExistingResident}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>

        {/* Require password change checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={mustChangePassword}
            onChange={(e) => setMustChangePassword(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-gray-700">
            Require password change on first official login
          </span>
        </label>
      </div>

      {/* SECTION 6: DELEGATED ADMINISTRATIVE POWERS & COLLECTION PRIVILEGES */}
      <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/70 border-2 border-indigo-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5 text-indigo-900 font-bold text-base">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm shadow-sm">
              <FaShieldAlt />
            </div>
            <div>
              <h3>Delegated Powers & Access Privileges</h3>
              <p className="text-xs text-indigo-700 font-normal">
                Grant this committee official executive powers in their portal
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
            {Object.values(permissions).filter(Boolean).length} Active Powers
          </span>
        </div>

        {/* 1. Society Management Operations */}
        <div className="space-y-2 pt-1">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <FaUsers className="text-indigo-600" /> Society Management Capabilities
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Manage Residents */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
              permissions.canManageResidents
                ? "bg-white border-indigo-400 ring-2 ring-indigo-300 shadow-sm"
                : "bg-white/70 border-gray-200 hover:bg-white"
            }`}>
              <input
                type="checkbox"
                checked={permissions.canManageResidents}
                onChange={(e) => setPermissions((p) => ({ ...p, canManageResidents: e.target.checked }))}
                className="w-4 h-4 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-gray-900 block flex items-center gap-1.5">
                  <FaUsers className="text-indigo-600 text-xs" /> Manage Residents
                </span>
                <span className="text-gray-500">View, add new residents, and manage resident data.</span>
              </div>
            </label>

            {/* Manage Collectors */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
              permissions.canManageCollectors
                ? "bg-white border-indigo-400 ring-2 ring-indigo-300 shadow-sm"
                : "bg-white/70 border-gray-200 hover:bg-white"
            }`}>
              <input
                type="checkbox"
                checked={permissions.canManageCollectors}
                onChange={(e) => setPermissions((p) => ({ ...p, canManageCollectors: e.target.checked }))}
                className="w-4 h-4 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-gray-900 block flex items-center gap-1.5">
                  <FaUserTie className="text-indigo-600 text-xs" /> Manage Collectors
                </span>
                <span className="text-gray-500">View, add, and manage payment collector accounts.</span>
              </div>
            </label>

            {/* Review Registrations */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
              permissions.canManageRegistrations
                ? "bg-white border-indigo-400 ring-2 ring-indigo-300 shadow-sm"
                : "bg-white/70 border-gray-200 hover:bg-white"
            }`}>
              <input
                type="checkbox"
                checked={permissions.canManageRegistrations}
                onChange={(e) => setPermissions((p) => ({ ...p, canManageRegistrations: e.target.checked }))}
                className="w-4 h-4 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-gray-900 block flex items-center gap-1.5">
                  <FaUserPlus className="text-emerald-600 text-xs" /> Registration Requests
                </span>
                <span className="text-gray-500">Review, approve, or reject new resident sign-up requests.</span>
              </div>
            </label>

            {/* Profile Update Requests */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
              permissions.canManageProfileRequests
                ? "bg-white border-indigo-400 ring-2 ring-indigo-300 shadow-sm"
                : "bg-white/70 border-gray-200 hover:bg-white"
            }`}>
              <input
                type="checkbox"
                checked={permissions.canManageProfileRequests}
                onChange={(e) => setPermissions((p) => ({ ...p, canManageProfileRequests: e.target.checked }))}
                className="w-4 h-4 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-gray-900 block flex items-center gap-1.5">
                  <FaEdit className="text-purple-600 text-xs" /> Profile Requests
                </span>
                <span className="text-gray-500">Review and approve changes requested by residents to their profiles.</span>
              </div>
            </label>

            {/* Account Recovery */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none sm:col-span-2 ${
              permissions.canManageAccountRecovery
                ? "bg-white border-indigo-400 ring-2 ring-indigo-300 shadow-sm"
                : "bg-white/70 border-gray-200 hover:bg-white"
            }`}>
              <input
                type="checkbox"
                checked={permissions.canManageAccountRecovery}
                onChange={(e) => setPermissions((p) => ({ ...p, canManageAccountRecovery: e.target.checked }))}
                className="w-4 h-4 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-gray-900 block flex items-center gap-1.5">
                  <FaKey className="text-amber-600 text-xs" /> Account Recovery & Password Reset
                </span>
                <span className="text-gray-500">Help locked-out residents recover their accounts and issue temporary passwords.</span>
              </div>
            </label>
          </div>
        </div>

        {/* 2. Collection Powers */}
        <div className="space-y-2 pt-2 border-t border-indigo-200/60">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <FaMoneyBillWave className="text-emerald-600" /> Work as Collector (Fee Collection Powers)
          </p>
          <p className="text-xs text-gray-500">
            Allow this committee member to collect funds directly from residents and generate receipts.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Collect Garbage */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
              permissions.canCollectGarbage
                ? "bg-white border-emerald-500 ring-2 ring-emerald-300 shadow-sm"
                : "bg-white/70 border-gray-200 hover:bg-white"
            }`}>
              <input
                type="checkbox"
                checked={permissions.canCollectGarbage}
                onChange={(e) => setPermissions((p) => ({ ...p, canCollectGarbage: e.target.checked }))}
                className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-emerald-950 block">Garbage Collection</span>
                <span className="text-gray-500">Collect monthly door-to-door waste/garbage collection fees.</span>
              </div>
            </label>

            {/* Collect Special */}
            <label className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
              permissions.canCollectSpecial
                ? "bg-white border-purple-500 ring-2 ring-purple-300 shadow-sm"
                : "bg-white/70 border-gray-200 hover:bg-white"
            }`}>
              <input
                type="checkbox"
                checked={permissions.canCollectSpecial}
                onChange={(e) => setPermissions((p) => ({ ...p, canCollectSpecial: e.target.checked }))}
                className="w-4 h-4 mt-0.5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-purple-950 block">Special Campaign Collection</span>
                <span className="text-gray-500">Collect festival, development, and special campaign funds.</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-start gap-2.5">
        <FaInfoCircle className="text-indigo-500 shrink-0 mt-0.5 text-sm" />
        <div>
          <span className="font-semibold">Committee Governance:</span> Committee members have special privileges to publish notices, review resident complaints, and oversee society operations.
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-sm font-semibold text-gray-700 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white text-sm font-semibold shadow-sm hover:shadow transition flex items-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>{member ? "Update Official" : "Create Official Account"}</span>
          )}
        </button>
      </div>
    </form>
  );
}

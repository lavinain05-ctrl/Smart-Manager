import { useEffect, useState, useMemo, useRef } from "react";
import {
  FaUser,
  FaHeart,
  FaPhone,
  FaEnvelope,
  FaHome,
  FaBuilding,
  FaKey,
  FaEye,
  FaEyeSlash,
  FaCopy,
  FaCheck,
  FaExclamationCircle,
  FaShieldAlt,
  FaSearch,
  FaTimes,
  FaCheckCircle,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useResidents } from "../../context/ResidentContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { normalizeMobile, validateMobile } from "../../services/authService";
import { getResidents } from "../../services/residentService";

const RELATIONS = [
  "Spouse",
  "Son",
  "Daughter",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Daughter-in-Law",
  "Son-in-Law",
  "Grandfather",
  "Grandmother",
  "Grandchild",
  "Relative",
  "Other",
];

export default function FamilyMemberForm({
  familyMember,
  onSave,
  onCancel,
  preselectedResidentId,
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

  // Active / valid residents list (any resident not marked inactive)
  const activeResidents = useMemo(() => {
    return (residentList || []).filter((r) => {
      const status = (r.status || "").toLowerCase();
      const isInactive = status === "inactive" || status === "deleted";
      return !isInactive && (r.owner || r.name || r.flat);
    });
  }, [residentList]);

  const [parentResidentId, setParentResidentId] = useState("");
  const [residentSearch, setResidentSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [flat, setFlat] = useState("");
  const [block, setBlock] = useState("");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("Spouse");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [emergencyContact, setEmergencyContact] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Anti-autofill state: inputs start readOnly so browser password managers skip them on page load
  const [emailReadOnly, setEmailReadOnly] = useState(true);
  const [pwReadOnly, setPwReadOnly] = useState(true);

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

    if (familyMember) {
      setParentResidentId(familyMember.parentResidentId || "");
      setFlat(familyMember.flat || "");
      setBlock(familyMember.block || "");
      setName(familyMember.name || "");
      setRelation(familyMember.relation || "Spouse");
      setGender(familyMember.gender || "");
      setAge(familyMember.age || "");
      setPhone(normalizeMobile(familyMember.phone || ""));
      setEmail(familyMember.email || "");
      setPassword("");
      setMustChangePassword(familyMember.mustChangePassword ?? false);
      setEmergencyContact(Boolean(familyMember.emergencyContact));
      setResidentSearch("");
    } else {
      const initialParentId = preselectedResidentId || "";
      setParentResidentId(initialParentId);
      if (initialParentId && activeResidents.length > 0) {
        const found = activeResidents.find((r) => r.id === initialParentId);
        if (found) {
          setFlat(found.flat || found.flatNumber || "");
          setBlock(found.block || "");
        }
      } else {
        setFlat("");
        setBlock("");
      }
      setName("");
      setRelation("Spouse");
      setGender("");
      setAge("");
      setPhone("");
      setEmail("");
      setPassword("");
      setMustChangePassword(true);
      setEmergencyContact(false);
      setResidentSearch("");
    }
    setShowPassword(false);
    setCopied(false);
    setSubmitting(false);
  }, [familyMember, preselectedResidentId, activeResidents]);

  // When a resident is picked from the searchable list
  function handleSelectResident(res) {
    if (!res) {
      setParentResidentId("");
      setIsDropdownOpen(false);
      return;
    }
    setParentResidentId(res.id);
    const resFlat = res.flat || res.flatNumber || "";
    const resBlock = res.block || "";
    if (resFlat) setFlat(resFlat);
    if (resBlock) setBlock(resBlock);
    setIsDropdownOpen(false);
    setResidentSearch("");
    toast.success(`Linked to ${res.owner || res.name} (Flat ${resFlat})`);
  }

  function handleClearResident() {
    setParentResidentId("");
    setResidentSearch("");
  }

  function handleGeneratePassword() {
    const randomPass = "RWA@" + Math.floor(100000 + Math.random() * 900000);
    setPwReadOnly(false);
    setPassword(randomPass);
    setShowPassword(true);
    toast.success("Generated temporary password!");
  }

  function handleCopyPassword() {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedResidentObj = useMemo(() => {
    return activeResidents.find((r) => r.id === parentResidentId);
  }, [activeResidents, parentResidentId]);

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
      toast.error("Please enter the family member's full name");
      return;
    }

    const cleanPhone = normalizeMobile(phone);
    const phoneErr = validateMobile(cleanPhone);
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }

    if (!familyMember && (!password || password.length < 6)) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (familyMember && password && password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        parentResidentId,
        parentFlat: flat.trim(),
        parentBlock: block.trim(),
        name: name.trim(),
        relation: relation.trim(),
        gender,
        age: age ? Number(age) : "",
        phone: cleanPhone,
        email: email.trim(),
        password: password || undefined,
        mustChangePassword,
        emergencyContact,
      });
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save family member");
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
      {/* SECTION 1: RESIDENT & FLAT SEARCH & SELECTION */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4.5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <FaHome className="text-emerald-600" />
            <span>Parent Resident & Flat</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
            {activeResidents.length} Registered Residents
          </span>
        </div>

        {/* If a resident is currently selected, show selected resident card */}
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
          /* Searchable Resident Combobox */
          <div className="relative" ref={dropdownRef}>
            <label className="block mb-1.5 text-xs font-medium text-gray-700">
              Search & Select Resident <span className="text-red-500">*</span>
            </label>

            <div className="relative">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
              <input
                type="text"
                placeholder="Search by resident name, flat (e.g. 101), block, or phone..."
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

            {/* Dropdown list of matching residents */}
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

        {/* Flat & Block Input Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block mb-1 text-xs font-medium text-gray-600">
              Flat / House Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 101 or B-402"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              required
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
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
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
                placeholder="e.g. Block A"
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              />
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: MEMBER PROFILE */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
          <FaUser className="text-sky-600" />
          <span>Member Information</span>
        </div>

        {/* Full Name */}
        <div>
          <label className="block mb-1.5 text-xs font-medium text-gray-700">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FaUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
            <input
              type="text"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-10 pr-3.5 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
        </div>

        {/* Relation & Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <FaHeart className="text-pink-500 text-xs" />
              <span>Relationship to Resident</span>
            </label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              {RELATIONS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-700">
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            >
              <option value="">Prefer not to say</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Age & Emergency Contact Checkbox */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label className="block mb-1.5 text-xs font-medium text-gray-700">
              Age <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="number"
              min="1"
              max="120"
              placeholder="e.g. 28"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            />
          </div>

          <div className="sm:pt-5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-xl p-3 hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-medium text-gray-700">
                Primary Emergency Contact
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 3: LOGIN & CREDENTIALS WITH 100% AUTOFILL DEFENSE */}
      <div className="bg-sky-50/50 border border-sky-200/80 rounded-2xl p-4.5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <FaShieldAlt className="text-sky-600" />
            <span>Portal Login Credentials</span>
          </div>
          <span className="text-[11px] bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded-full">
            Resident Portal Access
          </span>
        </div>

        {/* Mobile Number (Login Username) */}
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
              name="new_member_mobile_login_field"
              placeholder="10-digit mobile number"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(normalizeMobile(e.target.value))}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-mono"
              required
              autoComplete="off"
              data-form-type="other"
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            Family member logs in using this 10-digit mobile number.
          </p>
        </div>

        {/* Contact Email (Defeats browser autofill with readOnly on mount + custom name) */}
        <div>
          <label className="block mb-1.5 text-xs font-medium text-gray-700">
            Email Address <span className="text-gray-400 font-normal">(Optional for notices)</span>
          </label>
          <div className="relative">
            <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
            <input
              type="text"
              inputMode="email"
              name="f_member_contact_email_prevent_fill"
              id="f_member_contact_email_prevent_fill"
              placeholder="member@example.com (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={emailReadOnly}
              onFocus={() => setEmailReadOnly(false)}
              onMouseDown={() => setEmailReadOnly(false)}
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            />
          </div>
        </div>

        {/* Login Password (Defeats browser autofill with readOnly on mount + new-password) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-700">
              {familyMember ? "Update Password" : "Login Password"}{" "}
              {!familyMember && <span className="text-red-500">*</span>}
              {familyMember && (
                <span className="text-gray-400 font-normal"> (Leave blank to keep unchanged)</span>
              )}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-100/90 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition"
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
              name="f_member_new_secret_code_prevent_fill"
              id="f_member_new_secret_code_prevent_fill"
              placeholder={familyMember ? "New password (min 6 characters)" : "Min 6 characters"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              readOnly={pwReadOnly}
              onFocus={() => setPwReadOnly(false)}
              onMouseDown={() => setPwReadOnly(false)}
              autoComplete="new-password"
              data-form-type="other"
              data-lpignore="true"
              minLength={password ? 6 : undefined}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-mono"
              required={!familyMember}
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
            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
          />
          <span className="text-xs text-gray-700">
            Require password change on first portal login
          </span>
        </label>
      </div>

      {/* Info Notice */}
      <div className="p-3.5 bg-sky-50 border border-sky-100 rounded-xl text-xs text-sky-800 flex items-start gap-2.5">
        <FaExclamationCircle className="text-sky-500 shrink-0 mt-0.5 text-sm" />
        <div>
          <span className="font-semibold">Portal Account:</span> Family members will be able to log in with this mobile number to view bills, notices, upcoming events, and raise complaints linked to their flat.
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
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white text-sm font-semibold shadow-sm hover:shadow transition flex items-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>{familyMember ? "Update Member" : "Create Account"}</span>
          )}
        </button>
      </div>
    </form>
  );
}

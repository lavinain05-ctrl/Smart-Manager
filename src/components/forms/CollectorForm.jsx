import { useEffect, useState } from "react";
import {
  FaEye,
  FaEyeSlash,
  FaKey,
  FaCopy,
  FaCheck,
  FaBuilding,
  FaBicycle,
  FaWalking,
  FaTruck,
  FaTrashAlt,
  FaHandHoldingHeart,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useBlockFlat } from "../../context/BlockFlatContext";
import { normalizeMobile } from "../../services/authService";
import { subscribeSpecialCollections } from "../../services/specialCollectionService";

const VEHICLE_PRESETS = [
  { label: "Bike", icon: <FaBicycle className="text-xs" /> },
  { label: "E-Rickshaw", icon: <FaTruck className="text-xs" /> },
  { label: "Cart", icon: <FaTruck className="text-xs" /> },
  { label: "Walking", icon: <FaWalking className="text-xs" /> },
  { label: "Van", icon: <FaTruck className="text-xs" /> },
];

export default function CollectorForm({
  collector,
  onSave,
  onCancel,
}) {
  const { blocks } = useBlockFlat();
  const activeBlocks = (blocks || []).filter((b) => b.status === "active" || !b.status);

  const emptyForm = {
    name: "",
    mobile: "",
    area: "",
    vehicle: "",
    status: "Active",
    email: "",
    password: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Collection Powers & Campaign Assignment State
  const [specialCampaigns, setSpecialCampaigns] = useState([]);
  const [assignedModules, setAssignedModules] = useState(["garbage"]);
  const [assignedCampaignScope, setAssignedCampaignScope] = useState("all");
  const [assignedCampaigns, setAssignedCampaigns] = useState([]);

  useEffect(() => {
    const unsub = subscribeSpecialCollections((list) => {
      setSpecialCampaigns(list.filter((c) => c.status === "active"));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (collector) {
      setForm({
        name: collector.name || "",
        mobile: normalizeMobile(collector.mobile || ""),
        area: collector.area || "",
        vehicle: collector.vehicle || "",
        status: collector.status || "Active",
        email: collector.email || "",
        password: "",
      });
      setMustChangePassword(collector.mustChangePassword ?? false);
      const modules =
        Array.isArray(collector.assignedModules) && collector.assignedModules.length > 0
          ? collector.assignedModules
          : ["garbage"];
      setAssignedModules(modules);
      const campaigns = Array.isArray(collector.assignedCampaigns)
        ? collector.assignedCampaigns
        : [];
      setAssignedCampaigns(campaigns);
      setAssignedCampaignScope(campaigns.length > 0 ? "specific" : "all");
    } else {
      setForm(emptyForm);
      setMustChangePassword(true);
      setAssignedModules(["garbage"]);
      setAssignedCampaigns([]);
      setAssignedCampaignScope("all");
    }
    setShowPassword(false);
    setCopied(false);
    setSubmitting(false);
  }, [collector]);

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === "mobile") {
      setForm((prev) => ({
        ...prev,
        mobile: normalizeMobile(value),
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleToggleBlockArea(blockName) {
    const currentAreas = (form.area || "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    let updated;
    if (currentAreas.includes(blockName)) {
      updated = currentAreas.filter((a) => a !== blockName);
    } else {
      updated = [...currentAreas, blockName];
    }
    setForm((prev) => ({
      ...prev,
      area: updated.join(", "),
    }));
  }

  function handleSetAllBlocks() {
    if (activeBlocks.length === 0) return;
    const names = activeBlocks.map((b) => b.name).join(", ");
    setForm((prev) => ({ ...prev, area: names }));
  }

  function handleGeneratePassword() {
    const randomPass = "RWA@" + Math.floor(100000 + Math.random() * 900000);
    setForm((prev) => ({ ...prev, password: randomPass }));
    setShowPassword(true);
    toast.success("Generated temporary password!");
  }

  function handleCopyPassword() {
    if (!form.password) return;
    navigator.clipboard.writeText(form.password);
    setCopied(true);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (submitting) return;
    setSubmitting(true);

    try {
      const cleanMobile = normalizeMobile(form.mobile);

      if (cleanMobile.length !== 10) {
        toast.error("Mobile number must be exactly 10 digits.");
        setSubmitting(false);
        return;
      }

      if (!collector && (!form.password || form.password.length < 6)) {
        toast.error("Password must be at least 6 characters.");
        setSubmitting(false);
        return;
      }

      if (assignedModules.length === 0) {
        toast.error("Please assign at least one collection power (Garbage or Special Collections).");
        setSubmitting(false);
        return;
      }

      if (
        assignedModules.includes("special_collections") &&
        assignedCampaignScope === "specific" &&
        assignedCampaigns.length === 0
      ) {
        toast.error("Please select at least one campaign or choose 'All Active Campaigns'.");
        setSubmitting(false);
        return;
      }

      const finalCampaigns =
        assignedModules.includes("special_collections") && assignedCampaignScope === "specific"
          ? assignedCampaigns
          : [];

      const payload = collector
        ? {
            name: form.name.trim(),
            mobile: cleanMobile,
            area: form.area.trim(),
            vehicle: form.vehicle.trim(),
            status: form.status,
            email: (form.email || "").trim(),
            mustChangePassword,
            assignedModules,
            assignedCampaigns: finalCampaigns,
            ...(form.password ? { password: form.password } : {}),
          }
        : {
            name: form.name.trim(),
            mobile: cleanMobile,
            area: form.area.trim(),
            vehicle: form.vehicle.trim(),
            status: form.status || "Active",
            email: (form.email || "").trim(),
            password: form.password,
            mustChangePassword,
            assignedModules,
            assignedCampaigns: finalCampaigns,
          };

      const success = await onSave(payload);

      if (success === false) {
        setSubmitting(false);
        return;
      }

      if (!collector) {
        setForm(emptyForm);
      }

      if (onCancel) {
        onCancel();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">

      {/* Hidden fields to prevent browser autofill from injecting admin credentials */}
      <input type="text" name="prevent_autofill" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
      <input type="password" name="prevent_autofill_pw" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

      {/* Collector Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Collector Name <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          placeholder="e.g. Ramesh Kumar"
          value={form.name}
          onChange={handleChange}
          className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          required
          disabled={submitting}
          autoComplete="off"
        />
      </div>

      {/* Mobile Number */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Mobile Number (Used for Login) <span className="text-red-500">*</span>
        </label>
        <input
          name="mobile"
          id="collector-mobile"
          placeholder="10-digit mobile number"
          value={form.mobile}
          onChange={handleChange}
          className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
          required
          disabled={submitting}
          maxLength={10}
          autoComplete="off"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          Collector logs in at <span className="font-semibold text-emerald-700">/login</span> using this mobile number
        </p>
      </div>

      {/* Assigned Area (with block chips) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold text-gray-700">
            Assigned Area <span className="text-red-500">*</span>
          </label>
          {activeBlocks.length > 0 && (
            <button
              type="button"
              onClick={handleSetAllBlocks}
              className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold"
            >
              + All Blocks
            </button>
          )}
        </div>

        {/* Quick select block pills */}
        {activeBlocks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {activeBlocks.map((b) => {
              const isSelected = (form.area || "")
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .includes(b.name.toLowerCase());
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleToggleBlockArea(b.name)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  <FaBuilding className="text-[10px]" />
                  {b.name}
                  {isSelected && <FaCheck className="text-[9px]" />}
                </button>
              );
            })}
          </div>
        )}

        <input
          name="area"
          placeholder="e.g. 90 metre, Block A, Common Area"
          value={form.area}
          onChange={handleChange}
          className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          required
          disabled={submitting}
        />
      </div>

      {/* Vehicle Details (with presets) */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Vehicle Details <span className="text-red-500">*</span>
        </label>

        {/* Quick vehicle chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {VEHICLE_PRESETS.map((v) => {
            const isSelected = (form.vehicle || "").toLowerCase() === v.label.toLowerCase();
            return (
              <button
                key={v.label}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, vehicle: v.label }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {v.icon}
                {v.label}
              </button>
            );
          })}
        </div>

        <input
          name="vehicle"
          placeholder="Vehicle (e.g. Bike / Cart / Walking / Van)"
          value={form.vehicle}
          onChange={handleChange}
          className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          required
          disabled={submitting}
        />
      </div>

      {/* Contact Email */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Contact Email <span className="font-normal text-gray-400">(Optional)</span>
        </label>
        <input
          type="email"
          name="email"
          id="collector-contact-email"
          placeholder="Contact email (optional)"
          value={form.email}
          onChange={handleChange}
          className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          disabled={submitting}
          autoComplete="off"
        />
      </div>

      {/* Login Password Section */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-amber-900">
            {collector ? "New Password (optional)" : "Login Password"} {!collector && <span className="text-red-500">*</span>}
          </label>
          <button
            type="button"
            onClick={handleGeneratePassword}
            className="text-xs text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 bg-amber-100/80 px-2 py-1 rounded-md hover:bg-amber-200 transition"
          >
            <FaKey className="text-[10px]" /> Auto-Generate
          </button>
        </div>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            id="collector-login-password"
            placeholder={collector ? "Leave blank to keep current password" : "Min 6 characters (or click Auto-Generate)"}
            value={form.password}
            onChange={handleChange}
            minLength={form.password ? 6 : undefined}
            className="w-full border bg-white rounded-xl p-3 pr-20 text-sm focus:ring-2 focus:ring-amber-500 outline-none font-mono"
            required={!collector}
            disabled={submitting}
            autoComplete="new-password"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {form.password && (
              <button
                type="button"
                onClick={handleCopyPassword}
                title="Copy password"
                className="text-gray-500 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                {copied ? <FaCheck className="text-green-600 text-xs" /> : <FaCopy className="text-xs" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-500 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100 transition"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <FaEyeSlash className="text-xs" /> : <FaEye className="text-xs" />}
            </button>
          </div>
        </div>

        {/* Require Password Change Flag */}
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={mustChangePassword}
            onChange={(e) => setMustChangePassword(e.target.checked)}
            className="w-4 h-4 text-amber-600 rounded cursor-pointer"
          />
          <span className="text-xs text-amber-900 font-medium select-none">
            Prompt collector to change password upon first login
          </span>
        </label>
      </div>

      {/* ─── Assigned Collection Powers ─── */}
      <div className="bg-gradient-to-br from-gray-50 to-emerald-50/40 p-4 rounded-2xl border border-gray-200 space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider">
            Assigned Collection Powers
          </label>
          <p className="text-xs text-gray-500 mt-0.5">
            Select the collection modules this staff member is authorized to collect on their portal.
          </p>
        </div>

        {/* Powers Checkboxes */}
        <div className="grid grid-cols-1 gap-2.5">
          {/* Garbage Collection Option */}
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
              assignedModules.includes("garbage")
                ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="checkbox"
              checked={assignedModules.includes("garbage")}
              onChange={(e) => {
                if (e.target.checked) {
                  setAssignedModules((prev) => [...prev, "garbage"]);
                } else {
                  setAssignedModules((prev) => prev.filter((m) => m !== "garbage"));
                }
              }}
              className="mt-0.5 w-4 h-4 text-emerald-600 rounded cursor-pointer"
            />
            <div>
              <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                <FaTrashAlt className="text-emerald-600 text-xs" /> Garbage Collection (Monthly Billing)
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Collect monthly waste charges from assigned society block flats.
              </p>
            </div>
          </label>

          {/* Special Collections Option */}
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
              assignedModules.includes("special_collections")
                ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <input
              type="checkbox"
              checked={assignedModules.includes("special_collections")}
              onChange={(e) => {
                if (e.target.checked) {
                  setAssignedModules((prev) => [...prev, "special_collections"]);
                } else {
                  setAssignedModules((prev) => prev.filter((m) => m !== "special_collections"));
                }
              }}
              className="mt-0.5 w-4 h-4 text-indigo-600 rounded cursor-pointer"
            />
            <div>
              <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                <FaHandHoldingHeart className="text-indigo-600 text-xs" /> Special Collections & Contributions
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Collect festival celebrations, community funds, events, and special drives.
              </p>
            </div>
          </label>
        </div>

        {/* Special Collections Campaign Targeting */}
        {assignedModules.includes("special_collections") && (
          <div className="mt-3 p-3 bg-white rounded-xl border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950">Campaign Access Scope:</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-indigo-50/50">
                <input
                  type="radio"
                  name="campaign_scope"
                  checked={assignedCampaignScope === "all"}
                  onChange={() => {
                    setAssignedCampaignScope("all");
                    setAssignedCampaigns([]);
                  }}
                  className="w-3.5 h-3.5 text-indigo-600 cursor-pointer"
                />
                <span className="font-semibold text-gray-800">All Active Campaigns</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-indigo-50/50">
                <input
                  type="radio"
                  name="campaign_scope"
                  checked={assignedCampaignScope === "specific"}
                  onChange={() => setAssignedCampaignScope("specific")}
                  className="w-3.5 h-3.5 text-indigo-600 cursor-pointer"
                />
                <span className="font-semibold text-gray-800">Specific Campaigns Only</span>
              </label>
            </div>

            {/* Campaign Checklist if specific */}
            {assignedCampaignScope === "specific" && (
              <div className="space-y-2 pt-2 border-t border-indigo-100">
                <span className="text-[11px] font-semibold text-gray-600 block">
                  Select Campaigns Authorized for this Collector:
                </span>
                {specialCampaigns.length === 0 ? (
                  <p className="text-xs text-amber-600 italic">
                    No active special collections right now. Once created in Special Collections, you can assign them here.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {specialCampaigns.map((col) => {
                      const isChecked = assignedCampaigns.includes(col.id);
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                            isChecked
                              ? "bg-indigo-50/70 border-indigo-300 font-medium text-indigo-950"
                              : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignedCampaigns((prev) => [...prev, col.id]);
                                } else {
                                  setAssignedCampaigns((prev) => prev.filter((id) => id !== col.id));
                                }
                              }}
                              className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer"
                            />
                            <span className="truncate">{col.name}</span>
                          </div>
                          <span className="text-[10px] text-gray-500 shrink-0 ml-2 font-mono">
                            {col.collectionType}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {collector && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Account Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            disabled={submitting}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-bold shadow transition text-sm"
        >
          {submitting
            ? "Saving..."
            : collector
            ? "Update Collector"
            : "Save Collector"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition text-sm"
          >
            Cancel
          </button>
        )}
      </div>

    </form>
  );
}
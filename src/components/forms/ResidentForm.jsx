import { useEffect, useState } from "react";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { normalizeMobile } from "../../services/authService";

export default function ResidentForm({
  resident,
  onSave,
  onClose,
  defaultCharge,
  hidePortalFields,
}) {
  const { blocks } = useBlockFlat();

  // Only show active blocks in the dropdown
  const activeBlocks = blocks.filter((b) => b.status === "active" || !b.status);

  const [form, setForm] = useState({
    flat: "",
    owner: "",
    mobile: "",
    block: "",
    blockId: "",
    floor: "",
    charge: "",
    email: "",
    password: "",
    familyMembers: "",
    remarks: "",
  });

  const [enablePortalLogin, setEnablePortalLogin] = useState(false);
  const [portalMobile, setPortalMobile] = useState("");
  const [portalMobileCustom, setPortalMobileCustom] = useState(false);
  const [garbageEnrolled, setGarbageEnrolled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (resident) {
      const resMobile = normalizeMobile(resident.mobile || "");
      setForm({
        flat: resident.flat || "",
        owner: resident.owner || "",
        mobile: resMobile,
        block: resident.block || "",
        blockId: resident.blockId || "",
        floor: resident.floor || "",
        charge: resident.charge || "",
        email: resident.email || "",
        password: "",
        familyMembers: resident.familyMembers || "",
        remarks: resident.remarks || "",
      });
      setPortalMobile(resMobile);
      setPortalMobileCustom(false);
      // If resident already has portal account, indicate it
      setEnablePortalLogin(Boolean(resident.hasPortalAccess || resident.email));
      setGarbageEnrolled(resident.garbageStatus ? resident.garbageStatus === "participating" : true);
    } else {
      setForm({
        flat: "",
        owner: "",
        mobile: "",
        block: "",
        blockId: "",
        floor: "",
        charge: defaultCharge || "",
        email: "",
        password: "",
        familyMembers: "",
        remarks: "",
      });
      setPortalMobile("");
      setPortalMobileCustom(false);
      setEnablePortalLogin(false);
      setGarbageEnrolled(true);
    }
    setSubmitting(false);
  }, [resident, defaultCharge]);

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === "mobile") {
      const cleaned = normalizeMobile(value);
      setForm((prev) => ({ ...prev, mobile: cleaned }));
      if (!portalMobileCustom) {
        setPortalMobile(cleaned);
      }
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleBlockChange(e) {
    const selectedId = e.target.value;
    const selectedBlock = activeBlocks.find((b) => b.id === selectedId);
    setForm((prev) => ({
      ...prev,
      blockId: selectedId,
      block: selectedBlock?.name || "",
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (submitting) return;
    setSubmitting(true);

    try {
      const cleanMainMobile = normalizeMobile(form.mobile);
      const cleanPortalMobile = normalizeMobile(portalMobile || form.mobile);

      const payload = {
        ...form,
        mobile: cleanMainMobile,
        enablePortalLogin,
        portalMobile: cleanPortalMobile,
        garbageStatus: garbageEnrolled ? "participating" : "not_participating",
      };

      const success = await onSave(payload);

      if (success === false) {
        setSubmitting(false);
        return;
      }

      if (!resident) {
        setForm({
          flat: "",
          owner: "",
          mobile: "",
          block: "",
          blockId: "",
          floor: "",
          charge: defaultCharge || "",
          email: "",
          password: "",
          familyMembers: "",
          remarks: "",
        });
        setPortalMobile("");
        setPortalMobileCustom(false);
        setEnablePortalLogin(false);
      }

      if (onClose) {
        onClose();
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

      <input
        name="flat"
        value={form.flat}
        onChange={handleChange}
        placeholder="Flat Number (e.g. B-201, A101, 571)"
        className="w-full border rounded-xl p-3"
        required
        disabled={submitting}
      />

      <input
        name="owner"
        value={form.owner}
        onChange={handleChange}
        placeholder="Owner Name"
        className="w-full border rounded-xl p-3"
        required
        disabled={submitting}
      />

      <div>
        <input
          name="mobile"
          value={form.mobile}
          onChange={handleChange}
          placeholder="Mobile Number (10 digits)"
          className="w-full border rounded-xl p-3"
          required
          disabled={submitting}
          maxLength={10}
          autoComplete="off"
        />
        <p className="text-xs text-gray-400 mt-1">Main society contact number</p>
      </div>

      {/* Block selection or text input if no blocks configured */}
      <div>
        {activeBlocks.length > 0 ? (
          <select
            value={form.blockId}
            onChange={handleBlockChange}
            className="w-full border rounded-xl p-3"
            disabled={submitting}
            required
          >
            <option value="">Select Block</option>
            {activeBlocks.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : (
          <input
            name="block"
            value={form.block}
            onChange={handleChange}
            placeholder="Block (e.g. Block A, Wing B)"
            className="w-full border rounded-xl p-3"
            disabled={submitting}
            required
          />
        )}
      </div>

      <input
        name="floor"
        value={form.floor}
        onChange={handleChange}
        placeholder="Floor"
        className="w-full border rounded-xl p-3"
        disabled={submitting}
      />

      <input
        name="charge"
        type="number"
        value={form.charge}
        onChange={handleChange}
        placeholder="Monthly Charge (₹)"
        className="w-full border rounded-xl p-3 font-mono font-bold"
        disabled={submitting}
      />

      {/* Garbage Collection Enrollment */}
      <div className="flex items-center gap-3 p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/80">
        <input
          type="checkbox"
          id="garbageEnrolled"
          checked={garbageEnrolled}
          onChange={(e) => setGarbageEnrolled(e.target.checked)}
          className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
        />
        <label htmlFor="garbageEnrolled" className="text-xs font-bold text-emerald-950 cursor-pointer select-none">
          Enroll in Door-to-Door Garbage Collection (Participating)
        </label>
      </div>

      <input
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        placeholder="Email Address (optional, for notifications)"
        className="w-full border rounded-xl p-3"
        disabled={submitting}
        autoComplete="off"
      />

      <input
        name="familyMembers"
        value={form.familyMembers}
        onChange={handleChange}
        placeholder="Family Members (optional)"
        className="w-full border rounded-xl p-3"
        disabled={submitting}
      />

      <textarea
        name="remarks"
        value={form.remarks}
        onChange={handleChange}
        placeholder="Remarks (optional)"
        rows={2}
        className="w-full border rounded-xl p-3 resize-none"
        disabled={submitting}
      />

      {/* Portal Login Section */}
      {!hidePortalFields && (
        <div className="border-t pt-4 mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enable-portal-login"
              checked={enablePortalLogin}
              onChange={(e) => setEnablePortalLogin(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
            />
            <label htmlFor="enable-portal-login" className="text-sm font-bold text-gray-700 cursor-pointer">
              Enable Resident Portal Login
            </label>
          </div>

          {enablePortalLogin && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Portal Login Mobile Number
                </label>
                <input
                  type="tel"
                  name="portalMobile"
                  id="resident-portal-mobile"
                  value={portalMobile}
                  onChange={(e) => {
                    setPortalMobileCustom(true);
                    setPortalMobile(normalizeMobile(e.target.value));
                  }}
                  placeholder="Portal Mobile Number (10 digits)"
                  className="w-full border bg-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  disabled={submitting}
                  maxLength={10}
                  autoComplete="off"
                  required={enablePortalLogin}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Resident logs in using: <span className="font-semibold text-emerald-700">{portalMobile || form.mobile || "Enter mobile number above"}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Portal Password {resident && <span className="font-normal text-gray-400">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  id="resident-portal-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={resident ? "New Portal Password (min 6 chars, optional)" : "Portal Password (min 6 chars)"}
                  className="w-full border bg-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  disabled={submitting}
                  minLength={form.password ? 6 : undefined}
                  required={!resident && enablePortalLogin}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Access Origin / Provenance Details (when viewing / editing an existing resident) */}
      {resident && (resident.accessProvenance || resident.createdBy) && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>🛡️</span> Access Provenance & Origin
            </span>
            <span className="px-2 py-0.5 rounded-full font-semibold bg-slate-200 text-slate-700 text-[10px]">
              {resident.accessProvenance?.channel === "registration_approval"
                ? "Self-Registration Approved"
                : resident.accessProvenance?.channel === "committee_portal"
                ? "Committee Created"
                : resident.accessProvenance?.channel === "collector_creation"
                ? "Collector Onboarded"
                : resident.createdBy === "Collector"
                ? "Collector Entry"
                : "Admin Created"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px]">Granted / Created By</span>
              <span className="font-semibold text-slate-800">
                {resident.accessProvenance?.grantedByName || resident.createdByName || "Administrator"}
                {resident.accessProvenance?.grantedByDesignation && (
                  <span className="text-slate-500 font-normal"> ({resident.accessProvenance.grantedByDesignation})</span>
                )}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px]">Authorized Role</span>
              <span className="font-semibold text-slate-800 capitalize">
                {resident.accessProvenance?.grantedByRole || (resident.createdBy === "Collector" ? "Collector" : "Admin")}
              </span>
            </div>

            {(resident.accessProvenance?.grantedAt || resident.approvedAt || resident.registeredAt) && (
              <div className="col-span-2">
                <span className="text-slate-400 block text-[10px]">Access Timestamp</span>
                <span className="font-medium text-slate-700">
                  {new Date(
                    resident.accessProvenance?.grantedAt || resident.approvedAt || resident.registeredAt
                  ).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold shadow transition"
      >
        {submitting
          ? "Saving..."
          : resident
          ? "Update Resident"
          : "Save Resident"}
      </button>

    </form>
  );
}
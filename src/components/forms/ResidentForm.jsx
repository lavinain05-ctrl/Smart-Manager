import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { normalizeMobile, validateMobile } from "../../services/authService";
import {
  normalizePlotNumber,
  normalizeFloor,
  normalizeUnitNumber,
  generatePropertyId,
  generateFlatId,
  cleanUnitNumber,
  AVAILABLE_FLOORS,
  formatResidentFloor,
} from "../../services/propertyService";
import {
  FaMoneyBillWave,
  FaCheckCircle,
  FaClock,
  FaReceipt,
  FaCalendarAlt,
} from "react-icons/fa";
import {
  getAvailableBillingMonths,
  getAvailableBillingYears,
} from "../../utils/billingCycle";

export default function ResidentForm({
  resident,
  onSave,
  onClose,
  defaultCharge,
  hidePortalFields,
  showCollectionPaymentFields = false,
  defaultMonth = "",
  defaultYear = "",
}) {
  const { blocks } = useBlockFlat();

  // Only show active blocks in the dropdown
  const activeBlocks = blocks.filter((b) => b.status === "active" || !b.status);

  const [form, setForm] = useState({
    flat: "",
    plotNumber: "",
    floor: "Ground Floor",
    unitNumber: "",
    personType: "OWNER",
    propertyId: "",
    owner: "",
    mobile: "",
    block: "",
    blockId: "",
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

  // Initial Payment & Billing State (for Collector / Committee Onboarding)
  const now = new Date();
  const currentMonthName = now.toLocaleString("default", { month: "long" });
  const currentYearNum = now.getFullYear();

  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [billingMonth, setBillingMonth] = useState(defaultMonth || currentMonthName);
  const [billingYear, setBillingYear] = useState(Number(defaultYear) || currentYearNum);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentAmount, setPaymentAmount] = useState(defaultCharge || "80");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");

  const availableMonths = getAvailableBillingMonths(billingYear);
  const availableYears = getAvailableBillingYears();

  useEffect(() => {
    if (defaultMonth) setBillingMonth(defaultMonth);
    if (defaultYear) setBillingYear(Number(defaultYear));
  }, [defaultMonth, defaultYear]);

  useEffect(() => {
    if (form.charge) {
      setPaymentAmount(String(form.charge));
    } else if (defaultCharge) {
      setPaymentAmount(String(defaultCharge));
    }
  }, [form.charge, defaultCharge]);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(billingMonth)) {
      setBillingMonth(availableMonths[0]);
    }
  }, [billingYear, availableMonths, billingMonth]);

  useEffect(() => {
    if (resident) {
      const resMobile = normalizeMobile(resident.mobile || "");
      const rawFlat = resident.flat || resident.flatNumber || "";
      const rawUnit = resident.unitNumber || "";
      const resolvedPlot = resident.plotNumber || (rawUnit && rawFlat.endsWith(`-${rawUnit}`) ? rawFlat.slice(0, -(rawUnit.length + 1)) : rawFlat) || "";
      setForm({
        flat: rawFlat,
        plotNumber: resolvedPlot,
        floor: formatResidentFloor(resident.floor) || "Ground Floor",
        unitNumber: rawUnit,
        personType: resident.personType || "OWNER",
        propertyId: resident.propertyId || "",
        owner: resident.owner || "",
        mobile: resMobile,
        block: resident.block || "",
        blockId: resident.blockId || "",
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
        plotNumber: "",
        floor: "Ground Floor",
        unitNumber: "",
        personType: "OWNER",
        propertyId: "",
        owner: "",
        mobile: "",
        block: "",
        blockId: "",
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
      const mobErr = validateMobile(cleanMainMobile);
      if (mobErr) {
        toast.error(mobErr);
        setSubmitting(false);
        return;
      }

      const cleanPortalMobile = normalizeMobile(portalMobile || form.mobile);
      if (enablePortalLogin) {
        const portalMobErr = validateMobile(cleanPortalMobile);
        if (portalMobErr) {
          toast.error("Portal login: " + portalMobErr);
          setSubmitting(false);
          return;
        }
        if (!resident && (!form.password || form.password.length < 6)) {
          toast.error("Portal password must be at least 6 characters.");
          setSubmitting(false);
          return;
        }
      }

      const resolvedPlot = (form.plotNumber || form.flat || "").trim();
      const floorObj = normalizeFloor(form.floor);
      const normUnit = cleanUnitNumber(form.unitNumber || "", resolvedPlot);
      const displayFlat = generateFlatId({
        plotNumber: resolvedPlot,
        floor: floorObj.label,
        unitNumber: normUnit,
      });
      const canonicalPropertyId = form.propertyId || (form.blockId && resolvedPlot ? generatePropertyId({
        blockId: form.blockId,
        plotNumber: resolvedPlot,
        floor: floorObj.code,
        unitNumber: normUnit,
      }) : "");

      const payload = {
        ...form,
        plotNumber: resolvedPlot,
        floor: floorObj.label,
        floorCode: floorObj.code,
        unitNumber: normUnit,
        personType: (form.personType || "OWNER").toUpperCase(),
        flat: displayFlat,
        flatNumber: displayFlat,
        propertyId: canonicalPropertyId,
        charge: garbageEnrolled ? (Number(form.charge) || 0) : 0,
        mobile: cleanMainMobile,
        enablePortalLogin,
        portalMobile: cleanPortalMobile,
        garbageStatus: garbageEnrolled ? "participating" : "not_participating",
        paymentStatus: (showCollectionPaymentFields && !resident && garbageEnrolled) ? paymentStatus : null,
        billingMonth: (showCollectionPaymentFields && !resident && garbageEnrolled) ? billingMonth : null,
        billingYear: (showCollectionPaymentFields && !resident && garbageEnrolled) ? Number(billingYear) : null,
        paymentMethod: (showCollectionPaymentFields && !resident && garbageEnrolled) ? paymentMethod : "Cash",
        paymentAmount: (showCollectionPaymentFields && !resident && garbageEnrolled) ? (Number(paymentAmount) || Number(form.charge) || 80) : 0,
        paymentReference: (showCollectionPaymentFields && !resident && garbageEnrolled) ? paymentReference.trim() : "",
        paymentRemarks: (showCollectionPaymentFields && !resident && garbageEnrolled) ? paymentRemarks.trim() : "",
      };

      const success = await onSave(payload);

      if (success === false) {
        setSubmitting(false);
        return;
      }

      if (!resident) {
        setForm({
          flat: "",
          plotNumber: "",
          floor: "Ground Floor",
          unitNumber: "",
          personType: "OWNER",
          propertyId: "",
          owner: "",
          mobile: "",
          block: "",
          blockId: "",
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

      {/* Block Selection */}
      <div>
        <label className="block mb-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Block <span className="text-red-500">*</span>
        </label>
        {activeBlocks.length > 0 ? (
          <select
            value={form.blockId}
            onChange={handleBlockChange}
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
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
            placeholder="Block (e.g. 90 METRE, Block A)"
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            disabled={submitting}
            required
          />
        )}
      </div>

      {/* Plot Number & Floor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block mb-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Plot Number <span className="text-red-500">*</span>
          </label>
          <input
            name="plotNumber"
            value={form.plotNumber}
            onChange={(e) => {
              handleChange(e);
              setForm((prev) => ({ ...prev, flat: e.target.value }));
            }}
            placeholder="e.g. 12, D-572"
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            required
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block mb-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Floor <span className="text-red-500">*</span>
          </label>
          <select
            name="floor"
            value={form.floor}
            onChange={handleChange}
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
            disabled={submitting}
            required
          >
            {AVAILABLE_FLOORS.map((fl) => (
              <option key={fl} value={fl}>
                {fl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Unit Number & Occupancy Person Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block mb-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Flat Number <span className="text-gray-400 font-normal lowercase">(optional)</span>
          </label>
          <input
            name="unitNumber"
            value={form.unitNumber}
            onChange={handleChange}
            placeholder="e.g. 1, 2, A (optional)"
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block mb-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Person Type <span className="text-red-500">*</span>
          </label>
          <select
            name="personType"
            value={form.personType === "TENANT" ? "RENTED" : form.personType}
            onChange={handleChange}
            className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-emerald-800 bg-emerald-50/50"
            disabled={submitting}
            required
          >
            <option value="OWNER">Property Owner</option>
            <option value="RENTED">Rented</option>
          </select>
        </div>
      </div>

      {/* Live Canonical Property Identity Badge */}
      {form.plotNumber && (
        <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
          <span>
            <strong>Property:</strong> {form.block ? `Block ${form.block}` : "Block"}, Plot {form.plotNumber}, {form.floor}, {form.unitNumber ? `Flat ${form.unitNumber}` : "Single Property"}
          </span>
          <span className="font-bold uppercase text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded">
            {form.personType === "TENANT" ? "RENTED" : form.personType}
          </span>
        </div>
      )}

      {/* Resident Full Name */}
      <div>
        <label className="block mb-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Resident Name <span className="text-red-500">*</span>
        </label>
        <input
          name="owner"
          value={form.owner}
          onChange={handleChange}
          placeholder="Full Name"
          className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
          required
          disabled={submitting}
        />
      </div>

      {/* Mobile Number */}
      <div>
        <label className="block mb-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
          Mobile Number <span className="text-red-500">*</span>
        </label>
        <input
          name="mobile"
          value={form.mobile}
          onChange={handleChange}
          placeholder="10-digit Mobile Number"
          className="w-full border rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
          required
          disabled={submitting}
          maxLength={10}
          autoComplete="off"
        />
        <p className="text-xs text-gray-400 mt-1">Main society contact number</p>
      </div>

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
          onChange={(e) => {
            const checked = e.target.checked;
            setGarbageEnrolled(checked);
            if (!checked) {
              setForm((prev) => ({ ...prev, charge: 0 }));
            } else if (!form.charge || Number(form.charge) === 0) {
              setForm((prev) => ({ ...prev, charge: defaultCharge || 80 }));
            }
          }}
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

      {/* Initial Payment & Billing Status Section (Shown on Collector / Committee Onboarding) */}
      {showCollectionPaymentFields && !resident && garbageEnrolled && (
        <div className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/60 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-emerald-200/70 pb-3">
            <div className="flex items-center gap-2.5 text-emerald-900">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs">
                <FaMoneyBillWave />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Payment & Billing Status</h4>
                <p className="text-[11px] text-gray-500">Record immediate collection or mark as pending for this billing month</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Collector Option
            </span>
          </div>

          {/* Payment Status Choice (Paid vs Pending) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Payment Status <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentStatus("Paid")}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border-2 text-xs font-bold transition cursor-pointer active:scale-95 ${
                  paymentStatus === "Paid"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <FaCheckCircle className={paymentStatus === "Paid" ? "text-white" : "text-emerald-600 text-sm"} />
                <span>Paid (Issue Receipt)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatus("Pending")}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border-2 text-xs font-bold transition cursor-pointer active:scale-95 ${
                  paymentStatus === "Pending"
                    ? "bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/20"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                <FaClock className={paymentStatus === "Pending" ? "text-white" : "text-amber-500 text-sm"} />
                <span>Pending (Unpaid)</span>
              </button>
            </div>
          </div>

          {/* Month and Year Selection */}
          <div className="grid grid-cols-2 gap-2.5 bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <FaCalendarAlt className="text-emerald-600 text-[11px]" /> Billing Month
              </label>
              <select
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                className="w-full border bg-emerald-50/30 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                disabled={submitting}
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Billing Year
              </label>
              <select
                value={billingYear}
                onChange={(e) => setBillingYear(Number(e.target.value))}
                className="w-full border bg-emerald-50/30 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                disabled={submitting}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fields when "Paid" is selected */}
          {paymentStatus === "Paid" && (
            <div className="bg-white border border-emerald-200 rounded-xl p-3.5 space-y-3 shadow-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("Cash")}
                      className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        paymentMethod === "Cash"
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("UPI")}
                      className={`py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        paymentMethod === "UPI"
                          ? "bg-white text-emerald-700 shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      UPI
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Amount Collected (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="e.g. 80"
                    className="w-full border bg-white rounded-xl p-2 text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                    disabled={submitting}
                    required
                  />
                </div>
              </div>

              {paymentMethod === "UPI" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    UPI Reference / UTR Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. UPI/429812345678"
                    className="w-full border bg-white rounded-xl p-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                    disabled={submitting}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Collection Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="e.g. Collected at door upon adding resident"
                  className="w-full border bg-white rounded-xl p-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  disabled={submitting}
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
                <FaReceipt className="text-emerald-600 text-sm shrink-0" />
                <span>
                  Official receipt will be generated and opened immediately for <strong>Thermal Print (58mm)</strong>, <strong>PDF</strong>, and <strong>WhatsApp Share</strong>.
                </span>
              </div>
            </div>
          )}

          {/* Info card when "Pending" is selected */}
          {paymentStatus === "Pending" && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/90 text-xs text-amber-900 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <FaClock className="text-amber-600" /> Bill marked as Pending
                </span>
                <span className="font-black text-amber-800 text-sm">
                  ₹{Number(paymentAmount) || Number(form.charge) || 80}
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                A bill of ₹{Number(paymentAmount) || Number(form.charge) || 80} will be created as <strong>Pending</strong> for <strong>{billingMonth} {billingYear}</strong>. The resident will immediately appear in your Pending Collection list across all portals.
              </p>
            </div>
          )}
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
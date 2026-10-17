import { useState } from "react";
import {
  FaExclamationTriangle,
  FaUser,
  FaHome,
  FaBuilding,
  FaPhone,
  FaEnvelope,
  FaTimes,
  FaCheckCircle,
  FaTimesCircle,
  FaExternalLinkAlt,
  FaInfoCircle,
  FaPhoneAlt,
  FaAmbulance,
  FaBriefcase,
  FaVenusMars,
  FaCalendarAlt,
  FaKey,
  FaLeaf,
  FaShieldAlt,
  FaCopy,
  FaCheck,
  FaExchangeAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";
import { formatResidentFloor } from "../../services/propertyService";

export default function DuplicateConflictModal({
  isOpen,
  onClose,
  request,
  conflicts = [],
  onViewResidentProfile,
  onApprove,
  onReject,
}) {
  const [selectedConflictIndex, setSelectedConflictIndex] = useState(0);
  const [copiedField, setCopiedField] = useState("");

  if (!isOpen || !request || !conflicts || conflicts.length === 0) return null;

  const currentConflict = conflicts[selectedConflictIndex] || conflicts[0];
  const matchedResident = currentConflict?.matchedResident || {};
  const applicant = request;

  function handleCopy(text, fieldName) {
    if (!text || text === "—") return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(""), 2000);
  }

  const isCritical = conflicts.some((c) => c.severity === "critical");
  const isTenant =
    (applicant.personType || "").toUpperCase() === "TENANT" ||
    (applicant.personType || "").toUpperCase() === "RENTED";

  const matchedIsTenant =
    (matchedResident.personType || "").toUpperCase() === "TENANT" ||
    (matchedResident.personType || "").toUpperCase() === "RENTED";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* ── MODAL HEADER ── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-5 sm:p-6 shrink-0 relative border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 shadow-inner ${
                  isCritical
                    ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                    : "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                }`}
              >
                <FaExclamationTriangle />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    Duplicate Identity & Property Conflict Inspector
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${
                      isCritical
                        ? "bg-rose-500/30 text-rose-200 border-rose-400/40"
                        : "bg-amber-500/30 text-amber-200 border-amber-400/40"
                    }`}
                  >
                    <FaShieldAlt className="text-[10px]" />
                    {isCritical ? "Critical Conflict" : "Review Notice"}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-slate-300 border border-white/20">
                    {conflicts.length} {conflicts.length === 1 ? "Collision Detected" : "Collisions Detected"}
                  </span>
                </div>
                <p className="text-slate-300 text-xs sm:text-sm mt-1">
                  Comparing incoming applicant <strong className="text-white">{applicant.name}</strong> against active society records
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition text-lg cursor-pointer shrink-0"
              title="Close modal"
            >
              <FaTimes />
            </button>
          </div>

          {/* Conflict Switcher Tabs (if multiple conflicts) */}
          {conflicts.length > 1 && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 font-medium shrink-0">Select Conflict:</span>
              {conflicts.map((c, idx) => (
                <button
                  key={c.id || idx}
                  onClick={() => setSelectedConflictIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 ${
                    selectedConflictIndex === idx
                      ? "bg-amber-400 text-slate-900 shadow-sm"
                      : "bg-white/10 text-slate-200 hover:bg-white/20"
                  }`}
                >
                  <span>#{idx + 1}: {c.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── MODAL BODY ── */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Active Conflict Description & Impact Box */}
          <div
            className={`rounded-2xl p-4 border transition ${
              currentConflict?.severity === "critical"
                ? "bg-rose-50/80 border-rose-200 text-rose-950"
                : "bg-amber-50/80 border-amber-200 text-amber-950"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  currentConflict?.severity === "critical"
                    ? "bg-rose-200 text-rose-800"
                    : "bg-amber-200 text-amber-800"
                }`}
              >
                <FaInfoCircle className="text-base" />
              </div>
              <div className="space-y-1 text-xs sm:text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm sm:text-base">
                    {currentConflict?.title || "Potential Data Collision"}
                  </h4>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md ${
                      currentConflict?.severity === "critical"
                        ? "bg-rose-200 text-rose-900"
                        : "bg-amber-200 text-amber-900"
                    }`}
                  >
                    Matched on: {currentConflict?.matchedField || "Identity"}
                  </span>
                </div>
                <p className="font-medium text-slate-800">
                  {currentConflict?.message}
                </p>
                {currentConflict?.advice && (
                  <p className="text-slate-600 text-xs mt-1.5 bg-white/70 rounded-xl p-2.5 border border-slate-200/60 leading-relaxed">
                    💡 <strong className="text-slate-800">Admin Guidance:</strong> {currentConflict.advice}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── SIDE-BY-SIDE COMPARISON ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <FaExchangeAlt className="text-indigo-600" /> Side-by-Side Verification
              </h3>
              <span className="text-xs text-slate-400">
                Highlighted blocks indicate conflicting properties
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LEFT COLUMN: Pending Applicant */}
              <div className="bg-slate-50/90 border-2 border-amber-300 rounded-2xl p-4 space-y-3.5 relative shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 font-black flex items-center justify-center text-base">
                      {applicant.name ? applicant.name.charAt(0).toUpperCase() : <FaUser />}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                        {applicant.name}
                      </h4>
                      <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                        ● Pending Registration Applicant
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      isTenant
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {isTenant ? "Tenant (Rented)" : "Property Owner"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Mobile Comparison */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      currentConflict?.type === "mobile"
                        ? "bg-rose-50 border-rose-300 text-rose-900 font-bold"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaPhone className={currentConflict?.type === "mobile" ? "text-rose-600" : "text-slate-400"} />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase block text-slate-400">Mobile (Login ID)</span>
                        <span className="truncate block font-mono font-bold text-slate-900">{applicant.mobile || "—"}</span>
                      </div>
                    </div>
                    {currentConflict?.type === "mobile" && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-200 text-rose-900 shrink-0">
                        Match Collision
                      </span>
                    )}
                  </div>

                  {/* Email Comparison */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      currentConflict?.type === "email"
                        ? "bg-rose-50 border-rose-300 text-rose-900 font-bold"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaEnvelope className={currentConflict?.type === "email" ? "text-rose-600" : "text-slate-400"} />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase block text-slate-400">Email Address</span>
                        <span className="truncate block font-medium text-slate-800">{applicant.email || "Not provided"}</span>
                      </div>
                    </div>
                    {currentConflict?.type === "email" && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-200 text-rose-900 shrink-0">
                        Match Collision
                      </span>
                    )}
                  </div>

                  {/* Property Hierarchy Comparison */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      currentConflict?.type?.startsWith("property")
                        ? "bg-amber-50 border-amber-300 text-amber-900 font-bold"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaBuilding className={currentConflict?.type?.startsWith("property") ? "text-amber-600" : "text-slate-400"} />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase block text-slate-400">Property Hierarchy</span>
                        <span className="truncate block font-medium text-slate-800">
                          {applicant.block ? `Block ${applicant.block}, ` : ""}Plot {applicant.plotNumber || applicant.flat || "—"}, {applicant.floor || "—"}{applicant.unitNumber ? `, Unit ${applicant.unitNumber}` : ""}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded shrink-0">
                      ID: {applicant.flat || "—"}
                    </span>
                  </div>

                  {/* Secondary Metadata */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 block uppercase">Father / Husband</span>
                      <span className="font-semibold text-slate-800 truncate block">{applicant.fatherHusbandName || "—"}</span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 block uppercase">Occupation</span>
                      <span className="font-semibold text-slate-800 truncate block">{applicant.occupation || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Matched Existing Resident */}
              <div className="bg-blue-50/40 border-2 border-blue-300 rounded-2xl p-4 space-y-3.5 relative shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-blue-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 font-black flex items-center justify-center text-base">
                      {matchedResident.owner
                        ? matchedResident.owner.charAt(0).toUpperCase()
                        : matchedResident.name
                        ? matchedResident.name.charAt(0).toUpperCase()
                        : "R"}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                        {matchedResident.owner || matchedResident.name || "Existing Resident"}
                      </h4>
                      <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <FaCheckCircle className="text-[10px]" /> Registered Society Resident
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      matchedIsTenant
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {matchedIsTenant ? "Tenant (Rented)" : "Property Owner"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Mobile Comparison */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      currentConflict?.type === "mobile"
                        ? "bg-rose-50 border-rose-300 text-rose-900 font-bold"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaPhone className={currentConflict?.type === "mobile" ? "text-rose-600" : "text-slate-400"} />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase block text-slate-400">Mobile (Login ID)</span>
                        <span className="truncate block font-mono font-bold text-slate-900">{matchedResident.mobile || "—"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(matchedResident.mobile, "Mobile")}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition shrink-0"
                      title="Copy Mobile"
                    >
                      {copiedField === "Mobile" ? <FaCheck className="text-emerald-600 text-xs" /> : <FaCopy className="text-xs" />}
                    </button>
                  </div>

                  {/* Email Comparison */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      currentConflict?.type === "email"
                        ? "bg-rose-50 border-rose-300 text-rose-900 font-bold"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaEnvelope className={currentConflict?.type === "email" ? "text-rose-600" : "text-slate-400"} />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase block text-slate-400">Email Address</span>
                        <span className="truncate block font-medium text-slate-800">{matchedResident.email || "Not provided"}</span>
                      </div>
                    </div>
                    {matchedResident.email && (
                      <button
                        onClick={() => handleCopy(matchedResident.email, "Email")}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition shrink-0"
                        title="Copy Email"
                      >
                        {copiedField === "Email" ? <FaCheck className="text-emerald-600 text-xs" /> : <FaCopy className="text-xs" />}
                      </button>
                    )}
                  </div>

                  {/* Property Hierarchy Comparison */}
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                      currentConflict?.type?.startsWith("property")
                        ? "bg-amber-50 border-amber-300 text-amber-900 font-bold"
                        : "bg-white border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FaBuilding className={currentConflict?.type?.startsWith("property") ? "text-amber-600" : "text-slate-400"} />
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase block text-slate-400">Property Hierarchy</span>
                        <span className="truncate block font-medium text-slate-800">
                          {matchedResident.block ? `Block ${matchedResident.block}, ` : ""}Plot {matchedResident.plotNumber || matchedResident.flat || "—"}, {formatResidentFloor(matchedResident.floor) || "—"}{matchedResident.unitNumber ? `, Unit ${matchedResident.unitNumber}` : ""}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded shrink-0">
                      ID: {matchedResident.flat || "—"}
                    </span>
                  </div>

                  {/* Secondary Metadata */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 block uppercase">Account Status</span>
                      <span className="font-semibold text-emerald-700 truncate block">
                        {matchedResident.status || "Active"}
                      </span>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-2">
                      <span className="text-[10px] text-slate-400 block uppercase">Garbage Service</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {matchedResident.garbageParticipation === "not_participating" ? "Opted Out" : "Participating"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Button to open full profile in ResidentDetailsModal */}
                <button
                  type="button"
                  onClick={() => {
                    if (onViewResidentProfile && matchedResident) {
                      onViewResidentProfile(matchedResident);
                    }
                  }}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <FaExternalLinkAlt className="text-[10px]" />
                  <span>Inspect {matchedResident.owner || matchedResident.name || "Resident"}'s Full Profile (Dues, Family, Records)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── MODAL ACTIONS FOOTER ── */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {applicant.mobile && (
              <a
                href={`tel:${applicant.mobile}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition"
              >
                <FaPhone className="text-emerald-600" /> Call Applicant
              </a>
            )}
            {matchedResident.mobile && (
              <a
                href={`tel:${matchedResident.mobile}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition"
              >
                <FaPhone className="text-blue-600" /> Call Existing Resident
              </a>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold transition"
            >
              Close
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onReject) {
                  onReject(applicant, currentConflict?.message || "Identity conflict detected");
                }
              }}
              className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs sm:text-sm font-bold transition flex items-center gap-1.5"
            >
              <FaTimes />
              <span>Reject with Conflict Reason</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onApprove) {
                  onApprove(applicant);
                }
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <FaCheck />
              <span>Proceed to Approve & Override</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

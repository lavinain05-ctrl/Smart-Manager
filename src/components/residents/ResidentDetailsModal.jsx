import { useState, useEffect, useMemo } from "react";
import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaHome,
  FaBuilding,
  FaCalendarAlt,
  FaEdit,
  FaCheckCircle,
  FaClock,
  FaTimes,
  FaShieldAlt,
  FaBriefcase,
  FaVenusMars,
  FaUserFriends,
  FaRecycle,
  FaKey,
  FaBan,
  FaMoneyBillWave,
  FaReceipt,
  FaWhatsapp,
  FaIdCard,
  FaInfoCircle,
  FaCopy,
  FaPrint,
  FaFileInvoiceDollar,
  FaUserShield,
  FaExternalLinkAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { isRealEmail } from "../../services/authService";
import { subscribeFamilyMembers } from "../../services/residentService";
import { isGcParticipating } from "../../services/statisticsService";

export default function ResidentDetailsModal({
  resident,
  onClose,
  onEdit,
  onResetPassword,
  onBlock,
  onCollect,
  payments = [],
  bills = [],
  garbageBills = [],
}) {
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "property" | "garbage" | "payments" | "audit"
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loadingFamily, setLoadingFamily] = useState(true);

  // Subscribe to family members for this resident
  useEffect(() => {
    if (!resident?.id) return;
    setLoadingFamily(true);
    const unsub = subscribeFamilyMembers(resident.id, (members) => {
      setFamilyMembers(members || []);
      setLoadingFamily(false);
    });
    return () => unsub && unsub();
  }, [resident?.id]);

  // Payments for this resident
  const residentPayments = useMemo(() => {
    if (!resident) return [];
    const resId = resident.id;
    const flatStr = (resident.flat || "").toLowerCase().trim();
    return (payments || [])
      .filter((p) => {
        if (p.residentId && p.residentId === resId) return true;
        if (flatStr && (p.flat || "").toLowerCase().trim() === flatStr) return true;
        return false;
      })
      .sort((a, b) => {
        const dateA = new Date(a.paymentDate || a.createdAt || 0);
        const dateB = new Date(b.paymentDate || b.createdAt || 0);
        return dateB - dateA;
      });
  }, [resident, payments]);

  // Garbage bills for this resident
  const residentGarbageBills = useMemo(() => {
    if (!resident) return [];
    const resId = resident.id;
    const flatStr = (resident.flat || "").toLowerCase().trim();
    return (garbageBills || [])
      .filter((b) => {
        if (b.residentId && b.residentId === resId) return true;
        if (flatStr && (b.flat || "").toLowerCase().trim() === flatStr) return true;
        return false;
      })
      .sort((a, b) => (b.month || "").localeCompare(a.month || ""));
  }, [resident, garbageBills]);

  if (!resident) return null;

  const isParticipating = isGcParticipating(resident);
  const cleanPhone = (resident.mobile || "").replace(/\D/g, "").slice(-10);
  const altPhone = (resident.alternateMobile || "").replace(/\D/g, "").slice(-10);
  const realEmail = isRealEmail(resident.email) ? resident.email : null;
  const isBlocked = resident.isBlocked || resident.status === "Blocked";

  function copyToClipboard(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  }

  function handlePrintSummary() {
    window.print();
  }

  const prov = resident.accessProvenance;
  const channelLabel =
    prov?.channel === "registration_approval"
      ? "Resident Registration Approval"
      : prov?.channel === "committee_portal"
      ? "Committee Portal Direct Entry"
      : prov?.channel === "collector_creation"
      ? "Collector Field Onboarding"
      : "Direct Admin Entry";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* ── MODAL HEADER ── */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 sm:p-6 pb-5 shrink-0 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center text-xl sm:text-2xl font-black shrink-0 shadow-inner">
                {resident.owner ? resident.owner.charAt(0).toUpperCase() : "R"}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {resident.owner || "Resident Profile"}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Flat {resident.flat}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      resident.personType === "RENTED" || resident.personType === "TENANT"
                        ? "bg-purple-500/20 text-purple-300 border-purple-400/30"
                        : "bg-blue-500/20 text-blue-300 border-blue-400/30"
                    }`}
                  >
                    {resident.personType || "OWNER"}
                  </span>
                  {isBlocked ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/30 text-red-300 border border-red-500/40 flex items-center gap-1">
                      <FaBan className="text-[10px]" /> Blocked
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <FaCheckCircle className="text-[10px]" /> Active Account
                    </span>
                  )}
                </div>
                <p className="text-slate-300 text-xs sm:text-sm mt-1 flex items-center gap-2 flex-wrap">
                  <span>Block: <strong className="text-white">{resident.block || "—"}</strong></span>
                  <span>•</span>
                  <span>Floor: <strong className="text-white">{resident.floor || "Ground Floor"}</strong></span>
                  {resident.mobile && (
                    <>
                      <span>•</span>
                      <span>Phone: <strong className="text-white font-mono">{resident.mobile}</strong></span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handlePrintSummary}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition text-sm cursor-pointer"
                title="Print Resident Profile"
              >
                <FaPrint />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-red-500/30 text-slate-300 hover:text-red-200 transition text-base cursor-pointer"
                title="Close Modal"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {/* Top Quick Actions Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/10 text-xs">
            <button
              onClick={() => {
                onClose();
                onEdit && onEdit(resident);
              }}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              <FaEdit /> Edit Details
            </button>

            <button
              onClick={() => {
                onClose();
                onResetPassword && onResetPassword(resident);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30 font-semibold transition flex items-center gap-1.5"
            >
              <FaKey /> Reset Password
            </button>

            <button
              onClick={() => {
                onClose();
                onBlock && onBlock(resident);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition flex items-center gap-1.5 border ${
                isBlocked
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/30"
                  : "bg-red-500/20 text-red-300 border-red-400/30 hover:bg-red-500/30"
              }`}
            >
              <FaBan /> {isBlocked ? "Unblock Account" : "Block Access"}
            </button>

            {cleanPhone && (
              <a
                href={`https://wa.me/91${cleanPhone}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition flex items-center gap-1.5 shadow-xs ml-auto"
              >
                <FaWhatsapp /> Chat on WhatsApp
              </a>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-4 -mb-5 overflow-x-auto scrollbar-none pt-1">
            {[
              { id: "overview", label: "Overview & Personal", icon: FaUser },
              { id: "property", label: "Property & Housing", icon: FaHome },
              { id: "garbage", label: "Garbage & Dues", icon: FaRecycle },
              { id: "family", label: `Family (${familyMembers.length})`, icon: FaUserFriends },
              { id: "payments", label: `Payments (${residentPayments.length})`, icon: FaReceipt },
              { id: "audit", label: "Security & Audit", icon: FaShieldAlt },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className={isActive ? "text-blue-600" : "text-slate-400"} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MODAL BODY CONTENT ── */}
        <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
          {/* ════ TAB 1: OVERVIEW & PERSONAL DETAILS ════ */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Full Name */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5"><FaUser className="text-blue-500" /> Full Name / Owner</span>
                    <button
                      onClick={() => copyToClipboard(resident.owner, "Name")}
                      className="text-slate-400 hover:text-blue-600"
                      title="Copy"
                    >
                      <FaCopy />
                    </button>
                  </div>
                  <p className="font-bold text-base text-slate-800">{resident.owner || "—"}</p>
                  {resident.name && resident.name !== resident.owner && (
                    <p className="text-xs text-slate-500 mt-0.5">Alt: {resident.name}</p>
                  )}
                </div>

                {/* Primary Mobile */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5"><FaPhone className="text-emerald-500" /> Primary Mobile</span>
                    <button
                      onClick={() => copyToClipboard(cleanPhone, "Mobile")}
                      className="text-slate-400 hover:text-blue-600"
                      title="Copy"
                    >
                      <FaCopy />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-base text-slate-800 font-mono">
                      {resident.mobile || "—"}
                    </p>
                    {cleanPhone && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${cleanPhone}`}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                          title="Direct Call"
                        >
                          <FaPhone className="text-xs" />
                        </a>
                        <a
                          href={`https://wa.me/91${cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                          title="WhatsApp"
                        >
                          <FaWhatsapp className="text-xs" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Alternate Mobile */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5"><FaPhone className="text-cyan-500" /> Alternate Mobile</span>
                    {altPhone && (
                      <button
                        onClick={() => copyToClipboard(altPhone, "Alternate Mobile")}
                        className="text-slate-400 hover:text-blue-600"
                        title="Copy"
                      >
                        <FaCopy />
                      </button>
                    )}
                  </div>
                  <p className="font-bold text-base text-slate-800 font-mono">
                    {resident.alternateMobile || "Not provided"}
                  </p>
                </div>

                {/* Email Address */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    <span className="flex items-center gap-1.5"><FaEnvelope className="text-indigo-500" /> Email Address</span>
                    {realEmail && (
                      <button
                        onClick={() => copyToClipboard(realEmail, "Email")}
                        className="text-slate-400 hover:text-blue-600"
                        title="Copy"
                      >
                        <FaCopy />
                      </button>
                    )}
                  </div>
                  <p className="font-bold text-sm text-slate-800 truncate" title={realEmail || ""}>
                    {realEmail || <span className="text-slate-400 font-normal italic">No email registered</span>}
                  </p>
                </div>

                {/* Father / Husband Name */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <FaUserShield className="text-amber-500" /> Father / Husband Name
                  </div>
                  <p className="font-bold text-base text-slate-800">
                    {resident.fatherHusbandName || "—"}
                  </p>
                </div>

                {/* Gender & DOB */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <FaVenusMars className="text-pink-500" /> Gender / DOB
                  </div>
                  <p className="font-bold text-sm text-slate-800">
                    {resident.gender || "—"} {resident.dob ? `• ${resident.dob}` : ""}
                  </p>
                </div>

                {/* Occupation */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <FaBriefcase className="text-teal-500" /> Occupation
                  </div>
                  <p className="font-bold text-base text-slate-800">
                    {resident.occupation || "—"}
                  </p>
                </div>

                {/* Emergency Contact */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <FaPhone className="text-rose-500" /> Emergency Contact
                  </div>
                  <p className="font-bold text-base text-slate-800 font-mono">
                    {resident.emergencyContact || "—"}
                  </p>
                </div>

                {/* Resident Type */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <FaIdCard className="text-purple-500" /> Residence Status
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      resident.personType === "RENTED" || resident.personType === "TENANT"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {resident.personType || "OWNER"}
                  </span>
                </div>
              </div>

              {/* Remarks Box */}
              {resident.remarks && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed">
                  <strong className="block text-amber-950 font-bold mb-1 flex items-center gap-1.5">
                    <FaInfoCircle className="text-amber-500" /> Admin Remarks & Notes:
                  </strong>
                  {resident.remarks}
                </div>
              )}
            </div>
          )}

          {/* ════ TAB 2: PROPERTY & HOUSING DETAILS ════ */}
          {activeTab === "property" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Flat / House No.
                  </span>
                  <p className="text-xl font-black text-slate-800">{resident.flat || "—"}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Plot Number
                  </span>
                  <p className="text-lg font-bold text-slate-800">{resident.plotNumber || resident.flat || "—"}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Block Name
                  </span>
                  <p className="text-lg font-bold text-blue-700">{resident.block || "—"}</p>
                  {resident.blockId && (
                    <span className="text-[10px] text-slate-400 font-mono">ID: {resident.blockId}</span>
                  )}
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Floor Level
                  </span>
                  <p className="text-base font-bold text-slate-800">{resident.floor || "Ground Floor"}</p>
                  {resident.floorCode && (
                    <span className="text-[10px] text-slate-400 font-mono">Code: {resident.floorCode}</span>
                  )}
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Unit / Portion
                  </span>
                  <p className="text-base font-bold text-slate-800">{resident.unitNumber || "Entire Floor / Single Unit"}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Monthly Maintenance Charge
                  </span>
                  <p className="text-xl font-black text-emerald-600">₹{Number(resident.charge) > 0 ? resident.charge : 80}</p>
                </div>
              </div>

              {/* Canonical Property ID */}
              {resident.propertyId && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                      Canonical Society Property ID
                    </span>
                    <p className="font-mono text-xs text-slate-700 truncate mt-0.5 font-semibold">
                      {resident.propertyId}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(resident.propertyId, "Property ID")}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition shrink-0 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FaCopy /> Copy
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ════ TAB 3: GARBAGE COLLECTION & DUES ════ */}
          {activeTab === "garbage" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    GC Program Status
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                        isParticipating
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <FaRecycle className="text-[10px]" />
                      {resident.garbageStatus || (isParticipating ? "Participating" : "Not Participating")}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Monthly Waste Collection Fee
                  </span>
                  <p className="text-2xl font-black text-emerald-600 mt-1">
                    ₹{isParticipating ? (Number(resident.charge) > 0 ? resident.charge : 80) : 0}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Direct Action
                  </span>
                  {onCollect && (
                    <button
                      onClick={() => {
                        onClose();
                        onCollect(resident);
                      }}
                      className="mt-2 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <FaFileInvoiceDollar /> Collect Payment
                    </button>
                  )}
                </div>
              </div>

              {/* Garbage Bills History */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <FaRecycle className="text-emerald-500" /> Garbage Bills Ledger
                  </h3>
                  <span className="text-xs text-slate-500">
                    {residentGarbageBills.length} recorded bill{residentGarbageBills.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {residentGarbageBills.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    No garbage bills recorded specifically for this flat.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Month</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Collector</th>
                          <th className="p-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {residentGarbageBills.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-800">{b.month || "—"}</td>
                            <td className="p-3 font-bold text-emerald-600">₹{b.amount || b.monthlyCharge || "80"}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  b.status === "Paid"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {b.status || "Pending"}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">{b.collectorName || "—"}</td>
                            <td className="p-3 text-slate-400">
                              {b.createdAt ? new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt).toLocaleDateString("en-IN") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ TAB 4: FAMILY MEMBERS ════ */}
          {activeTab === "family" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <FaUserFriends className="text-blue-500" /> Linked Family Members
                </h3>
                <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-full border border-blue-200">
                  {familyMembers.length} Registered
                </span>
              </div>

              {loadingFamily ? (
                <div className="p-8 text-center text-slate-400 text-xs">Loading family members...</div>
              ) : familyMembers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-xs">
                  No separate family member login accounts linked to this primary resident.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {familyMembers.map((fm) => (
                    <div
                      key={fm.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-start gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {fm.name ? fm.name.charAt(0).toUpperCase() : "F"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-800 truncate">{fm.name}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            {fm.relation || fm.relationship || "Family"}
                          </span>
                        </div>
                        {fm.phone && (
                          <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                            <FaPhone className="text-[9px] text-slate-400" /> {fm.phone}
                          </p>
                        )}
                        {fm.email && isRealEmail(fm.email) && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{fm.email}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════ TAB 5: PAYMENTS & RECEIPTS ════ */}
          {activeTab === "payments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <FaReceipt className="text-emerald-500" /> Payment & Collection History
                </h3>
                <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                  {residentPayments.length} Payment{residentPayments.length !== 1 ? "s" : ""}
                </span>
              </div>

              {residentPayments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 text-xs">
                  No payment receipts recorded for this resident in the system yet.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Receipt #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Month / Purpose</th>
                          <th className="p-3">Mode</th>
                          <th className="p-3">Collector</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {residentPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-mono font-bold text-blue-700">
                              {p.receiptNumber || p.receiptNo || p.id.slice(0, 8)}
                            </td>
                            <td className="p-3 text-slate-600 whitespace-nowrap">
                              {p.paymentDate || (p.createdAt ? new Date(p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt).toLocaleDateString("en-IN") : "—")}
                            </td>
                            <td className="p-3 font-bold text-emerald-600">
                              ₹{p.amount || 0}
                            </td>
                            <td className="p-3 text-slate-700">
                              {p.month ? `${p.month} ${p.year || ""}` : p.purpose || "Maintenance"}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                {p.paymentMethod || p.mode || "Cash"}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">
                              {p.collectedByName || p.collectorName || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ TAB 6: SECURITY & AUDIT PROVENANCE ════ */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b pb-3">
                  <FaShieldAlt className="text-indigo-500" /> Access Provenance & Governance
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Onboarding Channel
                    </span>
                    <p className="font-bold text-slate-800 text-sm">{channelLabel}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Granted / Approved By
                    </span>
                    <p className="font-bold text-slate-800 text-sm">
                      {prov?.grantedByName || resident.createdByName || resident.createdBy || "Admin"}
                      {prov?.grantedByDesignation ? ` (${prov.grantedByDesignation})` : ""}
                    </p>
                    {prov?.grantedByRole && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        Role: {prov.grantedByRole}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Approved Timestamp
                    </span>
                    <p className="font-mono text-slate-700">
                      {prov?.grantedAt
                        ? new Date(prov.grantedAt).toLocaleString("en-IN")
                        : resident.approvedAt
                        ? new Date(resident.approvedAt?.toDate ? resident.approvedAt.toDate() : resident.approvedAt).toLocaleString("en-IN")
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Account Record Created At
                    </span>
                    <p className="font-mono text-slate-700">
                      {resident.createdAt
                        ? new Date(resident.createdAt?.toDate ? resident.createdAt.toDate() : resident.createdAt).toLocaleString("en-IN")
                        : "—"}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">
                      Resident Document ID (UID)
                    </span>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-slate-700 font-bold bg-slate-50 p-2 rounded-xl border text-xs truncate flex-1">
                        {resident.id}
                      </p>
                      <button
                        onClick={() => copyToClipboard(resident.id, "Resident ID")}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center gap-1.5 shrink-0"
                      >
                        <FaCopy /> Copy ID
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Block Details if Blocked */}
              {isBlocked && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-xs text-red-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-red-700 text-sm">
                    <FaBan /> Account Access Is Blocked
                  </div>
                  <p>
                    Reason: <strong>{resident.blockedReason || "Maintenance / Garbage Dues Pending"}</strong>
                  </p>
                  {resident.blockedUntil && (
                    <p>
                      Blocked Until: <strong>{new Date(resident.blockedUntil).toLocaleString("en-IN")}</strong>
                    </p>
                  )}
                  {resident.blockedBy && (
                    <p>
                      Enforced by: <strong>{resident.blockedBy}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 hidden sm:block">
            D Block RWA Society Resident Audit Profile
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

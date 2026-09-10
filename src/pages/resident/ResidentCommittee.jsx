import { useState, useMemo } from "react";
import {
  FaUserTie,
  FaPhone,
  FaEnvelope,
  FaWhatsapp,
  FaHome,
  FaBuilding,
  FaSearch,
  FaClock,
  FaQuoteLeft,
  FaShieldAlt,
  FaUsers,
  FaChevronRight,
} from "react-icons/fa";
import { useCommittee } from "../../context/CommitteeContext";

const DESIGNATION_COLORS = {
  President: "bg-amber-100 text-amber-800 border-amber-200",
  "Vice President": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "General Secretary": "bg-blue-100 text-blue-800 border-blue-200",
  "Joint Secretary": "bg-purple-100 text-purple-800 border-purple-200",
  Treasurer: "bg-violet-100 text-violet-800 border-violet-200",
  "Executive Member": "bg-slate-100 text-slate-800 border-slate-200",
};

export default function ResidentCommittee() {
  const { committee = [] } = useCommittee();
  const [search, setSearch] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("all");

  // Filter only active committee members and sort by order
  const activeMembers = useMemo(() => {
    return [...committee]
      .filter((m) => m.status !== "inactive")
      .sort((a, b) => Number(a.order || 99) - Number(b.order || 99));
  }, [committee]);

  // Unique designations for filter tabs
  const designations = useMemo(() => {
    const list = Array.from(new Set(activeMembers.map((m) => m.designation).filter(Boolean)));
    return list;
  }, [activeMembers]);

  // Filtered members
  const filtered = useMemo(() => {
    return activeMembers.filter((m) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.name?.toLowerCase().includes(q) ||
        m.designation?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        m.flat?.toLowerCase().includes(q) ||
        m.block?.toLowerCase().includes(q);

      const matchesDesignation =
        filterDesignation === "all" || m.designation === filterDesignation;

      return matchesSearch && matchesDesignation;
    });
  }, [activeMembers, search, filterDesignation]);

  // Clean phone number for WhatsApp
  const cleanPhone = (ph) => (ph || "").replace(/\D/g, "").slice(-10);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-100 text-xs font-semibold backdrop-blur-md mb-3">
            <FaShieldAlt className="text-amber-400" /> D BLOCK RWA INDRAPRASTHA
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <FaUserTie className="text-amber-400 shrink-0" />
            RWA Committee Members
          </h1>
          <p className="text-blue-100/90 text-sm max-w-2xl mt-2 leading-relaxed">
            Meet your elected RWA leadership and office bearers dedicated to the safety, welfare, and development of D BLOCK RWA INDRAPRASTHA. Reach out to your representatives for assistance.
          </p>

          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{activeMembers.length} Active Committee Members</span>
            </div>
            <span>•</span>
            <span>Official Society Leadership</span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search member, role, flat, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Designation Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setFilterDesignation("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filterDesignation === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Roles ({activeMembers.length})
          </button>
          {designations.map((desig) => {
            const count = activeMembers.filter((m) => m.designation === desig).length;
            return (
              <button
                key={desig}
                type="button"
                onClick={() => setFilterDesignation(desig)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  filterDesignation === desig
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {desig} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Members Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 text-2xl">
            <FaUsers />
          </div>
          <h2 className="text-lg font-bold text-slate-800">No Committee Members Found</h2>
          <p className="text-xs text-slate-500 mt-1">
            {search || filterDesignation !== "all"
              ? "Try adjusting your search criteria or filter."
              : "Committee members will appear here once added by the administrator."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((member) => {
            const badgeColor =
              DESIGNATION_COLORS[member.designation] ||
              "bg-slate-100 text-slate-700 border-slate-200";
            const phoneClean = cleanPhone(member.phone);
            const isEmailReal =
              member.email && !member.email.includes("firebaseapp.com");

            return (
              <div
                key={member.id || member.uid}
                className="bg-white rounded-3xl shadow-sm border border-slate-200/80 hover:shadow-md transition duration-200 flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Top Bar with Designation */}
                  <div className="p-5 pb-0 flex items-start justify-between gap-2">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border shadow-xs ${badgeColor}`}
                    >
                      {member.designation}
                    </span>
                    {member.tenure && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        <FaClock className="text-[9px]" /> {member.tenure}
                      </span>
                    )}
                  </div>

                  {/* Profile Header */}
                  <div className="p-5 pt-4 flex items-center gap-4">
                    {member.profilePhotoUrl ? (
                      <img
                        src={member.profilePhotoUrl}
                        alt={member.name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-extrabold text-xl shadow-sm shrink-0">
                        {member.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "RWA"}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-slate-900 truncate leading-snug group-hover:text-blue-600 transition">
                        {member.name}
                      </h3>
                      {(member.flat || member.block) && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium truncate">
                          <FaHome className="text-[10px] text-slate-400 shrink-0" />
                          <span>
                            {member.flat ? `Flat ${member.flat}` : ""}
                            {member.flat && member.block ? " • " : ""}
                            {member.block ? `Block ${member.block}` : ""}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Delegated Portfolios & Authorities */}
                  {member.permissions && (
                    <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                      {(member.permissions.canCollectGarbage || member.permissions.canCollectSpecial) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          💰 Fee Collection Officer
                        </span>
                      )}
                      {(member.permissions.canManageResidents || member.permissions.canManageRegistrations) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                          👥 Resident Affairs
                        </span>
                      )}
                      {(member.permissions.canManageProfileRequests || member.permissions.canManageAccountRecovery) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          🛡️ Verification Officer
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bio / Message */}
                  {member.introduction && (
                    <div className="px-5 pb-4">
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-xs text-slate-600 leading-relaxed italic flex items-start gap-2">
                        <FaQuoteLeft className="text-[10px] text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-3">{member.introduction}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Contact Actions Strip */}
                <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {member.phone ? (
                      <a
                        href={`tel:${member.phone}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 truncate bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 transition shadow-xs"
                      >
                        <FaPhone className="text-[10px] text-emerald-600" />
                        <span>{member.phone}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No phone listed</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {phoneClean && (
                      <a
                        href={`https://wa.me/91${phoneClean}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition text-sm shadow-xs"
                        title="Chat on WhatsApp"
                      >
                        <FaWhatsapp />
                      </a>
                    )}
                    {isEmailReal && (
                      <a
                        href={`mailto:${member.email}`}
                        className="w-8 h-8 rounded-xl bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition text-xs shadow-xs"
                        title="Send Email"
                      >
                        <FaEnvelope />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import {
  FaUserTie,
  FaPhone,
  FaEnvelope,
  FaWhatsapp,
  FaSearch,
  FaClock,
  FaQuoteLeft,
  FaShieldAlt,
  FaUsers,
  FaCrown,
  FaAward,
  FaTimes,
  FaExpand,
  FaCheckCircle,
  FaMoneyBillWave,
  FaUserShield,
  FaEdit,
  FaKey,
  FaBullhorn,
} from "react-icons/fa";
import { useCommittee } from "../../context/CommitteeContext";

export function getMemberPhoto(member) {
  if (member?.profilePhotoUrl) return member.profilePhotoUrl;
  const isDharmendra =
    member?.designation?.toLowerCase() === "president" ||
    member?.name?.toLowerCase().includes("dharmendra");
  if (isDharmendra) return "/committee/president.jpg";
  const isAnkit =
    member?.designation?.toLowerCase() === "vice president" ||
    member?.name?.toLowerCase().includes("ankit");
  if (isAnkit) return "/committee/ankit-chaudhary.png";
  const isSecretary =
    member?.designation?.toLowerCase() === "secretary" ||
    member?.name?.toLowerCase().includes("janardan") ||
    member?.name?.toLowerCase().includes("janardhan");
  if (isSecretary) return "/committee/secretary.jpg";
  const isTreasurer =
    member?.designation?.toLowerCase() === "treasurer" ||
    member?.name?.toLowerCase().includes("sandeep") ||
    member?.name?.toLowerCase().includes("gaur");
  if (isTreasurer) return "/committee/treasurer.jpg";
  const isVinod =
    member?.designation?.toLowerCase() === "vice treasurer" ||
    member?.name?.toLowerCase().includes("vinod");
  if (isVinod) return "/committee/vinod-kumar.jpg";
  const isNarendra =
    member?.designation?.toLowerCase() === "spokesperson" ||
    member?.name?.toLowerCase().includes("narendra") ||
    member?.name?.toLowerCase().includes("dhama");
  if (isNarendra) return "/committee/narendra-dhama.png";
  const isDinesh =
    member?.designation?.toLowerCase() === "advisor" ||
    member?.name?.toLowerCase().includes("dinesh");
  if (isDinesh) return "/committee/dinesh-kumar.png";
  const isManoj =
    member?.designation?.toLowerCase() === "vice secretary" ||
    member?.name?.toLowerCase().includes("manoj") ||
    member?.name?.toLowerCase().includes("tomar");
  if (isManoj) return "/committee/manoj-tomar.jpg";
  const isPandey =
    member?.name?.toLowerCase().includes("pandey") ||
    member?.name?.toLowerCase().includes("d k") ||
    member?.name?.toLowerCase().includes("dk");
  if (isPandey) return "/committee/dk-pandey.jpg";
  return null;
}

const DESIGNATION_STYLES = {
  President: {
    badge: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    gradient: "from-amber-500/20 via-orange-500/10 to-transparent",
    ring: "ring-amber-400/60",
    icon: FaCrown,
    iconColor: "text-amber-500",
  },
  "Vice President": {
    badge: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    gradient: "from-sky-500/20 via-blue-500/10 to-transparent",
    ring: "ring-sky-400/60",
    icon: FaAward,
    iconColor: "text-sky-500",
  },
  Secretary: {
    badge: "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
    gradient: "from-indigo-500/20 via-purple-500/10 to-transparent",
    ring: "ring-indigo-400/60",
    icon: FaShieldAlt,
    iconColor: "text-indigo-500",
  },
  "General Secretary": {
    badge: "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
    gradient: "from-indigo-500/20 via-purple-500/10 to-transparent",
    ring: "ring-indigo-400/60",
    icon: FaShieldAlt,
    iconColor: "text-indigo-500",
  },
  "Joint Secretary": {
    badge: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    gradient: "from-purple-500/20 via-fuchsia-500/10 to-transparent",
    ring: "ring-purple-400/60",
    icon: FaAward,
    iconColor: "text-purple-500",
  },
  "Vice Secretary": {
    badge: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
    gradient: "from-purple-500/20 via-fuchsia-500/10 to-transparent",
    ring: "ring-purple-400/60",
    icon: FaAward,
    iconColor: "text-purple-500",
  },
  Treasurer: {
    badge: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
    ring: "ring-emerald-400/60",
    icon: FaMoneyBillWave,
    iconColor: "text-emerald-500",
  },
  "Vice Treasurer": {
    badge: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
    ring: "ring-emerald-400/60",
    icon: FaMoneyBillWave,
    iconColor: "text-emerald-500",
  },
  Spokesperson: {
    badge: "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
    gradient: "from-cyan-500/20 via-blue-500/10 to-transparent",
    ring: "ring-cyan-400/60",
    icon: FaBullhorn,
    iconColor: "text-cyan-500",
  },
  Advisor: {
    badge: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    gradient: "from-blue-500/20 via-indigo-500/10 to-transparent",
    ring: "ring-blue-400/60",
    icon: FaUserShield,
    iconColor: "text-blue-500",
  },
  "Executive Member": {
    badge: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    gradient: "from-slate-500/10 to-transparent",
    ring: "ring-slate-300/60 dark:ring-slate-700",
    icon: FaUserTie,
    iconColor: "text-slate-500",
  },
};

export default function ResidentCommittee() {
  const { committee = [] } = useCommittee();
  const [search, setSearch] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("all");
  const [enlargedMember, setEnlargedMember] = useState(null);

  // Filter only active committee members and sort by order
  const activeMembers = useMemo(() => {
    return [...committee]
      .filter((m) => {
        const isBlocked = m.isBlocked || m.status === "blocked" || m.status === "suspended";
        return !isBlocked && m.status !== "inactive";
      })
      .sort((a, b) => Number(a.order || 99) - Number(b.order || 99));
  }, [committee]);

  // Unique designations for filter tabs
  const designations = useMemo(() => {
    return Array.from(new Set(activeMembers.map((m) => m.designation).filter(Boolean)));
  }, [activeMembers]);

  // Filtered members based on search and tab
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

  function getInitials(name) {
    if (!name) return "RWA";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  return (
    <div className="space-y-4 sm:space-y-7 max-w-7xl mx-auto pb-14 transition-colors">
      {/* 1. HERO BANNER WITH SCENIC BACKDROP & CURVED BOTTOM */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl sm:shadow-2xl bg-slate-950 text-white">
        {/* Scenic Society Background with Royal Gradient Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 transform scale-105 filter blur-xs"
          style={{ backgroundImage: `url('/society-banner.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-blue-950/90 to-indigo-950/90 mix-blend-multiply" />
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Banner Content */}
        <div className="relative z-10 p-4 sm:p-10 pb-10 sm:pb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-white/10 text-amber-300 border border-amber-300/30 text-[10px] sm:text-xs font-bold backdrop-blur-md mb-3 sm:mb-4 shadow-sm max-w-full">
            <FaShieldAlt className="text-amber-400 shrink-0" />
            <span className="truncate">D BLOCK RWA INDRAPRASTHA • EXECUTIVE COMMITTEE</span>
          </div>

          <h1 className="text-xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-2 sm:gap-3">
            <FaUserTie className="text-amber-400 shrink-0 text-base sm:text-3xl" />
            <span>RWA Executive Committee</span>
          </h1>

          <p className="text-slate-200 text-xs sm:text-base max-w-3xl mt-2 leading-relaxed">
            Meet the elected office bearers and representatives dedicated to the security, welfare, maintenance, and development of D Block Indraprastha. Connect directly with your officials for community matters.
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:gap-6 mt-4 sm:mt-6 pt-3.5 sm:pt-5 border-t border-white/10 text-[11px] sm:text-xs text-slate-300">
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">{activeMembers.length} Active Officials</span>
            </div>
            <div className="flex items-center gap-1">
              <FaPhone className="text-emerald-400" />
              <span>Direct WhatsApp & Call</span>
            </div>
          </div>
        </div>

        {/* Curved Wave Bottom Divider */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none pointer-events-none">
          <svg
            className="relative block w-full h-6 text-slate-50 dark:text-slate-950 transition-colors"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,0 C150,90 350,-40 500,60 C650,160 900,10 1200,40 L1200,120 Z" />
          </svg>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/90 dark:border-slate-800 p-3 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 transition-colors">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
          <input
            type="text"
            placeholder="Search official by name, role, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <FaTimes />
            </button>
          )}
        </div>

        {/* Designation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none -mx-1 px-1">
          <button
            type="button"
            onClick={() => setFilterDesignation("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              filterDesignation === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  filterDesignation === desig
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {desig} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. EMPTY STATE */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/90 dark:border-slate-800 p-12 text-center transition-colors">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3 text-2xl">
            <FaUsers />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">No Committee Members Found</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            {search || filterDesignation !== "all"
              ? "No officials match your search criteria. Try clearing filters or searching with another term."
              : "Committee members will appear here once added by the society administrator."}
          </p>
          {(search || filterDesignation !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterDesignation("all");
              }}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* 4. UNIFIED COMMITTEE MEMBERS GRID (ALL IN SAME SECTION) */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center text-sm shadow-xs">
                <FaCrown />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Core Office Bearers & Committee Members
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {filterDesignation !== "all"
                    ? `Showing ${filterDesignation} officials`
                    : "Elected office bearers and committee leadership"}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full">
              {filtered.length} {filtered.length === 1 ? "Official" : "Officials"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
            {filtered.map((member) => (
              <MemberCard
                key={member.id || member.uid}
                member={member}
                onEnlargePhoto={() => setEnlargedMember(member)}
                cleanPhone={cleanPhone}
                getInitials={getInitials}
              />
            ))}
          </div>
        </div>
      )}

      {/* 6. ENLARGED PHOTO LIGHTBOX MODAL */}
      {enlargedMember && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm"
          onClick={() => setEnlargedMember(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  {enlargedMember.designation}
                </span>
                <h3 className="text-base font-bold truncate">{enlargedMember.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEnlargedMember(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            {/* Photo View */}
            <div className="relative aspect-square bg-slate-900 flex items-center justify-center overflow-hidden">
              {getMemberPhoto(enlargedMember) ? (
                <img
                  src={getMemberPhoto(enlargedMember)}
                  alt={enlargedMember.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-white/50">
                  <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center text-4xl font-extrabold text-amber-400 shadow-inner">
                    {getInitials(enlargedMember.name)}
                  </div>
                  <p className="text-xs text-slate-400 mt-3">Photo will be updated shortly</p>
                </div>
              )}
            </div>

            {/* Modal Body / Contact Actions */}
            <div className="p-5 space-y-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
              {enlargedMember.tenure && (
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                    {enlargedMember.tenure}
                  </span>
                </div>
              )}

              {enlargedMember.introduction && (
                <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  "{enlargedMember.introduction}"
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                {enlargedMember.phone && (
                  <a
                    href={`tel:${enlargedMember.phone}`}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition"
                  >
                    <FaPhone className="text-emerald-600 dark:text-emerald-400" />
                    <span>Call Official</span>
                  </a>
                )}
                {cleanPhone(enlargedMember.phone) && (
                  <a
                    href={`https://wa.me/91${cleanPhone(enlargedMember.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                  >
                    <FaWhatsapp className="text-sm" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable Member Card Component
 */
function MemberCard({ member, onEnlargePhoto, cleanPhone, getInitials }) {
  const [imgError, setImgError] = useState(false);
  const style = DESIGNATION_STYLES[member.designation] || DESIGNATION_STYLES["Executive Member"];
  const RoleIcon = style.icon;
  const phoneClean = cleanPhone(member.phone);
  const isEmailReal = member.email && !member.email.includes("firebaseapp.com");
  const photoUrl = getMemberPhoto(member);

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-sm border border-amber-200/80 dark:border-amber-900/60 ring-1 ring-amber-100 dark:ring-amber-950/40 transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:shadow-xl hover:-translate-y-0.5"
    >
      <div>
        {/* Top Header Accent with Designation Badge */}
        <div className="p-3.5 sm:p-5 pb-0 flex items-start justify-between gap-2">
          <span
            className={`text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full border shadow-2xs flex items-center gap-1.5 ${style.badge}`}
          >
            <RoleIcon className={`text-xs ${style.iconColor}`} />
            <span>{member.designation || "Executive Member"}</span>
          </span>

          {member.tenure && (
            <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-800 px-2 sm:px-2.5 py-0.5 rounded-full border border-slate-100 dark:border-slate-700 flex items-center gap-1">
              <FaClock className="text-[9px] text-slate-400" />
              <span>{member.tenure}</span>
            </span>
          )}
        </div>

        {/* Member Profile Info (Photo + Details) */}
        <div className="p-3.5 sm:p-5 pt-3 sm:pt-4 flex items-center gap-3 sm:gap-4">
          {/* Portrait Photo Container */}
          <div
            onClick={onEnlargePhoto}
            className={`relative rounded-2xl overflow-hidden shrink-0 cursor-pointer shadow-md group/photo transition duration-300 w-16 h-16 sm:w-20 sm:h-20 ${style.ring} ring-2`}
            title="Click to view full photo"
          >
            {photoUrl && !imgError ? (
              <img
                src={photoUrl}
                alt={member.name}
                className="w-full h-full object-cover group-hover/photo:scale-105 transition duration-300"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white flex flex-col items-center justify-center font-extrabold text-base sm:text-xl shadow-inner relative">
                <span className="tracking-wider">{getInitials(member.name)}</span>
                <div className="absolute bottom-1 right-1 opacity-20">
                  <RoleIcon className="text-xs sm:text-sm" />
                </div>
              </div>
            )}

            {/* Expand Hover Hint */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs opacity-0 group-hover/photo:opacity-100 transition duration-200">
              <FaExpand />
            </div>
          </div>

          {/* Member Name */}
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-sm sm:text-base md:text-lg text-slate-900 dark:text-white truncate leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
              {member.name}
            </h3>
          </div>
        </div>

        {/* Delegated Portfolios */}
        {member.permissions && Object.values(member.permissions).some(Boolean) && (
          <div className="px-3.5 sm:px-5 pb-2.5 sm:pb-3 flex flex-wrap gap-1 sm:gap-1.5">
            {(member.permissions.canManageResidents || member.permissions.canManageRegistrations) && (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <FaUserShield className="text-[8px]" /> Resident Affairs
              </span>
            )}
            {(member.permissions.canManageProfileRequests || member.permissions.canManageAccountRecovery) && (
              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <FaCheckCircle className="text-[8px]" /> Verification Officer
              </span>
            )}
          </div>
        )}

        {/* Introduction / Message */}
        {member.introduction && (
          <div className="px-3.5 sm:px-5 pb-3 sm:pb-4">
            <div className="bg-slate-50/90 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-slate-100 dark:border-slate-800 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic flex items-start gap-1.5 sm:gap-2">
              <FaQuoteLeft className="text-slate-400 shrink-0 text-[9px] mt-0.5" />
              <span className="line-clamp-2">{member.introduction}</span>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer: Quick Actions */}
      <div className="p-2.5 sm:p-4 bg-slate-50/90 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {member.phone ? (
            <a
              href={`tel:${member.phone}`}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 truncate bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs hover:border-blue-300 transition"
              title="Call Official"
            >
              <FaPhone className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{member.phone}</span>
            </a>
          ) : (
            <span className="text-xs text-slate-400 italic">No phone</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {phoneClean && (
            <a
              href={`https://wa.me/91${phoneClean}`}
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition text-sm shadow-xs hover:shadow"
              title="Direct WhatsApp Chat"
            >
              <FaWhatsapp />
            </a>
          )}
          {isEmailReal && (
            <a
              href={`mailto:${member.email}`}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition text-xs shadow-xs hover:shadow"
              title={`Send Email to ${member.email}`}
            >
              <FaEnvelope />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

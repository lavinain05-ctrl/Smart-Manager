import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaTimes,
  FaUser,
  FaHome,
  FaBullhorn,
  FaExclamationCircle,
  FaCalendarAlt,
  FaLeaf,
  FaUserTie,
  FaBuilding,
  FaArrowRight,
  FaRecycle,
} from "react-icons/fa";

import { useResidents } from "../../context/ResidentContext";
import { useNotices } from "../../context/NoticeContext";
import { useComplaints } from "../../context/ComplaintContext";
import { useEvents } from "../../context/EventContext";
import { useActivities } from "../../context/ActivityContext";
import { useCommittee } from "../../context/CommitteeContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { useGarbage } from "../../context/GarbageContext";

const CATEGORIES = [
  { key: "all", label: "All", icon: <FaSearch /> },
  { key: "residents", label: "Residents", icon: <FaUser /> },
  { key: "notices", label: "Notices", icon: <FaBullhorn /> },
  { key: "complaints", label: "Complaints", icon: <FaExclamationCircle /> },
  { key: "events", label: "Events", icon: <FaCalendarAlt /> },
  { key: "activities", label: "Activities", icon: <FaLeaf /> },
  { key: "committee", label: "Committee", icon: <FaUserTie /> },
  { key: "blocks", label: "Blocks", icon: <FaBuilding /> },
  { key: "garbage", label: "Garbage", icon: <FaRecycle /> },
];

export default function GlobalSearch({ isAdmin = false }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const { residents } = useResidents();
  const { notices } = useNotices();
  const { complaints } = useComplaints();
  const { events } = useEvents();
  const { activities } = useActivities();
  const { committee } = useCommittee();
  const { blocks, flats } = useBlockFlat();
  const { garbageAccounts, garbageBills } = useGarbage();

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const items = [];

    // Residents
    if (category === "all" || category === "residents") {
      residents.forEach((r) => {
        if (
          r.owner?.toLowerCase().includes(q) ||
          r.flat?.toLowerCase().includes(q) ||
          r.mobile?.includes(q) ||
          r.block?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q)
        ) {
          items.push({
            type: "residents",
            icon: <FaUser className="text-blue-500" />,
            title: r.owner,
            subtitle: `${r.flat} • Block ${r.block || "—"} • ${r.mobile}`,
            path: isAdmin ? "/admin/residents" : null,
          });
        }
      });
    }

    // Notices
    if (category === "all" || category === "notices") {
      notices.forEach((n) => {
        if (
          n.title?.toLowerCase().includes(q) ||
          n.content?.toLowerCase().includes(q) ||
          n.description?.toLowerCase().includes(q)
        ) {
          items.push({
            type: "notices",
            icon: <FaBullhorn className="text-purple-500" />,
            title: n.title,
            subtitle: n.content?.substring(0, 80) || n.description?.substring(0, 80) || "",
            path: isAdmin ? "/admin/notices" : "/resident/notices",
          });
        }
      });
    }

    // Complaints
    if (category === "all" || category === "complaints") {
      complaints.forEach((c) => {
        if (
          c.title?.toLowerCase().includes(q) ||
          c.subject?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.residentName?.toLowerCase().includes(q)
        ) {
          items.push({
            type: "complaints",
            icon: <FaExclamationCircle className="text-red-500" />,
            title: c.title || c.subject,
            subtitle: `${c.residentName || "—"} • ${c.status || "pending"}`,
            path: isAdmin ? "/admin/complaints" : "/resident/complaints",
          });
        }
      });
    }

    // Events
    if (category === "all" || category === "events") {
      events.forEach((e) => {
        if (
          e.title?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q)
        ) {
          items.push({
            type: "events",
            icon: <FaCalendarAlt className="text-indigo-500" />,
            title: e.title,
            subtitle: `${e.date || e.eventDate || ""} ${e.location ? `• ${e.location}` : ""}`,
            path: isAdmin ? "/admin/events" : "/resident/events",
          });
        }
      });
    }

    // Activities
    if (category === "all" || category === "activities") {
      activities.forEach((a) => {
        if (
          a.title?.toLowerCase().includes(q) ||
          a.category?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.organizer?.toLowerCase().includes(q)
        ) {
          items.push({
            type: "activities",
            icon: <FaLeaf className="text-green-500" />,
            title: a.title,
            subtitle: `${a.category} • ${a.date || ""}`,
            path: isAdmin ? "/admin/activities" : "/resident/activities",
          });
        }
      });
    }

    // Committee
    if (category === "all" || category === "committee") {
      committee.forEach((m) => {
        if (
          m.name?.toLowerCase().includes(q) ||
          m.designation?.toLowerCase().includes(q) ||
          m.phone?.includes(q)
        ) {
          items.push({
            type: "committee",
            icon: <FaUserTie className="text-indigo-500" />,
            title: m.name,
            subtitle: `${m.designation || "Member"} ${m.phone ? `• ${m.phone}` : ""}`,
            path: isAdmin ? "/admin/committee" : null,
          });
        }
      });
    }

    // Blocks & Flats (admin only)
    if (isAdmin && (category === "all" || category === "blocks")) {
      blocks.forEach((b) => {
        if (b.name?.toLowerCase().includes(q)) {
          const blockFlats = flats.filter((f) => f.blockId === b.id);
          items.push({
            type: "blocks",
            icon: <FaBuilding className="text-gray-500" />,
            title: b.name,
            subtitle: `${blockFlats.length} flats • ${b.floors || 0} floors`,
            path: "/admin/blocks-flats",
          });
        }
      });

      flats.forEach((f) => {
        if (
          f.flatNumber?.toLowerCase().includes(q) ||
          f.residentName?.toLowerCase().includes(q)
        ) {
          items.push({
            type: "blocks",
            icon: <FaHome className="text-emerald-500" />,
            title: `Flat ${f.flatNumber}`,
            subtitle: `${f.blockName || "—"} • ${f.residentName || "Vacant"} • ${f.status}`,
            path: "/admin/blocks-flats",
          });
        }
      });
    }

    // Garbage Accounts & Bills (admin only)
    if (isAdmin && (category === "all" || category === "garbage")) {
      garbageAccounts.forEach((a) => {
        if (
          a.residentName?.toLowerCase().includes(q) ||
          a.flat?.toLowerCase().includes(q) ||
          a.block?.toLowerCase().includes(q)
        ) {
          items.push({
            type: "garbage",
            icon: <FaRecycle className="text-emerald-500" />,
            title: a.residentName || "Account",
            subtitle: `${a.flat || "—"} • ${a.block || "—"} • ${a.status}`,
            path: "/admin/residents",
          });
        }
      });

      garbageBills.forEach((b) => {
        if (
          b.residentName?.toLowerCase().includes(q) ||
          b.flat?.toLowerCase().includes(q)
        ) {
          items.push({
            type: "garbage",
            icon: <FaRecycle className="text-teal-500" />,
            title: `GC Bill — ${b.residentName || (b.flat ? `Flat ${b.flat}` : "Resident")}`,
            subtitle: `${b.month} ${b.year} • ₹${b.amount} • ${b.status}`,
            path: "/admin/bills",
          });
        }
      });
    }

    return items.slice(0, 20);
  }, [query, category, residents, notices, complaints, events, activities, committee, blocks, flats, garbageAccounts, garbageBills, isAdmin]);

  function handleSelect(result) {
    setOpen(false);
    setQuery("");
    if (result.path) {
      navigate(result.path);
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 text-sm transition"
      >
        <FaSearch className="text-xs" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-white rounded border font-mono">
          Ctrl+K
        </kbd>
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-start justify-center pt-[10vh]">
          <div
            ref={panelRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col overflow-hidden mx-4"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b">
              <FaSearch className="text-gray-400 text-lg shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search residents, notices, events, activities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 text-lg outline-none placeholder:text-gray-400"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600">
                  <FaTimes />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="px-2 py-1 text-xs bg-gray-100 rounded-lg text-gray-500 hover:bg-gray-200"
              >
                ESC
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 px-5 py-2.5 border-b overflow-x-auto">
              {CATEGORIES.map((cat) => {
                if (!isAdmin && cat.key === "blocks") return null;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                      category === cat.key
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {cat.icon}
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {query.length < 2 ? (
                <div className="p-8 text-center text-gray-400">
                  <FaSearch className="text-4xl mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">Type at least 2 characters to search</p>
                </div>
              ) : results.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm">No results found for "{query}"</p>
                </div>
              ) : (
                <div className="py-2">
                  {results.map((result, i) => (
                    <button
                      key={`${result.type}-${i}`}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition text-left"
                    >
                      <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        {result.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{result.title}</p>
                        <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 font-medium shrink-0">
                        {result.type}
                      </span>
                      {result.path && (
                        <FaArrowRight className="text-gray-300 text-xs shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 border-t bg-gray-50 text-[10px] text-gray-400 flex items-center justify-between">
              <span>{results.length} results</span>
              <span>↑↓ Navigate • Enter Select • Esc Close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

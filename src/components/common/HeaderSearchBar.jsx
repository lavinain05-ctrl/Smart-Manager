import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaTimes,
  FaBullhorn,
  FaCalendarAlt,
  FaExclamationCircle,
  FaFileInvoiceDollar,
  FaRecycle,
  FaUserTie,
  FaPhone,
  FaLightbulb,
} from "react-icons/fa";

const QUICK_ACTIONS = [
  { title: "Notices & Circulars", link: "/resident/notices", icon: <FaBullhorn className="text-indigo-500" />, keywords: ["notice", "announcement", "circular", "meeting", "alert"] },
  { title: "Upcoming Events", link: "/resident/events", icon: <FaCalendarAlt className="text-emerald-500" />, keywords: ["event", "festival", "sports", "gathering", "diwali", "holi"] },
  { title: "Register Complaint", link: "/resident/complaints", icon: <FaExclamationCircle className="text-rose-500" />, keywords: ["complaint", "issue", "water", "electricity", "seepage", "lift"] },
  { title: "My Bills & Receipts", link: "/resident/bills", icon: <FaFileInvoiceDollar className="text-blue-500" />, keywords: ["bill", "payment", "due", "receipt", "fee", "pay"] },
  { title: "Garbage Collection", link: "/resident/garbage", icon: <FaRecycle className="text-teal-500" />, keywords: ["garbage", "waste", "cleaning", "trash", "collection"] },
  { title: "RWA Committee Members", link: "/resident/committee", icon: <FaUserTie className="text-amber-500" />, keywords: ["committee", "president", "secretary", "treasurer", "member"] },
  { title: "Emergency Contacts", link: "/resident/emergency", icon: <FaPhone className="text-red-500" />, keywords: ["emergency", "police", "ambulance", "fire", "security", "guard"] },
  { title: "Suggestion Box", link: "/resident/suggestions", icon: <FaLightbulb className="text-yellow-500" />, keywords: ["suggestion", "idea", "feedback"] },
];

export default function HeaderSearchBar({ isMobile = false, onCloseMobile = () => {} }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? QUICK_ACTIONS.filter(
        (item) =>
          item.title.toLowerCase().includes(trimmed) ||
          item.keywords.some((k) => k.includes(trimmed))
      )
    : QUICK_ACTIONS.slice(0, 4);

  const handleSelect = (link) => {
    setOpen(false);
    setQuery("");
    if (isMobile) onCloseMobile();
    navigate(link);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && filtered.length > 0) {
      handleSelect(filtered[0].link);
    } else if (e.key === "Escape") {
      setOpen(false);
      if (isMobile) onCloseMobile();
    }
  };

  return (
    <div className={`relative ${isMobile ? "w-full" : "w-64 sm:w-72 md:w-80 lg:w-96"}`} ref={containerRef}>
      <div className="relative flex items-center">
        <FaSearch className="absolute left-3.5 text-slate-400 text-sm pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search notices, events, complaints..."
          className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-full border border-slate-200/90 dark:border-slate-700/80 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-2xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Autocomplete / Quick Jump Menu */}
      {open && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
            {trimmed ? "Matching Results" : "Quick Access"}
          </div>

          <div className="max-h-64 overflow-y-auto py-1 divide-y divide-slate-50 dark:divide-slate-800/40">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-slate-500">
                No matching portal sections found for "{query}"
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.link}
                  type="button"
                  onClick={() => handleSelect(item.link)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-800/70 transition group"
                >
                  <span className="text-base shrink-0 group-hover:scale-110 transition-transform">
                    {item.icon}
                  </span>
                  <span className="font-semibold truncate flex-1">{item.title}</span>
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    Jump →
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaLightbulb,
  FaPaperPlane,
  FaClock,
  FaUserSecret,
  FaUserCheck,
  FaCommentDots,
  FaBan,
  FaArrowLeft,
  FaSearch,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import {
  subscribeSuggestions,
  addSuggestion,
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUS_CONFIG,
} from "../../services/suggestionService";
import { subscribeSettings } from "../../services/settingsService";

export default function ResidentSuggestions() {
  const { user } = useAuth();
  const { residents } = useResidents();

  const [settings, setSettings] = useState({ enableSuggestions: true });
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Society Improvement");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Subscribe to Society Settings
  useEffect(() => {
    const unsub = subscribeSettings((data) => {
      setSettings(data || { enableSuggestions: true });
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Subscribe to Suggestions
  useEffect(() => {
    const unsub = subscribeSuggestions((data) => {
      setSuggestions(data || []);
      setLoading(false);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const cleanPhone = useMemo(() => {
    const raw = user?.phone || user?.mobile || (user?.email?.includes("@") ? user.email.split("@")[0] : "");
    const digits = String(raw).replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }, [user]);

  const resident = useMemo(() => {
    return (
      residents.find(
        (r) =>
          r.id === user?.residentId ||
          r.id === user?.uid ||
          (cleanPhone && String(r.mobile || "").replace(/\D/g, "").slice(-10) === cleanPhone) ||
          (user?.name && r.owner?.toLowerCase() === user.name.toLowerCase())
      ) || null
    );
  }, [residents, user, cleanPhone]);

  const canonicalResidentId = resident?.id || user?.residentId || user?.uid || "";
  const flatNumber = resident?.flat || user?.flat || "";
  const residentName = resident?.owner || user?.name || "Resident";

  // Filter suggestions submitted by this resident
  const mySuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      if (s.residentId && s.residentId === canonicalResidentId) return true;
      if (flatNumber && s.flatNumber && s.flatNumber === flatNumber) return true;
      return false;
    });
  }, [suggestions, canonicalResidentId, flatNumber]);

  const filteredSuggestions = useMemo(() => {
    if (!search.trim()) return mySuggestions;
    const q = search.toLowerCase();
    return mySuggestions.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
    );
  }, [mySuggestions, search]);

  const isEnabled = settings.enableSuggestions !== false;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isEnabled) {
      toast.error("The Suggestion Box is currently paused by administration.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error("Please provide both a title and description for your suggestion.");
      return;
    }

    setSubmitting(true);
    try {
      await addSuggestion({
        title,
        category,
        description,
        isAnonymous,
        residentId: canonicalResidentId,
        residentName,
        flatNumber,
        mobile: resident?.mobile || user?.phone || "",
      });

      toast.success("Thank you! Your suggestion has been submitted to the RWA administration.");
      setTitle("");
      setDescription("");
      setIsAnonymous(false);
      setCategory("Society Improvement");
    } catch (err) {
      console.error("Error submitting suggestion:", err);
      toast.error("Could not submit suggestion. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return "Just now";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl shrink-0">
            <FaLightbulb />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Community Feedback
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  isEnabled
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                }`}
              >
                {isEnabled ? "Accepting Ideas" : "Paused"}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              Resident Suggestion Box
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Share your thoughts, ideas, and improvement suggestions directly with the RWA Committee.
            </p>
          </div>
        </div>

        <Link
          to="/resident/dashboard"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition self-start sm:self-center"
        >
          <FaArrowLeft className="text-[10px]" /> Back to Dashboard
        </Link>
      </div>

      {/* Paused Notice Banner if disabled */}
      {!isEnabled && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3">
          <FaBan className="text-rose-600 dark:text-rose-400 text-lg mt-0.5 shrink-0" />
          <div className="text-xs sm:text-sm text-rose-800 dark:text-rose-300">
            <strong className="block font-bold">Suggestion Box Currently Paused</strong>
            The society administration has temporarily paused new suggestion submissions. You can still view and review your previously submitted ideas below.
          </div>
        </div>
      )}

      {/* Grid: Submit Form (Left) & My Submitted Suggestions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center text-sm">
              <FaPaperPlane />
            </div>
            <h2 className="font-bold text-base text-slate-900 dark:text-white">
              Submit a Suggestion
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!isEnabled}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {SUGGESTION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject / Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Suggestion Title
              </label>
              <input
                type="text"
                placeholder="e.g. Add solar lights in main park pathway..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!isEnabled}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 placeholder-slate-400"
              />
            </div>

            {/* Detailed Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Details & Proposed Idea
              </label>
              <textarea
                rows={5}
                placeholder="Describe your idea, benefits for the society, or how it could be implemented..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isEnabled}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 placeholder-slate-400 resize-none leading-relaxed"
              />
            </div>

            {/* Anonymity Toggle */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="text-base text-slate-500">
                  {isAnonymous ? <FaUserSecret className="text-amber-500" /> : <FaUserCheck className="text-emerald-500" />}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    {isAnonymous ? "Submit Anonymously" : `Submit as Flat ${flatNumber || "Resident"}`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isAnonymous
                      ? "Your name and flat will not be visible to the committee."
                      : "The committee will see your registered flat details."}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAnonymous((prev) => !prev)}
                disabled={!isEnabled}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAnonymous ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isAnonymous ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isEnabled || submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaPaperPlane className="text-xs" />
              {submitting ? "Sending..." : "Submit to RWA Committee"}
            </button>
          </form>
        </div>

        {/* Right List: My Suggestions (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span>My Submitted Suggestions</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {mySuggestions.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Track the committee review status and read official replies
                </p>
              </div>

              {/* Search Bar */}
              {mySuggestions.length > 0 && (
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search ideas..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Loading suggestions...
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 mx-auto text-xl">
                  <FaLightbulb />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {search ? "No suggestions matched your search." : "No suggestions submitted yet."}
                </p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Have an idea to make D Block even better? Fill in the form on the left to send it to the RWA committee.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSuggestions.map((item) => {
                  const statusCfg =
                    SUGGESTION_STATUS_CONFIG[item.status] || SUGGESTION_STATUS_CONFIG["Under Review"];

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-3"
                    >
                      {/* Top Bar: Category + Date + Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                            {item.category}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(item.createdAt)}
                          </span>
                          {item.isAnonymous && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <FaUserSecret /> Anonymous
                            </span>
                          )}
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusCfg.color}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-line">
                          {item.description}
                        </p>
                      </div>

                      {/* Official Admin Response Box */}
                      {item.adminRemarks ? (
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-850 border border-emerald-200/80 dark:border-emerald-800/60 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            <FaCommentDots />
                            <span>Official RWA Committee Response</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            {item.adminRemarks}
                          </p>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 italic">
                          <FaClock className="text-[9px]" /> Awaiting committee review & response
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

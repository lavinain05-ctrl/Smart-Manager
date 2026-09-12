import { useState, useEffect, useMemo } from "react";
import {
  FaQuestionCircle,
  FaHeadset,
  FaEdit,
  FaTrash,
  FaPlus,
  FaSave,
  FaUndo,
  FaSearch,
  FaTimes,
  FaCheckCircle,
  FaClock,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaTag,
  FaRecycle,
  FaHandHoldingHeart,
  FaFileInvoiceDollar,
  FaExclamationCircle,
  FaUserTie,
  FaExternalLinkAlt,
  FaLightbulb,
  FaEye,
  FaInfoCircle,
} from "react-icons/fa";
import toast from "react-hot-toast";

import {
  subscribeSupportConfig,
  saveSupportConfig,
  resetSupportConfig,
  subscribeSupportFaqs,
  saveSupportFaqs,
  resetSupportFaqs,
  DEFAULT_HELPDESK_CONFIG,
  DEFAULT_SUPPORT_FAQS,
} from "../../services/supportService";

const CATEGORY_OPTIONS = [
  { id: "garbage", label: "Garbage Collection", icon: <FaRecycle /> },
  { id: "special", label: "Special Collections", icon: <FaHandHoldingHeart /> },
  { id: "billing", label: "Billing & Receipts", icon: <FaFileInvoiceDollar /> },
  { id: "complaints", label: "Complaints & Maintenance", icon: <FaExclamationCircle /> },
  { id: "society", label: "Society & Contacts", icon: <FaUserTie /> },
  { id: "general", label: "General & Miscellaneous", icon: <FaQuestionCircle /> },
];

export default function ManageSupport() {
  const [activeTab, setActiveTab] = useState("helpdesk"); // "helpdesk" | "faqs" | "preview"

  // ─── Helpdesk Config State ───
  const [helpdeskConfig, setHelpdeskConfig] = useState(DEFAULT_HELPDESK_CONFIG);
  const [savingHelpdesk, setSavingHelpdesk] = useState(false);

  // ─── FAQs State ───
  const [faqs, setFaqs] = useState(DEFAULT_SUPPORT_FAQS);
  const [savingFaqs, setSavingFaqs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  // ─── Modal State for Add / Edit FAQ ───
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null); // null = add, object = edit
  const [faqForm, setFaqForm] = useState({
    id: "",
    category: "garbage",
    badge: "",
    question: "",
    answer: "",
    tips: "",
    actionLink: "",
    actionText: "",
    active: true,
  });

  // ─── Delete Confirmation Modal ───
  const [faqToDelete, setFaqToDelete] = useState(null);

  // ─── Subscriptions ───
  useEffect(() => {
    const unsubConfig = subscribeSupportConfig((data) => {
      setHelpdeskConfig(data);
    });

    const unsubFaqs = subscribeSupportFaqs((list) => {
      setFaqs(list);
    });

    return () => {
      unsubConfig();
      unsubFaqs();
    };
  }, []);

  // ─── Helpdesk Config Handlers ───
  const handleConfigChange = (field, value) => {
    setHelpdeskConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveHelpdesk = async (e) => {
    e.preventDefault();
    setSavingHelpdesk(true);
    try {
      await saveSupportConfig(helpdeskConfig);
      toast.success("Helpdesk & office details saved! Updated on all resident devices.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save helpdesk details.");
    } finally {
      setSavingHelpdesk(false);
    }
  };

  const handleResetHelpdesk = async () => {
    if (!window.confirm("Reset helpdesk details to standard defaults?")) return;
    try {
      await resetSupportConfig();
      toast.success("Helpdesk details reset to defaults.");
    } catch {
      toast.error("Could not reset helpdesk details.");
    }
  };

  // ─── FAQs Filtered List ───
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqs.filter((faq) => {
      const matchCat =
        selectedCategoryFilter === "all" || faq.category === selectedCategoryFilter;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        (faq.badge || "").toLowerCase().includes(q)
      );
    });
  }, [faqs, searchQuery, selectedCategoryFilter]);

  // ─── FAQ CRUD Handlers ───
  const openAddFaqModal = () => {
    setEditingFaq(null);
    setFaqForm({
      id: `faq-${Date.now()}`,
      category: selectedCategoryFilter !== "all" ? selectedCategoryFilter : "garbage",
      badge: "General",
      question: "",
      answer: "",
      tips: "",
      actionLink: "",
      actionText: "",
      active: true,
    });
    setFaqModalOpen(true);
  };

  const openEditFaqModal = (faq) => {
    setEditingFaq(faq);
    setFaqForm({
      id: faq.id,
      category: faq.category || "garbage",
      badge: faq.badge || "",
      question: faq.question || "",
      answer: faq.answer || "",
      tips: faq.tips || "",
      actionLink: faq.actionLink || "",
      actionText: faq.actionText || "",
      active: faq.active !== false,
    });
    setFaqModalOpen(true);
  };

  const handleSaveFaqModal = async (e) => {
    e.preventDefault();
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      toast.error("Please provide both a question and an answer.");
      return;
    }

    setSavingFaqs(true);
    try {
      let updatedList = [];
      if (editingFaq) {
        // Edit
        updatedList = faqs.map((item) =>
          item.id === editingFaq.id ? { ...faqForm } : item
        );
      } else {
        // Add new
        updatedList = [{ ...faqForm, id: `faq-${Date.now()}` }, ...faqs];
      }

      await saveSupportFaqs(updatedList);
      toast.success(editingFaq ? "FAQ updated successfully!" : "New FAQ added!");
      setFaqModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save FAQ.");
    } finally {
      setSavingFaqs(false);
    }
  };

  const handleDeleteFaq = async () => {
    if (!faqToDelete) return;
    setSavingFaqs(true);
    try {
      const updatedList = faqs.filter((item) => item.id !== faqToDelete.id);
      await saveSupportFaqs(updatedList);
      toast.success("FAQ deleted.");
      setFaqToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete FAQ.");
    } finally {
      setSavingFaqs(false);
    }
  };

  const handleToggleFaqActive = async (faq) => {
    try {
      const updatedList = faqs.map((item) =>
        item.id === faq.id ? { ...item, active: item.active === false } : item
      );
      await saveSupportFaqs(updatedList);
      toast.success(
        faq.active === false
          ? "FAQ enabled for residents."
          : "FAQ hidden from residents."
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
    }
  };

  const handleRestoreDefaultFaqs = async () => {
    if (
      !window.confirm(
        "Are you sure you want to restore the entire standard FAQ knowledge base? Any custom questions added will be reset to default templates."
      )
    ) {
      return;
    }

    setSavingFaqs(true);
    try {
      await resetSupportFaqs();
      toast.success("Standard society FAQs restored!");
    } catch (err) {
      console.error(err);
      toast.error("Could not restore FAQs.");
    } finally {
      setSavingFaqs(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ═══════════ Header ═══════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
            <FaHeadset /> Resident Knowledge Base & Helpdesk Admin
          </div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">
            Support & Helpdesk Management
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Admin controls to customize the Helpdesk contact card, timings, helpline, and all FAQs shown across every resident portal.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab("helpdesk")}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === "helpdesk"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Helpdesk & Office
          </button>
          <button
            onClick={() => setActiveTab("faqs")}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === "faqs"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            FAQs ({faqs.length})
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === "preview"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FaEye /> Live Preview
          </button>
        </div>
      </div>

      {/* ═══════════ TAB 1: Helpdesk Contact Details ═══════════ */}
      {activeTab === "helpdesk" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-6">
          <div className="border-b pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                RWA Management & Helpdesk Contact Details
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                These details are displayed in the bottom card of the Resident Support page for all flats.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetHelpdesk}
              className="text-xs text-gray-400 hover:text-red-600 font-semibold inline-flex items-center gap-1 transition"
            >
              <FaUndo className="text-[10px]" /> Reset Defaults
            </button>
          </div>

          <form onSubmit={handleSaveHelpdesk} className="space-y-6">
            {/* Header Titles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Card Section Title
                </label>
                <input
                  type="text"
                  value={helpdeskConfig.sectionTitle || ""}
                  onChange={(e) => handleConfigChange("sectionTitle", e.target.value)}
                  placeholder="e.g. RWA Management & Helpdesk"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tagline / Subtitle
                </label>
                <input
                  type="text"
                  value={helpdeskConfig.tagline || ""}
                  onChange={(e) => handleConfigChange("tagline", e.target.value)}
                  placeholder="Need direct assistance? Get in touch with our office..."
                  className="w-full border rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Office Timings */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <FaClock /> Office Timings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Weekday Timings (Mon - Sat)
                  </label>
                  <input
                    type="text"
                    value={helpdeskConfig.officeTimingsWeekday || ""}
                    onChange={(e) =>
                      handleConfigChange("officeTimingsWeekday", e.target.value)
                    }
                    placeholder="Mon - Sat: 9:00 AM - 6:00 PM"
                    className="w-full bg-white border rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Sunday / Weekend Timings
                  </label>
                  <input
                    type="text"
                    value={helpdeskConfig.officeTimingsWeekend || ""}
                    onChange={(e) =>
                      handleConfigChange("officeTimingsWeekend", e.target.value)
                    }
                    placeholder="Sunday: 10:00 AM - 2:00 PM"
                    className="w-full bg-white border rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Helpline & Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Helpline */}
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <FaPhone /> Helpline & Security Phone
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    value={helpdeskConfig.helplinePhone || ""}
                    onChange={(e) => handleConfigChange("helplinePhone", e.target.value)}
                    placeholder="011-23456789 / +91 9876543210"
                    className="w-full bg-white border rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Helpline Availability Note
                  </label>
                  <input
                    type="text"
                    value={helpdeskConfig.helplineNote || ""}
                    onChange={(e) => handleConfigChange("helplineNote", e.target.value)}
                    placeholder="Available 24/7 for urgent matters"
                    className="w-full bg-white border rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Official Email */}
              <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200/80 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                  <FaEnvelope /> Official RWA Email
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Support Email Address
                  </label>
                  <input
                    type="email"
                    value={helpdeskConfig.officialEmail || ""}
                    onChange={(e) => handleConfigChange("officialEmail", e.target.value)}
                    placeholder="rwa.dblock@indraprastha.org"
                    className="w-full bg-white border rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Email SLA / Response Note
                  </label>
                  <input
                    type="text"
                    value={helpdeskConfig.emailNote || ""}
                    onChange={(e) => handleConfigChange("emailNote", e.target.value)}
                    placeholder="Responses within 24 hours"
                    className="w-full bg-white border rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Office Physical Address */}
            <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <FaMapMarkerAlt /> Physical Office Address
              </h3>
              <input
                type="text"
                value={helpdeskConfig.officeAddress || ""}
                onChange={(e) => handleConfigChange("officeAddress", e.target.value)}
                placeholder="Community Center, D Block, Indraprastha Society, Delhi"
                className="w-full bg-white border rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="submit"
                disabled={savingHelpdesk}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                <FaSave />
                {savingHelpdesk ? "Saving Changes..." : "Save Helpdesk Details"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════ TAB 2: FAQ Knowledge Base Management ═══════════ */}
      {activeTab === "faqs" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-3 max-w-lg">
              <div className="relative w-full">
                <FaSearch className="absolute left-3.5 top-3 text-gray-400 text-sm" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions or keywords..."
                  className="w-full border rounded-xl pl-9 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleRestoreDefaultFaqs}
                disabled={savingFaqs}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-red-600 border border-slate-200 rounded-xl hover:bg-red-50 transition"
                title="Restore society template FAQs"
              >
                Restore Defaults
              </button>

              <button
                type="button"
                onClick={openAddFaqModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
              >
                <FaPlus /> Add New Question
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setSelectedCategoryFilter("all")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedCategoryFilter === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Questions ({faqs.length})
            </button>
            {CATEGORY_OPTIONS.map((cat) => {
              const count = faqs.filter((f) => f.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryFilter(cat.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                    selectedCategoryFilter === cat.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-gray-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className="opacity-70 text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* FAQs List */}
          {filteredFaqs.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
              <FaQuestionCircle className="text-4xl text-gray-300 mx-auto mb-3" />
              <h3 className="font-bold text-gray-700">No questions found</h3>
              <p className="text-gray-500 text-xs mt-1">
                Try a different search or click "Add New Question" above.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredFaqs.map((faq, index) => {
                const categoryObj =
                  CATEGORY_OPTIONS.find((c) => c.id === faq.category) || {
                    label: faq.category,
                    icon: <FaQuestionCircle />,
                  };

                return (
                  <div
                    key={faq.id || index}
                    className={`bg-white rounded-2xl border p-5 shadow-xs transition hover:shadow-md ${
                      faq.active === false
                        ? "opacity-60 bg-gray-50 border-gray-200"
                        : "border-slate-200/90"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                            {categoryObj.icon}
                            {categoryObj.label}
                          </span>
                          {faq.badge && (
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                              <FaTag className="inline mr-1 text-[10px]" />
                              {faq.badge}
                            </span>
                          )}
                          {faq.active === false && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Hidden from Residents
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-gray-900 leading-snug">
                          {faq.question}
                        </h3>

                        <p className="text-gray-600 text-xs sm:text-sm whitespace-pre-line leading-relaxed">
                          {faq.answer}
                        </p>

                        {faq.tips && (
                          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2">
                            <FaLightbulb className="text-amber-500 mt-0.5 shrink-0" />
                            <span>
                              <strong>Tip:</strong> {faq.tips}
                            </span>
                          </div>
                        )}

                        {faq.actionLink && (
                          <div className="pt-1 text-xs text-blue-600 font-semibold inline-flex items-center gap-1">
                            <FaExternalLinkAlt className="text-[10px]" />
                            <span>
                              Button: "{faq.actionText || 'View'}" → {faq.actionLink}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-start border-t sm:border-t-0 pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleToggleFaqActive(faq)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                            faq.active === false
                              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                          title={
                            faq.active === false
                              ? "Make visible to residents"
                              : "Hide from residents"
                          }
                        >
                          {faq.active === false ? "Show" : "Hide"}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditFaqModal(faq)}
                          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                          title="Edit Question"
                        >
                          <FaEdit />
                        </button>

                        <button
                          type="button"
                          onClick={() => setFaqToDelete(faq)}
                          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                          title="Delete Question"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ TAB 3: Live Preview ═══════════ */}
      {activeTab === "preview" && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-800 flex items-center gap-2">
            <FaInfoCircle className="text-blue-600 shrink-0 text-base" />
            <span>
              This is a live preview showing how your Helpdesk Card and Frequently Asked Questions appear to all residents on the Resident Portal.
            </span>
          </div>

          {/* Preview: The Helpdesk Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-800 tracking-tight">
                  {helpdeskConfig.sectionTitle || "RWA Management & Helpdesk"}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {helpdeskConfig.tagline ||
                    "Need direct assistance? Get in touch with our office bearers or visit the society office."}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm opacity-90">
                <FaHeadset /> Message RWA Helpdesk
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {/* Office Timings */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-base shrink-0 mt-0.5">
                  <FaClock />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    Office Timings
                  </span>
                  <h4 className="font-bold text-sm text-gray-800 mt-0.5">
                    {helpdeskConfig.officeTimingsWeekday}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {helpdeskConfig.officeTimingsWeekend}
                  </p>
                </div>
              </div>

              {/* Helpline & Security */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-base shrink-0 mt-0.5">
                  <FaPhone />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-700/80 uppercase tracking-wider block">
                    Helpline & Security
                  </span>
                  <h4 className="font-bold text-sm text-gray-800 mt-0.5">
                    {helpdeskConfig.helplinePhone}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {helpdeskConfig.helplineNote}
                  </p>
                </div>
              </div>

              {/* Official Email */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-base shrink-0 mt-0.5">
                  <FaEnvelope />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-purple-700/80 uppercase tracking-wider block">
                    Official Email
                  </span>
                  <h4 className="font-bold text-sm text-gray-800 mt-0.5 truncate max-w-[170px]">
                    {helpdeskConfig.officialEmail}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {helpdeskConfig.emailNote}
                  </p>
                </div>
              </div>

              {/* RWA Office */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-base shrink-0 mt-0.5">
                  <FaMapMarkerAlt />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-rose-700/80 uppercase tracking-wider block">
                    RWA Office
                  </span>
                  <h4 className="font-bold text-sm text-gray-800 mt-0.5 leading-snug">
                    {helpdeskConfig.officeAddress}
                  </h4>
                </div>
              </div>
            </div>
          </div>

          {/* Sample FAQ Cards Preview */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-700 text-sm">
              Active FAQs Sample ({faqs.filter((f) => f.active !== false).length} active)
            </h3>
            {faqs
              .filter((f) => f.active !== false)
              .slice(0, 3)
              .map((faq) => (
                <div
                  key={faq.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                      {faq.badge || "General"}
                    </span>
                    <h4 className="font-bold text-gray-800 text-sm sm:text-base">
                      {faq.question}
                    </h4>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm pl-2">
                    {faq.answer}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ═══════════ ADD / EDIT FAQ MODAL ═══════════ */}
      {faqModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-800">
                {editingFaq ? "Edit FAQ Question" : "Add New Support FAQ"}
              </h3>
              <button
                type="button"
                onClick={() => setFaqModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveFaqModal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={faqForm.category}
                    onChange={(e) =>
                      setFaqForm({ ...faqForm, category: e.target.value })
                    }
                    className="w-full border rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Badge Tag (e.g. Schedule, How to Pay)
                  </label>
                  <input
                    type="text"
                    value={faqForm.badge}
                    onChange={(e) =>
                      setFaqForm({ ...faqForm, badge: e.target.value })
                    }
                    placeholder="e.g. Timings, Verification, Receipts"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Question *
                </label>
                <input
                  type="text"
                  value={faqForm.question}
                  onChange={(e) =>
                    setFaqForm({ ...faqForm, question: e.target.value })
                  }
                  placeholder="e.g. What are the garbage collection timings?"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Detailed Answer *
                </label>
                <textarea
                  rows={4}
                  value={faqForm.answer}
                  onChange={(e) =>
                    setFaqForm({ ...faqForm, answer: e.target.value })
                  }
                  placeholder="Provide a clear, accurate explanation for residents..."
                  className="w-full border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Helpful Tip (Optional)
                </label>
                <input
                  type="text"
                  value={faqForm.tips}
                  onChange={(e) =>
                    setFaqForm({ ...faqForm, tips: e.target.value })
                  }
                  placeholder="e.g. Keep waste placed outside before 7:30 AM."
                  className="w-full border rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Action Button Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={faqForm.actionLink}
                    onChange={(e) =>
                      setFaqForm({ ...faqForm, actionLink: e.target.value })
                    }
                    placeholder="/resident/garbage or /resident/bills"
                    className="w-full border rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Button Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={faqForm.actionText}
                    onChange={(e) =>
                      setFaqForm({ ...faqForm, actionText: e.target.value })
                    }
                    placeholder="e.g. View Overview / Pay Bill"
                    className="w-full border rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={faqForm.active}
                  onChange={(e) =>
                    setFaqForm({ ...faqForm, active: e.target.checked })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="activeCheck" className="text-xs font-bold text-gray-700 cursor-pointer">
                  Visible to residents immediately
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setFaqModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border text-sm font-semibold hover:bg-gray-50 text-gray-600"
                  disabled={savingFaqs}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFaqs}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-sm disabled:opacity-50"
                >
                  <FaCheckCircle />
                  {savingFaqs ? "Saving..." : editingFaq ? "Save Changes" : "Add Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════ DELETE CONFIRMATION MODAL ═══════════ */}
      {faqToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-xl">
              <FaTrash />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Delete this FAQ?
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                "{faqToDelete.question}"
              </p>
              <p className="text-xs text-red-600 mt-2 font-medium">
                This question will be permanently removed from all resident support pages.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFaqToDelete(null)}
                className="px-4 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50"
                disabled={savingFaqs}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFaq}
                disabled={savingFaqs}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {savingFaqs ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

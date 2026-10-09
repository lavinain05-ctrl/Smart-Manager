import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaQuestionCircle,
  FaSearch,
  FaChevronDown,
  FaChevronUp,
  FaRecycle,
  FaHandHoldingHeart,
  FaFileInvoiceDollar,
  FaExclamationCircle,
  FaPhone,
  FaWhatsapp,
  FaEnvelope,
  FaClock,
  FaMapMarkerAlt,
  FaPaperPlane,
  FaTimes,
  FaCheckCircle,
  FaArrowRight,
  FaLightbulb,
  FaShieldAlt,
  FaInfoCircle,
  FaUserTie,
  FaQrcode,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import { useSettings } from "../../context/SettingsContext";
import { useCommittee } from "../../context/CommitteeContext";
import { useGarbage } from "../../context/GarbageContext";
import { isGcParticipating } from "../../services/statisticsService";
import { DEFAULT_JOIN_GC_MESSAGE } from "./ResidentGarbage";
import { addComplaint as createHelpdeskTicket } from "../../services/complaintService";
import { createNotification } from "../../services/notificationService";
import {
  subscribeSupportConfig,
  subscribeSupportFaqs,
  DEFAULT_HELPDESK_CONFIG,
  DEFAULT_SUPPORT_FAQS,
} from "../../services/supportService";
import toast from "react-hot-toast";

const FAQ_CATEGORIES = [
  { id: "all", label: "All Questions", icon: <FaQuestionCircle /> },
  { id: "garbage", label: "Garbage Collection", icon: <FaRecycle /> },
  { id: "special", label: "Special Collections", icon: <FaHandHoldingHeart /> },
  { id: "billing", label: "Billing & Receipts", icon: <FaFileInvoiceDollar /> },
  { id: "complaints", label: "Complaints & Maintenance", icon: <FaExclamationCircle /> },
  { id: "society", label: "Society & Contacts", icon: <FaUserTie /> },
];

export default function ResidentSupport() {
  const { user } = useAuth();
  const { residents = [] } = useResidents();
  const { settings = {} } = useSettings();
  const { committee = [] } = useCommittee();
  const { garbageRequests = [], submitRequest } = useGarbage();

  // Dynamic helpdesk config and FAQs from Firestore (via supportService)
  const [helpdeskConfig, setHelpdeskConfig] = useState(DEFAULT_HELPDESK_CONFIG);
  const [faqsList, setFaqsList] = useState(DEFAULT_SUPPORT_FAQS);

  useEffect(() => {
    const unsubConfig = subscribeSupportConfig((data) => {
      setHelpdeskConfig(data);
    });
    const unsubFaqs = subscribeSupportFaqs((list) => {
      setFaqsList(list.filter((f) => f.active !== false));
    });
    return () => {
      unsubConfig();
      unsubFaqs();
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedId, setExpandedId] = useState("gc-1");
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSubject, setContactSubject] = useState("General Support Inquiry");
  const [contactMessage, setContactMessage] = useState("");
  const [submittingInquiry, setSubmittingInquiry] = useState(false);

  const faqsSectionRef = useRef(null);

  const handleBrowseFaqs = (category = null) => {
    if (category) {
      setSelectedCategory(category);
    }
    setTimeout(() => {
      if (faqsSectionRef.current) {
        faqsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  // Resident info
  const resident = useMemo(() => {
    return (
      residents.find(
        (r) =>
          r.id === user?.residentId ||
          r.id === user?.uid ||
          (user?.phone && r.mobile === user.phone) ||
          (user?.name && r.owner?.toLowerCase() === user.name.toLowerCase())
      ) || null
    );
  }, [residents, user]);

  const isEnrolledInGc = isGcParticipating(resident);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqsList.filter((faq) => {
      const matchCategory =
        selectedCategory === "all" || faq.category === selectedCategory;
      if (!matchCategory) return false;

      if (!q) return true;
      const titleMatch = faq.question.toLowerCase().includes(q);
      const answerMatch = faq.answer.toLowerCase().includes(q);
      const badgeMatch = (faq.badge || "").toLowerCase().includes(q);
      return titleMatch || answerMatch || badgeMatch;
    });
  }, [searchQuery, selectedCategory, faqsList]);

  const activeCommittee = useMemo(
    () => committee.filter((c) => c.status !== "inactive"),
    [committee]
  );

  const president = activeCommittee.find((c) =>
    (c.designation || "").toLowerCase().includes("president") &&
    !(c.designation || "").toLowerCase().includes("vice")
  );
  const secretary = activeCommittee.find((c) =>
    (c.designation || "").toLowerCase().includes("secretary") &&
    !(c.designation || "").toLowerCase().includes("joint")
  );

  async function handleSendHelpdeskMessage(e) {
    e.preventDefault();
    if (!contactMessage.trim()) {
      toast.error("Please enter your message for the RWA office.");
      return;
    }

    setSubmittingInquiry(true);
    try {
      const flatNum = resident?.flat || user?.flat || "—";
      const blockNum = resident?.block || user?.block || "";
      const residentName = resident?.owner || user?.name || "Resident";
      const phoneNum = resident?.mobile || user?.phone || "";

      // 1. Save Helpdesk Inquiry ticket to Firestore complaints collection
      await createHelpdeskTicket({
        residentId: resident?.id || user?.residentId || user?.uid || "",
        residentName,
        flat: flatNum,
        block: blockNum,
        phone: phoneNum,
        category: "Helpdesk Inquiry",
        priority: "Medium",
        description: `[Topic: ${contactSubject}]\n\n${contactMessage.trim()}`,
      });

      // 2. Send instant real-time notification to RWA Admin
      try {
        await createNotification({
          userId: "admin",
          title: `Helpdesk Inquiry: Flat ${flatNum} (${residentName})`,
          message: `${contactSubject} — ${contactMessage.slice(0, 100)}`,
          type: "inquiry",
          link: "/admin/complaints",
        });
      } catch (notifErr) {
        console.warn("Admin notification trigger failed:", notifErr);
      }

      toast.success("Message sent! Your inquiry is now registered with the RWA office.");
      setShowContactModal(false);
      setContactMessage("");
    } catch (err) {
      console.error("Helpdesk message error:", err);
      toast.error("Could not send message. Please call the helpline.");
    } finally {
      setSubmittingInquiry(false);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* ═══════════ Header & Hero Banner ═══════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-7 sm:p-9 shadow-xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-blue-100 text-xs font-semibold uppercase tracking-wider backdrop-blur-md mb-3">
            <FaShieldAlt className="text-blue-300" /> Resident Knowledge Base & Helpdesk
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            How can we help you today?
          </h1>
          <p className="mt-2 text-blue-100 text-sm sm:text-base leading-relaxed opacity-90">
            Find instant answers regarding Garbage Collection, Special Contributions,
            payment receipts, society maintenance, and official RWA guidelines.
          </p>

          {/* Search Box */}
          <div className="mt-6 relative max-w-xl">
            <FaSearch className="absolute left-4 top-3.5 text-gray-400 text-base" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleBrowseFaqs();
                }
              }}
              placeholder="Search by topic: garbage collection, contribute, receipts, bills..."
              className="w-full bg-white text-gray-800 rounded-2xl pl-11 pr-10 py-3.5 text-sm shadow-lg outline-none focus:ring-4 focus:ring-blue-400/40 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600 p-1"
                title="Clear"
              >
                <FaTimes />
              </button>
            )}
          </div>
        </div>

        {/* Decorative ambient gradients */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute right-10 bottom-0 w-64 h-64 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />
      </div>

      {/* ═══════════ Quick Topic Cards ═══════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Garbage Collection Support */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl mb-3.5 group-hover:scale-105 transition">
              <FaRecycle />
            </div>
            <h3 className="font-bold text-gray-800 text-base">Garbage Collection</h3>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              Doorstep waste pickup guidelines, timings (7 AM - 10:30 AM), enrollment & pause requests.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-emerald-600">
            <button
              type="button"
              onClick={() => handleBrowseFaqs("garbage")}
              className="hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Browse FAQs <FaArrowRight className="text-[10px]" />
            </button>
            <Link
              to="/resident/garbage"
              className="text-gray-400 hover:text-emerald-700 transition"
            >
              Service Page →
            </Link>
          </div>
        </div>

        {/* Special Collections */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center text-xl mb-3.5 group-hover:scale-105 transition">
              <FaHandHoldingHeart />
            </div>
            <h3 className="font-bold text-gray-800 text-base">Special Collections</h3>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              How to contribute to festivals, CCTV drives, park upgrades, and download official receipts.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-pink-600">
            <button
              type="button"
              onClick={() => handleBrowseFaqs("special")}
              className="hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Browse FAQs <FaArrowRight className="text-[10px]" />
            </button>
            <Link
              to="/resident/special-collections"
              className="text-gray-400 hover:text-pink-700 transition"
            >
              Campaigns →
            </Link>
          </div>
        </div>

        {/* Billing & Receipts */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl mb-3.5 group-hover:scale-105 transition">
              <FaFileInvoiceDollar />
            </div>
            <h3 className="font-bold text-gray-800 text-base">Billing & Receipts</h3>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              Monthly invoices, advance payments, receipt verification, and payment mode guidance.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-blue-600">
            <button
              type="button"
              onClick={() => handleBrowseFaqs("billing")}
              className="hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Browse FAQs <FaArrowRight className="text-[10px]" />
            </button>
            <Link
              to="/resident/bills"
              className="text-gray-400 hover:text-blue-700 transition"
            >
              My Bills →
            </Link>
          </div>
        </div>

        {/* Complaints & Helpdesk */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 hover:shadow-md transition flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl mb-3.5 group-hover:scale-105 transition">
              <FaExclamationCircle />
            </div>
            <h3 className="font-bold text-gray-800 text-base">Complaints & Tickets</h3>
            <p className="text-gray-500 text-xs mt-1 leading-relaxed">
              Raise issues for water, electricity, sanitation, or security and track live resolution status.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-amber-600">
            <button
              type="button"
              onClick={() => handleBrowseFaqs("complaints")}
              className="hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Browse FAQs <FaArrowRight className="text-[10px]" />
            </button>
            <Link
              to="/resident/complaints"
              className="text-gray-400 hover:text-amber-700 transition"
            >
              File a Ticket →
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════ Step-by-Step Guidance Box: How to Pay Garbage Collection ═══════════ */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-900 text-white p-6 sm:p-8 shadow-md border border-emerald-800/60">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/30">
              <FaRecycle /> Doorstep Collection Guide
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              How to Pay Your Monthly Garbage Collection Fee
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Garbage collection fees are collected directly at your doorstep by your RWA-assigned collector at the end of each month in 3 simple steps:
            </p>
          </div>
          <Link
            to="/resident/bills"
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg transition active:scale-95 shrink-0 inline-flex items-center gap-2"
          >
            <FaFileInvoiceDollar /> Check My Bills
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-3">
              1
            </div>
            <h4 className="font-bold text-sm text-white">Doorstep Collector Visit</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Your RWA-assigned collector visits your home at the end of each completed month to collect the monthly fee (in cash or UPI).
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-3">
              2
            </div>
            <h4 className="font-bold text-sm text-white">Instant System Update</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              The collector immediately updates your payment record in the RWA society system, changing your status to "Payment Confirmed".
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-3">
              3
            </div>
            <h4 className="font-bold text-sm text-white">Collect Official Receipt</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Please always collect your official receipt from the collector as confirmation. You can also view and download digital receipts in your portal.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════ Step-by-Step Guidance Box: How to Contribute ═══════════ */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-blue-950 text-white p-6 sm:p-8 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-bold uppercase tracking-wider border border-pink-500/30">
              <FaHandHoldingHeart /> Step-by-Step Guide
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              How to Contribute to Special Collections & Drives
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Learn how you can participate in festival funds, society security drives, and infrastructure improvements in 4 simple steps.
            </p>
          </div>
          <Link
            to="/resident/special-collections"
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-sm shadow-lg transition active:scale-95 shrink-0 inline-flex items-center gap-2"
          >
            <FaHandHoldingHeart /> View Active Campaigns
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-sm mb-3">
              1
            </div>
            <h4 className="font-bold text-sm text-white">Select a Drive</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Browse active drives in Special Collections (e.g. Festival Fund, CCTV Network).
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-sm mb-3">
              2
            </div>
            <h4 className="font-bold text-sm text-white">Choose Amount</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Pick a suggested contribution tier or enter your voluntary custom amount in ₹.
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-sm mb-3">
              3
            </div>
            <h4 className="font-bold text-sm text-white">Pay via UPI / Bank</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Scan the RWA QR code or pay via bank transfer, then input your 12-digit UTR reference.
            </p>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-sm mb-3">
              4
            </div>
            <h4 className="font-bold text-sm text-white">Download Receipt</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Once verified by RWA Treasury, download your official verified contribution receipt.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════ FAQs Section ═══════════ */}
      <div
        ref={faqsSectionRef}
        id="faqs-section"
        className="space-y-6 scroll-mt-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Showing {filteredFaqs.length} answer{filteredFaqs.length === 1 ? "" : "s"}
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full custom-scrollbar">
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                  selectedCategory === cat.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* FAQs Accordion List */}
        {filteredFaqs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
            <FaQuestionCircle className="text-4xl text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-gray-700">No matching questions found</h3>
            <p className="text-gray-500 text-xs mt-1">
              Try searching with different keywords or switch the category filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-semibold text-xs hover:bg-blue-100 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const isOpen = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? "border-blue-500/60 shadow-md ring-2 ring-blue-500/10"
                      : "border-slate-200/80 hover:border-slate-300 shadow-xs"
                  }`}
                >
                  <button
                    onClick={() => setExpandedId(isOpen ? null : faq.id)}
                    className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold shrink-0">
                        {faq.badge}
                      </span>
                      <h3 className="font-bold text-gray-800 text-sm sm:text-base leading-snug">
                        {faq.question}
                      </h3>
                    </div>
                    <div className="text-gray-400 shrink-0 text-sm">
                      {isOpen ? <FaChevronUp className="text-blue-600" /> : <FaChevronDown />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-6 sm:px-6 pt-0 border-t border-slate-100 mt-1">
                      <div className="pt-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                        {faq.answer}
                      </div>

                      {faq.tips && (
                        <div className="mt-4 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed">
                          <FaLightbulb className="text-amber-500 text-sm shrink-0 mt-0.5" />
                          <span>
                            <strong>Helpful Tip:</strong> {faq.tips}
                          </span>
                        </div>
                      )}

                      {faq.actionLink && (
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                          <Link
                            to={faq.actionLink}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition"
                          >
                            <span>{faq.actionText || "Open Section"}</span>
                            <FaArrowRight className="text-[10px]" />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════ RWA Contact & Helpdesk ═══════════ */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">
              {helpdeskConfig.sectionTitle || "RWA Management & Helpdesk"}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {helpdeskConfig.tagline ||
                "Need direct assistance? Get in touch with our office bearers or submit a request directly."}
            </p>
          </div>
          <button
            onClick={() => setShowContactModal(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-sm transition inline-flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <FaPaperPlane className="text-xs" /> Message RWA Helpdesk
          </button>
        </div>
      </div>

      {/* ═══════════ Helpdesk Message Modal ═══════════ */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-7">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2.5 text-blue-700">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <FaPaperPlane className="text-sm" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">
                    Message RWA Helpdesk
                  </h3>
                  <p className="text-xs text-gray-400">Direct inquiry to society administrators</p>
                </div>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSendHelpdeskMessage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Inquiry Topic / Subject
                </label>
                <select
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Garbage Collection Question">Garbage Collection Question / Issue</option>
                  <option value="Special Collection Contribution">Special Collection Contribution Assistance</option>
                  <option value="Bill or Receipt Discrepancy">Bill or Receipt Discrepancy</option>
                  <option value="Maintenance Request">Society Maintenance Request</option>
                  <option value="General Support Inquiry">General Support Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Your Message / Details
                </label>
                <textarea
                  rows={4}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Describe your question or request in detail..."
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium leading-relaxed"
                  required
                />
              </div>

              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-center gap-2">
                <FaInfoCircle className="text-blue-500 shrink-0" />
                <span>
                  Submitted by: <strong>{user?.name || resident?.owner || "Resident"}</strong> (Flat: {resident?.flat || user?.flat || "—"})
                </span>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 text-sm font-medium transition text-gray-600"
                  disabled={submittingInquiry}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInquiry}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-sm disabled:opacity-50"
                >
                  <FaPaperPlane className="text-xs" />
                  {submittingInquiry ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

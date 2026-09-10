import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FaCalendarAlt,
  FaClock,
  FaBullseye,
  FaCheckCircle,
  FaExclamationCircle,
  FaCopy,
  FaExternalLinkAlt,
  FaShieldAlt,
  FaSearch,
  FaDownload,
  FaBuilding,
  FaUser,
  FaPhone,
  FaEnvelope,
  FaFileAlt,
  FaCreditCard,
  FaQrcode,
  FaArrowRight,
  FaSpinner,
  FaTimesCircle,
  FaHandHoldingHeart
} from "react-icons/fa";
import {
  getCampaignById,
  submitSpecialContribution,
  lookupExternalContributionStatus
} from "../../services/specialCollectionService";
import { generateSpecialCollectionReceiptPDF } from "../../utils/specialCollectionReceiptGenerator";

export default function PublicSpecialCollection() {
  const { id } = useParams();

  // Campaign data
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tabs: 'contribute' or 'track'
  const [activeTab, setActiveTab] = useState("contribute");

  // Contribution Form State
  const [contributorName, setContributorName] = useState("");
  const [contributorMobile, setContributorMobile] = useState("");
  const [contributorEmail, setContributorEmail] = useState("");
  const [contributorCategory, setContributorCategory] = useState("Well-Wisher / Guest");
  const [addressDetails, setAddressDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [utrNumber, setUtrNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Post-submission success state
  const [submittedPayment, setSubmittedPayment] = useState(null);

  // Status Lookup State
  const [lookupRef, setLookupRef] = useState("");
  const [lookupMobile, setLookupMobile] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResults, setLookupResults] = useState(null);
  const [lookupError, setLookupError] = useState("");

  // Clipboard copy state
  const [copiedKey, setCopiedKey] = useState("");

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  useEffect(() => {
    async function loadCampaign() {
      if (!id) {
        setError("Invalid campaign link.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getCampaignById(id);
        if (!data) {
          setError("This collection campaign was not found or has expired.");
        } else {
          setCampaign(data);
          if (data.contributionModel === "fixed" || data.amountType === "fixed") {
            setAmount(data.fixedAmount || "");
          }
        }
      } catch (err) {
        console.error("Failed to load campaign:", err);
        setError("Unable to load campaign details. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    loadCampaign();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (!contributorName.trim()) {
      setSubmitError("Please enter your full name.");
      return;
    }
    const cleanPhone = contributorMobile.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setSubmitError("Please enter a valid 10-digit mobile number.");
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setSubmitError("Please enter a valid contribution amount.");
      return;
    }
    const minRequired = campaign.minAmount || campaign.minimumAmount;
    if (minRequired && numAmount < minRequired) {
      setSubmitError(`Minimum contribution amount is ₹${minRequired.toLocaleString("en-IN")}.`);
      return;
    }
    if (paymentMode === "UPI" && (!utrNumber || utrNumber.trim().length < 6)) {
      setSubmitError("Please enter a valid 12-digit UTR / UPI Transaction Reference Number.");
      return;
    }
    if (!declaration) {
      setSubmitError("Please check the confirmation declaration before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await submitSpecialContribution({
        campaignId: campaign.id,
        isExternal: true,
        contributorName: contributorName.trim(),
        contributorMobile: cleanPhone,
        contributorEmail: contributorEmail.trim(),
        contributorCategory,
        contributorFlat: addressDetails.trim(),
        amount: numAmount,
        paymentMode,
        utrNumber: utrNumber.trim(),
        notes: remarks.trim()
      });

      setSubmittedPayment({
        ...res,
        campaignTitle: campaign.name || campaign.title,
        amount: numAmount,
        contributorName: contributorName.trim(),
        utrNumber: utrNumber.trim()
      });
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitError(err.message || "Failed to submit contribution. Please check details.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    setLookupError("");
    setLookupResults(null);

    if (!lookupRef.trim() && !lookupMobile.trim()) {
      setLookupError("Please enter your Reference ID or Mobile Number.");
      return;
    }

    try {
      setLookupLoading(true);
      const results = await lookupExternalContributionStatus(campaign.id, lookupRef.trim(), lookupMobile.trim());
      if (!results || results.length === 0) {
        setLookupError("No contribution records found matching the provided details.");
      } else {
        setLookupResults(results);
      }
    } catch (err) {
      console.error("Lookup failed:", err);
      setLookupError("Failed to lookup records. Please verify the entered details.");
    } finally {
      setLookupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <FaSpinner className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-slate-300 text-sm">Loading collection campaign...</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center">
          <FaExclamationCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Campaign Unavailable</h2>
          <p className="text-slate-300 text-sm mb-6">{error || "This collection is not currently accepting contributions."}</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            Go to RWA Portal
          </Link>
        </div>
      </div>
    );
  }

  // Pre-calculate progress
  const target = campaign.targetAmount || 0;
  const collected = campaign.collectedAmount || 0;
  const percent = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
  const isClosed = campaign.status !== "active";

  const upiId = campaign.upiId || campaign.bankDetails?.upiId || "";
  const upiHolder = campaign.upiName || campaign.accountName || campaign.bankDetails?.accountHolderName || "D-Block RWA";
  const accNum = campaign.accountNumber || campaign.bankDetails?.accountNumber || "";
  const ifscCode = campaign.ifsc || campaign.bankDetails?.ifscCode || "";
  const bankName = campaign.bankName || campaign.bankDetails?.bankName || "";
  const campaignName = campaign.name || campaign.title || "Special Collection";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Banner / Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
              <FaBuilding />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-wide">D-Block RWA</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase font-semibold">
                  Special Contribution
                </span>
              </div>
              <p className="text-xs text-slate-400">Official Society Collection Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab("contribute");
                setSubmittedPayment(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "contribute"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              Contribute
            </button>
            <button
              onClick={() => setActiveTab("track")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === "track"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <FaSearch />
              Track Receipt
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        {/* Campaign Hero Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800/80 to-slate-900 border border-slate-700/60 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {campaign.collectionType || campaign.category || "Special Fund"}
            </span>
            {isClosed ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Campaign Closed
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Accepting Contributions
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
            {campaignName}
          </h1>

          {(campaign.description || campaign.purpose) && (
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl mb-6">
              {campaign.description || campaign.purpose}
            </p>
          )}

          {/* Progress / Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-700/60">
            <div>
              <span className="text-xs text-slate-400 font-medium block">Total Collected</span>
              <span className="text-xl sm:text-2xl font-bold text-white">
                ₹{collected.toLocaleString("en-IN")}
              </span>
            </div>

            {target > 0 && (
              <div>
                <span className="text-xs text-slate-400 font-medium block">Target Goal</span>
                <span className="text-xl sm:text-2xl font-bold text-slate-300">
                  ₹{target.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            <div>
              <span className="text-xs text-slate-400 font-medium block">Total Contributors</span>
              <span className="text-xl sm:text-2xl font-bold text-indigo-400">
                {campaign.totalContributorsCount || 0}
              </span>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-medium block">End Date</span>
              <span className="text-sm sm:text-base font-semibold text-slate-300 mt-1 block">
                {campaign.endDate || "Ongoing"}
              </span>
            </div>
          </div>

          {target > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Progress towards society target</span>
                <span className="font-semibold text-indigo-300">{percent}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: CONTRIBUTE */}
        {activeTab === "contribute" && (
          <div>
            {isClosed ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-lg mx-auto">
                <FaTimesCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Campaign is Currently Closed</h3>
                <p className="text-slate-400 text-sm mb-4">
                  This collection has reached its conclusion and is no longer accepting new payment submissions.
                </p>
                <button
                  onClick={() => setActiveTab("track")}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  <FaSearch />
                  Check Status of an Existing Contribution
                </button>
              </div>
            ) : submittedPayment ? (
              /* Success Submission Screen */
              <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 max-w-2xl mx-auto shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-4 text-2xl">
                  <FaCheckCircle />
                </div>

                <h2 className="text-2xl font-extrabold text-white text-center mb-1">
                  Contribution Submitted!
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm text-center mb-6">
                  Your payment details have been recorded and sent to D-Block RWA Admin for bank verification.
                </p>

                {/* Reference Box */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 mb-6 space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <span className="text-xs text-slate-400">Tracking Reference No</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-400 text-sm sm:text-base">
                        {submittedPayment.referenceCode || submittedPayment.id}
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            submittedPayment.referenceCode || submittedPayment.id,
                            "sub-ref"
                          )
                        }
                        className="p-1 text-slate-400 hover:text-white"
                        title="Copy Reference"
                      >
                        <FaCopy />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Contributor Name</span>
                    <span className="font-semibold text-white">{submittedPayment.contributorName}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Amount Paid</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      ₹{submittedPayment.amount?.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">UTR / Reference</span>
                    <span className="font-mono text-slate-300">{submittedPayment.utrNumber}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400">Current Verification Status</span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <FaClock />
                      Pending Bank Verification
                    </span>
                  </div>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-xs text-indigo-200 mb-6 flex items-start gap-2.5">
                  <FaShieldAlt className="text-indigo-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">How Verification Works:</span>
                    As per RWA audit protocol, payments are never confirmed automatically. An authorized committee member will verify this UTR against bank credits. Once approved, your official Society PDF receipt will be issued.
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      setSubmittedPayment(null);
                      setContributorName("");
                      setContributorMobile("");
                      setContributorEmail("");
                      setUtrNumber("");
                      setRemarks("");
                      setDeclaration(false);
                    }}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-semibold text-center transition-colors"
                  >
                    Make Another Contribution
                  </button>
                  <button
                    onClick={() => {
                      setLookupRef(submittedPayment.referenceCode || submittedPayment.id);
                      setActiveTab("track");
                    }}
                    className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold text-center transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FaSearch />
                    Track Verification Status
                  </button>
                </div>
              </div>
            ) : (
              /* Contribution Submission Form */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Payment Credentials */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Step 1 Box: How to Pay */}
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                      <FaCreditCard className="text-indigo-400" />
                      Step 1: Transfer Funds
                    </h2>

                    {/* QR Code / Deep Link */}
                    {upiId ? (
                      <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-200">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                              `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
                                upiHolder
                              )}&am=${amount || ""}&cu=INR&tn=${encodeURIComponent(
                                campaignName.substring(0, 30)
                              )}`
                            )}`}
                            alt="UPI QR Code"
                            className="w-44 h-44 object-contain rounded-lg"
                          />
                          <span className="text-[11px] text-slate-700 font-semibold mt-2">
                            Scan with GPay, PhonePe, Paytm or BHIM
                          </span>
                        </div>

                        {/* UPI ID Row */}
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Official Society UPI ID</span>
                            <span className="font-mono text-xs sm:text-sm font-semibold text-white">
                              {upiId}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(upiId, "upi")}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-semibold flex items-center gap-1"
                          >
                            <FaCopy />
                            {copiedKey === "upi" ? "Copied" : "Copy"}
                          </button>
                        </div>

                        {/* Deep link for mobile devices */}
                        <a
                          href={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(
                            upiHolder
                          )}&am=${amount || ""}&cu=INR&tn=${encodeURIComponent(
                            campaignName.substring(0, 30)
                          )}`}
                          className="w-full py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors sm:hidden"
                        >
                          <FaExternalLinkAlt />
                          Tap to Open in UPI App
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">UPI payment details are being updated.</p>
                    )}

                    {/* Bank Details Dropdown / Section */}
                    {accNum && (
                      <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2 text-xs">
                        <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
                          Bank Account Transfer
                        </span>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Account Holder:</span>
                          <span className="font-medium text-white">
                            {upiHolder}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Account No:</span>
                          <div className="flex items-center gap-1.5 font-mono text-white font-semibold">
                            {accNum}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(accNum, "acc")}
                              className="text-slate-400 hover:text-white"
                            >
                              <FaCopy />
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">IFSC Code:</span>
                          <div className="flex items-center gap-1.5 font-mono text-white font-semibold">
                            {ifscCode}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(ifscCode, "ifsc")}
                              className="text-slate-400 hover:text-white"
                            >
                              <FaCopy />
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">Bank Name:</span>
                          <span className="font-medium text-white">{bankName}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Submission Form */}
                <div className="lg:col-span-7">
                  <form
                    onSubmit={handleSubmit}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5"
                  >
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <FaFileAlt className="text-emerald-400" />
                      Step 2: Submit Payment Details
                    </h2>

                    {submitError && (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                        <FaExclamationCircle className="flex-shrink-0 mt-0.5" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    {/* Amount Input */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Contribution Amount (₹) *
                      </label>
                      {campaign.contributionModel === "fixed" || campaign.amountType === "fixed" ? (
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                          <input
                            type="text"
                            readOnly
                            value={campaign.fixedAmount}
                            className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold cursor-not-allowed text-sm"
                          />
                          <span className="absolute right-3 top-2.5 text-[11px] text-slate-400">
                            Fixed Amount
                          </span>
                        </div>
                      ) : (
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                          <input
                            type="number"
                            min={campaign.minAmount || campaign.minimumAmount || 1}
                            step="1"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={
                              (campaign.minAmount || campaign.minimumAmount)
                                ? `Minimum ₹${campaign.minAmount || campaign.minimumAmount}`
                                : "Enter amount"
                            }
                            className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold text-sm focus:outline-none focus:border-indigo-500"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Contributor Full Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Contributor / Donor Full Name *
                      </label>
                      <div className="relative">
                        <FaUser className="text-slate-400 absolute left-3 top-3.5" />
                        <input
                          type="text"
                          value={contributorName}
                          onChange={(e) => setContributorName(e.target.value)}
                          placeholder="e.g., Rajesh Sharma / Gupta Family"
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Mobile & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Mobile Number *
                        </label>
                        <div className="relative">
                          <FaPhone className="text-slate-400 absolute left-3 top-3.5" />
                          <input
                            type="tel"
                            maxLength="10"
                            value={contributorMobile}
                            onChange={(e) => setContributorMobile(e.target.value)}
                            placeholder="10-digit number"
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Email ID (Optional)
                        </label>
                        <div className="relative">
                          <FaEnvelope className="text-slate-400 absolute left-3 top-3.5" />
                          <input
                            type="email"
                            value={contributorEmail}
                            onChange={(e) => setContributorEmail(e.target.value)}
                            placeholder="For e-receipt"
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Contributor Category & Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Contributor Category
                        </label>
                        <select
                          value={contributorCategory}
                          onChange={(e) => setContributorCategory(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Resident">Resident</option>
                          <option value="Non-Resident">Non-Resident Member</option>
                          <option value="Well-Wisher / Guest">Well-Wisher / Guest</option>
                          <option value="Commercial / Shop">Commercial / Shop Owner</option>
                          <option value="Sponsor / Organization">Sponsor / Organization</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Flat / House / Address Details
                        </label>
                        <input
                          type="text"
                          value={addressDetails}
                          onChange={(e) => setAddressDetails(e.target.value)}
                          placeholder="e.g. D-402, Sector 12 / Shop 5"
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Payment Mode & UTR / Ref Number */}
                    <div className="pt-2 border-t border-slate-800 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Payment Mode Used
                          </label>
                          <select
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                          >
                            <option value="UPI">UPI (GooglePay / PhonePe / Paytm / BHIM)</option>
                            <option value="Bank Transfer">Bank Transfer (NEFT / IMPS / RTGS)</option>
                            <option value="Cash">Cash Handover to Committee</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            {paymentMode === "UPI"
                              ? "12-Digit UTR / Transaction ID *"
                              : paymentMode === "Bank Transfer"
                              ? "Bank IMPS/NEFT Ref No *"
                              : "Receipt / Note No"}
                          </label>
                          <input
                            type="text"
                            value={utrNumber}
                            onChange={(e) => setUtrNumber(e.target.value)}
                            placeholder={paymentMode === "UPI" ? "e.g. 423589123456" : "Reference No"}
                            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-indigo-500 uppercase"
                            required={paymentMode === "UPI" || paymentMode === "Bank Transfer"}
                          />
                        </div>
                      </div>

                      {/* Optional Remarks */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Remarks / Note for Society (Optional)
                        </label>
                        <input
                          type="text"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="e.g. Contributed on behalf of late Shri..."
                          className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Declaration Checkbox */}
                    <div className="pt-2">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={declaration}
                          onChange={(e) => setDeclaration(e.target.checked)}
                          className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4 bg-slate-950"
                        />
                        <span className="text-xs text-slate-400 leading-relaxed">
                          I declare that I have transferred ₹{amount || "0"} to the official D-Block RWA account and entered the genuine transaction reference. I understand this will be verified by the admin before the receipt is confirmed.
                        </span>
                      </label>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
                    >
                      {submitting ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Submitting & Checking UTR...
                        </>
                      ) : (
                        <>
                          Submit Contribution Details
                          <FaArrowRight />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRACK RECEIPT */}
        {activeTab === "track" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <FaSearch className="text-indigo-400" />
                Track Contribution Status
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mb-6">
                Enter your Tracking Reference No (e.g. EXT-SC-2026-XXXXXX) or your 10-digit mobile number to check confirmation status and download your official RWA receipt.
              </p>

              <form onSubmit={handleLookup} className="space-y-4">
                {lookupError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                    <FaExclamationCircle className="flex-shrink-0 mt-0.5" />
                    <span>{lookupError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Tracking Reference ID
                    </label>
                    <input
                      type="text"
                      value={lookupRef}
                      onChange={(e) => setLookupRef(e.target.value)}
                      placeholder="e.g. EXT-SC-..."
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-indigo-500 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Or Mobile Number
                    </label>
                    <input
                      type="tel"
                      maxLength="10"
                      value={lookupMobile}
                      onChange={(e) => setLookupMobile(e.target.value)}
                      placeholder="10-digit mobile"
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {lookupLoading ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Searching Records...
                    </>
                  ) : (
                    <>
                      <FaSearch />
                      Find Contribution
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Lookup Results */}
            {lookupResults && lookupResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-300">Found {lookupResults.length} Record(s):</h3>
                {lookupResults.map((rec) => {
                  const isConfirmed = rec.status === "confirmed";
                  const isRejected = rec.status === "rejected";
                  const isPending = rec.status === "pending";

                  return (
                    <div
                      key={rec.id}
                      className={`bg-slate-900 border rounded-2xl p-5 shadow-lg space-y-4 ${
                        isConfirmed
                          ? "border-emerald-500/40"
                          : isRejected
                          ? "border-rose-500/40"
                          : "border-amber-500/40"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Contributor</span>
                          <span className="font-bold text-white text-sm">{rec.contributorName}</span>
                        </div>

                        {isConfirmed && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                            <FaCheckCircle />
                            Confirmed by Admin
                          </span>
                        )}
                        {isPending && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                            <FaClock />
                            Pending Bank Verification
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                            <FaTimesCircle />
                            Verification Rejected
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block">Amount</span>
                          <span className="font-bold text-white text-sm">
                            ₹{rec.amount?.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Reference Code</span>
                          <span className="font-mono text-indigo-300 font-semibold">{rec.referenceNumber || rec.referenceCode || rec.id}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">UTR Number</span>
                          <span className="font-mono text-slate-300">{rec.utr || rec.utrNumber || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Date</span>
                          <span className="text-slate-300">{rec.paymentDate || rec.submittedDate || "N/A"}</span>
                        </div>
                      </div>

                      {/* Rejection notice */}
                      {isRejected && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                          <span className="font-semibold block mb-0.5">Reason for Rejection:</span>
                          {rec.rejectionReason || "UTR could not be matched against society bank account credit."}
                        </div>
                      )}

                      {/* Confirmed Receipt Download */}
                      {isConfirmed && (
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Official Receipt No</span>
                            <span className="font-mono text-xs font-bold text-emerald-400">
                              {rec.receiptNumber || "Generated"}
                            </span>
                          </div>
                          <button
                            onClick={() => generateSpecialCollectionReceiptPDF(rec)}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/20"
                          >
                            <FaDownload />
                            Download Official Receipt (PDF)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} D-Block RWA Smart Manager. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Special Collections & Contributions Module</span>
            <Link to="/login" className="hover:text-white transition-colors">
              Resident / Admin Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

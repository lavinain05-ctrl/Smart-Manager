import { useState, useEffect, useMemo } from "react";
import {
  FaHandHoldingHeart,
  FaReceipt,
  FaCalendarAlt,
  FaCopy,
  FaExternalLinkAlt,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaFileDownload,
  FaInfoCircle,
  FaBuilding,
  FaTimes,
  FaMoneyBillWave,
  FaArrowRight,
  FaRedo,
  FaPlus,
  FaHistory,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { useResidents } from "../../context/ResidentContext";
import {
  subscribeSpecialCollections,
  subscribeResidentSpecialPayments,
  submitSpecialCollectionPayment,
} from "../../services/specialCollectionService";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";

export default function ResidentSpecialCollections() {
  const { user } = useAuth();
  const { residents = [] } = useResidents();

  const canonicalResident = useMemo(() => {
    return (
      residents.find((r) => r.id === user?.residentId || r.id === user?.uid) ||
      residents.find((r) => user?.phone && r.mobile === user?.phone) ||
      residents.find((r) => user?.email && r.email?.toLowerCase() === user?.email?.toLowerCase()) ||
      null
    );
  }, [residents, user]);

  const canonicalResidentId = canonicalResident?.id || user?.residentId || user?.uid;

  const [collections, setCollections] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [payingCollection, setPayingCollection] = useState(null);
  const [enteredAmount, setEnteredAmount] = useState("");
  const [utrNumber, setUtrNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentTime, setPaymentTime] = useState(
    new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);

  // Subscribe to collections & resident payments with real-time multi-identifier sync
  useEffect(() => {
    const unsubCol = subscribeSpecialCollections((list) => {
      setCollections(list.filter((c) => c.status === "active" || c.status === "closed"));
      setLoading(false);
    });

    const cleanPhone = (canonicalResident?.mobile || user?.phone || user?.mobile || "").replace(/\D/g, "");
    const unsubPay = subscribeResidentSpecialPayments(
      {
        residentIds: [canonicalResidentId, canonicalResident?.id, user?.residentId, user?.uid].filter(Boolean),
        mobileNumbers: [
          canonicalResident?.mobile,
          user?.phone,
          user?.mobile,
          cleanPhone,
          cleanPhone.length >= 10 ? cleanPhone.slice(-10) : null,
        ].filter(Boolean),
        userIds: [user?.uid, canonicalResident?.userId].filter(Boolean),
      },
      (list) => {
        setPayments(list);
      }
    );

    return () => {
      unsubCol();
      unsubPay();
    };
  }, [canonicalResidentId, canonicalResident, user]);

  // Open Payment Modal
  function handleOpenPay(col, existingPayment = null) {
    setPayingCollection(col);
    setEnteredAmount(
      col.amountType === "fixed" ? String(col.fixedAmount) : String(col.minimumAmount || "")
    );
    setUtrNumber(existingPayment?.utr || "");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    setSubmissionSuccess(null);
  }

  // Handle Submit UTR
  async function handleSubmitPayment(e) {
    e.preventDefault();
    if (!utrNumber.trim()) {
      toast.error("Please enter the UTR / Transaction ID from your UPI or banking app.");
      return;
    }

    const amt = Number(enteredAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid contribution amount.");
      return;
    }

    if (payingCollection.amountType !== "fixed") {
      if (payingCollection.minimumAmount > 0 && amt < payingCollection.minimumAmount) {
        toast.error(`Minimum contribution is ₹${payingCollection.minimumAmount}`);
        return;
      }
      if (payingCollection.maximumAmount > 0 && amt > payingCollection.maximumAmount) {
        toast.error(`Maximum contribution is ₹${payingCollection.maximumAmount}`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await submitSpecialCollectionPayment(
        {
          collectionId: payingCollection.id,
          collectionName: payingCollection.name,
          purpose: payingCollection.purpose,
          contributorType: "resident",
          residentId: canonicalResidentId || user?.uid,
          userId: user?.uid || canonicalResident?.userId || canonicalResidentId || "",
          flatNumber: canonicalResident?.flat || user?.flatNumber || user?.flat || "",
          block: canonicalResident?.block || user?.block || "",
          contributorName: canonicalResident?.owner || user?.name || "Resident",
          mobileNumber: canonicalResident?.mobile || user?.phone || user?.mobile || "",
          amount: amt,
          utr: utrNumber.trim(),
          paymentDate,
          paymentTime,
        },
        user
      );

      setSubmissionSuccess({
        amount: amt,
        utr: utrNumber.trim(),
        submittedAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      });
      toast.success("Payment submitted for Admin verification!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to submit payment.");
    } finally {
      setSubmitting(false);
    }
  }

  // Helper to generate & download receipt PDF
  function handleDownloadReceipt(col, payment) {
    if (!payment) return;
    const isCash = payment.paymentMethod === "Cash" || payment.utr === "CASH-OFFLINE";
    generateSpecialCollectionReceipt({
      receiptNumber: payment.receiptNumber,
      collectionName: col?.name || payment.collectionName || "Special Collection",
      purpose: col?.purpose || payment.purpose || "Community Contribution",
      contributorName: payment.contributorName || canonicalResident?.owner || user?.name || "Resident",
      contributorType: "Resident",
      flatNumber: payment.flatNumber || canonicalResident?.flat || user?.flatNumber || user?.flat || "",
      block: payment.block || canonicalResident?.block || user?.block || "",
      mobileNumber: payment.mobileNumber || canonicalResident?.mobile || user?.phone || user?.mobile || "",
      amount: payment.amount,
      paymentMethod: payment.paymentMethod || (isCash ? "Cash" : "UPI / Bank Transfer"),
      utr: payment.utr || (isCash ? "CASH-OFFLINE" : "—"),
      paymentDate: payment.paymentDate || "—",
      confirmedByName: payment.confirmedByName || payment.collectorName || "Society Admin",
      collectorName: payment.collectorName || "",
      confirmedAt: payment.confirmedAt?.toDate
        ? payment.confirmedAt.toDate().toLocaleDateString("en-IN")
        : payment.paymentDate || new Date().toLocaleDateString("en-IN"),
    });
  }

  // Copy helper
  function copyText(text, label = "Copied") {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  }

  // UPI deep link
  function getUpiIntentUri(col, amount) {
    if (!col.upiId) return "";
    const pa = encodeURIComponent(col.upiId);
    const pn = encodeURIComponent(col.upiName || "D Block RWA Indraprastha");
    const am = encodeURIComponent(amount || col.fixedAmount || "0");
    const tn = encodeURIComponent(`${col.name} Contribution`);
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-900">
          <FaHandHoldingHeart className="text-emerald-600" />
          Special Collections & Contributions
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Participate in D-Block society festivals, community functions, and special contribution campaigns.
        </p>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading campaigns...</div>
      ) : collections.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-gray-500 shadow-sm">
          <FaHandHoldingHeart className="text-4xl text-gray-300 mx-auto mb-3" />
          <p className="font-medium">No active special collections right now.</p>
          <p className="text-xs text-gray-400 mt-1">When the RWA creates a festival or fund campaign, it will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {collections.map((col) => {
            // Find all contributions made by this resident (online or cash offline)
            const colPayments = payments.filter((p) => p.collectionId === col.id);
            const confirmedPayments = colPayments.filter((p) => p.status === "confirmed");
            const pendingPayments = colPayments.filter((p) => p.status === "pending");
            const rejectedPayments = colPayments.filter((p) => p.status === "rejected");
            const totalPaidAmount = confirmedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const isClosed = col.status === "closed";

            return (
              <div
                key={col.id}
                className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Top Badge & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {col.collectionType || "Special Event"}
                    </span>

                    {confirmedPayments.length > 0 ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-emerald-100 text-emerald-800">
                        <FaCheckCircle className="text-emerald-600" />
                        {confirmedPayments.length > 1
                          ? `Confirmed (${confirmedPayments.length}) ✓`
                          : "Confirmed ✓"}
                      </span>
                    ) : pendingPayments.length > 0 ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-amber-100 text-amber-800">
                        <FaClock className="text-amber-600" /> Pending Verification ⏳
                      </span>
                    ) : rejectedPayments.length > 0 ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 bg-red-100 text-red-800">
                        <FaTimesCircle className="text-red-600" /> Verification Failed ❌
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                        Not Contributed
                      </span>
                    )}
                  </div>

                  {/* Campaign Name & Purpose */}
                  <h3 className="font-bold text-lg text-gray-900 leading-snug">{col.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{col.purpose}</p>

                  {col.description && (
                    <p className="text-xs text-gray-600 mt-3 bg-gray-50 p-3 rounded-xl">
                      {col.description}
                    </p>
                  )}

                  {/* Contribution Details */}
                  <div className="mt-4 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-emerald-700 font-semibold block uppercase">
                        {col.amountType === "fixed" ? "Contribution Amount" : "Contribution Model"}
                      </span>
                      <span className="text-lg font-mono font-bold text-emerald-950">
                        {col.amountType === "fixed"
                          ? `₹${Number(col.fixedAmount).toLocaleString("en-IN")}`
                          : col.minimumAmount > 0
                          ? `Min ₹${col.minimumAmount} (Variable)`
                          : "Any Amount"}
                      </span>
                    </div>

                    {col.endDate && (
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 block uppercase">Deadline</span>
                        <span className="text-xs font-semibold text-gray-800">
                          {new Date(col.endDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Synchronized Contributions & Payment History */}
                  {colPayments.length > 0 && (
                    <div className="mt-4 pt-3 border-t space-y-3">
                      {/* Confirmed Contributions Box */}
                      {confirmedPayments.length > 0 && (
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                              <FaCheckCircle className="text-emerald-600" />
                              Total Contributed: ₹{totalPaidAmount.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                              {confirmedPayments.length} Confirmed Contribution{confirmedPayments.length > 1 ? "s" : ""}
                            </span>
                          </div>

                          {/* Individual Confirmed Payment Cards */}
                          <div className="space-y-2">
                            {confirmedPayments.map((p, idx) => {
                              const isCash = p.paymentMethod === "Cash" || p.utr === "CASH-OFFLINE";
                              return (
                                <div
                                  key={p.id || idx}
                                  className="bg-white rounded-xl p-3 border border-emerald-100 flex items-center justify-between gap-2 shadow-2xs"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-gray-900 text-sm">
                                        ₹{Number(p.amount).toLocaleString("en-IN")}
                                      </span>
                                      {isCash ? (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                                          💵 Cash Payment
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 inline-flex items-center gap-1">
                                          ⚡ UPI / Online
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-gray-600 flex flex-wrap items-center gap-x-2">
                                      <span>Date: {p.paymentDate || "—"}</span>
                                      {isCash && (p.collectorName || p.confirmedByName) && (
                                        <span className="text-amber-800 font-medium">
                                          • Received by: {p.collectorName || p.confirmedByName}
                                        </span>
                                      )}
                                      {!isCash && p.utr && (
                                        <span className="font-mono text-gray-500">
                                          • UTR: {p.utr}
                                        </span>
                                      )}
                                    </div>
                                    {p.receiptNumber && (
                                      <div className="font-mono text-[10px] text-emerald-700">
                                        Receipt: {p.receiptNumber}
                                      </div>
                                    )}
                                  </div>

                                  {p.receiptNumber && (
                                    <button
                                      onClick={() => handleDownloadReceipt(col, p)}
                                      className="shrink-0 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                                      title="Download Official Receipt (PDF)"
                                    >
                                      <FaFileDownload /> PDF
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pending Payments Box */}
                      {pendingPayments.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1.5">
                          <p className="font-bold flex items-center gap-1.5 text-amber-950">
                            <FaClock className="text-amber-600" /> Pending Admin Verification ({pendingPayments.length})
                          </p>
                          {pendingPayments.map((p, idx) => (
                            <div key={p.id || idx} className="text-[11px] text-amber-900 bg-amber-100/60 rounded-lg p-2 border border-amber-200">
                              Amount: <strong>₹{p.amount}</strong> • UTR: <strong className="font-mono">{p.utr}</strong>
                              <span className="block text-[10px] text-amber-700 mt-0.5">
                                Submitted on {p.paymentDate || "Today"} — awaiting bank verification by Admin.
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rejected Payments Box */}
                      {rejectedPayments.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 space-y-1">
                          <p className="font-bold flex items-center gap-1.5 text-red-900">
                            <FaTimesCircle className="text-red-600" /> Payment Verification Failed
                          </p>
                          {rejectedPayments.map((p, idx) => (
                            <div key={p.id || idx} className="text-[11px]">
                              <span>UTR: {p.utr} (₹{p.amount}) — Reason: <strong>{p.rejectionReason || "Could not verify transaction"}</strong></span>
                              {p.adminRemarks && <span className="block italic text-[10px]">Remark: {p.adminRemarks}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons: Pay Again / Another Payment & Receipt Download */}
                <div className="mt-6 pt-3 border-t flex flex-col sm:flex-row items-center gap-2.5">
                  {colPayments.length === 0 && !isClosed && (
                    <button
                      onClick={() => handleOpenPay(col)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <FaMoneyBillWave /> Pay Contribution
                    </button>
                  )}

                  {confirmedPayments.length > 0 && !isClosed && (
                    <div className="flex items-center gap-2.5 w-full">
                      <button
                        onClick={() => handleOpenPay(col)}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                        title="Make another contribution to this campaign"
                      >
                        <FaRedo /> Pay Again / Another Payment
                      </button>
                      <button
                        onClick={() => handleDownloadReceipt(col, confirmedPayments[0])}
                        className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-gray-200 shrink-0"
                        title="Download Latest Receipt"
                      >
                        <FaFileDownload className="text-emerald-700" /> {confirmedPayments.length > 1 ? "Latest Receipt" : "Receipt PDF"}
                      </button>
                    </div>
                  )}

                  {confirmedPayments.length > 0 && isClosed && (
                    <button
                      onClick={() => handleDownloadReceipt(col, confirmedPayments[0])}
                      className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <FaFileDownload /> Download Official Receipt (PDF)
                    </button>
                  )}

                  {colPayments.length > 0 && confirmedPayments.length === 0 && pendingPayments.length > 0 && !isClosed && (
                    <div className="w-full space-y-2">
                      <div className="w-full text-center py-2 text-xs font-semibold text-amber-700 bg-amber-50 rounded-xl border border-amber-100">
                        Verification in progress by Admin
                      </div>
                      <button
                        onClick={() => handleOpenPay(col)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                      >
                        <FaPlus /> Pay Again / Another Payment
                      </button>
                    </div>
                  )}

                  {colPayments.length > 0 && confirmedPayments.length === 0 && !pendingPayments.length && rejectedPayments.length > 0 && !isClosed && (
                    <button
                      onClick={() => handleOpenPay(col, rejectedPayments[0])}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <FaRedo /> Re-submit Corrected UTR
                    </button>
                  )}

                  {isClosed && colPayments.length === 0 && (
                    <div className="w-full text-center py-2 text-xs font-semibold text-gray-500 bg-gray-50 rounded-xl">
                      Collection Closed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── PAYMENT & UTR SUBMISSION MODAL ─── */}
      {payingCollection && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[94vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-base">{payingCollection.name}</h3>
                  {payments.some((p) => p.collectionId === payingCollection.id && p.status === "confirmed") && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Additional Contribution
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{payingCollection.purpose}</p>
              </div>
              <button
                onClick={() => setPayingCollection(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <FaTimes />
              </button>
            </div>

            {submissionSuccess ? (
              /* Success confirmation view */
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mx-auto">
                  <FaClock />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">Payment Submitted for Verification</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Your contribution of <strong>₹{submissionSuccess.amount}</strong> with UTR{" "}
                    <strong className="font-mono">{submissionSuccess.utr}</strong> has been submitted to the Society Admin.
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 text-left space-y-1">
                  <p className="font-bold">Important Note:</p>
                  <p>
                    Your receipt will be generated and made available for download immediately after the Admin verifies the credit in the society's bank account.
                  </p>
                </div>

                <button
                  onClick={() => setPayingCollection(null)}
                  className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Payment details + submission form */
              <form onSubmit={handleSubmitPayment} className="p-6 space-y-5">
                {/* Previous contribution banner if paying again */}
                {(() => {
                  const existingConfirmed = payments.filter((p) => p.collectionId === payingCollection.id && p.status === "confirmed");
                  if (existingConfirmed.length === 0) return null;
                  const totalPreviouslyPaid = existingConfirmed.reduce((s, p) => s + Number(p.amount || 0), 0);
                  return (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
                      <div>
                        <p className="font-bold flex items-center gap-1.5">
                          <FaCheckCircle className="text-emerald-600" /> Previously Contributed: ₹{totalPreviouslyPaid.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          You are making another contribution to this campaign.
                        </p>
                      </div>
                      <span className="text-[10px] bg-emerald-200/80 font-bold px-2 py-0.5 rounded text-emerald-950">
                        {existingConfirmed.length} Past Payment{existingConfirmed.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                })()}

                {/* Contribution Amount Section */}
                <div className="bg-gray-50 border rounded-xl p-4 space-y-2">
                  <label className="block text-xs font-bold text-gray-700">Contribution Amount (₹)</label>
                  {payingCollection.amountType === "fixed" ? (
                    <div className="text-2xl font-mono font-bold text-emerald-800">
                      ₹{payingCollection.fixedAmount}
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={payingCollection.minimumAmount || 1}
                      max={payingCollection.maximumAmount || undefined}
                      required
                      placeholder="Enter your contribution amount"
                      value={enteredAmount}
                      onChange={(e) => setEnteredAmount(e.target.value)}
                      className="w-full bg-white border rounded-lg p-2.5 text-base font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  )}
                  {payingCollection.amountType !== "fixed" && payingCollection.minimumAmount > 0 && (
                    <p className="text-[11px] text-gray-500">Minimum: ₹{payingCollection.minimumAmount}</p>
                  )}
                </div>

                {/* Receiving Payment Accounts */}
                <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Step 1: Make Payment via UPI or Bank
                  </p>

                  {/* UPI Option */}
                  {payingCollection.upiId && (
                    <div className="bg-white rounded-lg p-3 border border-blue-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase block font-semibold">UPI ID</span>
                          <span className="font-mono text-sm font-bold text-gray-900 select-all">
                            {payingCollection.upiId}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(payingCollection.upiId, "UPI ID")}
                          className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition"
                        >
                          <FaCopy /> Copy
                        </button>
                      </div>

                      {/* UPI Intent Button */}
                      <a
                        href={getUpiIntentUri(payingCollection, enteredAmount)}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
                      >
                        <FaExternalLinkAlt /> Open in UPI App (GPay, PhonePe, Paytm)
                      </a>
                    </div>
                  )}

                  {/* Bank Details */}
                  {payingCollection.accountNumber && (
                    <div className="bg-white rounded-lg p-3 border border-blue-200 text-xs space-y-1.5 text-gray-800">
                      <span className="text-[10px] text-gray-400 uppercase block font-semibold">Bank Account Details</span>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Account Name:</span>
                        <span className="font-semibold">{payingCollection.accountName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Account Number:</span>
                        <span className="font-mono font-bold select-all">{payingCollection.accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">IFSC Code:</span>
                        <span className="font-mono font-bold select-all">{payingCollection.ifsc}</span>
                      </div>
                      {payingCollection.bankName && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Bank:</span>
                          <span>{payingCollection.bankName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 2: UTR Submission Form */}
                <div className="space-y-3 pt-1">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                    <FaInfoCircle className="text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      After completing your payment in your UPI or banking app, enter the <strong>Transaction / UTR Number</strong> below so Admin can verify and issue your receipt.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Transaction / UTR Number * <span className="text-gray-400 font-normal">(from your UPI/bank receipt)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 123456789012 or UPI Ref ID"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
                      className="w-full border rounded-xl p-2.5 font-mono text-sm font-bold text-gray-900 uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Payment Date *</label>
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full border rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Payment Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 10:30 AM"
                        value={paymentTime}
                        onChange={(e) => setPaymentTime(e.target.value)}
                        className="w-full border rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Auto-filled resident info */}
                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 space-y-1 font-medium">
                    <div className="flex justify-between">
                      <span>Payer Name:</span>
                      <span className="font-bold text-gray-800">{user?.name || "Resident"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Registered Mobile:</span>
                      <span className="font-bold text-gray-800">{user?.phone || user?.mobile || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Flat & Block:</span>
                      <span className="font-bold text-gray-800">{user?.flatNumber || user?.flat || "—"}, {user?.block || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Submit buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setPayingCollection(null)}
                    className="px-4 py-2.5 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !utrNumber.trim()}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    {submitting ? "Submitting..." : "Submit Payment for Verification"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

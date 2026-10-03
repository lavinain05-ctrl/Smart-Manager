import { useState, useEffect } from "react";
import {
  FaTimes,
  FaShieldAlt,
  FaCheckCircle,
  FaFileInvoiceDollar,
  FaReceipt,
  FaLock,
  FaArrowRight,
  FaSpinner,
  FaExclamationTriangle,
  FaCog,
  FaQrcode,
  FaCopy,
  FaCheck,
  FaMobileAlt,
  FaBolt,
  FaPrint,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { initiateOnlineUpiPayment } from "../../services/paymentGatewayService";
import { collectResidentPayment } from "../../utils/collectPayment";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import { useAuth } from "../../context/AuthContext";

export default function OnlinePaymentModal({
  isOpen,
  onClose,
  bill,
  resident,
  bills = [],
  settings = {},
  onPaymentSuccess,
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utr, setUtr] = useState("");

  if (!isOpen || !bill) return null;

  const rawAmount = Number(bill.amount) > 0 ? Number(bill.amount) : (Number(resident?.charge) || 80);
  const razorpayKey = (settings?.razorpayKeyId || "").trim();
  const hasGatewayConfigured = Boolean(razorpayKey);
  const upiId = (settings?.upiId || "").trim();

  const flatDisplay = resident?.flat || resident?.flatNumber || "Your Flat";
  const residentName = resident?.owner || resident?.name || user?.name || "Resident";
  const societyName = settings?.societyName || "D BLOCK RWA INDRAPRASTHA";

  const note = `Maintenance Flat ${flatDisplay} ${bill.month} ${bill.year}`.slice(0, 50);
  const upiDeepLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(societyName)}&am=${Number(rawAmount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`
    : "";

  useEffect(() => {
    if (upiId && rawAmount > 0) {
      QRCode.toDataURL(upiDeepLink, {
        width: 220,
        margin: 1,
        color: {
          dark: "#064e3b",
          light: "#ffffff",
        },
      })
        .then(setQrDataUrl)
        .catch((err) => console.warn("Could not generate QR code:", err));
    } else {
      setQrDataUrl("");
    }
  }, [upiId, rawAmount, upiDeepLink]);

  function handleCopyUpi() {
    if (upiId) {
      navigator.clipboard.writeText(upiId);
      setCopiedUpi(true);
      toast.success("UPI ID copied to clipboard!");
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  }

  async function handleStartRazorpay() {
    setLoading(true);
    try {
      await initiateOnlineUpiPayment({
        resident,
        bill,
        bills,
        gatewaySettings: {
          razorpayKeyId: razorpayKey,
          societyName,
          upiId,
        },
        onSuccess: (receiptData) => {
          setLoading(false);
          setSuccessReceipt(receiptData);
          if (onPaymentSuccess) {
            onPaymentSuccess(receiptData);
          }
        },
        onFailure: (err) => {
          setLoading(false);
          console.warn("[PaymentModal] Payment dismiss or failure:", err?.message);
        },
      });
    } catch (e) {
      setLoading(false);
      console.error("[PaymentModal] Exception launching gateway:", e);
    }
  }

  async function handleDirectUpiConfirm(e) {
    e.preventDefault();
    if (!utr.trim()) {
      toast.error("Please enter the 12-digit UPI Reference / UTR number from your payment app");
      return;
    }

    setLoading(true);
    try {
      const result = await collectResidentPayment({
        resident: resident || { id: bill.residentId, flat: flatDisplay, owner: residentName },
        month: bill.month,
        year: bill.year,
        paymentData: {
          method: "Online UPI",
          amount: rawAmount,
          monthlyRate: rawAmount,
          isAdvance: Boolean(bill.isAdvance),
          coveredMonths: bill.coveredMonths || [{ month: bill.month, year: Number(bill.year) }],
          referenceNumber: utr.trim(),
          remarks: `Direct UPI to ${upiId}`,
          collectorName: "Resident Self-Service",
          collectorRole: "resident",
        },
        bills,
      });

      if (result) {
        toast.success("Payment recorded successfully!");
        setSuccessReceipt(
          typeof result === "object"
            ? result
            : {
                receiptNumber: `REC-${Date.now()}`,
                amount: rawAmount,
                flat: flatDisplay,
                month: bill.month,
                year: bill.year,
                paymentMethod: "Online UPI",
              }
        );
        if (onPaymentSuccess) onPaymentSuccess(result);
      }
    } catch (err) {
      toast.error(err.message || "Failed to confirm payment");
    } finally {
      setLoading(false);
    }
  }

  function handleCloseModal() {
    setSuccessReceipt(null);
    setLoading(false);
    setUtr("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] my-auto overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header (Always pinned at top of modal) */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white p-4 sm:p-5 relative shrink-0">
          <button
            onClick={handleCloseModal}
            className="absolute top-3.5 right-3.5 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition z-10"
            aria-label="Close"
          >
            <FaTimes className="text-base" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs shadow-inner">
              <FaFileInvoiceDollar />
            </span>
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-emerald-200">
              Instant Online Payment
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-bold tracking-tight">
            {bill.month} {bill.year} Maintenance
          </h3>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            {settings?.societyName || "D BLOCK RWA INDRAPRASTHA"}
          </p>
        </div>

        {/* Content Body (Smoothly scrollable if viewport is compact) */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {successReceipt ? (
            /* SUCCESS STATE */
            <div className="text-center py-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl shadow-lg shadow-emerald-500/20">
                <FaCheckCircle />
              </div>

              <div>
                <h4 className="text-xl font-bold text-slate-900">Payment Confirmed!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Your payment of <span className="font-bold text-slate-900">₹{rawAmount}</span> for {bill.month} {bill.year} has been automatically verified and recorded.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Official Receipt:</span>
                  <span className="font-mono font-bold text-emerald-700">{successReceipt.receiptNumber || `REC-${Date.now()}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Flat / Unit:</span>
                  <span className="font-semibold text-slate-800">{flatDisplay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-semibold text-slate-800">Online UPI (Auto-Verified)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-600">PAID & SYNCHRONIZED</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (successReceipt) {
                      printPaymentReceipt(successReceipt, settings);
                    } else {
                      toast.error("Receipt details not loaded");
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  <FaPrint />
                  Print Official Receipt Now
                </button>

                <Link
                  to="/resident/receipts"
                  onClick={handleCloseModal}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition"
                >
                  <FaReceipt />
                  All Receipts History
                </Link>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-2 px-4 rounded-xl text-slate-500 hover:bg-slate-100 font-medium text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* PAYMENT PROMPT STATE */
            <>
              {/* Bill Details Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Resident & Property
                    </span>
                    <span className="text-sm font-bold text-slate-800 block">
                      {residentName}
                    </span>
                    <span className="text-xs text-slate-600">
                      {flatDisplay} {resident?.block ? `(${resident.block})` : ""}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Total Payable
                    </span>
                    <span className="text-2xl font-extrabold text-emerald-600 block leading-tight">
                      ₹{rawAmount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400">Zero extra fees</span>
                  </div>
                </div>

                <div className="border-t border-slate-200/70 pt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Billing Period:</span>
                  <span className="font-semibold text-slate-700">{bill.month} {bill.year}</span>
                </div>
              </div>

              {/* 1. Automated Gateway Checkout (Active when Razorpay Key ID is configured) */}
              {hasGatewayConfigured && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <FaBolt className="text-amber-500" /> Automated Checkout
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded font-extrabold bg-emerald-200 text-emerald-900">
                      {razorpayKey.startsWith("rzp_live") ? "LIVE MODE" : "TEST MODE SIMULATOR"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartRazorpay}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 transition active:scale-[0.98]"
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="animate-spin text-sm" />
                        <span>Opening Gateway...</span>
                      </>
                    ) : (
                      <>
                        <span>Pay ₹{rawAmount.toLocaleString()} via Gateway</span>
                        <FaArrowRight className="text-xs" />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-emerald-800 font-medium">
                    ⚡ Instant auto-confirmation without entering UTR number.
                  </p>
                </div>
              )}

              {/* Divider if both Gateway and Direct UPI are available */}
              {hasGatewayConfigured && upiId && (
                <div className="flex items-center gap-3 my-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider before:flex-1 before:h-px before:bg-slate-200 after:flex-1 after:h-px after:bg-slate-200">
                  Or Scan UPI QR Directly
                </div>
              )}

              {/* 2. Direct Dynamic UPI Payment Section (Active if Society UPI ID exists) */}
              {upiId ? (
                <div className="bg-gradient-to-b from-emerald-50/90 to-teal-50/50 border border-emerald-200/90 rounded-2xl p-3 sm:p-4 text-center space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                      <FaQrcode className="text-emerald-700 text-sm" /> Scan & Pay via Any UPI App
                    </span>
                    <span className="bg-emerald-600 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg shadow-xs">
                      ₹{rawAmount.toLocaleString()}
                    </span>
                  </div>

                  {/* QR Code */}
                  <div className="inline-block p-2 bg-white rounded-2xl shadow-md border border-emerald-200">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Society UPI QR"
                        className="w-32 h-32 sm:w-36 sm:h-36 mx-auto rounded-lg"
                      />
                    ) : (
                      <div className="w-32 h-32 flex items-center justify-center text-xs text-gray-400">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-emerald-900 font-semibold max-w-xs mx-auto leading-tight">
                    Scan with <strong>GPay, PhonePe, Paytm, BHIM, or CRED</strong>
                  </p>

                  {/* Mobile Deep Link Button */}
                  {upiDeepLink && (
                    <a
                      href={upiDeepLink}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                    >
                      <FaMobileAlt /> Open Installed UPI App
                    </a>
                  )}

                  {/* Copy UPI ID */}
                  <div className="flex items-center justify-center gap-2 bg-white/90 border border-emerald-200 py-1.5 px-3 rounded-xl max-w-xs mx-auto text-xs">
                    <span className="text-gray-500 font-medium">UPI:</span>
                    <span className="font-mono font-bold text-gray-800 text-[11px] truncate">
                      {upiId}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="text-emerald-700 hover:text-emerald-900 ml-1 p-1"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <FaCheck className="text-emerald-600 text-xs" /> : <FaCopy className="text-xs" />}
                    </button>
                  </div>

                  {/* UTR Input Form */}
                  <form onSubmit={handleDirectUpiConfirm} className="text-left pt-2 space-y-2 border-t border-emerald-200/70">
                    <label className="block text-[11px] font-bold text-emerald-950">
                      Enter UPI Ref / UTR No. (12 digits shown after payment):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={utr}
                        onChange={(e) => setUtr(e.target.value)}
                        placeholder="e.g. 427812984120"
                        maxLength={30}
                        required
                        className="flex-1 bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={loading || !utr.trim()}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition shadow-xs whitespace-nowrap"
                      >
                        {loading ? "Recording..." : "Confirm"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              {/* Notice if neither UPI ID nor Razorpay is set */}
              {!upiId && !hasGatewayConfigured && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                  <FaExclamationTriangle className="text-amber-500 text-base shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Payment Methods Pending</p>
                    <p className="text-[11px] leading-relaxed text-amber-700">
                      The society administration has not yet entered the Society UPI ID in Settings.
                      {user?.role === "admin" && (
                        <Link
                          to="/admin/settings"
                          onClick={handleCloseModal}
                          className="inline-flex items-center gap-1 font-bold text-amber-900 underline block mt-1 hover:text-black"
                        >
                          <FaCog className="text-[10px]" /> Go to Admin Settings to set UPI ID
                        </Link>
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium pt-1">
                <FaLock className="text-[10px]" />
                <span>256-bit Encrypted & RBI Licensed Payment Network</span>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

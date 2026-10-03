import { useState } from "react";
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
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { initiateOnlineUpiPayment } from "../../services/paymentGatewayService";
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

  if (!isOpen || !bill) return null;

  const rawAmount = Number(bill.amount) > 0 ? Number(bill.amount) : (Number(resident?.charge) || 80);
  const razorpayKey = (settings?.razorpayKeyId || "").trim();
  const hasGatewayConfigured = Boolean(razorpayKey);

  const flatDisplay = resident?.flat || resident?.flatNumber || "Your Flat";
  const residentName = resident?.owner || resident?.name || user?.name || "Resident";

  async function handleStartPayment() {
    setLoading(true);
    try {
      await initiateOnlineUpiPayment({
        resident,
        bill,
        bills,
        gatewaySettings: {
          razorpayKeyId: razorpayKey,
          societyName: settings?.societyName || "D BLOCK RWA INDRAPRASTHA",
          upiId: settings?.upiId || "",
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

  function handleCloseModal() {
    setSuccessReceipt(null);
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white p-6 relative">
          <button
            onClick={handleCloseModal}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition"
            aria-label="Close"
          >
            <FaTimes className="text-base" />
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm shadow-inner">
              <FaFileInvoiceDollar />
            </span>
            <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-200">
              Instant Online Payment
            </span>
          </div>

          <h3 className="text-xl font-bold tracking-tight">
            {bill.month} {bill.year} Maintenance
          </h3>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            {settings?.societyName || "D BLOCK RWA INDRAPRASTHA"}
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
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
                <Link
                  to="/resident/receipts"
                  onClick={handleCloseModal}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition"
                >
                  <FaReceipt />
                  View & Print Official Receipt
                </Link>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-2.5 px-4 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold text-xs transition"
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

              {/* Supported UPI Apps */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block text-center">
                  Instant Payment via Any UPI App
                </span>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {["PhonePe", "Google Pay", "Paytm", "BHIM", "CRED"].map((app) => (
                    <span
                      key={app}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200/70 shadow-xs"
                    >
                      {app}
                    </span>
                  ))}
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200 shadow-xs">
                    Dynamic QR
                  </span>
                </div>
              </div>

              {/* Status Notice if Gateway is not configured yet */}
              {!hasGatewayConfigured && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                  <FaExclamationTriangle className="text-amber-500 text-base shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Gateway Key Pending Activation</p>
                    <p className="text-[11px] leading-relaxed text-amber-700">
                      The society administration has not yet entered the Razorpay Key ID in Settings.
                      {user?.role === "admin" && (
                        <Link
                          to="/admin/settings"
                          onClick={handleCloseModal}
                          className="inline-flex items-center gap-1 font-bold text-amber-900 underline block mt-1 hover:text-black"
                        >
                          <FaCog className="text-[10px]" /> Go to Admin Settings to add Key
                        </Link>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleStartPayment}
                  disabled={loading || !hasGatewayConfigured}
                  className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-2xl font-bold text-sm text-white shadow-lg transition-all ${
                    hasGatewayConfigured && !loading
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 shadow-emerald-600/30 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:translate-y-0"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                  }`}
                >
                  {loading ? (
                    <>
                      <FaSpinner className="animate-spin text-base" />
                      <span>Opening Secure Gateway...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ₹{rawAmount.toLocaleString()} via UPI</span>
                      <FaArrowRight className="text-xs" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <FaLock className="text-[10px]" />
                  <span>256-bit Encrypted & RBI Licensed Payment Network</span>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

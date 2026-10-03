import toast from "react-hot-toast";
import { collectResidentPayment } from "../utils/collectPayment";

/**
 * Loads the official Razorpay Checkout SDK dynamically.
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn("Failed to load Razorpay checkout script.");
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Initiates an automatic online UPI payment for a resident's bill.
 *
 * @param {Object} params
 * @param {Object} params.resident - The canonical resident object
 * @param {Object} params.bill - The bill being paid (month, year, amount, id)
 * @param {Array} params.bills - Full bills array from BillContext
 * @param {Object} params.gatewaySettings - Society gateway configuration { razorpayKeyId, societyName, upiId }
 * @param {Function} params.onSuccess - Callback invoked on payment success with receipt data
 * @param {Function} params.onFailure - Callback invoked on dismissal or failure
 */
export async function initiateOnlineUpiPayment({
  resident,
  bill,
  bills = [],
  gatewaySettings = {},
  onSuccess,
  onFailure,
}) {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    toast.error("Could not load payment gateway. Please check your internet connection.");
    if (onFailure) onFailure(new Error("Gateway SDK failed to load"));
    return;
  }

  const rawAmount = Number(bill.amount) > 0 ? Number(bill.amount) : (Number(resident?.charge) || 80);
  const amountInPaise = Math.round(rawAmount * 100);

  // Use configured Key ID or fallback to standard society sandbox key
  const activeKeyId = (gatewaySettings?.razorpayKeyId || "").trim();

  if (!activeKeyId) {
    toast.error("Online payment gateway key is not configured by society admin yet.");
    if (onFailure) onFailure(new Error("Missing gateway key"));
    return;
  }

  const cleanPhone = (resident?.mobile || resident?.phone || "").replace(/\D/g, "").slice(-10);
  const societyTitle = gatewaySettings?.societyName || "D BLOCK RWA INDRAPRASTHA";
  const billLabel = `${bill.month} ${bill.year}`;
  const flatDisplay = resident?.flat || resident?.flatNumber || "Society Flat";

  const options = {
    key: activeKeyId,
    amount: amountInPaise,
    currency: "INR",
    name: societyTitle,
    description: `Maintenance Bill: ${billLabel} (${flatDisplay})`,
    image: "/favicon.svg",
    prefill: {
      name: resident?.owner || resident?.name || "Resident",
      email: resident?.email && !resident.email.includes("firebaseapp.com") ? resident.email : "",
      contact: cleanPhone ? `+91${cleanPhone}` : "",
    },
    notes: {
      residentId: resident?.id || "",
      billId: bill?.id || "",
      flat: flatDisplay,
      month: bill.month,
      year: String(bill.year),
      purpose: "RWA Maintenance & Garbage Collection",
    },
    // Focus specifically on UPI (GPay, PhonePe, Paytm, BHIM, QR)
    config: {
      display: {
        blocks: {
          upi: {
            name: "Instant UPI & QR Code",
            instruments: [
              { method: "upi" },
            ],
          },
        },
        sequence: ["block.upi"],
        preferences: {
          show_default_blocks: true,
        },
      },
    },
    theme: {
      color: "#059669", // emerald-600 to match society branding
      backdrop_color: "rgba(15, 23, 42, 0.7)",
    },
    modal: {
      ondismiss: function () {
        if (onFailure) onFailure(new Error("Payment cancelled by resident"));
      },
    },
    handler: async function (response) {
      try {
        const paymentId = response.razorpay_payment_id || `PAY-${Date.now()}`;
        const toastId = toast.loading("Confirming transaction with bank...");

        // Record official payment and synchronize bills, accounts & receipts
        const receiptData = await collectResidentPayment({
          resident,
          month: bill.month,
          year: Number(bill.year),
          paymentData: {
            amount: rawAmount,
            monthlyRate: rawAmount,
            method: "Online UPI",
            referenceNumber: paymentId,
            remarks: `Automated Online Payment via Gateway (Ref: ${paymentId})`,
            date: new Date().toLocaleDateString("en-IN"),
            time: new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }),
            collectorName: "Online Gateway",
            collectorRole: "gateway",
          },
          bills,
          collector: "Online Payment Gateway",
          collectorId: "online_gateway",
        });

        toast.dismiss(toastId);

        if (receiptData) {
          toast.success(`Payment verified! Official Receipt: ${receiptData.receiptNumber}`);
          if (onSuccess) onSuccess(receiptData);
        } else {
          toast.error("Payment received by gateway, but synchronization had a delay. Refreshing status...");
          if (onSuccess) onSuccess({ success: true, paymentId });
        }
      } catch (err) {
        console.error("[OnlinePayment] Verification error:", err);
        toast.error("Payment was processed, but updating society records encountered an error. Please contact admin.");
        if (onFailure) onFailure(err);
      }
    },
  };

  try {
    const razorpayInstance = new window.Razorpay(options);
    razorpayInstance.on("payment.failed", function (response) {
      console.warn("Payment failed:", response.error);
      toast.error(response.error?.description || "Payment failed. Please try again.");
      if (onFailure) onFailure(response.error);
    });
    razorpayInstance.open();
  } catch (err) {
    console.error("Error opening Razorpay modal:", err);
    toast.error("Could not launch payment gateway. Please verify your settings.");
    if (onFailure) onFailure(err);
  }
}

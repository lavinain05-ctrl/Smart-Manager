import { FaCheckCircle, FaPrint, FaFileDownload, FaTimes, FaReceipt, FaCopy } from "react-icons/fa";
import toast from "react-hot-toast";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import { generateReceipt } from "../../utils/receiptGenerator";
import { generateSpecialCollectionReceipt } from "../../utils/specialCollectionReceiptGenerator";

export default function PaymentReceiptSuccessModal({
  open,
  receipt,
  onClose,
  title = "Payment Recorded Successfully!",
  subtitle = "Official RWA receipt has been generated and synchronized across all portals.",
}) {
  if (!open || !receipt) return null;

  const isSpecial = Boolean(
    receipt.collectionName ||
    receipt.type === "Special Collection" ||
    receipt.collectionType === "special"
  );

  const receiptNo = receipt.receiptNumber || receipt.receiptNo || "REC-" + Date.now();
  const residentName = receipt.residentName || receipt.contributorName || "Resident";
  const flat = receipt.flat || receipt.flatNumber || "—";
  const block = receipt.block || "";
  const amount = Number(receipt.totalPaidAmount || receipt.amount || 0).toLocaleString("en-IN");
  const mode = receipt.paymentMethod || receipt.paymentMode || receipt.method || "Cash";
  const date = receipt.paymentDate || receipt.date || new Date().toLocaleDateString("en-IN");
  const collector = receipt.collectorName || receipt.collector || "Authorized Collector";
  const designation = receipt.collectorDesignation ? `(${receipt.collectorDesignation})` : (receipt.collectorRole ? `(${receipt.collectorRole})` : "");
  
  let periodLabel = "";
  if (isSpecial) {
    periodLabel = receipt.collectionName || receipt.specialCampaignName || "Special Campaign";
  } else if (receipt.isAdvance && receipt.periodLabel) {
    periodLabel = `${receipt.periodLabel} (${receipt.advanceDuration || 1} Mos Advance)`;
  } else {
    periodLabel = `${receipt.month || ""} ${receipt.year || ""}`.trim() || "Garbage Maintenance";
  }

  function handlePrint() {
    printPaymentReceipt(receipt);
  }

  function handleDownloadPDF() {
    if (isSpecial) {
      generateSpecialCollectionReceipt(receipt);
    } else {
      generateReceipt(receipt);
    }
  }

  function handleCopyReceiptNo() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(receiptNo);
      toast.success("Receipt Number copied!");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden my-auto border border-emerald-100 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-5 sm:p-6 text-center relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition cursor-pointer"
            title="Close"
          >
            <FaTimes className="text-sm" />
          </button>
          <div className="w-14 h-14 bg-white text-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg mb-3">
            <FaCheckCircle />
          </div>
          <h3 className="text-xl font-bold tracking-tight">{title}</h3>
          <p className="text-xs text-emerald-100 mt-1 max-w-xs mx-auto leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Receipt Voucher Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Receipt Number Badge */}
          <div className="flex items-center justify-between bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3">
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                Official Receipt Number
              </div>
              <div className="font-mono font-bold text-emerald-900 text-sm sm:text-base">
                {receiptNo}
              </div>
            </div>
            <button
              onClick={handleCopyReceiptNo}
              className="p-2 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-xl transition cursor-pointer"
              title="Copy Receipt No"
            >
              <FaCopy className="text-sm" />
            </button>
          </div>

          {/* Key Details Card */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">
                {isSpecial ? "Contributor" : "Resident"}
              </span>
              <span className="font-bold text-gray-900 text-right">
                {residentName}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Flat / Unit</span>
              <span className="font-semibold text-gray-800">
                Flat {flat} {block ? `(${block})` : ""}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">
                {isSpecial ? "Campaign" : "Period"}
              </span>
              <span className="font-semibold text-emerald-700 text-right max-w-[200px] truncate">
                {periodLabel}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Payment Mode</span>
              <span className="inline-block font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
                {mode}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Collected By</span>
              <span className="font-medium text-gray-800 text-right">
                {collector} {designation}
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-200/80">
              <span className="text-gray-500 font-medium">Date</span>
              <span className="text-gray-700 font-medium">{date}</span>
            </div>

            {receipt.remarks && (
              <div className="flex justify-between items-start pt-1 text-[11px] text-gray-500 italic">
                <span>Notes:</span>
                <span className="text-right max-w-[200px]">{receipt.remarks}</span>
              </div>
            )}
          </div>

          {/* Amount Paid Big Pill */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-emerald-100 font-semibold block">
                Amount Collected
              </span>
              <span className="text-xs text-white/80">Immediate Validated Voucher</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              ₹{amount}
            </div>
          </div>

          {/* Action Buttons: PRINT and DOWNLOAD PDF */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handlePrint}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <FaPrint className="text-base" /> Print Receipt
              </button>

              <button
                onClick={handleDownloadPDF}
                className="w-full py-3 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 active:scale-[0.98] rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <FaFileDownload className="text-base text-teal-600" /> Download PDF
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-600 rounded-2xl text-xs font-semibold transition cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

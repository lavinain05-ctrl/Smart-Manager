import { useMemo } from "react";
import { FaReceipt, FaFilePdf, FaPrint } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import { useSettings } from "../../context/SettingsContext";
import GarbageModuleTabs from "../../components/resident/GarbageModuleTabs";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ResidentReceipts() {
  const { user } = useAuth();
  const { payments } = usePayments();
  const { residents } = useResidents();
  const { settings } = useSettings();

  const cleanPhone = useMemo(() => {
    const raw = user?.phone || user?.mobile || (user?.email?.includes("@") ? user.email.split("@")[0] : "");
    const digits = String(raw).replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }, [user]);

  const resident = useMemo(() => {
    return (
      residents.find((r) => r.id === user?.residentId || r.id === user?.uid) ||
      residents.find((r) => {
        if (!cleanPhone) return false;
        const rDigits = String(r.mobile || r.phone || "").replace(/\D/g, "");
        const rClean = rDigits.length >= 10 ? rDigits.slice(-10) : rDigits;
        return rClean === cleanPhone;
      }) ||
      residents.find(
        (r) =>
          user?.email &&
          !user.email.includes("firebaseapp.com") &&
          r.email?.toLowerCase() === user.email.toLowerCase()
      ) ||
      residents.find(
        (r) =>
          user?.name &&
          r.owner?.toLowerCase() === user.name.toLowerCase()
      ) ||
      null
    );
  }, [residents, user, cleanPhone]);

  const canonicalResidentId = resident?.id || user?.residentId || user?.uid;

  const myPayments = useMemo(() => {
    return payments
      .filter((p) => {
        if (p.residentId === canonicalResidentId || p.residentId === user?.residentId || p.residentId === user?.uid) {
          return true;
        }
        if (resident?.id && p.residentId === resident.id) {
          return true;
        }
        if (cleanPhone && p.mobile) {
          const pClean = String(p.mobile).replace(/\D/g, "").slice(-10);
          if (pClean === cleanPhone) return true;
        }
        const residentOwnerName = (resident?.owner || user?.name || "").trim().toLowerCase();
        if (
          residentOwnerName &&
          p.residentName?.trim().toLowerCase() === residentOwnerName &&
          (!p.flat || p.flat === (resident?.flat || user?.flat))
        ) {
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        const tsA = Number((a.receiptNumber || "").replace("REC-", "")) || 0;
        const tsB = Number((b.receiptNumber || "").replace("REC-", "")) || 0;
        return tsB - tsA;
      });
  }, [payments, canonicalResidentId, resident, user, cleanPhone]);

  // Deduplicate by receiptNumber to present clean consolidated receipt cards
  const displayReceipts = useMemo(() => {
    const seen = new Set();
    return myPayments.filter((p) => {
      const key = p.receiptNumber || p.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [myPayments]);

  function downloadPDF(payment) {
    const doc = new jsPDF();
    const society = settings?.societyName || "Smart Manager";

    doc.setFontSize(20);
    doc.text(society, 105, 18, { align: "center" });
    doc.setFontSize(12);
    doc.text("Payment Receipt", 105, 28, { align: "center" });
    doc.text(`Receipt: ${payment.receiptNumber}`, 105, 36, { align: "center" });

    autoTable(doc, {
      startY: 46,
      theme: "grid",
      head: [["Field", "Details"]],
      body: [
        ["Resident", payment.residentName],
        ["Flat", payment.flat],
        ["Block", payment.block || "-"],
        [
          "Amount",
          payment.isAdvance && payment.totalPaidAmount
            ? `₹${Number(payment.totalPaidAmount).toLocaleString()} (${payment.advanceDuration || 1} Months Advance)`
            : `₹${Number(payment.amount).toLocaleString()}`,
        ],
        ["Payment Method", payment.paymentMethod],
        ["Date", payment.paymentDate],
        ["Time", payment.paymentTime || "-"],
        [
          "Period",
          payment.isAdvance && payment.periodLabel
            ? payment.periodLabel
            : `${payment.month} ${payment.year}`,
        ],
        ...(payment.isAdvance ? [["Payment Type", `Advance Payment (${payment.advanceDuration || 1} Months)`]] : []),
        [
          "Collector",
          payment.collectorRole === "committee"
            ? `${payment.collector || payment.collectorName} (${payment.collectorDesignation || "Committee Member"})`
            : payment.collector || payment.collectorName || "-",
        ],
        ["Receipt No.", payment.receiptNumber],
      ],
    });

    doc.save(`Receipt-${payment.receiptNumber}.pdf`);
  }

  function printReceipt(payment) {
    printPaymentReceipt(payment);
  }

  return (
    <div className="space-y-6">
      <GarbageModuleTabs />

      <div>
        <h1 className="text-3xl font-bold">My Receipts</h1>
        <p className="text-gray-500">{displayReceipts.length} receipt{displayReceipts.length === 1 ? "" : "s"}</p>
      </div>

      {displayReceipts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaReceipt className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Receipts</h2>
          <p className="mt-2">Receipts will appear here after payments are collected.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {displayReceipts.map((p) => {
            const displayAmt = p.isAdvance && p.totalPaidAmount ? p.totalPaidAmount : p.amount;
            return (
              <div key={p.id || p.receiptNumber} className="bg-white rounded-2xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 text-xl shrink-0">
                    <FaReceipt />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-800">{p.receiptNumber}</h3>
                      {p.isAdvance && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                          🎉 {p.advanceDuration ? `${p.advanceDuration} Mo Advance` : "Advance"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {p.paymentDate} • {p.isAdvance && p.periodLabel ? p.periodLabel : `${p.month} ${p.year}`}
                    </p>
                    {(p.collector || p.collectorName) && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <span>Collected by:</span>
                        <span className={`font-semibold ${p.collectorRole === "committee" ? "text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200" : "text-gray-700"}`}>
                          {p.collector || p.collectorName} {p.collectorRole === "committee" && p.collectorDesignation ? `(${p.collectorDesignation})` : ""}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-emerald-600 font-mono">
                    ₹{Number(displayAmt).toLocaleString()}
                  </p>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    p.paymentMethod === "Cash" ? "bg-green-100 text-green-700"
                    : p.paymentMethod === "UPI" ? "bg-purple-100 text-purple-700"
                    : p.paymentMethod === "Exempted" ? "bg-gray-100 text-gray-700"
                    : "bg-blue-100 text-blue-700"
                  }`}>
                    {p.paymentMethod}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => downloadPDF(p)} className="flex items-center gap-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-2xs">
                    <FaFilePdf /> PDF
                  </button>
                  <button onClick={() => printReceipt(p)} className="flex items-center gap-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-2xs">
                    <FaPrint /> Print
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

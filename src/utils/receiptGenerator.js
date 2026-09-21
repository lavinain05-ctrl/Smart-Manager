import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generateReceipt(payment) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129);
  doc.text("D BLOCK RWA", 105, 18, {
    align: "center",
  });

  doc.setFontSize(11);
  doc.setTextColor(100);

  doc.text(
    "Resident Welfare Association — Indraprastha",
    105,
    26,
    {
      align: "center",
    }
  );

  // Line
  doc.setDrawColor(16, 185, 129);
  doc.line(15, 32, 195, 32);

  // Title
  doc.setFontSize(18);
  doc.setTextColor(0);

  doc.text(
    "PAYMENT RECEIPT",
    105,
    45,
    {
      align: "center",
    }
  );

  autoTable(doc, {
    startY: 55,

    head: [["Field", "Value"]],

    body: [
      ["Receipt No", payment.receiptNumber],

      ["Resident", payment.residentName],

      ["Flat", payment.flat],

      ["Block", payment.block],

      [
        "Amount",
        payment.isAdvance && payment.totalPaidAmount
          ? `₹${Number(payment.totalPaidAmount).toLocaleString()} (${payment.advanceDuration || 1} Months Advance)`
          : `₹${Number(payment.amount || 0).toLocaleString()}`,
      ],

      [
        payment.isAdvance ? "Covered Period" : "Billing Month",
        payment.isAdvance && payment.periodLabel ? payment.periodLabel : `${payment.month} ${payment.year}`,
      ],

      ...(payment.isAdvance
        ? [["Payment Type", `Advance Garbage Fee (${payment.advanceDuration || 1} Months)`]]
        : []),

      ["Payment Method", payment.paymentMethod],

      ["Payment Date", payment.paymentDate],

      ["Collector", payment.collector],

      ["Remarks", payment.remarks || "-"],
    ],

    theme: "grid",

    headStyles: {
      fillColor: [16, 185, 129],
    },
  });

  const endY = doc.lastAutoTable.finalY + 20;

  doc.setFontSize(11);

  doc.text(
    "Thank you for your payment.",
    105,
    endY,
    {
      align: "center",
    }
  );

  doc.text(
    "This is an official computer-generated receipt from D Block RWA.",
    105,
    endY + 8,
    {
      align: "center",
    }
  );

  doc.save(
    `Receipt-${payment.receiptNumber}.pdf`
  );
}

export const generateReceiptPDF = generateReceipt;
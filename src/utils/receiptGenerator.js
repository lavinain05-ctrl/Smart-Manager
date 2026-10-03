import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatResidentFloor } from "../services/propertyService";

export function generateReceipt(rawPayment, residentInfo = null) {
  if (!rawPayment) return;

  const payment = residentInfo
    ? {
        ...residentInfo,
        ...rawPayment,
        plotNumber: rawPayment.plotNumber || residentInfo.plotNumber || residentInfo.plot || "",
        floor: rawPayment.floor || residentInfo.floor || "",
        floorCode: rawPayment.floorCode || residentInfo.floorCode || "",
        unitNumber: rawPayment.unitNumber || residentInfo.unitNumber || residentInfo.unit || "",
        personType: rawPayment.personType || residentInfo.personType || residentInfo.occupantType || "",
        block: rawPayment.block || residentInfo.block || "",
        flat: rawPayment.flat || rawPayment.flatNumber || residentInfo.flat || residentInfo.flatNumber || "",
      }
    : rawPayment;

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
    "GARBAGE COLLECTION FEE RECEIPT",
    105,
    45,
    {
      align: "center",
    }
  );

  const floorLabel = formatResidentFloor(payment.floor);

  autoTable(doc, {
    startY: 55,

    head: [["Field", "Value"]],

    body: [
      ["Receipt No", payment.receiptNumber || "-"],

      ["Resident", payment.residentName || "-"],

      ["Flat / Unit", payment.flat || payment.flatNumber || "—"],

      ...(payment.plotNumber && payment.plotNumber !== payment.flat
        ? [["Plot Number", `Plot ${payment.plotNumber}`]]
        : []),

      ...(floorLabel
        ? [["Floor", floorLabel]]
        : []),

      ...(payment.unitNumber
        ? [["Unit Number", `Unit ${payment.unitNumber}`]]
        : []),

      ["Block", payment.block || "-"],

      ...(payment.personType
        ? [["Resident Type", payment.personType]]
        : []),

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
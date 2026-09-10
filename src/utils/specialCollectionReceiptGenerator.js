import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generate and download an official PDF receipt for Special Collection contribution.
 *
 * @param {Object} data
 * @param {string} data.receiptNumber - e.g. RWA-SC-2026-000124
 * @param {string} data.collectionName - Name of the campaign e.g. D-Block Diwali Celebration 2026
 * @param {string} data.purpose - Purpose e.g. Festival Celebration
 * @param {string} data.contributorName - Name of resident or external contributor
 * @param {string} data.contributorType - "Resident" or "External Contributor"
 * @param {string} [data.flatNumber] - Flat number if resident
 * @param {string} [data.block] - Block name if resident
 * @param {string} [data.mobileNumber] - Mobile number
 * @param {number|string} data.amount - Contribution amount
 * @param {string} data.utr - Transaction / UTR Number
 * @param {string} data.paymentDate - Date payment was made
 * @param {string} [data.confirmedAt] - Verification timestamp string
 * @param {string} [data.confirmedByName] - Admin who verified
 */
export function generateSpecialCollectionReceipt(data) {
  const doc = new jsPDF();

  // Header Banner
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129); // Emerald-600
  doc.text("D BLOCK RWA INDRAPRASTHA", 105, 18, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text("Smart Manager — Special Collection & Contribution Receipt", 105, 26, {
    align: "center",
  });

  // Top Border Line
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.8);
  doc.line(15, 32, 195, 32);

  // Document Title
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("OFFICIAL PAYMENT RECEIPT", 105, 42, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Receipt No: ${data.receiptNumber || "—"}`, 105, 48, { align: "center" });

  // Receipt Details Table
  const tableRows = [
    ["Receipt Number", data.receiptNumber || "—"],
    ["Collection Campaign", data.collectionName || "Special Collection"],
    ["Purpose", data.purpose || "Community Contribution"],
    ["Contributor Name", data.contributorName || "—"],
    ["Contributor Category", data.contributorType || "Resident"],
  ];

  if (data.flatNumber || data.block) {
    tableRows.push(["Flat & Block", `${data.flatNumber || "—"} (${data.block || "—"})`]);
  }

  if (data.mobileNumber) {
    tableRows.push(["Mobile Number", data.mobileNumber]);
  }

  const mode = data.paymentMethod || (data.utr === "CASH-OFFLINE" ? "Cash" : "UPI / Bank Transfer");
  tableRows.push(
    ["Contribution Amount", `INR ${Number(data.amount || 0).toLocaleString("en-IN")}`],
    ["Payment Mode", mode],
    ["Transaction UTR / Ref", data.utr || "—"],
    ["Payment Date", data.paymentDate || "—"],
    ["Verification Status", "CONFIRMED ✓"],
    ["Verified By", data.confirmedByName || data.collectorName || "Society Admin"],
    ["Verified On", data.confirmedAt || new Date().toLocaleDateString("en-IN")]
  );

  autoTable(doc, {
    startY: 55,
    head: [["Attribute", "Details"]],
    body: tableRows,
    theme: "grid",
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60 },
      1: { cellWidth: 120 },
    },
    styles: {
      fontSize: 10,
      cellPadding: 3.5,
    },
  });

  const finalY = doc.lastAutoTable.finalY + 16;

  // Thank You & Footer Notes
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text("Thank you for your generous contribution to D-Block RWA!", 105, finalY, {
    align: "center",
  });

  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text("This is an electronically generated and verified receipt.", 105, finalY + 8, {
    align: "center",
  });
  doc.text(
    `Issued via RWA Smart Manager on ${new Date().toLocaleDateString("en-IN")}`,
    105,
    finalY + 14,
    { align: "center" }
  );

  // Save the PDF
  const filename = `Special_Collection_Receipt_${data.receiptNumber || Date.now()}.pdf`;
  doc.save(filename);
}

export const generateSpecialCollectionReceiptPDF = generateSpecialCollectionReceipt;

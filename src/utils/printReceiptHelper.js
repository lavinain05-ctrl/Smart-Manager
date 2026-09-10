// ==========================================
// RWA Official Receipt Direct Print Helper
// Supports Garbage Collection & Special Campaigns
// ==========================================

export function printPaymentReceipt(receipt) {
  if (!receipt) return;

  const isSpecial = Boolean(
    receipt.collectionName ||
    receipt.type === "Special Collection" ||
    receipt.collectionType === "special"
  );

  const receiptNo = receipt.receiptNumber || receipt.receiptNo || "RWA-" + Date.now();
  const residentName = receipt.residentName || receipt.contributorName || "Resident";
  const flat = receipt.flat || receipt.flatNumber || "—";
  const block = receipt.block || "";
  const amount = Number(receipt.totalPaidAmount || receipt.amount || 0).toLocaleString("en-IN");
  const mode = receipt.paymentMethod || receipt.paymentMode || receipt.method || "Cash";
  const date = receipt.paymentDate || receipt.date || new Date().toLocaleDateString("en-IN");
  const time = receipt.paymentTime || receipt.time || "";
  const collector = receipt.collectorName || receipt.collector || "RWA Authorized Collector";
  const designation = receipt.collectorDesignation ? `(${receipt.collectorDesignation})` : (receipt.collectorRole ? `(${receipt.collectorRole})` : "");
  const remarks = receipt.remarks && receipt.remarks !== "-" ? receipt.remarks : "";

  let periodOrCampaign = "";
  if (isSpecial) {
    periodOrCampaign = receipt.collectionName || receipt.specialCampaignName || "Special Society Campaign";
  } else if (receipt.isAdvance && receipt.periodLabel) {
    periodOrCampaign = `${receipt.periodLabel} (${receipt.advanceDuration || 1} Months Advance)`;
  } else {
    periodOrCampaign = `${receipt.month || ""} ${receipt.year || ""}`.trim() || "Monthly Garbage Maintenance";
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt - ${receiptNo}</title>
        <style>
          @page {
            size: auto;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            background: #fff;
            padding: 16px;
            font-size: 13px;
            line-height: 1.4;
          }
          .receipt-container {
            max-width: 440px;
            margin: 0 auto;
            border: 2px solid #059669;
            border-radius: 16px;
            padding: 24px 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            position: relative;
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 54px;
            font-weight: 900;
            color: rgba(5, 150, 105, 0.06);
            letter-spacing: 6px;
            pointer-events: none;
            text-transform: uppercase;
            white-space: nowrap;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #e5e7eb;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .society-title {
            font-size: 20px;
            font-weight: 800;
            color: #047857;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .society-subtitle {
            font-size: 11px;
            color: #4b5563;
            margin-top: 2px;
            font-weight: 500;
          }
          .receipt-badge {
            display: inline-block;
            margin-top: 8px;
            background: #ecfdf5;
            color: #065f46;
            border: 1px solid #a7f3d0;
            padding: 3px 12px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .receipt-no-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f9fafb;
            border: 1px solid #f3f4f6;
            border-radius: 8px;
            padding: 8px 12px;
            margin-bottom: 14px;
          }
          .receipt-no-label {
            font-size: 11px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
          }
          .receipt-no-value {
            font-family: monospace, monospace;
            font-size: 13px;
            font-weight: 700;
            color: #047857;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .details-table tr td {
            padding: 7px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          .details-table tr:last-child td {
            border-bottom: none;
          }
          .td-label {
            color: #4b5563;
            font-size: 12px;
            width: 40%;
          }
          .td-value {
            text-align: right;
            font-weight: 600;
            color: #111827;
            font-size: 12.5px;
          }
          .amount-box {
            background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
            border: 1.5px solid #a7f3d0;
            border-radius: 12px;
            padding: 12px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }
          .amount-box .amount-label {
            font-size: 12px;
            font-weight: 700;
            color: #065f46;
            text-transform: uppercase;
          }
          .amount-box .amount-value {
            font-size: 22px;
            font-weight: 900;
            color: #047857;
          }
          .sign-box {
            margin-top: 18px;
            padding-top: 12px;
            border-top: 1.5px dashed #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 10.5px;
            color: #6b7280;
          }
          .sign-col {
            text-align: center;
          }
          .sign-line {
            width: 110px;
            border-bottom: 1px solid #9ca3af;
            margin-bottom: 4px;
            height: 24px;
          }
          .footer-note {
            text-align: center;
            font-size: 10px;
            color: #9ca3af;
            margin-top: 16px;
            border-top: 1px solid #f3f4f6;
            padding-top: 8px;
          }
          @media print {
            body {
              padding: 0;
            }
            .receipt-container {
              box-shadow: none;
              border-color: #059669;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="watermark">PAID</div>

          <div class="header">
            <div class="society-title">Smart Manager RWA</div>
            <div class="society-subtitle">Resident Welfare Association Official Desk</div>
            <div class="receipt-badge">${isSpecial ? "Special Collection Receipt" : "Maintenance Fee Receipt"}</div>
          </div>

          <div class="receipt-no-row">
            <span class="receipt-no-label">Receipt No</span>
            <span class="receipt-no-value">${receiptNo}</span>
          </div>

          <table class="details-table">
            <tr>
              <td class="td-label">${isSpecial ? "Contributor" : "Resident Name"}</td>
              <td class="td-value">${residentName}</td>
            </tr>
            <tr>
              <td class="td-label">Flat / Address</td>
              <td class="td-value">Flat ${flat} ${block ? `(${block})` : ""}</td>
            </tr>
            <tr>
              <td class="td-label">${isSpecial ? "Campaign / Event" : "Billing Cycle"}</td>
              <td class="td-value">${periodOrCampaign}</td>
            </tr>
            <tr>
              <td class="td-label">Payment Mode</td>
              <td class="td-value">${mode}</td>
            </tr>
            <tr>
              <td class="td-label">Date & Time</td>
              <td class="td-value">${date}${time ? ` • ${time}` : ""}</td>
            </tr>
            <tr>
              <td class="td-label">Collected By</td>
              <td class="td-value">${collector} ${designation}</td>
            </tr>
            ${remarks ? `
            <tr>
              <td class="td-label">Remarks</td>
              <td class="td-value" style="font-weight: 500; font-size: 11.5px; color: #4b5563;">${remarks}</td>
            </tr>` : ""}
          </table>

          <div class="amount-box">
            <span class="amount-label">Amount Paid</span>
            <span class="amount-value">₹${amount}</span>
          </div>

          <div class="sign-box">
            <div class="sign-col">
              <div class="sign-line"></div>
              <span>Resident / Payer</span>
            </div>
            <div class="sign-col">
              <div class="sign-line"></div>
              <span>Authorized Officer</span>
            </div>
          </div>

          <div class="footer-note">
            This is an official computer-generated receipt from Smart Manager RWA. Thank you!
          </div>
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1500);
  }, 250);
}

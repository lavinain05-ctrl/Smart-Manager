// ============================================================================
// printReportHelper.js
// Isolated iframe printing engine & vector PDF generator for official RWA reports.
// Ensures clean page layout, @media print CSS, headers, footers & signatures.
// ============================================================================
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";

/**
 * Executes direct printing via a hidden isolated iframe.
 */
function executeIframePrint(htmlContent, title = "RWA-Report") {
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
  doc.write(htmlContent);
  doc.title = title;
  doc.close();

  // Give resources and fonts a moment to render before firing print
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error("Print execution failed:", e);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 400);
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 1. PRINT BLOCK-WISE RESIDENT REGISTER
 * ═════════════════════════════════════════════════════════════════════════════
 */
export function printBlockWiseResidentsRegister({
  syncedData,
  settings = {},
  filterBlock = "all",
  filterStatus = "all",
  filterGc = "all",
}) {
  if (!syncedData || !syncedData.blocks) return;

  const societyName = settings.societyName || "Resident Welfare Association";
  const societyAddress = settings.address || "Society Premises";
  const societyContact = settings.contactNumber || settings.supportPhone || "";
  const billingPeriod = `${syncedData.billingMonth} ${syncedData.billingYear}`;
  const generatedAt = syncedData.generatedAt || new Date().toLocaleString("en-IN");

  // Filter blocks if a specific block was selected
  let targetBlocks = syncedData.blocks;
  if (filterBlock !== "all") {
    targetBlocks = targetBlocks.filter(
      (b) => b.blockName.toLowerCase() === filterBlock.toLowerCase()
    );
  }

  // Filter residents inside blocks according to status and GC participation
  const processedBlocks = targetBlocks
    .map((b) => {
      const filteredResidents = b.residents.filter((r) => {
        if (filterStatus === "active" && r.status !== "Active") return false;
        if (filterStatus === "inactive" && r.status === "Active") return false;
        if (filterGc === "enrolled" && !r.isEnrolled) return false;
        if (filterGc === "opted_out" && r.isEnrolled) return false;
        return true;
      });

      const totalExpected = filteredResidents.reduce((s, r) => s + (r.isEnrolled ? r.monthlyCharge : 0), 0);
      const totalCollected = filteredResidents.filter((r) => r.isPaid).reduce((s, r) => s + r.paidAmount, 0);
      const totalPending = filteredResidents.filter((r) => !r.isPaid).reduce((s, r) => s + (r.isEnrolled ? r.monthlyCharge : 0), 0);
      const paidCount = filteredResidents.filter((r) => r.isPaid).length;

      return {
        ...b,
        residents: filteredResidents,
        totalFlats: filteredResidents.length,
        activeCount: filteredResidents.filter((r) => r.status === "Active").length,
        gcEnrolledCount: filteredResidents.filter((r) => r.isEnrolled).length,
        paidCount,
        pendingCount: filteredResidents.length - paidCount,
        expectedAmount: totalExpected,
        collectedAmount: totalCollected,
        pendingAmount: totalPending,
        collectionRate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : (paidCount > 0 ? 100 : 0),
      };
    })
    .filter((b) => b.residents.length > 0);

  // Recalculate Grand Totals for the print document
  const printGrandTotals = processedBlocks.reduce(
    (acc, b) => {
      acc.totalBlocks += 1;
      acc.totalFlats += b.totalFlats;
      acc.activeCount += b.activeCount;
      acc.gcEnrolledCount += b.gcEnrolledCount;
      acc.paidCount += b.paidCount;
      acc.pendingCount += b.pendingCount;
      acc.expectedAmount += b.expectedAmount;
      acc.collectedAmount += b.collectedAmount;
      acc.pendingAmount += b.pendingAmount;
      return acc;
    },
    {
      totalBlocks: 0,
      totalFlats: 0,
      activeCount: 0,
      gcEnrolledCount: 0,
      paidCount: 0,
      pendingCount: 0,
      expectedAmount: 0,
      collectedAmount: 0,
      pendingAmount: 0,
    }
  );

  printGrandTotals.collectionRate = printGrandTotals.expectedAmount > 0
    ? Math.round((printGrandTotals.collectedAmount / printGrandTotals.expectedAmount) * 100)
    : (printGrandTotals.paidCount > 0 ? 100 : 0);

  // Render HTML Document
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Resident Directory (Block-Wise) - ${societyName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 12mm 8mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.4;
          }
          .header-box {
            border-bottom: 2px solid #0f766e;
            padding-bottom: 10px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .society-title {
            font-size: 18px;
            font-weight: 800;
            color: #0f766e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .society-sub {
            font-size: 10px;
            color: #475569;
            margin-top: 2px;
          }
          .report-badge {
            text-align: right;
          }
          .report-name {
            font-size: 13px;
            font-weight: 800;
            color: #1e293b;
            text-transform: uppercase;
          }
          .report-meta {
            font-size: 9px;
            color: #64748b;
            margin-top: 2px;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            margin-bottom: 14px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 6px;
            padding: 6px 8px;
            text-align: center;
          }
          .kpi-card.highlight {
            background: #f0fdf4;
            border-color: #bbf7d0;
          }
          .kpi-card.pending {
            background: #fffbeb;
            border-color: #fde68a;
          }
          .kpi-label {
            font-size: 8px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
          }
          .kpi-value {
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 1px;
          }
          .block-section {
            margin-bottom: 16px;
            page-break-inside: avoid;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
          }
          .block-header {
            background: #f1f5f9;
            border-bottom: 1px solid #cbd5e1;
            padding: 6px 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .block-title {
            font-size: 12px;
            font-weight: 800;
            color: #0f766e;
          }
          .block-meta {
            font-size: 9px;
            color: #475569;
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
          }
          th {
            background: #f8fafc;
            color: #334155;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 8px;
            padding: 5px 6px;
            text-align: left;
            border-bottom: 1px solid #cbd5e1;
          }
          td {
            padding: 5px 6px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
          }
          tr:nth-child(even) td {
            background: #fafafa;
          }
          .flat-num {
            font-weight: 800;
            color: #0f766e;
          }
          .status-tag {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .status-paid {
            background: #dcfce7;
            color: #166534;
            border: 1px solid #bbf7d0;
          }
          .status-pending {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
          }
          .status-overdue {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
          }
          .block-subtotal {
            background: #f8fafc;
            font-weight: 700;
            border-top: 1px solid #cbd5e1;
            padding: 5px 10px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #334155;
          }
          .grand-summary {
            border: 2px solid #0f766e;
            background: #f0fdfa;
            border-radius: 6px;
            padding: 10px;
            margin-top: 16px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .grand-summary-title {
            font-size: 11px;
            font-weight: 800;
            color: #0f766e;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .grand-summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }
          .sign-box-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 30px;
            padding-top: 10px;
            page-break-inside: avoid;
          }
          .sign-box {
            border-top: 1px dashed #94a3b8;
            padding-top: 5px;
            text-align: center;
            font-size: 9px;
            color: #475569;
          }
          .sign-role {
            font-weight: 700;
            color: #1e293b;
          }
          .print-footer {
            margin-top: 16px;
            text-align: center;
            font-size: 8px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header-box">
          <div>
            <div class="society-title">${societyName}</div>
            <div class="society-sub">${societyAddress}${societyContact ? ` • Tel: ${societyContact}` : ""}</div>
          </div>
          <div class="report-badge">
            <div class="report-name">Resident Directory & Flat Register</div>
            <div class="report-meta">Billing Cycle: <strong>${billingPeriod}</strong> | Generated: ${generatedAt}</div>
          </div>
        </div>

        <!-- High-Level KPI Summary -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Blocks</div>
            <div class="kpi-value">${printGrandTotals.totalBlocks}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Flats</div>
            <div class="kpi-value">${printGrandTotals.totalFlats}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Active Flats</div>
            <div class="kpi-value">${printGrandTotals.activeCount}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">GC Enrolled</div>
            <div class="kpi-value">${printGrandTotals.gcEnrolledCount}</div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-label">Collected</div>
            <div class="kpi-value">₹${printGrandTotals.collectedAmount.toLocaleString("en-IN")}</div>
          </div>
          <div class="kpi-card pending">
            <div class="kpi-label">Pending Dues</div>
            <div class="kpi-value">₹${printGrandTotals.pendingAmount.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <!-- Block-by-Block Resident Tables -->
        ${processedBlocks
          .map(
            (b) => `
          <div class="block-section">
            <div class="block-header">
              <div class="block-title">${b.blockName}</div>
              <div class="block-meta">
                ${b.totalFlats} Flats • ${b.activeCount} Active • ${b.gcEnrolledCount} Doorstep GC • Billed: ₹${b.expectedAmount.toLocaleString("en-IN")}
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 30px; text-align: center;">S.N</th>
                  <th style="width: 60px;">Flat</th>
                  <th>Resident / Owner Name</th>
                  <th style="width: 80px;">Mobile</th>
                  <th style="width: 55px; text-align: center;">Resident</th>
                  <th style="width: 60px; text-align: center;">Garbage</th>
                  <th style="width: 50px; text-align: right;">Fee (₹)</th>
                  <th style="width: 65px; text-align: center;">Status</th>
                  <th style="width: 80px;">Receipt No</th>
                  <th style="width: 75px;">Payment Date</th>
                </tr>
              </thead>
              <tbody>
                ${b.residents
                  .map(
                    (r, idx) => `
                  <tr>
                    <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                    <td class="flat-num">${r.flat}</td>
                    <td><strong>${r.owner}</strong></td>
                    <td style="font-family: monospace; font-size: 9px;">${r.mobile}</td>
                    <td style="text-align: center; font-size: 8.5px;">${r.status}</td>
                    <td style="text-align: center; font-size: 8.5px;">${r.isEnrolled ? "Enrolled" : "Opted Out"}</td>
                    <td style="text-align: right; font-weight: 700;">₹${r.monthlyCharge}</td>
                    <td style="text-align: center;">
                      <span class="status-tag ${
                        r.isPaid
                          ? "status-paid"
                          : r.currentMonthStatus === "Overdue"
                          ? "status-overdue"
                          : "status-pending"
                      }">
                        ${r.isPaid ? "PAID" : r.currentMonthStatus}
                      </span>
                    </td>
                    <td style="font-family: monospace; font-size: 8.5px;">${r.receiptNo}</td>
                    <td style="font-size: 8.5px;">${r.paymentDate}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="block-subtotal">
              <div>
                <strong>${b.blockName} Totals:</strong> ${b.totalFlats} Flats (${b.paidCount} Paid, ${b.pendingCount} Pending)
              </div>
              <div>
                Collected: <strong style="color: #166534;">₹${b.collectedAmount.toLocaleString("en-IN")}</strong> | 
                Pending: <strong style="color: #991b1b;">₹${b.pendingAmount.toLocaleString("en-IN")}</strong> | 
                Rate: <strong>${b.collectionRate}%</strong>
              </div>
            </div>
          </div>
        `
          )
          .join("")}

        <!-- Grand Financial Summary Box -->
        <div class="grand-summary">
          <div class="grand-summary-title">Official Society Reconciliation Summary</div>
          <div class="grand-summary-grid">
            <div>
              <span style="color: #475569; font-size: 9px;">Total Society Flats:</span>
              <div style="font-size: 13px; font-weight: 800;">${printGrandTotals.totalFlats} Flats</div>
            </div>
            <div>
              <span style="color: #475569; font-size: 9px;">Total Monthly Billed:</span>
              <div style="font-size: 13px; font-weight: 800; color: #0f766e;">₹${printGrandTotals.expectedAmount.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <span style="color: #475569; font-size: 9px;">Total Verified Collected:</span>
              <div style="font-size: 13px; font-weight: 800; color: #166534;">₹${printGrandTotals.collectedAmount.toLocaleString("en-IN")} (${printGrandTotals.paidCount} Flats)</div>
            </div>
            <div>
              <span style="color: #475569; font-size: 9px;">Total Outstanding Dues:</span>
              <div style="font-size: 13px; font-weight: 800; color: #991b1b;">₹${printGrandTotals.pendingAmount.toLocaleString("en-IN")} (${printGrandTotals.pendingCount} Flats)</div>
            </div>
          </div>
        </div>

        <!-- Official Sign-off Footer -->
        <div class="sign-box-row">
          <div class="sign-box">
            <div class="sign-role">Prepared by</div>
            <div>System Administrator / Manager</div>
          </div>
          <div class="sign-box">
            <div class="sign-role">Verified by</div>
            <div>Treasurer / Accounts Officer</div>
          </div>
          <div class="sign-box">
            <div class="sign-role">Authorized by</div>
            <div>President / General Secretary</div>
          </div>
        </div>

        <div class="print-footer">
          Official computerized record generated by RWA Smart Manager. All figures reconciled and synchronized.
        </div>
      </body>
    </html>
  `;

  executeIframePrint(html, `Residents_Register_${billingPeriod.replace(/\s+/g, "_")}`);
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 2. PRINT BLOCK-WISE MONTHLY PAYMENT BILLS REGISTER
 * ═════════════════════════════════════════════════════════════════════════════
 */
export function printBlockWiseMonthlyBillsRegister({
  syncedData,
  settings = {},
  month,
  year,
  filterBlock = "all",
  filterStatus = "all",
}) {
  if (!syncedData || !syncedData.blocks) return;

  const societyName = settings.societyName || "Resident Welfare Association";
  const societyAddress = settings.address || "Society Premises";
  const societyContact = settings.contactNumber || settings.supportPhone || "";
  const billingPeriod = `${month || syncedData.billingMonth} ${year || syncedData.billingYear}`;
  const generatedAt = syncedData.generatedAt || new Date().toLocaleString("en-IN");

  // Filter blocks
  let targetBlocks = syncedData.blocks;
  if (filterBlock !== "all") {
    targetBlocks = targetBlocks.filter(
      (b) => b.blockName.toLowerCase() === filterBlock.toLowerCase()
    );
  }

  // Filter bills inside blocks
  const processedBlocks = targetBlocks
    .map((b) => {
      const filteredBills = b.bills.filter((bill) => {
        if (filterStatus === "paid" && !bill.isPaid) return false;
        if (filterStatus === "pending" && bill.isPaid) return false;
        if (filterStatus === "overdue" && bill.status !== "Overdue") return false;
        return true;
      });

      const totalBilled = filteredBills.reduce((s, bill) => s + bill.billAmount, 0);
      const totalCollected = filteredBills.filter((bill) => bill.isPaid).reduce((s, bill) => s + bill.paidAmount, 0);
      const totalPending = filteredBills.filter((bill) => !bill.isPaid).reduce((s, bill) => s + bill.pendingAmount, 0);
      const paidBillsCount = filteredBills.filter((bill) => bill.isPaid).length;

      return {
        ...b,
        bills: filteredBills,
        totalBills: filteredBills.length,
        paidBillsCount,
        pendingBillsCount: filteredBills.length - paidBillsCount,
        totalBilledAmount: totalBilled,
        totalCollectedAmount: totalCollected,
        totalPendingAmount: totalPending,
        collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : (paidBillsCount > 0 ? 100 : 0),
      };
    })
    .filter((b) => b.bills.length > 0);

  // Recalculate Grand Totals
  const printGrandTotals = processedBlocks.reduce(
    (acc, b) => {
      acc.totalBlocks += 1;
      acc.totalBills += b.totalBills;
      acc.paidBillsCount += b.paidBillsCount;
      acc.pendingBillsCount += b.pendingBillsCount;
      acc.totalBilledAmount += b.totalBilledAmount;
      acc.totalCollectedAmount += b.totalCollectedAmount;
      acc.totalPendingAmount += b.totalPendingAmount;
      return acc;
    },
    {
      totalBlocks: 0,
      totalBills: 0,
      paidBillsCount: 0,
      pendingBillsCount: 0,
      totalBilledAmount: 0,
      totalCollectedAmount: 0,
      totalPendingAmount: 0,
    }
  );

  printGrandTotals.collectionRate = printGrandTotals.totalBilledAmount > 0
    ? Math.round((printGrandTotals.totalCollectedAmount / printGrandTotals.totalBilledAmount) * 100)
    : (printGrandTotals.paidBillsCount > 0 ? 100 : 0);

  // Render HTML in Landscape orientation for financial columns
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Monthly Billing Register (Block-Wise) - ${societyName}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 8mm 10mm 8mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 10.5px;
            line-height: 1.35;
          }
          .header-box {
            border-bottom: 2px solid #0f766e;
            padding-bottom: 8px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .society-title {
            font-size: 18px;
            font-weight: 800;
            color: #0f766e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .society-sub {
            font-size: 9.5px;
            color: #475569;
            margin-top: 2px;
          }
          .report-badge {
            text-align: right;
          }
          .report-name {
            font-size: 13px;
            font-weight: 800;
            color: #1e293b;
            text-transform: uppercase;
          }
          .report-meta {
            font-size: 9px;
            color: #64748b;
            margin-top: 2px;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            margin-bottom: 12px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            border-radius: 6px;
            padding: 5px 8px;
            text-align: center;
          }
          .kpi-card.highlight {
            background: #f0fdf4;
            border-color: #bbf7d0;
          }
          .kpi-card.pending {
            background: #fffbeb;
            border-color: #fde68a;
          }
          .kpi-label {
            font-size: 8px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
          }
          .kpi-value {
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 1px;
          }
          .block-section {
            margin-bottom: 14px;
            page-break-inside: avoid;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            overflow: hidden;
          }
          .block-header {
            background: #f1f5f9;
            border-bottom: 1px solid #cbd5e1;
            padding: 5px 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .block-title {
            font-size: 11.5px;
            font-weight: 800;
            color: #0f766e;
          }
          .block-meta {
            font-size: 9px;
            color: #475569;
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
          }
          th {
            background: #f8fafc;
            color: #334155;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 7.5px;
            padding: 5px 6px;
            text-align: left;
            border-bottom: 1px solid #cbd5e1;
          }
          td {
            padding: 4.5px 6px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
          }
          tr:nth-child(even) td {
            background: #fafafa;
          }
          .flat-num {
            font-weight: 800;
            color: #0f766e;
          }
          .status-tag {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 7.5px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .status-paid {
            background: #dcfce7;
            color: #166534;
            border: 1px solid #bbf7d0;
          }
          .status-pending {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
          }
          .status-overdue {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
          }
          .block-subtotal {
            background: #f8fafc;
            font-weight: 700;
            border-top: 1px solid #cbd5e1;
            padding: 4px 10px;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            color: #334155;
          }
          .grand-summary {
            border: 2px solid #0f766e;
            background: #f0fdfa;
            border-radius: 6px;
            padding: 8px 12px;
            margin-top: 14px;
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          .grand-summary-title {
            font-size: 10px;
            font-weight: 800;
            color: #0f766e;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .grand-summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }
          .sign-box-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-top: 24px;
            padding-top: 8px;
            page-break-inside: avoid;
          }
          .sign-box {
            border-top: 1px dashed #94a3b8;
            padding-top: 4px;
            text-align: center;
            font-size: 8.5px;
            color: #475569;
          }
          .sign-role {
            font-weight: 700;
            color: #1e293b;
          }
          .print-footer {
            margin-top: 12px;
            text-align: center;
            font-size: 7.5px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header-box">
          <div>
            <div class="society-title">${societyName}</div>
            <div class="society-sub">${societyAddress}${societyContact ? ` • Phone: ${societyContact}` : ""}</div>
          </div>
          <div class="report-badge">
            <div class="report-name">Monthly Billing & Collection Register (Block-Wise)</div>
            <div class="report-meta">Billing Month: <strong>${billingPeriod}</strong> | Generated: ${generatedAt}</div>
          </div>
        </div>

        <!-- Summary KPIs -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Blocks Included</div>
            <div class="kpi-value">${printGrandTotals.totalBlocks}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Bills</div>
            <div class="kpi-value">${printGrandTotals.totalBills}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Billed</div>
            <div class="kpi-value">₹${printGrandTotals.totalBilledAmount.toLocaleString("en-IN")}</div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-label">Total Collected</div>
            <div class="kpi-value">₹${printGrandTotals.totalCollectedAmount.toLocaleString("en-IN")} (${printGrandTotals.paidBillsCount})</div>
          </div>
          <div class="kpi-card pending">
            <div class="kpi-label">Pending Dues</div>
            <div class="kpi-value">₹${printGrandTotals.totalPendingAmount.toLocaleString("en-IN")} (${printGrandTotals.pendingBillsCount})</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Collection Rate</div>
            <div class="kpi-value">${printGrandTotals.collectionRate}%</div>
          </div>
        </div>

        <!-- Block-by-Block Monthly Bills Tables -->
        ${processedBlocks
          .map(
            (b) => `
          <div class="block-section">
            <div class="block-header">
              <div class="block-title">${b.blockName}</div>
              <div class="block-meta">
                ${b.totalBills} Bills • Billed: ₹${b.totalBilledAmount.toLocaleString("en-IN")} • Collected: ₹${b.totalCollectedAmount.toLocaleString("en-IN")} • Pending: ₹${b.totalPendingAmount.toLocaleString("en-IN")} (${b.collectionRate}%)
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 25px; text-align: center;">S.N</th>
                  <th style="width: 50px;">Flat</th>
                  <th>Resident / Owner Name</th>
                  <th style="width: 75px;">Contact</th>
                  <th style="width: 80px;">Bill ID</th>
                  <th style="width: 55px; text-align: right;">Amount (₹)</th>
                  <th style="width: 55px; text-align: center;">Status</th>
                  <th style="width: 65px;">Due Date</th>
                  <th style="width: 70px;">Paid Date</th>
                  <th style="width: 65px;">Mode</th>
                  <th style="width: 80px;">Receipt No</th>
                  <th style="width: 85px;">Receiver / Collector</th>
                </tr>
              </thead>
              <tbody>
                ${b.bills
                  .map(
                    (bill, idx) => `
                  <tr>
                    <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                    <td class="flat-num">${bill.flat}</td>
                    <td><strong>${bill.residentName}</strong></td>
                    <td style="font-family: monospace; font-size: 8px;">${bill.mobile}</td>
                    <td style="font-family: monospace; font-size: 8px;">${bill.billNumber}</td>
                    <td style="text-align: right; font-weight: 700;">₹${bill.billAmount}</td>
                    <td style="text-align: center;">
                      <span class="status-tag ${
                        bill.isPaid
                          ? "status-paid"
                          : bill.status === "Overdue"
                          ? "status-overdue"
                          : "status-pending"
                      }">
                        ${bill.isPaid ? "PAID" : bill.status}
                      </span>
                    </td>
                    <td style="font-size: 8px;">${bill.dueDate}</td>
                    <td style="font-size: 8px;">${bill.paymentDate}</td>
                    <td style="font-size: 8px;">${bill.paymentMethod}</td>
                    <td style="font-family: monospace; font-size: 8px;">${bill.receiptNumber}</td>
                    <td style="font-size: 8px;">${bill.collector}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="block-subtotal">
              <div>
                <strong>${b.blockName} Subtotals:</strong> ${b.totalBills} Bills (${b.paidBillsCount} Paid, ${b.pendingBillsCount} Pending)
              </div>
              <div>
                Billed: <strong>₹${b.totalBilledAmount.toLocaleString("en-IN")}</strong> | 
                Collected: <strong style="color: #166534;">₹${b.totalCollectedAmount.toLocaleString("en-IN")}</strong> | 
                Pending: <strong style="color: #991b1b;">₹${b.totalPendingAmount.toLocaleString("en-IN")}</strong> | 
                Collection Rate: <strong>${b.collectionRate}%</strong>
              </div>
            </div>
          </div>
        `
          )
          .join("")}

        <!-- Grand Total Financial Reconciliation Box -->
        <div class="grand-summary">
          <div class="grand-summary-title">Official Billing & Reconciliation Statement</div>
          <div class="grand-summary-grid">
            <div>
              <span style="color: #475569; font-size: 8.5px;">Grand Total Bills:</span>
              <div style="font-size: 12px; font-weight: 800;">${printGrandTotals.totalBills} Bills across ${printGrandTotals.totalBlocks} Blocks</div>
            </div>
            <div>
              <span style="color: #475569; font-size: 8.5px;">Grand Total Billed:</span>
              <div style="font-size: 12px; font-weight: 800; color: #0f766e;">₹${printGrandTotals.totalBilledAmount.toLocaleString("en-IN")}</div>
            </div>
            <div>
              <span style="color: #475569; font-size: 8.5px;">Grand Total Collected:</span>
              <div style="font-size: 12px; font-weight: 800; color: #166534;">₹${printGrandTotals.totalCollectedAmount.toLocaleString("en-IN")} (${printGrandTotals.paidBillsCount} Paid)</div>
            </div>
            <div>
              <span style="color: #475569; font-size: 8.5px;">Grand Total Pending:</span>
              <div style="font-size: 12px; font-weight: 800; color: #991b1b;">₹${printGrandTotals.totalPendingAmount.toLocaleString("en-IN")} (${printGrandTotals.pendingBillsCount} Pending)</div>
            </div>
          </div>
        </div>

        <!-- Official Sign-off Footer -->
        <div class="sign-box-row">
          <div class="sign-box">
            <div class="sign-role">Accounts Officer</div>
            <div>Prepared Billing Statement</div>
          </div>
          <div class="sign-box">
            <div class="sign-role">Treasurer / Internal Auditor</div>
            <div>Verified & Reconciled with Bank/Cash</div>
          </div>
          <div class="sign-box">
            <div class="sign-role">President / General Secretary</div>
            <div>Authorized RWA Executive Sign-off</div>
          </div>
        </div>

        <div class="print-footer">
          Official monthly billing and collection register generated by RWA Smart Manager. All figures cross-verified with bank/cash records.
        </div>
      </body>
    </html>
  `;

  executeIframePrint(html, `Monthly_Bills_Register_${billingPeriod.replace(/\s+/g, "_")}`);
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 3. VECTOR PDF GENERATOR: BLOCK-WISE MONTHLY PAYMENT BILLS REGISTER
 * Crystal-clear text, vector typography, official letterhead & signatures.
 * ═════════════════════════════════════════════════════════════════════════════
 */
export function generateBlockWiseMonthlyBillsPDF({
  syncedData,
  settings = {},
  month,
  year,
  filterBlock = "all",
  filterStatus = "all",
}) {
  if (!syncedData || !syncedData.blocks) {
    toast.error("No billing data available for PDF export");
    return;
  }

  const societyName = settings.societyName || "D BLOCK RWA INDRAPRASTHA";
  const societyAddress = settings.address || "D Block, Indraprastha, New Delhi";
  const societyContact = settings.contactNumber || settings.supportPhone || "";
  const billingPeriod = `${month || syncedData.billingMonth} ${year || syncedData.billingYear}`;
  const generatedAt = syncedData.generatedAt || new Date().toLocaleString("en-IN");

  // Filter blocks
  let targetBlocks = syncedData.blocks;
  if (filterBlock !== "all") {
    targetBlocks = targetBlocks.filter(
      (b) => b.blockName.toLowerCase() === filterBlock.toLowerCase()
    );
  }

  // Filter bills inside blocks
  const processedBlocks = targetBlocks
    .map((b) => {
      const filteredBills = b.bills.filter((bill) => {
        if (filterStatus === "paid" && !bill.isPaid) return false;
        if (filterStatus === "pending" && bill.isPaid) return false;
        if (filterStatus === "overdue" && bill.status !== "Overdue") return false;
        return true;
      });

      const totalBilled = filteredBills.reduce((s, bill) => s + bill.billAmount, 0);
      const totalCollected = filteredBills.filter((bill) => bill.isPaid).reduce((s, bill) => s + bill.paidAmount, 0);
      const totalPending = filteredBills.filter((bill) => !bill.isPaid).reduce((s, bill) => s + bill.pendingAmount, 0);
      const paidBillsCount = filteredBills.filter((bill) => bill.isPaid).length;

      return {
        ...b,
        bills: filteredBills,
        totalBills: filteredBills.length,
        paidBillsCount,
        pendingBillsCount: filteredBills.length - paidBillsCount,
        totalBilledAmount: totalBilled,
        totalCollectedAmount: totalCollected,
        totalPendingAmount: totalPending,
        collectionRate: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : (paidBillsCount > 0 ? 100 : 0),
      };
    })
    .filter((b) => b.bills.length > 0);

  // Recalculate Grand Totals
  const printGrandTotals = processedBlocks.reduce(
    (acc, b) => {
      acc.totalBlocks += 1;
      acc.totalBills += b.totalBills;
      acc.paidBillsCount += b.paidBillsCount;
      acc.pendingBillsCount += b.pendingBillsCount;
      acc.totalBilledAmount += b.totalBilledAmount;
      acc.totalCollectedAmount += b.totalCollectedAmount;
      acc.totalPendingAmount += b.totalPendingAmount;
      return acc;
    },
    {
      totalBlocks: 0,
      totalBills: 0,
      paidBillsCount: 0,
      pendingBillsCount: 0,
      totalBilledAmount: 0,
      totalCollectedAmount: 0,
      totalPendingAmount: 0,
    }
  );

  printGrandTotals.collectionRate = printGrandTotals.totalBilledAmount > 0
    ? Math.round((printGrandTotals.totalCollectedAmount / printGrandTotals.totalBilledAmount) * 100)
    : (printGrandTotals.paidBillsCount > 0 ? 100 : 0);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(societyName.toUpperCase(), 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const subText = [
    societyAddress,
    societyContact ? `Contact: ${societyContact}` : "",
  ].filter(Boolean).join(" | ");
  doc.text(subText, 14, 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text(`MONTHLY BILLING & COLLECTION REGISTER — ${billingPeriod.toUpperCase()}`, 14, 23);

  // Right Header info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated: ${generatedAt}`, pageWidth - 14, 11, { align: "right" });
  doc.text(`Status: Verified & Synchronized`, pageWidth - 14, 17, { align: "right" });

  let currentY = 33;

  // Executive Summary Card
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, "FD");

  const statCols = [
    { label: "Total Bills", value: `${printGrandTotals.totalBills} (${printGrandTotals.totalBlocks} Blocks)` },
    { label: "Total Billed", value: `₹${printGrandTotals.totalBilledAmount.toLocaleString("en-IN")}` },
    { label: "Collected", value: `₹${printGrandTotals.totalCollectedAmount.toLocaleString("en-IN")} (${printGrandTotals.paidBillsCount} Paid)` },
    { label: "Pending Dues", value: `₹${printGrandTotals.totalPendingAmount.toLocaleString("en-IN")} (${printGrandTotals.pendingBillsCount} Pending)` },
    { label: "Collection Rate", value: `${printGrandTotals.collectionRate}%` },
  ];

  const colWidth = (pageWidth - 28) / statCols.length;
  statCols.forEach((stat, i) => {
    const x = 14 + (i * colWidth) + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(stat.label.toUpperCase(), x, currentY + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // slate-900
    if (i === 1) doc.setTextColor(15, 118, 110); // teal-700
    if (i === 2) doc.setTextColor(22, 101, 52); // green-800
    if (i === 3) doc.setTextColor(185, 28, 28); // red-700
    doc.text(stat.value, x, currentY + 11.5);
  });

  currentY += 21;

  // Render Table for each Block
  processedBlocks.forEach((b) => {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 16;
    }

    // Block Title Banner
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(`BLOCK: ${b.blockName.toUpperCase()} — (${b.totalBills} Flats | Billed: ₹${b.totalBilledAmount.toLocaleString("en-IN")} | Collected: ₹${b.totalCollectedAmount.toLocaleString("en-IN")} | Pending: ₹${b.totalPendingAmount.toLocaleString("en-IN")})`, 14, currentY);
    currentY += 3.5;

    const tableRows = b.bills.map((bill, index) => [
      index + 1,
      bill.flat || "—",
      bill.owner || bill.residentName || "—",
      bill.mobile || "—",
      bill.billNumber || "—",
      `₹${Number(bill.billAmount || 0).toLocaleString("en-IN")}`,
      bill.isPaid ? "PAID" : (bill.status || "PENDING").toUpperCase(),
      bill.dueDate || "—",
      bill.paymentDate || "—",
      bill.paymentMethod || (bill.isPaid ? "Direct" : "—"),
      bill.receiptNumber || "—",
      bill.collector || "—",
    ]);

    // Subtotal Row
    tableRows.push([
      "",
      "TOTAL",
      `${b.blockName} Sub-Total`,
      "",
      "",
      `₹${b.totalBilledAmount.toLocaleString("en-IN")}`,
      `${b.paidBillsCount} Paid / ${b.pendingBillsCount} Due`,
      "",
      `Col: ₹${b.totalCollectedAmount.toLocaleString("en-IN")}`,
      "",
      `Due: ₹${b.totalPendingAmount.toLocaleString("en-IN")}`,
      `Rate: ${b.collectionRate}%`,
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        ["#", "Flat", "Resident Name", "Mobile", "Bill No", "Amount", "Status", "Due Date", "Paid Date", "Method", "Receipt No", "Collector"]
      ],
      body: tableRows,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "middle",
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [16, 185, 129], // emerald-500
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { halign: "center", fontStyle: "bold", cellWidth: 16 },
        2: { cellWidth: 42, fontStyle: "bold" },
        3: { cellWidth: 24 },
        4: { cellWidth: 22, fontStyle: "italic" },
        5: { halign: "right", fontStyle: "bold", cellWidth: 18 },
        6: { halign: "center", fontStyle: "bold", cellWidth: 20 },
        7: { halign: "center", cellWidth: 22 },
        8: { halign: "center", cellWidth: 22 },
        9: { halign: "center", cellWidth: 18 },
        10: { cellWidth: 28 },
        11: { cellWidth: 25 },
      },
      didParseCell: function(data) {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [15, 23, 42];
        } else if (data.column.index === 6) {
          const val = String(data.cell.raw).toUpperCase();
          if (val === "PAID") {
            data.cell.styles.textColor = [22, 101, 52];
          } else if (val === "OVERDUE") {
            data.cell.styles.textColor = [185, 28, 28];
          } else {
            data.cell.styles.textColor = [180, 83, 9];
          }
        }
      },
    });

    currentY = doc.lastAutoTable.finalY + 8;
  });

  // Check if we need a new page for signatures
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 20;
  }

  // Official Signature Box
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1.5, 1], 0);

  const signWidth = 70;
  const signStartX = 14;
  const gap = (pageWidth - 28 - (signWidth * 3)) / 2;

  // 1. Prepared By
  doc.line(signStartX, currentY + 14, signStartX + signWidth, currentY + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Accounts Officer / Admin", signStartX + (signWidth / 2), currentY + 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Prepared Billing Statement", signStartX + (signWidth / 2), currentY + 22, { align: "center" });

  // 2. Verified By
  const x2 = signStartX + signWidth + gap;
  doc.line(x2, currentY + 14, x2 + signWidth, currentY + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Treasurer / Internal Auditor", x2 + (signWidth / 2), currentY + 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Verified with Bank / Cash Register", x2 + (signWidth / 2), currentY + 22, { align: "center" });

  // 3. Approved By
  const x3 = x2 + signWidth + gap;
  doc.line(x3, currentY + 14, x3 + signWidth, currentY + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("President / General Secretary", x3 + (signWidth / 2), currentY + 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Authorized Executive Sign-off", x3 + (signWidth / 2), currentY + 22, { align: "center" });

  // Add Page Numbers to all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Confidential — For Internal RWA Society & Audit Records Only | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  const safeFileName = `Monthly_Bills_Register_${billingPeriod.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  doc.save(safeFileName);
  toast.success("PDF Downloaded: Complete Block-Wise Register with clear typography");
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 4. VECTOR PDF GENERATOR: BLOCK-WISE RESIDENT REGISTER
 * ═════════════════════════════════════════════════════════════════════════════
 */
export function generateBlockWiseResidentsPDF({
  syncedData,
  settings = {},
  filterBlock = "all",
  filterStatus = "all",
  filterGc = "all",
}) {
  if (!syncedData || !syncedData.blocks) {
    toast.error("No resident data available for PDF export");
    return;
  }

  const societyName = settings.societyName || "D BLOCK RWA INDRAPRASTHA";
  const societyAddress = settings.address || "D Block, Indraprastha, New Delhi";
  const societyContact = settings.contactNumber || settings.supportPhone || "";
  const billingPeriod = `${syncedData.billingMonth} ${syncedData.billingYear}`;
  const generatedAt = syncedData.generatedAt || new Date().toLocaleString("en-IN");

  // Filter blocks
  let targetBlocks = syncedData.blocks;
  if (filterBlock !== "all") {
    targetBlocks = targetBlocks.filter(
      (b) => b.blockName.toLowerCase() === filterBlock.toLowerCase()
    );
  }

  // Filter residents
  const processedBlocks = targetBlocks
    .map((b) => {
      const filteredResidents = b.residents.filter((r) => {
        if (filterStatus === "active" && r.status !== "Active") return false;
        if (filterStatus === "inactive" && r.status === "Active") return false;
        if (filterGc === "enrolled" && !r.isEnrolled) return false;
        if (filterGc === "opted_out" && r.isEnrolled) return false;
        return true;
      });

      const totalExpected = filteredResidents.reduce((s, r) => s + (r.isEnrolled ? r.monthlyCharge : 0), 0);
      const totalCollected = filteredResidents.filter((r) => r.isPaid).reduce((s, r) => s + r.paidAmount, 0);
      const totalPending = filteredResidents.filter((r) => !r.isPaid).reduce((s, r) => s + (r.isEnrolled ? r.monthlyCharge : 0), 0);
      const paidCount = filteredResidents.filter((r) => r.isPaid).length;

      return {
        ...b,
        residents: filteredResidents,
        totalFlats: filteredResidents.length,
        activeCount: filteredResidents.filter((r) => r.status === "Active").length,
        gcEnrolledCount: filteredResidents.filter((r) => r.isEnrolled).length,
        paidCount,
        pendingCount: filteredResidents.length - paidCount,
        expectedAmount: totalExpected,
        collectedAmount: totalCollected,
        pendingAmount: totalPending,
        collectionRate: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : (paidCount > 0 ? 100 : 0),
      };
    })
    .filter((b) => b.residents.length > 0);

  const printGrandTotals = processedBlocks.reduce(
    (acc, b) => {
      acc.totalBlocks += 1;
      acc.totalFlats += b.totalFlats;
      acc.activeCount += b.activeCount;
      acc.gcEnrolledCount += b.gcEnrolledCount;
      acc.paidCount += b.paidCount;
      acc.pendingCount += b.pendingCount;
      acc.expectedAmount += b.expectedAmount;
      acc.collectedAmount += b.collectedAmount;
      acc.pendingAmount += b.pendingAmount;
      return acc;
    },
    {
      totalBlocks: 0,
      totalFlats: 0,
      activeCount: 0,
      gcEnrolledCount: 0,
      paidCount: 0,
      pendingCount: 0,
      expectedAmount: 0,
      collectedAmount: 0,
      pendingAmount: 0,
    }
  );

  printGrandTotals.collectionRate = printGrandTotals.expectedAmount > 0
    ? Math.round((printGrandTotals.collectedAmount / printGrandTotals.expectedAmount) * 100)
    : (printGrandTotals.paidCount > 0 ? 100 : 0);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(societyName.toUpperCase(), 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const subText = [
    societyAddress,
    societyContact ? `Contact: ${societyContact}` : "",
  ].filter(Boolean).join(" | ");
  doc.text(subText, 14, 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(52, 211, 153);
  doc.text(`OFFICIAL RESIDENT DIRECTORY & BILLING REGISTER — ${billingPeriod.toUpperCase()}`, 14, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${generatedAt}`, pageWidth - 14, 11, { align: "right" });
  doc.text(`Master Database Record`, pageWidth - 14, 17, { align: "right" });

  let currentY = 33;

  // Summary Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, "FD");

  const statCols = [
    { label: "Total Flats", value: `${printGrandTotals.totalFlats} (${printGrandTotals.totalBlocks} Blocks)` },
    { label: "Active Residents", value: `${printGrandTotals.activeCount}` },
    { label: "GC Enrolled", value: `${printGrandTotals.gcEnrolledCount}` },
    { label: "Expected Fee", value: `₹${printGrandTotals.expectedAmount.toLocaleString("en-IN")}` },
    { label: "Collected", value: `₹${printGrandTotals.collectedAmount.toLocaleString("en-IN")} (${printGrandTotals.paidCount} Paid)` },
    { label: "Pending", value: `₹${printGrandTotals.pendingAmount.toLocaleString("en-IN")}` },
  ];

  const colWidth = (pageWidth - 28) / statCols.length;
  statCols.forEach((stat, i) => {
    const x = 14 + (i * colWidth) + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(stat.label.toUpperCase(), x, currentY + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    if (i === 3) doc.setTextColor(15, 118, 110);
    if (i === 4) doc.setTextColor(22, 101, 52);
    if (i === 5) doc.setTextColor(185, 28, 28);
    doc.text(stat.value, x, currentY + 11.5);
  });

  currentY += 21;

  processedBlocks.forEach((b) => {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`BLOCK: ${b.blockName.toUpperCase()} — (${b.totalFlats} Flats | Active: ${b.activeCount} | GC Enrolled: ${b.gcEnrolledCount} | Col: ₹${b.collectedAmount.toLocaleString("en-IN")} | Due: ₹${b.pendingAmount.toLocaleString("en-IN")})`, 14, currentY);
    currentY += 3.5;

    const tableRows = b.residents.map((r, index) => [
      index + 1,
      r.flat || "—",
      r.owner || "Resident",
      r.mobile || "—",
      r.status,
      r.isEnrolled ? "Enrolled" : "Opted Out",
      `₹${r.monthlyCharge}`,
      r.isPaid ? "PAID" : r.currentMonthStatus.toUpperCase(),
      r.isPaid ? `₹${r.paidAmount}` : `₹${r.pendingDue}`,
      r.receiptNo || "—",
      r.paymentDate || "—",
      r.paymentMode || (r.isPaid ? "Direct" : "—"),
    ]);

    tableRows.push([
      "",
      "TOTAL",
      `${b.blockName} Subtotal`,
      "",
      `${b.activeCount} Active`,
      `${b.gcEnrolledCount} Enrolled`,
      `₹${b.expectedAmount.toLocaleString("en-IN")}`,
      `${b.paidCount} Paid / ${b.pendingCount} Due`,
      `Col: ₹${b.totalCollectedAmount || b.collectedAmount}`,
      "",
      "",
      `Rate: ${b.collectionRate}%`,
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 14, right: 14 },
      head: [
        ["#", "Flat", "Resident Name", "Mobile", "Status", "GC Service", "Monthly Fee", "Payment", "Amount", "Receipt No", "Date", "Method"]
      ],
      body: tableRows,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        valign: "middle",
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [14, 116, 144], // cyan-700
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { halign: "center", fontStyle: "bold", cellWidth: 16 },
        2: { cellWidth: 42, fontStyle: "bold" },
        3: { cellWidth: 24 },
        4: { halign: "center", cellWidth: 18 },
        5: { halign: "center", cellWidth: 20 },
        6: { halign: "right", fontStyle: "bold", cellWidth: 20 },
        7: { halign: "center", fontStyle: "bold", cellWidth: 22 },
        8: { halign: "right", fontStyle: "bold", cellWidth: 20 },
        9: { cellWidth: 28 },
        10: { halign: "center", cellWidth: 22 },
        11: { halign: "center", cellWidth: 20 },
      },
      didParseCell: function(data) {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [15, 23, 42];
        } else if (data.column.index === 7) {
          const val = String(data.cell.raw).toUpperCase();
          if (val === "PAID") data.cell.styles.textColor = [22, 101, 52];
          else if (val === "OVERDUE") data.cell.styles.textColor = [185, 28, 28];
          else data.cell.styles.textColor = [180, 83, 9];
        }
      },
    });

    currentY = doc.lastAutoTable.finalY + 8;
  });

  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 20;
  }

  // Signatures
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1.5, 1], 0);

  const signWidth = 70;
  const signStartX = 14;
  const gap = (pageWidth - 28 - (signWidth * 3)) / 2;

  doc.line(signStartX, currentY + 14, signStartX + signWidth, currentY + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("System Administrator", signStartX + (signWidth / 2), currentY + 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Resident Database Master", signStartX + (signWidth / 2), currentY + 22, { align: "center" });

  const x2 = signStartX + signWidth + gap;
  doc.line(x2, currentY + 14, x2 + signWidth, currentY + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Secretary / Membership Committee", x2 + (signWidth / 2), currentY + 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Flat Tenancy & Ownership Verified", x2 + (signWidth / 2), currentY + 22, { align: "center" });

  const x3 = x2 + signWidth + gap;
  doc.line(x3, currentY + 14, x3 + signWidth, currentY + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("President / General Secretary", x3 + (signWidth / 2), currentY + 18, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Official RWA Register Sign-off", x3 + (signWidth / 2), currentY + 22, { align: "center" });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Official Resident Register — ${societyName} | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  const safeFileName = `Resident_Register_${billingPeriod.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  doc.save(safeFileName);
  toast.success("PDF Downloaded: Complete Block-Wise Resident Register");
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 5. SINGLE BILL INVOICE / RECEIPT PDF GENERATOR
 * ═════════════════════════════════════════════════════════════════════════════
 */
export function generateSingleBillPDF(bill, settings = {}) {
  if (!bill) return;

  const societyName = settings.societyName || "D BLOCK RWA INDRAPRASTHA";
  const societyAddress = settings.address || "D Block, Indraprastha, New Delhi";
  const societyContact = settings.contactNumber || settings.supportPhone || "";
  const status = (bill.displayStatus || bill.status || "Pending").toUpperCase();
  const isPaid = status === "PAID";

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(societyName.toUpperCase(), 15, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`${societyAddress}${societyContact ? ` | Tel: ${societyContact}` : ""}`, 15, 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text("MONTHLY MAINTENANCE & GARBAGE INVOICE", 15, 29);

  // Right badge
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(`Invoice Date: ${new Date().toLocaleDateString("en-IN")}`, pageWidth - 15, 14, { align: "right" });
  doc.text(`Bill No: ${bill.paymentId || bill.id || "BILL-REV"}`, pageWidth - 15, 21, { align: "right" });

  // Bill Details Grid Box
  let currentY = 44;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, currentY, pageWidth - 30, 42, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("RESIDENT & PROPERTY PARTICULARS", 20, currentY + 7);

  const leftItems = [
    ["Resident Name:", bill.residentName || bill.owner || "Resident"],
    ["Flat Number:", bill.flat || "—"],
    ["Block:", bill.block || "General"],
  ];

  const rightItems = [
    ["Billing Period:", `${bill.month || "Current"} ${bill.year || ""}`],
    ["Due Date:", bill.dueDate || "10th of Month"],
    ["Payment Status:", status],
  ];

  leftItems.forEach((item, idx) => {
    const y = currentY + 16 + (idx * 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(item[0], 20, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(item[1], 55, y);
  });

  rightItems.forEach((item, idx) => {
    const y = currentY + 16 + (idx * 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(item[0], 115, y);
    doc.setFont("helvetica", "bold");
    if (idx === 2) {
      if (isPaid) doc.setTextColor(22, 101, 52);
      else if (status === "OVERDUE") doc.setTextColor(185, 28, 28);
      else doc.setTextColor(180, 83, 9);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(item[1], 150, y);
  });

  // Table with Line Item Charges
  currentY += 50;

  const itemRows = [
    [
      "1",
      `Monthly Doorstep Waste & Society Maintenance Collection Fee\nBilling Period: ${bill.month} ${bill.year}`,
      `₹${Number(bill.amount || 80).toLocaleString("en-IN")}`,
      isPaid ? `₹${Number(bill.paidAmount || bill.amount || 80).toLocaleString("en-IN")}` : "₹0",
      isPaid ? "₹0" : `₹${Number(bill.amount || 80).toLocaleString("en-IN")}`
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 15, right: 15 },
    head: [["S.No", "Description of Charges", "Bill Amount", "Paid Amount", "Balance Due"]],
    body: itemRows,
    theme: "grid",
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      1: { cellWidth: 90 },
      2: { halign: "right", fontStyle: "bold", cellWidth: 26 },
      3: { halign: "right", fontStyle: "bold", cellWidth: 26, textColor: [22, 101, 52] },
      4: { halign: "right", fontStyle: "bold", cellWidth: 24, textColor: isPaid ? [100, 116, 139] : [185, 28, 28] },
    },
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // Payment Confirmation or Due Notice Box
  if (isPaid) {
    doc.setFillColor(240, 253, 244); // green-50
    doc.setDrawColor(187, 247, 208); // green-200
    doc.roundedRect(15, currentY, pageWidth - 30, 26, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(22, 101, 52);
    doc.text("PAYMENT RECEIVED WITH THANKS", 20, currentY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(21, 128, 61);
    doc.text(`Receipt Number: ${bill.paymentId || "REC-CONFIRMED"}`, 20, currentY + 14);
    doc.text(`Payment Date: ${bill.paymentDate || "Recorded"} | Mode: ${bill.paymentMethod || "Cash"}`, 20, currentY + 20);
  } else {
    doc.setFillColor(254, 242, 242); // red-50
    doc.setDrawColor(254, 202, 202); // red-200
    doc.roundedRect(15, currentY, pageWidth - 30, 26, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(153, 27, 27);
    doc.text("PAYMENT OUTSTANDING NOTICE", 20, currentY + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(185, 28, 28);
    doc.text(`Please clear dues before ${bill.dueDate || "10th of Month"} to ensure uninterrupted society service.`, 20, currentY + 14);
    doc.text(`Payment can be made via UPI / Cash to assigned door-to-door collector or at RWA Office.`, 20, currentY + 20);
  }

  currentY += 40;

  // Signature / Stamp
  doc.setDrawColor(203, 213, 225);
  doc.line(pageWidth - 75, currentY + 15, pageWidth - 15, currentY + 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("Authorized Signatory", pageWidth - 45, currentY + 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(societyName, pageWidth - 45, currentY + 24, { align: "center" });

  doc.save(`Invoice_${bill.flat}_${bill.month}_${bill.year}.pdf`);
  toast.success(`PDF Invoice for Flat ${bill.flat} downloaded`);
}

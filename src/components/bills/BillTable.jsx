import { useState, useMemo, useEffect } from "react";
import {
  FaEye,
  FaTrash,
  FaPrint,
  FaMoneyBillWave,
  FaFilePdf,
} from "react-icons/fa";

import { generateSingleBillPDF } from "../../utils/printReportHelper";
import Pagination from "../common/Pagination";

export default function BillTable({
  bills,
  onPay,
  onView,
  onDelete,
  settings = {},
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [bills.length]);

  const pagedBills = useMemo(() => {
    if (pageSize === "all" || pageSize === "All" || Number(pageSize) >= bills.length) {
      return bills;
    }
    const numericSize = Number(pageSize) || 25;
    const start = (page - 1) * numericSize;
    return bills.slice(start, start + numericSize);
  }, [bills, page, pageSize]);

  function downloadBillPDF(bill) {
    generateSingleBillPDF(bill, settings);
  }

  function printBill(bill) {
    const status = (bill.displayStatus || bill.status || "Pending").toUpperCase();
    const isPaid = status === "PAID";
    const societyName = settings.societyName || "D BLOCK RWA INDRAPRASTHA";
    const societyAddress = settings.address || "D Block, Indraprastha, New Delhi";
    const societyContact = settings.contactNumber || settings.supportPhone || "";
    const printWindow = window.open("", "_blank");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - Flat ${bill.flat} - ${bill.month} ${bill.year}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            background: #fff;
          }
          .invoice-card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 24px;
            max-width: 750px;
            margin: 0 auto;
          }
          .header-banner {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .soc-name {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .soc-addr {
            font-size: 11px;
            color: #475569;
            margin-top: 3px;
          }
          .inv-title-box {
            text-align: right;
          }
          .inv-badge {
            display: inline-block;
            background: #0f172a;
            color: #fff;
            font-size: 10px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 4px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .inv-meta {
            font-size: 11px;
            color: #64748b;
            margin-top: 5px;
          }
          .grid-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 18px;
            margin-bottom: 20px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 6px;
          }
          .item-lbl {
            color: #64748b;
          }
          .item-val {
            font-weight: 700;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 20px;
          }
          th {
            background: #0f172a;
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            padding: 10px;
            text-align: left;
          }
          td {
            border-bottom: 1px solid #e2e8f0;
            padding: 10px;
            font-size: 12px;
          }
          .status-box {
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 25px;
            ${
              isPaid
                ? "background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;"
                : "background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;"
            }
          }
          .status-header {
            font-size: 13px;
            font-weight: 800;
            margin-bottom: 4px;
          }
          .status-desc {
            font-size: 11px;
          }
          .footer-sign {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 20px;
          }
          .sign-box {
            text-align: center;
            width: 200px;
          }
          .sign-line {
            border-top: 1px solid #94a3b8;
            margin-bottom: 6px;
          }
          .sign-title {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
          }
          .sign-sub {
            font-size: 10px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="invoice-card">
          <div class="header-banner">
            <div>
              <div class="soc-name">${societyName.toUpperCase()}</div>
              <div class="soc-addr">${societyAddress}${societyContact ? ` • Tel: ${societyContact}` : ""}</div>
            </div>
            <div class="inv-title-box">
              <div class="inv-badge">Official Maintenance Invoice</div>
              <div class="inv-meta">Bill Ref: ${bill.paymentId || bill.id || "REC-" + bill.flat}</div>
            </div>
          </div>

          <div class="grid-details">
            <div>
              <div class="item-row"><span class="item-lbl">Resident Name:</span> <span class="item-val">${bill.residentName || "-"}</span></div>
              <div class="item-row"><span class="item-lbl">Flat Number:</span> <span class="item-val">${bill.flat}</span></div>
              <div class="item-row"><span class="item-lbl">Block:</span> <span class="item-val">${bill.block || "General"}</span></div>
            </div>
            <div>
              <div class="item-row"><span class="item-lbl">Billing Period:</span> <span class="item-val">${bill.month} ${bill.year}</span></div>
              <div class="item-row"><span class="item-lbl">Due Date:</span> <span class="item-val">${bill.dueDate || "10th of Month"}</span></div>
              <div class="item-row"><span class="item-lbl">Status:</span> <span class="item-val" style="color: ${isPaid ? '#16a34a' : '#dc2626'}">${status}</span></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>Description</th>
                <th style="text-align: right; width: 110px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center; color: #64748b;">1</td>
                <td>
                  <strong>Monthly Doorstep Waste & Society Maintenance Collection Fee</strong><br>
                  <span style="font-size: 10.5px; color: #64748b;">Billing Cycle: ${bill.month} ${bill.year}</span>
                </td>
                <td style="text-align: right; font-weight: 700; font-size: 14px;">₹${Number(bill.amount).toLocaleString("en-IN")}</td>
              </tr>
            </tbody>
          </table>

          <div class="status-box">
            <div class="status-header">${isPaid ? "✓ PAYMENT RECEIVED WITH THANKS" : "⚠ PAYMENT OUTSTANDING NOTICE"}</div>
            <div class="status-desc">
              ${
                isPaid
                  ? `Receipt ID: <strong>${bill.paymentId || "CONFIRMED"}</strong> • Paid on: <strong>${bill.paymentDate || "Recorded"}</strong> via <strong>${bill.paymentMethod || "Cash"}</strong>.`
                  : `Please clear dues by ${bill.dueDate || "the due date"} to ensure uninterrupted society services.`
              }
            </div>
          </div>

          <div class="footer-sign">
            <div style="font-size: 10px; color: #94a3b8;">
              Printed on ${new Date().toLocaleString("en-IN")}<br>
              System Generated Official Bill
            </div>
            <div class="sign-box">
              <div class="sign-line"></div>
              <div class="sign-title">Authorized Signatory</div>
              <div class="sign-sub">${societyName}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-x-auto border border-gray-100">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="p-4 text-left font-bold text-gray-600">Flat</th>
            <th className="p-4 text-left font-bold text-gray-600">Resident</th>
            <th className="p-4 text-left font-bold text-gray-600">Amount</th>
            <th className="p-4 text-left font-bold text-gray-600">Status</th>
            <th className="p-4 text-left font-bold text-gray-600">Due Date</th>
            <th className="p-4 text-center font-bold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bills.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center py-16 text-gray-500">
                <div className="flex flex-col items-center gap-3">
                  <FaFilePdf className="text-5xl text-gray-300" />
                  <p className="text-lg font-medium">No Bills Found</p>
                </div>
              </td>
            </tr>
          ) : (
            pagedBills.map((bill) => {
              const status = bill.displayStatus || bill.status;
              const isSettled = status === "Paid" || status === "Exempted";
              
              return (
                <tr key={bill.id} className="border-t border-gray-50 hover:bg-emerald-50/30 transition">
                  <td className="p-4 font-bold text-gray-800">{bill.flat}</td>
                  <td className="p-4 font-medium text-gray-600">{bill.residentName}</td>
                  <td className="p-4 font-bold text-emerald-600">₹{bill.amount}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase ${
                        status === "Paid" ? "bg-green-100 text-green-700"
                        : status === "Pending" ? "bg-yellow-100 text-yellow-700"
                        : status === "Exempted" ? "bg-gray-200 text-gray-700"
                        : status === "Overdue" ? "bg-red-100 text-red-700"
                        : "bg-red-100 text-red-700"
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-gray-500">{bill.dueDate || "-"}</td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      {/* Collect */}
                      <button
                        onClick={() => onPay(bill)}
                        disabled={isSettled}
                        className={`p-2.5 rounded-lg transition shadow-sm ${
                          isSettled 
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                            : "bg-emerald-100 hover:bg-emerald-600 text-emerald-600 hover:text-white"
                        }`}
                        title={isSettled ? "Payment Settled" : "Collect Payment"}
                      >
                        <FaMoneyBillWave />
                      </button>

                      {/* View */}
                      <button 
                        onClick={() => onView(bill)}
                        className="bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white p-2.5 rounded-lg transition shadow-sm" 
                        title="View Bill"
                      >
                        <FaEye />
                      </button>

                      {/* PDF Download */}
                      <button
                        onClick={() => downloadBillPDF(bill)}
                        className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-2.5 rounded-lg transition shadow-sm"
                        title="Download PDF"
                      >
                        <FaFilePdf />
                      </button>
                      
                      {/* Print */}
                      <button
                        onClick={() => printBill(bill)}
                        className="bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white p-2.5 rounded-lg transition shadow-sm"
                        title="Print Bill"
                      >
                        <FaPrint />
                      </button>
                      
                      {/* Delete */}
                      <button 
                        onClick={() => onDelete(bill)}
                        className="bg-gray-50 hover:bg-red-600 text-gray-600 hover:text-white p-2.5 rounded-lg transition shadow-sm" 
                        title="Delete Bill"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {bills.length > 0 && (
        <Pagination
          currentPage={page}
          totalItems={bills.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[25, 50, 100, "all"]}
        />
      )}
    </div>
  );
}
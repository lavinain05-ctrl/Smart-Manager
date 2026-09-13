import { useState, useMemo } from "react";
import {
  FaPrint,
  FaFilePdf,
  FaTimes,
  FaBuilding,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaFilter,
  FaInfoCircle,
} from "react-icons/fa";
import { syncBlockWiseMonthlyBills } from "../../utils/reportSyncService";
import {
  printBlockWiseMonthlyBillsRegister,
  generateBlockWiseMonthlyBillsPDF,
} from "../../utils/printReportHelper";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PrintMonthlyBillsModal({
  open,
  onClose,
  residents = [],
  blocks = [],
  bills = [],
  garbageBills = [],
  payments = [],
  initialMonth = new Date().toLocaleString("default", { month: "long" }),
  initialYear = new Date().getFullYear(),
  settings = {},
}) {
  const [targetMonth, setTargetMonth] = useState(initialMonth);
  const [targetYear, setTargetYear] = useState(initialYear);
  const [selectedBlock, setSelectedBlock] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Reconcile and synchronize bills block-wise
  const syncedData = useMemo(() => {
    return syncBlockWiseMonthlyBills({
      residents,
      blocks,
      bills,
      garbageBills,
      payments,
      month: targetMonth,
      year: targetYear,
    });
  }, [residents, blocks, bills, garbageBills, payments, targetMonth, targetYear]);

  // Extract unique block names
  const availableBlocks = useMemo(() => {
    return syncedData.blocks.map((b) => b.blockName);
  }, [syncedData]);

  // Filtered view for preview
  const previewBlocks = useMemo(() => {
    let result = syncedData.blocks;
    if (selectedBlock !== "all") {
      result = result.filter(
        (b) => b.blockName.toLowerCase() === selectedBlock.toLowerCase()
      );
    }
    return result
      .map((b) => {
        const filteredBills = b.bills.filter((bill) => {
          if (selectedStatus === "paid" && !bill.isPaid) return false;
          if (selectedStatus === "pending" && bill.isPaid) return false;
          if (selectedStatus === "overdue" && bill.status !== "Overdue") return false;
          return true;
        });

        const totalBilled = filteredBills.reduce((s, bill) => s + bill.billAmount, 0);
        const totalCollected = filteredBills
          .filter((bill) => bill.isPaid)
          .reduce((s, bill) => s + bill.paidAmount, 0);
        const totalPending = filteredBills
          .filter((bill) => !bill.isPaid)
          .reduce((s, bill) => s + bill.pendingAmount, 0);
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
          collectionRate:
            totalBilled > 0
              ? Math.round((totalCollected / totalBilled) * 100)
              : (paidBillsCount > 0 ? 100 : 0),
        };
      })
      .filter((b) => b.bills.length > 0);
  }, [syncedData, selectedBlock, selectedStatus]);

  // Preview Grand Totals
  const previewGrandTotals = useMemo(() => {
    const acc = previewBlocks.reduce(
      (a, b) => {
        a.totalBlocks += 1;
        a.totalBills += b.totalBills;
        a.paidBillsCount += b.paidBillsCount;
        a.pendingBillsCount += b.pendingBillsCount;
        a.totalBilledAmount += b.totalBilledAmount;
        a.totalCollectedAmount += b.totalCollectedAmount;
        a.totalPendingAmount += b.totalPendingAmount;
        return a;
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
    acc.collectionRate =
      acc.totalBilledAmount > 0
        ? Math.round((acc.totalCollectedAmount / acc.totalBilledAmount) * 100)
        : (acc.paidBillsCount > 0 ? 100 : 0);
    return acc;
  }, [previewBlocks]);

  function handleTriggerPrint() {
    printBlockWiseMonthlyBillsRegister({
      syncedData,
      settings,
      month: targetMonth,
      year: targetYear,
      filterBlock: selectedBlock,
      filterStatus: selectedStatus,
    });
  }

  function handleDownloadPdf() {
    generateBlockWiseMonthlyBillsPDF({
      syncedData,
      settings,
      month: targetMonth,
      year: targetYear,
      filterBlock: selectedBlock,
      filterStatus: selectedStatus,
    });
  }

  if (!open) return null;

  const currentYearNum = new Date().getFullYear();
  const yearOptions = [currentYearNum - 2, currentYearNum - 1, currentYearNum, currentYearNum + 1, currentYearNum + 2];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl shadow-xs border border-emerald-100">
              <FaMoneyBillWave />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-800">
                  Monthly Bills Register (Block-Wise)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Synchronized
                </span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                Complete billing ledger grouped block by block with amounts, paid receipts, payment modes & collectors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-red-600/20 transition"
              title="Download Crystal-Clear PDF Register"
            >
              <FaFilePdf className="text-sm" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition"
              title="Print Register / Save via Print Dialog"
            >
              <FaPrint />
              <span>Print Register</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Billing Period (Month & Year) */}
            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Billing Month
              </label>
              <div className="relative">
                <FaCalendarAlt className="absolute left-3.5 top-3.5 text-slate-400 text-xs" />
                <select
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Billing Year
              </label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Block Scope */}
            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Block Scope
              </label>
              <div className="relative">
                <FaBuilding className="absolute left-3.5 top-3.5 text-slate-400 text-xs" />
                <select
                  value={selectedBlock}
                  onChange={(e) => setSelectedBlock(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Blocks (Block-Wise)</option>
                  {availableBlocks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Payment Status */}
            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Payment Status
              </label>
              <div className="relative">
                <FaFilter className="absolute left-3.5 top-3.5 text-slate-400 text-xs" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Bills (Paid & Pending)</option>
                  <option value="paid">Paid Only</option>
                  <option value="pending">Pending & Overdue Only</option>
                  <option value="overdue">Overdue Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-4 pt-3 border-t border-slate-200">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Blocks</p>
              <p className="text-sm font-black text-slate-800 mt-0.5">{previewGrandTotals.totalBlocks}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Total Bills</p>
              <p className="text-sm font-black text-slate-800 mt-0.5">{previewGrandTotals.totalBills}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Total Billed</p>
              <p className="text-sm font-black text-indigo-600 mt-0.5">₹{previewGrandTotals.totalBilledAmount.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-center">
              <p className="text-[10px] font-bold uppercase text-emerald-700">Collected</p>
              <p className="text-sm font-black text-emerald-700 mt-0.5">
                ₹{previewGrandTotals.totalCollectedAmount.toLocaleString()} ({previewGrandTotals.paidBillsCount})
              </p>
            </div>
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center">
              <p className="text-[10px] font-bold uppercase text-amber-800">Pending</p>
              <p className="text-sm font-black text-amber-800 mt-0.5">
                ₹{previewGrandTotals.totalPendingAmount.toLocaleString()} ({previewGrandTotals.pendingBillsCount})
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Rate</p>
              <p className="text-sm font-black text-slate-800 mt-0.5">{previewGrandTotals.collectionRate}%</p>
            </div>
          </div>
        </div>

        {/* Live Preview Document Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-100/60 space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-900 flex items-center gap-2">
            <FaInfoCircle className="text-emerald-600 shrink-0" />
            <span>
              <strong>Synchronized Statement:</strong> Showing bills and payments for <strong>{targetMonth} {targetYear}</strong>. Click <strong>Print Monthly Register</strong> to print in landscape orientation with full payment metadata, receipts, and audit blocks.
            </span>
          </div>

          {previewBlocks.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <p className="text-slate-400 text-sm">No bills found matching the selected month/block/status filters.</p>
            </div>
          ) : (
            previewBlocks.map((b) => (
              <div key={b.blockName} className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                {/* Block Header */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-xs">
                      {b.blockName.replace("Block ", "").charAt(0) || "B"}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{b.blockName}</h3>
                      <p className="text-[11px] text-slate-500">
                        {b.totalBills} Bills • {b.paidBillsCount} Paid • {b.pendingBillsCount} Pending
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500">
                      Billed: <strong className="text-slate-800">₹{b.totalBilledAmount.toLocaleString()}</strong>
                    </span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      Collected: ₹{b.totalCollectedAmount.toLocaleString()}
                    </span>
                    {b.totalPendingAmount > 0 && (
                      <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        Pending: ₹{b.totalPendingAmount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                        <th className="py-2.5 px-4 w-12 text-center">#</th>
                        <th className="py-2.5 px-3">Flat</th>
                        <th className="py-2.5 px-3">Resident</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Bill ID</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Paid Date</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3">Receipt No</th>
                        <th className="py-2.5 px-3">Collector</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {b.bills.map((bill, idx) => (
                        <tr key={bill.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-black text-emerald-800">
                            {bill.flat}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {bill.residentName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            {bill.mobile}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                            {bill.billNumber}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-800">
                            ₹{bill.billAmount}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                bill.isPaid
                                  ? "bg-emerald-100 text-emerald-800"
                                  : bill.status === "Overdue"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {bill.isPaid ? "Paid" : bill.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {bill.paymentDate}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {bill.paymentMethod}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600">
                            {bill.receiptNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {bill.collector}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Society: <strong>{settings.societyName || "RWA Society"}</strong> • Billing Cycle: <strong>{targetMonth} {targetYear}</strong>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-red-600/20 transition"
              title="Download Crystal-Clear PDF Register"
            >
              <FaFilePdf className="text-sm" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
            >
              <FaPrint />
              <span>Print Monthly Register</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

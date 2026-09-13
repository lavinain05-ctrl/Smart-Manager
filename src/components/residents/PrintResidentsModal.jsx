import { useState, useMemo } from "react";
import {
  FaPrint,
  FaTimes,
  FaBuilding,
  FaUsers,
  FaFilter,
  FaInfoCircle,
  FaFilePdf,
} from "react-icons/fa";
import { syncBlockWiseResidents } from "../../utils/reportSyncService";
import {
  printBlockWiseResidentsRegister,
  generateBlockWiseResidentsPDF,
} from "../../utils/printReportHelper";

export default function PrintResidentsModal({
  open,
  onClose,
  residents = [],
  blocks = [],
  bills = [],
  garbageBills = [],
  payments = [],
  month = new Date().toLocaleString("default", { month: "long" }),
  year = new Date().getFullYear(),
  settings = {},
}) {
  const [selectedBlock, setSelectedBlock] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedGc, setSelectedGc] = useState("all");

  // Synchronize the complete dataset block by block
  const syncedData = useMemo(() => {
    return syncBlockWiseResidents({
      residents,
      blocks,
      bills,
      garbageBills,
      payments,
      month,
      year,
    });
  }, [residents, blocks, bills, garbageBills, payments, month, year]);

  // Extract unique block names
  const availableBlocks = useMemo(() => {
    return syncedData.blocks.map((b) => b.blockName);
  }, [syncedData]);

  // Filtered view for on-screen preview
  const previewBlocks = useMemo(() => {
    let result = syncedData.blocks;
    if (selectedBlock !== "all") {
      result = result.filter(
        (b) => b.blockName.toLowerCase() === selectedBlock.toLowerCase()
      );
    }
    return result
      .map((b) => {
        const filteredResidents = b.residents.filter((r) => {
          if (selectedStatus === "active" && r.status !== "Active") return false;
          if (selectedStatus === "inactive" && r.status === "Active") return false;
          if (selectedGc === "enrolled" && !r.isEnrolled) return false;
          if (selectedGc === "opted_out" && r.isEnrolled) return false;
          return true;
        });

        const totalExpected = filteredResidents.reduce(
          (s, r) => s + (r.isEnrolled ? r.monthlyCharge : 0),
          0
        );
        const totalCollected = filteredResidents
          .filter((r) => r.isPaid)
          .reduce((s, r) => s + r.paidAmount, 0);
        const totalPending = filteredResidents
          .filter((r) => !r.isPaid)
          .reduce((s, r) => s + (r.isEnrolled ? r.monthlyCharge : 0), 0);
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
          collectionRate:
            totalExpected > 0
              ? Math.round((totalCollected / totalExpected) * 100)
              : (paidCount > 0 ? 100 : 0),
        };
      })
      .filter((b) => b.residents.length > 0);
  }, [syncedData, selectedBlock, selectedStatus, selectedGc]);

  // Preview Grand Totals
  const previewGrandTotals = useMemo(() => {
    const acc = previewBlocks.reduce(
      (a, b) => {
        a.totalBlocks += 1;
        a.totalFlats += b.totalFlats;
        a.activeCount += b.activeCount;
        a.gcEnrolledCount += b.gcEnrolledCount;
        a.paidCount += b.paidCount;
        a.pendingCount += b.pendingCount;
        a.expectedAmount += b.expectedAmount;
        a.collectedAmount += b.collectedAmount;
        a.pendingAmount += b.pendingAmount;
        return a;
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
    acc.collectionRate =
      acc.expectedAmount > 0
        ? Math.round((acc.collectedAmount / acc.expectedAmount) * 100)
        : (acc.paidCount > 0 ? 100 : 0);
    return acc;
  }, [previewBlocks]);

  function handleTriggerPrint() {
    printBlockWiseResidentsRegister({
      syncedData,
      settings,
      filterBlock: selectedBlock,
      filterStatus: selectedStatus,
      filterGc: selectedGc,
    });
  }

  function handleDownloadPdf() {
    generateBlockWiseResidentsPDF({
      syncedData,
      settings,
      filterBlock: selectedBlock,
      filterStatus: selectedStatus,
      filterGc: selectedGc,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-lg shadow-emerald-600/20">
              <FaPrint />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800">
                  Print Resident Register (Block-Wise)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Synchronized
                </span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                Official RWA flat directory organized block by block with doorstep collection status & payment details.
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Block Filter */}
            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Select Block Scope
              </label>
              <div className="relative">
                <FaBuilding className="absolute left-3.5 top-3.5 text-slate-400 text-xs" />
                <select
                  value={selectedBlock}
                  onChange={(e) => setSelectedBlock(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Blocks (Block-Wise Breakdown)</option>
                  {availableBlocks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Resident Status Filter */}
            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Resident Status
              </label>
              <div className="relative">
                <FaUsers className="absolute left-3.5 top-3.5 text-slate-400 text-xs" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Status (Active & Inactive)</option>
                  <option value="active">Active Residents Only</option>
                  <option value="inactive">Inactive Residents Only</option>
                </select>
              </div>
            </div>

            {/* Garbage Collection Filter */}
            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Doorstep Garbage Service
              </label>
              <div className="relative">
                <FaFilter className="absolute left-3.5 top-3.5 text-slate-400 text-xs" />
                <select
                  value={selectedGc}
                  onChange={(e) => setSelectedGc(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Flats (Enrolled & Opted Out)</option>
                  <option value="enrolled">Doorstep Service Enrolled Only</option>
                  <option value="opted_out">Opted Out Flats Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-4 pt-3 border-t border-slate-200">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Blocks</p>
              <p className="text-sm font-black text-slate-800 mt-0.5">{previewGrandTotals.totalBlocks}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Total Flats</p>
              <p className="text-sm font-black text-slate-800 mt-0.5">{previewGrandTotals.totalFlats}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">GC Enrolled</p>
              <p className="text-sm font-black text-emerald-600 mt-0.5">{previewGrandTotals.gcEnrolledCount}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Expected Billed</p>
              <p className="text-sm font-black text-indigo-600 mt-0.5">₹{previewGrandTotals.expectedAmount.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-center">
              <p className="text-[10px] font-bold uppercase text-emerald-700">Collected</p>
              <p className="text-sm font-black text-emerald-700 mt-0.5">₹{previewGrandTotals.collectedAmount.toLocaleString()}</p>
            </div>
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center">
              <p className="text-[10px] font-bold uppercase text-amber-800">Pending</p>
              <p className="text-sm font-black text-amber-800 mt-0.5">₹{previewGrandTotals.pendingAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Live Preview Document Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-100/60 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-800 flex items-center gap-2">
            <FaInfoCircle className="text-blue-600 shrink-0" />
            <span>
              <strong>Print Preview:</strong> Showing synchronized data for <strong>{month} {year}</strong>. Click <strong>Print Official Register</strong> above to open the clean print dialog with official society letterhead and signature blocks.
            </span>
          </div>

          {previewBlocks.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <p className="text-slate-400 text-sm">No residents found matching the selected block/status filters.</p>
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
                        {b.totalFlats} Flats • {b.activeCount} Active • {b.gcEnrolledCount} GC Enrolled
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500">
                      Billed: <strong className="text-slate-800">₹{b.expectedAmount.toLocaleString()}</strong>
                    </span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      Collected: ₹{b.collectedAmount.toLocaleString()}
                    </span>
                    {b.pendingAmount > 0 && (
                      <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                        Pending: ₹{b.pendingAmount.toLocaleString()}
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
                        <th className="py-2.5 px-3">Resident / Owner</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3 text-center">Garbage</th>
                        <th className="py-2.5 px-3 text-right">Fee (₹)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Receipt No</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {b.residents.map((r, idx) => (
                        <tr key={r.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-black text-emerald-800">
                            {r.flat}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {r.owner}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            {r.mobile}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                r.isEnrolled
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {r.isEnrolled ? "Enrolled" : "Opted Out"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                            ₹{r.monthlyCharge}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                r.isPaid
                                  ? "bg-emerald-100 text-emerald-800"
                                  : r.currentMonthStatus === "Overdue"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {r.isPaid ? "Paid" : r.currentMonthStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600">
                            {r.receiptNo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {r.paymentDate}
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
            Society: <strong>{settings.societyName || "RWA Society"}</strong> • Period: <strong>{month} {year}</strong>
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
              <span>Print Official Register</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

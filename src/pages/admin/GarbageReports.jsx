import { useMemo, useState } from "react";
import {
  FaChartBar,
  FaFileExcel,
  FaFilePdf,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";

import { useGarbage } from "../../context/GarbageContext";
import { usePayments } from "../../context/PaymentContext";
import { isGcParticipating } from "../../services/statisticsService";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const REPORT_TYPES = [
  { key: "monthly", label: "Monthly Report" },
  { key: "collector", label: "Collector Report" },
  { key: "block", label: "Block Report" },
  { key: "outstanding", label: "Outstanding Report" },
  { key: "yearly", label: "Yearly Summary" },
];

export default function GarbageReports() {
  const {
    garbageAccounts,
    garbageBills,
    garbageCollectors,
    residents = [],
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
  } = useGarbage();

  const { payments = [] } = usePayments();

  const [reportType, setReportType] = useState("monthly");

  // Synchronized monthly bills: merge garbageBills with any participating residents who don't have a bill doc yet
  const monthlyBills = useMemo(() => {
    const billMap = new Map();

    // 1. Existing bills from garbageBills
    garbageBills
      .filter((b) => b.month === selectedMonth && Number(b.year) === Number(selectedYear))
      .forEach((b) => {
        billMap.set(b.residentId, { ...b });
      });

    // 2. Active participating residents
    const activeParticipants = (residents || []).filter(
      (r) => isGcParticipating(r) && r.status !== "Inactive" && r.status !== "inactive"
    );

    activeParticipants.forEach((r) => {
      const paymentMatch = (payments || []).find(
        (p) =>
          (p.residentId === r.id || p.residentId === r.uid || (r.mobile && p.mobile && p.mobile.includes(r.mobile.slice(-10)))) &&
          p.month === selectedMonth &&
          Number(p.year) === Number(selectedYear)
      );

      const isPaid = Boolean(paymentMatch);
      const charge = Number(Number(r.charge) > 0 ? r.charge : 80);

      if (billMap.has(r.id)) {
        const b = billMap.get(r.id);
        if (isPaid && b.status !== "Paid" && b.status !== "Exempted") {
          billMap.set(r.id, {
            ...b,
            status: "Paid",
            paidAmount: Number(paymentMatch.amount || b.amount || charge),
            paymentDate: paymentMatch.paymentDate || b.paymentDate || "",
            paymentMethod: paymentMatch.paymentMethod || b.paymentMethod || "Cash",
            collectedBy: paymentMatch.collector || b.collectedBy || "Collector",
          });
        }
      } else {
        billMap.set(r.id, {
          id: `auto-${r.id}`,
          residentId: r.id,
          residentName: r.owner || r.name || "Resident",
          flat: r.flat || "—",
          block: r.block || "General",
          amount: charge,
          status: isPaid ? "Paid" : "Pending",
          paidAmount: isPaid ? Number(paymentMatch.amount || charge) : 0,
          paymentDate: paymentMatch?.paymentDate || "—",
          paymentMethod: paymentMatch?.paymentMethod || "—",
          collectedBy: paymentMatch?.collector || "—",
        });
      }
    });

    return Array.from(billMap.values());
  }, [garbageBills, residents, payments, selectedMonth, selectedYear]);

  // ========================
  // Report Data
  // ========================

  const monthlyReport = useMemo(() => {
    const total = monthlyBills.reduce((s, b) => s + Number(b.amount || 0), 0);
    const collected = monthlyBills.filter((b) => b.status === "Paid").reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
    const pending = total - collected;
    const paidCount = monthlyBills.filter((b) => b.status === "Paid").length;
    const pendingCount = monthlyBills.filter((b) => b.status === "Pending").length;
    return { total, collected, pending, paidCount, pendingCount, bills: monthlyBills };
  }, [monthlyBills]);

  const collectorReport = useMemo(() => {
    const map = {};
    monthlyBills.forEach((b) => {
      if (b.status === "Paid" && b.collectedById) {
        if (!map[b.collectedById]) {
          map[b.collectedById] = { name: b.collectedBy || "Collector", count: 0, amount: 0 };
        }
        map[b.collectedById].count += 1;
        map[b.collectedById].amount += Number(b.paidAmount || b.amount || 0);
      }
    });
    return Object.entries(map).map(([id, data]) => ({ id, ...data }));
  }, [monthlyBills]);

  const blockReport = useMemo(() => {
    const map = {};
    monthlyBills.forEach((b) => {
      const block = b.block || "General";
      if (!map[block]) {
        map[block] = { block, total: 0, collected: 0, pending: 0, count: 0, paidCount: 0 };
      }
      map[block].count += 1;
      map[block].total += Number(b.amount || 0);
      if (b.status === "Paid") {
        map[block].collected += Number(b.paidAmount || b.amount || 0);
        map[block].paidCount += 1;
      } else {
        map[block].pending += Number(b.amount || 0);
      }
    });
    return Object.values(map).sort((a, b) => a.block.localeCompare(b.block));
  }, [monthlyBills]);

  const outstandingReport = useMemo(() => {
    return garbageBills
      .filter((b) => b.status === "Pending")
      .sort((a, b) => {
        const ya = Number(a.year), yb = Number(b.year);
        if (ya !== yb) return ya - yb;
        return MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month);
      });
  }, [garbageBills]);

  const yearlyReport = useMemo(() => {
    return MONTHS.map((month) => {
      const bills = garbageBills.filter((b) => b.month === month && Number(b.year) === Number(selectedYear));
      const total = bills.reduce((s, b) => s + Number(b.amount || 0), 0);
      const collected = bills.filter((b) => b.status === "Paid").reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
      return { month, total, collected, pending: total - collected, count: bills.length };
    });
  }, [garbageBills, selectedYear]);

  // ========================
  // Export
  // ========================

  function exportExcel() {
    let data;
    let sheetName;

    if (reportType === "monthly") {
      sheetName = "Monthly";
      data = monthlyReport.bills.map((b) => ({
        Resident: b.residentName, Flat: b.flat, Block: b.block,
        Amount: b.amount, Status: b.status, Paid: b.paidAmount || 0,
        Method: b.paymentMethod || "", "Collected By": b.collectedBy || "",
      }));
    } else if (reportType === "collector") {
      sheetName = "Collector";
      data = collectorReport.map((c) => ({
        Collector: c.name, "Bills Collected": c.count, "Amount Collected": c.amount,
      }));
    } else if (reportType === "block") {
      sheetName = "Block";
      data = blockReport.map((b) => ({
        Block: b.block, Bills: b.count, Total: b.total, Collected: b.collected, Pending: b.pending,
      }));
    } else if (reportType === "outstanding") {
      sheetName = "Outstanding";
      data = outstandingReport.map((b) => ({
        Resident: b.residentName, Flat: b.flat, Block: b.block,
        Month: b.month, Year: b.year, Amount: b.amount,
      }));
    } else {
      sheetName = "Yearly";
      data = yearlyReport.map((r) => ({
        Month: r.month, Bills: r.count, Total: r.total, Collected: r.collected, Pending: r.pending,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), `Garbage_${sheetName}_${selectedMonth}_${selectedYear}.xlsx`);
  }

  function exportPdf() {
    const pdf = new jsPDF();
    const type = REPORT_TYPES.find((r) => r.key === reportType)?.label || "Report";
    pdf.setFontSize(16);
    pdf.text(`Garbage ${type}`, 14, 20);
    pdf.setFontSize(10);
    pdf.text(`${selectedMonth} ${selectedYear}`, 14, 28);

    let head;
    let body;

    if (reportType === "monthly") {
      head = [["Resident", "Flat", "Block", "Amount", "Status", "Paid", "Method"]];
      body = monthlyReport.bills.map((b) => [b.residentName, b.flat, b.block, `₹${b.amount}`, b.status, b.paidAmount ? `₹${b.paidAmount}` : "", b.paymentMethod || ""]);
    } else if (reportType === "collector") {
      head = [["Collector", "Bills Collected", "Amount"]];
      body = collectorReport.map((c) => [c.name, c.count, `₹${c.amount}`]);
    } else if (reportType === "block") {
      head = [["Block", "Bills", "Total", "Collected", "Pending"]];
      body = blockReport.map((b) => [b.block, b.count, `₹${b.total}`, `₹${b.collected}`, `₹${b.pending}`]);
    } else if (reportType === "outstanding") {
      head = [["Resident", "Flat", "Block", "Month", "Year", "Amount"]];
      body = outstandingReport.map((b) => [b.residentName, b.flat, b.block, b.month, b.year, `₹${b.amount}`]);
    } else {
      head = [["Month", "Bills", "Total", "Collected", "Pending"]];
      body = yearlyReport.map((r) => [r.month, r.count, `₹${r.total}`, `₹${r.collected}`, `₹${r.pending}`]);
    }

    pdf.autoTable({ startY: 35, head, body, styles: { fontSize: 8 }, headStyles: { fillColor: [16, 185, 129] } });
    pdf.save(`Garbage_${type}_${selectedMonth}_${selectedYear}.pdf`);
  }

  // ========================
  // Render current report
  // ========================

  function renderReport() {
    if (reportType === "monthly") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Bills" value={monthlyReport.bills.length} />
            <StatCard label="Total Amount" value={`₹${monthlyReport.total.toLocaleString()}`} />
            <StatCard label="Collected" value={`₹${monthlyReport.collected.toLocaleString()}`} color="text-emerald-700" />
            <StatCard label="Pending" value={`₹${monthlyReport.pending.toLocaleString()}`} color="text-red-700" />
            <StatCard label="Paid / Pending" value={`${monthlyReport.paidCount} / ${monthlyReport.pendingCount}`} />
          </div>
          <ReportTable
            headers={["Resident", "Flat", "Block", "Amount", "Status", "Paid", "Method"]}
            rows={monthlyReport.bills.map((b) => [b.residentName, b.flat, b.block, `₹${b.amount}`, b.status, b.paidAmount ? `₹${b.paidAmount}` : "—", b.paymentMethod || "—"])}
          />
        </div>
      );
    }

    if (reportType === "collector") {
      return (
        <ReportTable
          headers={["Collector", "Bills Collected", "Amount Collected"]}
          rows={collectorReport.map((c) => [c.name, c.count, `₹${c.amount.toLocaleString()}`])}
          emptyText="No collections recorded for this period"
        />
      );
    }

    if (reportType === "block") {
      return (
        <ReportTable
          headers={["Block", "Bills", "Total", "Collected", "Pending"]}
          rows={blockReport.map((b) => [b.block, b.count, `₹${b.total.toLocaleString()}`, `₹${b.collected.toLocaleString()}`, `₹${b.pending.toLocaleString()}`])}
          emptyText="No data for this period"
        />
      );
    }

    if (reportType === "outstanding") {
      return (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 font-medium">
              {outstandingReport.length} outstanding bills totaling ₹{outstandingReport.reduce((s, b) => s + Number(b.amount || 0), 0).toLocaleString()}
            </p>
          </div>
          <ReportTable
            headers={["Resident", "Flat", "Block", "Month", "Year", "Amount"]}
            rows={outstandingReport.map((b) => [b.residentName, b.flat, b.block, b.month, b.year, `₹${b.amount}`])}
            emptyText="No outstanding bills!"
          />
        </div>
      );
    }

    if (reportType === "yearly") {
      const totalYear = yearlyReport.reduce((s, r) => s + r.total, 0);
      const collectedYear = yearlyReport.reduce((s, r) => s + r.collected, 0);

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Yearly Total" value={`₹${totalYear.toLocaleString()}`} />
            <StatCard label="Yearly Collected" value={`₹${collectedYear.toLocaleString()}`} color="text-emerald-700" />
            <StatCard label="Yearly Pending" value={`₹${(totalYear - collectedYear).toLocaleString()}`} color="text-red-700" />
          </div>
          <ReportTable
            headers={["Month", "Bills", "Total", "Collected", "Pending"]}
            rows={yearlyReport.map((r) => [r.month, r.count, `₹${r.total.toLocaleString()}`, `₹${r.collected.toLocaleString()}`, `₹${r.pending.toLocaleString()}`])}
          />
        </div>
      );
    }

    return null;
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FaChartBar className="text-emerald-600" />
            Garbage Reports
          </h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded-xl px-4 py-2.5 bg-white shadow-sm text-sm outline-none"
          >
            {MONTHS.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border rounded-xl px-4 py-2.5 bg-white shadow-sm text-sm outline-none"
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>

          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border hover:bg-green-50 text-green-700 transition">
            <FaFileExcel /> Excel
          </button>

          <button onClick={exportPdf} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border hover:bg-red-50 text-red-700 transition">
            <FaFilePdf /> PDF
          </button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="bg-white rounded-2xl shadow-sm p-2 flex flex-wrap gap-2">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.key}
            onClick={() => setReportType(rt.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition ${
              reportType === rt.key
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            {rt.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      {renderReport()}
    </div>
  );
}

// ========================
// Sub-components
// ========================

function StatCard({ label, value, color = "text-gray-900" }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-gray-500 text-sm">{label}</p>
      <h3 className={`text-xl font-bold mt-1 ${color}`}>{value}</h3>
    </div>
  );
}

function ReportTable({ headers, rows, emptyText = "No data" }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              {headers.map((h) => (
                <th key={h} className="text-left px-6 py-4 font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b hover:bg-gray-50 transition">
                {row.map((cell, j) => (
                  <td key={j} className="px-6 py-4">{cell}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="text-center py-10 text-gray-400">{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { FaFilePdf, FaFileExcel, FaFileCsv } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function DailyReportExport({ payments, collectors, label }) {
  function buildRows() {
    const map = {};
    payments.forEach((p) => {
      const key = p.collector || "General / Admin";
      if (!map[key]) map[key] = { name: key, total: 0, cash: 0, upi: 0, bank: 0, count: 0 };
      map[key].total += Number(p.amount || 0);
      map[key].count++;
      if (p.paymentMethod === "Cash") map[key].cash += Number(p.amount || 0);
      if (p.paymentMethod === "UPI") map[key].upi += Number(p.amount || 0);
      if (p.paymentMethod === "Bank Transfer") map[key].bank += Number(p.amount || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }

  function exportPDF() {
    const doc = new jsPDF();
    const rows = buildRows();

    doc.setFontSize(18);
    doc.text("Collector Daily Report", 105, 15, { align: "center" });
    doc.setFontSize(11);
    doc.text(label, 105, 23, { align: "center" });

    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    doc.text(`Total Collection: ₹${grandTotal.toLocaleString()} | Payments: ${payments.length}`, 105, 31, { align: "center" });

    autoTable(doc, {
      startY: 40,
      head: [["#", "Collector", "Payments", "Cash", "UPI", "Bank", "Total"]],
      body: rows.map((r, i) => [
        i + 1, r.name, r.count,
        `₹${r.cash.toLocaleString()}`, `₹${r.upi.toLocaleString()}`,
        `₹${r.bank.toLocaleString()}`, `₹${r.total.toLocaleString()}`,
      ]),
      foot: [["", "TOTAL", payments.length,
        `₹${rows.reduce((s, r) => s + r.cash, 0).toLocaleString()}`,
        `₹${rows.reduce((s, r) => s + r.upi, 0).toLocaleString()}`,
        `₹${rows.reduce((s, r) => s + r.bank, 0).toLocaleString()}`,
        `₹${grandTotal.toLocaleString()}`,
      ]],
      styles: { fontSize: 9 },
    });

    // Individual payments table
    const finalY = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(14);
    doc.text("Payment Details", 14, finalY);

    autoTable(doc, {
      startY: finalY + 6,
      head: [["#", "Collector", "Resident", "Flat", "Amount", "Mode", "Date", "Time", "Receipt"]],
      body: payments.map((p, i) => [
        i + 1, p.collector, p.residentName, p.flat,
        `₹${p.amount}`, p.paymentMethod, p.paymentDate, p.paymentTime || "-", p.receiptNumber,
      ]),
      styles: { fontSize: 7 },
    });

    doc.save(`Collector-Daily-Report-${label.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
  }

  function exportExcel() {
    const rows = buildRows();
    const summaryData = rows.map((r, i) => ({
      "#": i + 1, Collector: r.name, Payments: r.count,
      Cash: r.cash, UPI: r.upi, Bank: r.bank, Total: r.total,
    }));
    const detailData = payments.map((p, i) => ({
      "#": i + 1, Collector: p.collector, Resident: p.residentName,
      Flat: p.flat, Block: p.block || "-", Amount: p.amount,
      Mode: p.paymentMethod, Date: p.paymentDate, Time: p.paymentTime || "-",
      Receipt: p.receiptNumber, Month: p.month, Year: p.year,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailData), "Details");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), `Collector-Daily-Report.xlsx`);
  }

  function exportCSV() {
    const headers = ["Collector", "Resident", "Flat", "Block", "Amount", "Mode", "Date", "Time", "Receipt", "Month", "Year"];
    const csvRows = [headers.join(",")];
    payments.forEach((p) => {
      csvRows.push([
        `"${p.collector}"`, `"${p.residentName}"`, `"${p.flat}"`, `"${p.block || "-"}"`,
        p.amount, `"${p.paymentMethod}"`, `"${p.paymentDate}"`, `"${p.paymentTime || "-"}"`,
        `"${p.receiptNumber}"`, `"${p.month}"`, p.year,
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    saveAs(blob, "Collector-Daily-Report.csv");
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button onClick={exportPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-medium transition shadow-lg shadow-red-500/20">
        <FaFilePdf /> PDF
      </button>
      <button onClick={exportExcel} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-medium transition shadow-lg shadow-green-500/20">
        <FaFileExcel /> Excel
      </button>
      <button onClick={exportCSV} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-medium transition shadow-lg shadow-blue-500/20">
        <FaFileCsv /> CSV
      </button>
    </div>
  );
}

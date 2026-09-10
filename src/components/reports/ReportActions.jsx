import {
  FaFileExcel,
  FaFilePdf,
  FaPrint,
} from "react-icons/fa";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ReportActions({
  residents,
  payments,
  month,
  year,
}) {
  function exportExcel() {
    const data = payments.map((payment) => ({
      Receipt: payment.receiptNumber,
      Flat: payment.flat,
      Resident: payment.residentName,
      Amount: payment.amount,
      Method: payment.paymentMethod,
      Date: payment.paymentDate,
      Month: payment.month,
      Year: payment.year,
      Collector: payment.collector,
      Remarks: payment.remarks || "",
    }));

    const worksheet =
      XLSX.utils.json_to_sheet(data);

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Collection Report"
    );

    const excelBuffer =
      XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

    const file = new Blob(
      [excelBuffer],
      {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    );

    saveAs(
      file,
      `Collection-Report-${month}-${year}.xlsx`
    );
  }

  function exportPDF() {
    const doc = new jsPDF();

    doc.setFontSize(20);

    doc.text(
      "Smart Manager",
      105,
      18,
      {
        align: "center",
      }
    );

    doc.setFontSize(12);

    doc.text(
      `${month} ${year} Collection Report`,
      105,
      28,
      {
        align: "center",
      }
    );

    autoTable(doc, {
      startY: 40,

      head: [[
        "Flat",
        "Resident",
        "Amount",
        "Method",
        "Date",
      ]],

      body: payments.map((payment) => [
        payment.flat,
        payment.residentName,
        `₹${payment.amount}`,
        payment.paymentMethod,
        payment.paymentDate,
      ]),
    });

    doc.save(
      `Collection-Report-${month}-${year}.pdf`
    );
  }

  return (
    <div className="flex flex-wrap gap-4">

      <button
        onClick={exportExcel}
        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl transition"
      >
        <FaFileExcel />
        Export Excel
      </button>

      <button
        onClick={exportPDF}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl transition"
      >
        <FaFilePdf />
        Export PDF
      </button>

      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl transition"
      >
        <FaPrint />
        Print Report
      </button>

    </div>
  );
}
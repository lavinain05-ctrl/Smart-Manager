import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { query, where, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

import { useBills } from "../../context/BillContext";
import { useBilling } from "../../context/BillingContext";
import { usePayments } from "../../context/PaymentContext";
import { useAuth } from "../../context/AuthContext";
import { collectResidentPayment } from "../../utils/collectPayment";
import { updateBill, deleteBill } from "../../services/billService";
import { getDisplayStatus } from "../../utils/billStatus";

import MonthSelector from "../../components/common/MonthSelector";
import BillSummaryCards from "../../components/bills/BillSummaryCards";
import BillFilters from "../../components/bills/BillFilters";
import BillTable from "../../components/bills/BillTable";
import PaymentModal from "../../components/payments/PaymentModal";
import PaymentReceiptSuccessModal from "../../components/collections/PaymentReceiptSuccessModal";
import ViewBillModal from "../../components/bills/ViewBillModal";
import ConfirmDialog from "../../components/common/ConfirmDialog";

export default function Bills() {
  const { bills, loading, generateBills } = useBills();
  const { selectedMonth, selectedYear } = useBilling();
  const { addPayment } = usePayments();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [blockFilter, setBlockFilter] = useState("All");
  const [selectedPayBill, setSelectedPayBill] = useState(null);
  const [selectedViewBill, setSelectedViewBill] = useState(null);
  const [billToDelete, setBillToDelete] = useState(null);
  const [successReceipt, setSuccessReceipt] = useState(null);

  // Derive unique blocks from bills
  const blocks = useMemo(() => {
    const set = new Set(bills.map((b) => b.block).filter(Boolean));
    return [...set].sort();
  }, [bills]);

  const monthlyBills = useMemo(() => {
    return bills
      .filter((bill) => {
        return (
          bill.month === selectedMonth &&
          Number(bill.year) === Number(selectedYear)
        );
      })
      .map((bill) => ({
        ...bill,
        displayStatus: getDisplayStatus(bill),
      }));
  }, [bills, selectedMonth, selectedYear]);

  const filteredBills = useMemo(() => {
    return monthlyBills.filter((bill) => {
      const searchMatch = `${bill.flat || ""} ${bill.residentName || ""} ${bill.block || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const statusMatch =
        statusFilter === "All" ? true : bill.displayStatus === statusFilter;
      const blockMatch =
        blockFilter === "All" ? true : bill.block === blockFilter;
      return searchMatch && statusMatch && blockMatch;
    });
  }, [monthlyBills, search, statusFilter, blockFilter]);

  async function handleCollectPayment(paymentData) {
    if (!selectedPayBill) return;

    try {
      const success = await collectResidentPayment({
        resident: {
          id: selectedPayBill.residentId,
          owner: selectedPayBill.residentName,
          name: selectedPayBill.residentName,
          flat: selectedPayBill.flat,
          block: selectedPayBill.block,
          charge: selectedPayBill.amount,
        },
        month: selectedPayBill.month,
        year: selectedPayBill.year,
        paymentData,
        bills,
        addPayment,
        collector: user?.name || "Admin",
        collectorId: user?.uid || null,
      });

      if (success) {
        setSelectedPayBill(null);
        setSuccessReceipt(success);
      }
    } catch (error) {
      console.error(error);
      toast.error("Transaction failed");
    }
  }

  function handleDeleteBill(bill) {
    setBillToDelete(bill);
  }

  async function confirmDeleteBill() {
    if (!billToDelete) return;
    try {
      // 1. Delete from bills collection
      await deleteBill(billToDelete.id);

      // 2. Also delete matching garbageBills doc if exists to maintain complete sync
      try {
        const gQ = query(
          collection(db, "garbageBills"),
          where("residentId", "==", billToDelete.residentId),
          where("month", "==", billToDelete.month),
          where("year", "==", Number(billToDelete.year))
        );
        const gSnap = await getDocs(gQ);
        for (const d of gSnap.docs) {
          await deleteDoc(doc(db, "garbageBills", d.id));
        }
      } catch (gErr) {
        console.warn("Could not delete matching garbageBills:", gErr.message);
      }

      toast.success("Bill deleted successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete bill");
    }
    setBillToDelete(null);
  }

  // Export to Excel (.xlsx)
  function handleExportExcel() {
    const data = filteredBills.map((b) => ({
      Resident: b.residentName || "",
      Flat: b.flat || "",
      Block: b.block || "",
      Amount: b.amount || 0,
      Status: b.displayStatus || b.status,
      "Due Date": b.dueDate || "",
      "Payment Date": b.paymentDate || "",
      "Payment Method": b.paymentMethod || "",
      "Receipt No": b.paymentId || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bills");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), `Bills_${selectedMonth}_${selectedYear}.xlsx`);
    toast.success("Excel sheet downloaded");
  }

  // Export to PDF
  function handleExportPdf() {
    const totalBilled = filteredBills.reduce((s, b) => s + Number(b.amount || 0), 0);
    const totalPaid = filteredBills
      .filter((b) => b.displayStatus === "Paid")
      .reduce((s, b) => s + Number(b.amount || 0), 0);
    const totalPending = totalBilled - totalPaid;

    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text(`RWA Monthly Bills — ${selectedMonth} ${selectedYear}`, 14, 20);
    pdf.setFontSize(10);
    pdf.text(
      `Total: ₹${totalBilled} | Collected: ₹${totalPaid} | Pending: ₹${totalPending} | Count: ${filteredBills.length}`,
      14,
      28
    );

    const tableData = filteredBills.map((b) => [
      b.residentName || "—",
      b.flat || "—",
      b.block || "—",
      `₹${b.amount || 0}`,
      b.displayStatus || b.status,
      b.dueDate || "—",
      b.paymentDate || "—",
    ]);

    pdf.autoTable({
      startY: 34,
      head: [["Resident", "Flat", "Block", "Amount", "Status", "Due Date", "Paid Date"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] },
    });

    pdf.save(`Bills_${selectedMonth}_${selectedYear}.pdf`);
    toast.success("PDF report downloaded");
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-800 tracking-tight">Bills Management</h1>
            <p className="text-gray-500 mt-1 font-medium">Manage Monthly Bills & Collect Payments</p>
          </div>
          <button
            onClick={generateBills}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition active:scale-95"
          >
            {loading ? "Generating Bills..." : "Generate Monthly Bills"}
          </button>
        </div>

        <MonthSelector />
        <BillSummaryCards bills={filteredBills} />
        <BillFilters
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          blockFilter={blockFilter}
          setBlockFilter={setBlockFilter}
          blocks={blocks}
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
        />
        <BillTable
          bills={filteredBills}
          onPay={(bill) => setSelectedPayBill(bill)}
          onView={(bill) => setSelectedViewBill(bill)}
          onDelete={handleDeleteBill}
        />
      </div>

      <PaymentModal
        open={!!selectedPayBill}
        bill={selectedPayBill}
        onClose={() => setSelectedPayBill(null)}
        onCollect={handleCollectPayment}
      />
      <ViewBillModal
        open={!!selectedViewBill}
        bill={selectedViewBill}
        onClose={() => setSelectedViewBill(null)}
      />
      <ConfirmDialog
        open={!!billToDelete}
        title="Delete Bill"
        message={
          billToDelete
            ? `Are you sure you want to delete the bill for ${billToDelete.flat}? This action cannot be undone.`
            : ""
        }
        onCancel={() => setBillToDelete(null)}
        onConfirm={confirmDeleteBill}
      />
      <PaymentReceiptSuccessModal
        open={Boolean(successReceipt)}
        receipt={successReceipt}
        onClose={() => setSuccessReceipt(null)}
      />
    </>
  );
}
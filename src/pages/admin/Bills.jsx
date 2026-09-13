import { useMemo, useState, useEffect } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { query, where, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

import { useBills } from "../../context/BillContext";
import { useBilling } from "../../context/BillingContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import { useGarbage } from "../../context/GarbageContext";
import { useBlockFlat } from "../../context/BlockFlatContext";
import { useAuth } from "../../context/AuthContext";
import { collectResidentPayment } from "../../utils/collectPayment";
import { deleteBill } from "../../services/billService";
import { getDisplayStatus } from "../../utils/billStatus";
import { subscribeSettings } from "../../services/settingsService";
import { isGcParticipating } from "../../services/statisticsService";
import { syncBlockWiseMonthlyBills } from "../../utils/reportSyncService";
import { generateBlockWiseMonthlyBillsPDF } from "../../utils/printReportHelper";

import MonthSelector from "../../components/common/MonthSelector";
import BillSummaryCards from "../../components/bills/BillSummaryCards";
import BillFilters from "../../components/bills/BillFilters";
import BillTable from "../../components/bills/BillTable";
import PaymentModal from "../../components/payments/PaymentModal";
import PaymentReceiptSuccessModal from "../../components/collections/PaymentReceiptSuccessModal";
import ViewBillModal from "../../components/bills/ViewBillModal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PrintMonthlyBillsModal from "../../components/bills/PrintMonthlyBillsModal";

export default function Bills() {
  const { bills, loading, generateBills } = useBills();
  const { selectedMonth, selectedYear } = useBilling();
  const { payments, addPayment } = usePayments();
  const { residents = [] } = useResidents();
  const { garbageBills = [] } = useGarbage();
  const { blocks: rawBlocks = [] } = useBlockFlat();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [blockFilter, setBlockFilter] = useState("All");
  const [selectedPayBill, setSelectedPayBill] = useState(null);
  const [selectedViewBill, setSelectedViewBill] = useState(null);
  const [billToDelete, setBillToDelete] = useState(null);
  const [successReceipt, setSuccessReceipt] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [societySettings, setSocietySettings] = useState({});

  useEffect(() => {
    const unsub = subscribeSettings((data) => {
      if (data) setSocietySettings(data);
    });
    return () => unsub && unsub();
  }, []);

  // Derive unique blocks from bills and blockFlat context
  const blocks = useMemo(() => {
    const set = new Set(bills.map((b) => b.block).filter(Boolean));
    rawBlocks.forEach((b) => {
      if (b.name) set.add(b.name);
    });
    return [...set].sort();
  }, [bills, rawBlocks]);

  const monthlyBills = useMemo(() => {
    const billMap = new Map();

    // 1. Existing bills from Firestore bills collection
    bills
      .filter((b) => b.month === selectedMonth && Number(b.year) === Number(selectedYear))
      .forEach((b) => {
        billMap.set(b.residentId, {
          ...b,
          displayStatus: getDisplayStatus(b),
        });
      });

    // 2. Reconcile with active participating residents
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
            displayStatus: "Paid",
            amount: Number(paymentMatch.amount || b.amount || charge),
            paymentDate: paymentMatch.paymentDate || b.paymentDate || "",
            paymentMethod: paymentMatch.paymentMethod || b.paymentMethod || "Cash",
            paymentId: paymentMatch.receiptNumber || paymentMatch.paymentId || b.paymentId || "",
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
          displayStatus: isPaid ? "Paid" : "Pending",
          month: selectedMonth,
          year: Number(selectedYear),
          dueDate: `10 ${selectedMonth} ${selectedYear}`,
          paymentDate: paymentMatch?.paymentDate || "",
          paymentMethod: paymentMatch?.paymentMethod || "",
          paymentId: paymentMatch?.receiptNumber || paymentMatch?.paymentId || "",
          _isVirtual: true,
        });
      }
    });

    return Array.from(billMap.values());
  }, [bills, residents, payments, selectedMonth, selectedYear]);

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

  // Export to PDF with crystal-clear vector formatting
  function handleExportPdf() {
    const syncedData = syncBlockWiseMonthlyBills({
      residents,
      blocks: rawBlocks,
      bills: monthlyBills,
      garbageBills,
      payments,
      month: selectedMonth,
      year: selectedYear,
    });

    generateBlockWiseMonthlyBillsPDF({
      syncedData,
      settings: societySettings,
      month: selectedMonth,
      year: selectedYear,
      filterBlock: blockFilter === "All" ? "all" : blockFilter,
      filterStatus: statusFilter === "All" ? "all" : statusFilter.toLowerCase(),
    });
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-800 tracking-tight">Bills Management</h1>
            <p className="text-gray-500 mt-1 font-medium">Manage Monthly Bills & Collect Payments</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={generateBills}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition active:scale-95 text-sm"
            >
              {loading ? "Generating Bills..." : "Generate Monthly Bills"}
            </button>
          </div>
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
          onPrintBills={() => setShowPrintModal(true)}
        />
        <BillTable
          bills={filteredBills}
          onPay={(bill) => setSelectedPayBill(bill)}
          onView={(bill) => setSelectedViewBill(bill)}
          onDelete={handleDeleteBill}
          settings={societySettings}
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
        settings={societySettings}
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

      {/* Block-Wise Monthly Bills Register Print Modal */}
      <PrintMonthlyBillsModal
        open={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        residents={residents}
        blocks={rawBlocks}
        bills={bills}
        garbageBills={garbageBills}
        payments={payments}
        initialMonth={selectedMonth}
        initialYear={selectedYear}
        settings={societySettings}
      />
    </>
  );
}
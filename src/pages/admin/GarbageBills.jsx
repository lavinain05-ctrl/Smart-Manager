import { useMemo, useState } from "react";
import {
  FaFileInvoiceDollar,
  FaSearch,
  FaMoneyBillWave,
  FaFileExcel,
  FaFilePdf,
  FaTrash,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";

import { useGarbage } from "../../context/GarbageContext";
import { usePayments } from "../../context/PaymentContext";
import { isGcParticipating } from "../../services/statisticsService";
import ConfirmDialog from "../../components/common/ConfirmDialog";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function GarbageBills() {
  const {
    garbageAccounts,
    garbageBills,
    residents = [],
    loading,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    generateBills,
    recordPayment,
    deleteBill,
  } = useGarbage();

  const { payments = [] } = usePayments();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [blockFilter, setBlockFilter] = useState("all");
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "Cash" });
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Synchronized monthly bills: merge garbageBills with all active participating residents
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
          month: selectedMonth,
          year: Number(selectedYear),
          dueDate: `10 ${selectedMonth} ${selectedYear}`,
          paymentDate: paymentMatch?.paymentDate || "",
          paymentMethod: paymentMatch?.paymentMethod || "",
          collectedBy: paymentMatch?.collector || "",
          _isVirtual: true,
        });
      }
    });

    return Array.from(billMap.values());
  }, [garbageBills, residents, payments, selectedMonth, selectedYear]);

  // Unique blocks
  const blocks = useMemo(() => {
    const set = new Set(monthlyBills.map((b) => b.block).filter(Boolean));
    return [...set].sort();
  }, [monthlyBills]);

  // Filtered
  const filtered = useMemo(() => {
    return monthlyBills.filter((bill) => {
      const matchSearch =
        `${bill.residentName} ${bill.flat} ${bill.block}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || bill.status === statusFilter;
      const matchBlock = blockFilter === "all" || bill.block === blockFilter;
      return matchSearch && matchStatus && matchBlock;
    });
  }, [monthlyBills, search, statusFilter, blockFilter]);

  // Stats
  const totalBilled = filtered.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalCollected = filtered
    .filter((b) => b.status === "Paid")
    .reduce((s, b) => s + Number(b.paidAmount || b.amount || 0), 0);
  const totalPending = totalBilled - totalCollected;

  // Record payment
  async function handleRecordPayment() {
    if (!payModal) return;
    const success = await recordPayment(payModal.id, {
      amount: payForm.amount || payModal.amount,
      paymentMethod: payForm.paymentMethod,
    });
    if (success) {
      setPayModal(null);
      setPayForm({ amount: "", paymentMethod: "Cash" });
    }
  }

  // Export Excel
  function exportExcel() {
    const data = filtered.map((b) => ({
      Resident: b.residentName,
      Flat: b.flat,
      Block: b.block,
      Amount: b.amount,
      Status: b.status,
      "Paid Amount": b.paidAmount || 0,
      "Payment Date": b.paymentDate || "",
      "Payment Method": b.paymentMethod || "",
      "Collected By": b.collectedBy || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Garbage Bills");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), `Garbage_Bills_${selectedMonth}_${selectedYear}.xlsx`);
  }

  // Export PDF
  function exportPdf() {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text(`Garbage Bills — ${selectedMonth} ${selectedYear}`, 14, 20);
    pdf.setFontSize(10);
    pdf.text(`Total: ₹${totalBilled} | Collected: ₹${totalCollected} | Pending: ₹${totalPending}`, 14, 28);

    pdf.autoTable({
      startY: 35,
      head: [["Resident", "Flat", "Block", "Amount", "Status", "Paid", "Method"]],
      body: filtered.map((b) => [
        b.residentName,
        b.flat,
        b.block,
        `₹${b.amount}`,
        b.status,
        b.paidAmount ? `₹${b.paidAmount}` : "",
        b.paymentMethod || "",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    pdf.save(`Garbage_Bills_${selectedMonth}_${selectedYear}.pdf`);
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FaFileInvoiceDollar className="text-emerald-600" />
            Garbage Bills
          </h1>
          <p className="text-gray-500 mt-1">
            {selectedMonth} {selectedYear} • {monthlyBills.length} bills
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded-xl px-4 py-2.5 bg-white shadow-sm text-sm outline-none"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border rounded-xl px-4 py-2.5 bg-white shadow-sm text-sm outline-none"
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={generateBills}
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition shadow-lg shadow-emerald-500/30 disabled:opacity-50"
          >
            <FaMoneyBillWave />
            {loading ? "Generating..." : "Generate Bills"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-gray-500 text-sm">Total Billed</p>
          <h3 className="text-xl font-bold text-indigo-700">₹{totalBilled.toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-gray-500 text-sm">Collected</p>
          <h3 className="text-xl font-bold text-emerald-700">₹{totalCollected.toLocaleString()}</h3>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-gray-500 text-sm">Pending</p>
          <h3 className="text-xl font-bold text-red-700">₹{totalPending.toLocaleString()}</h3>
        </div>
      </div>

      {/* Filters & Export */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FaSearch className="absolute left-4 top-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, flat, block..."
              className="w-full border rounded-xl pl-12 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-xl px-4 py-3 bg-white outline-none"
          >
            <option value="all">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
          </select>

          <select
            value={blockFilter}
            onChange={(e) => setBlockFilter(e.target.value)}
            className="border rounded-xl px-4 py-3 bg-white outline-none"
          >
            <option value="all">All Blocks</option>
            {blocks.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-3 rounded-xl border hover:bg-green-50 text-green-700 transition" title="Export Excel">
            <FaFileExcel /> Excel
          </button>

          <button onClick={exportPdf} className="flex items-center gap-2 px-4 py-3 rounded-xl border hover:bg-red-50 text-red-700 transition" title="Export PDF">
            <FaFilePdf /> PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Resident</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Flat</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Block</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Paid</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Method</th>
                <th className="text-center px-6 py-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bill) => (
                <tr key={bill.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium">{bill.residentName}</td>
                  <td className="px-6 py-4">{bill.flat}</td>
                  <td className="px-6 py-4">{bill.block}</td>
                  <td className="px-6 py-4">₹{Number(bill.amount || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      bill.status === "Paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{bill.paidAmount ? `₹${bill.paidAmount}` : "—"}</td>
                  <td className="px-6 py-4">{bill.paymentMethod || "—"}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {bill.status === "Pending" && (
                        <button
                          onClick={() => {
                            setPayModal(bill);
                            setPayForm({ amount: bill.amount, paymentMethod: "Cash" });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition"
                        >
                          Pay
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDelete(bill)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    No bills found. Click "Generate Bills" to create bills for active accounts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-lg mb-1">Record Payment</h3>
            <p className="text-gray-500 text-sm mb-4">
              {payModal.residentName} — {payModal.flat}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                <select
                  value={payForm.paymentMethod}
                  onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setPayModal(null)}
                className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Bill"
          message={`Delete bill for ${confirmDelete.residentName} (${confirmDelete.flat}) — ${confirmDelete.month} ${confirmDelete.year}?`}
          onConfirm={async () => {
            await deleteBill(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  FaMoneyBillWave,
  FaSearch,
  FaRecycle,
  FaPrint,
  FaCheckCircle,
  FaFilter,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import { useGarbage } from "../../context/GarbageContext";
import { useResidents } from "../../context/ResidentContext";
import { useBills } from "../../context/BillContext";
import { usePayments } from "../../context/PaymentContext";

import PaymentModal from "../../components/collections/PaymentModal";
import PaymentReceiptSuccessModal from "../../components/collections/PaymentReceiptSuccessModal";
import CollectorMonthBar from "../../components/collections/CollectorMonthBar";
import { useBilling } from "../../context/BillingContext";
import { collectResidentPayment } from "../../utils/collectPayment";
import { isPriorToResidentBillingStart } from "../../utils/billingCycle";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import PrinterQuickAction from "../../components/common/PrinterQuickAction";

export default function GarbageCollectorCollect() {
  const { user } = useAuth();
  const { garbageAccounts, garbageBills } = useGarbage();
  const { residents = [] } = useResidents();
  const { bills = [] } = useBills();
  const { payments = [], addPayment } = usePayments();
  const { selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useBilling();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, pending, paid, not_participating
  const [selectedResident, setSelectedResident] = useState(null);
  const [openCollectModal, setOpenCollectModal] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState(null);

  // Check if an account is paid for current month (including advance covered months)
  function isGarbagePaid(acc) {
    const resId = acc.residentId;
    const flat = acc.flat;

    // 1. Check in payments collection
    const paidInPayments = payments.some(
      (p) =>
        ((resId && p.residentId === resId) ||
         (flat && p.flat && String(p.flat).toLowerCase() === String(flat).toLowerCase())) &&
        ((p.month === selectedMonth && Number(p.year) === Number(selectedYear)) ||
         (p.isAdvance && Array.isArray(p.coveredMonths) &&
          p.coveredMonths.some((cm) => cm.month === selectedMonth && Number(cm.year) === Number(selectedYear))))
    );
    if (paidInPayments) return true;

    // 2. Check in garbageBills
    const bill = garbageBills.find(
      (b) =>
        (b.accountId === acc.id || (resId && b.residentId === resId)) &&
        b.month === selectedMonth &&
        Number(b.year) === Number(selectedYear)
    );
    return bill?.status === "Paid";
  }

  // Find relevant garbage bill
  function getBill(accountId, residentId) {
    return garbageBills.find(
      (b) =>
        (b.accountId === accountId || (residentId && b.residentId === residentId)) &&
        b.month === selectedMonth &&
        Number(b.year) === Number(selectedYear)
    );
  }

  function isAccountEligible(a) {
    const r = residents.find((res) => res.id === a.residentId) || a;
    return !isPriorToResidentBillingStart(r, selectedMonth, selectedYear);
  }

  // Assigned and filtered accounts
  const filteredAccounts = useMemo(() => {
    return garbageAccounts
      .filter((a) => a.collectorId === user?.uid || !a.collectorId)
      .filter((a) => {
        const query = search.toLowerCase();
        const matchesSearch =
          (a.residentName || "").toLowerCase().includes(query) ||
          (a.flat || "").toLowerCase().includes(query) ||
          (a.block || "").toLowerCase().includes(query) ||
          (a.floor || "").toLowerCase().includes(query);
        if (!matchesSearch) return false;

        const isNotPart = a.status === "inactive" || !isAccountEligible(a);
        const paid = isGarbagePaid(a);

        if (filter === "not_participating") return isNotPart;
        if (filter === "paid") return !isNotPart && paid;
        if (filter === "pending") return !isNotPart && !paid;
        return true;
      });
  }, [garbageAccounts, residents, user, search, filter, payments, garbageBills, selectedMonth, selectedYear]);

  // Counts for filter badges
  const filterCounts = useMemo(() => {
    const list = garbageAccounts.filter((a) => a.collectorId === user?.uid || !a.collectorId);
    let pending = 0;
    let paid = 0;
    let notPart = 0;

    list.forEach((a) => {
      if (a.status === "inactive" || !isAccountEligible(a)) {
        notPart++;
      } else if (isGarbagePaid(a)) {
        paid++;
      } else {
        pending++;
      }
    });

    return {
      all: list.length,
      pending,
      paid,
      notPart,
    };
  }, [garbageAccounts, residents, user, payments, garbageBills, selectedMonth, selectedYear]);

  // Open Full-Featured Payment Modal
  function handleOpenCollect(acc) {
    const matchedResident = residents.find(
      (r) =>
        r.id === acc.residentId ||
        (r.flat && acc.flat && r.flat.trim().toLowerCase() === acc.flat.trim().toLowerCase())
    );

    const residentObj = {
      id: matchedResident?.id || acc.residentId || acc.id,
      owner: matchedResident?.owner || acc.residentName || "Resident",
      name: matchedResident?.name || acc.residentName || "Resident",
      flat: acc.flat || matchedResident?.flat || "",
      flatNumber: acc.flat || matchedResident?.flatNumber || "",
      block: acc.block || matchedResident?.block || "",
      floor: acc.floor || matchedResident?.floor || "",
      plotNumber: acc.plotNumber || matchedResident?.plotNumber || acc.flat || "",
      unitNumber: acc.unitNumber || matchedResident?.unitNumber || "",
      personType: acc.personType || matchedResident?.personType || "OWNER",
      charge: Number(acc.monthlyCharge) > 0
        ? Number(acc.monthlyCharge)
        : (Number(matchedResident?.charge) > 0 ? Number(matchedResident?.charge) : 80),
      ...(matchedResident || {}),
    };

    setSelectedResident(residentObj);
    setOpenCollectModal(true);
  }

  // Handle Complete Payment Submission (Single Month or Advance)
  async function handleCollect(paymentData) {
    if (!selectedResident) return;

    const success = await collectResidentPayment({
      resident: selectedResident,
      month: selectedMonth,
      year: selectedYear,
      paymentData,
      bills,
      addPayment,
      collector: user?.name || "Collector",
      collectorId: user?.uid,
    });

    if (success) {
      setOpenCollectModal(false);
      setSelectedResident(null);
      setSuccessReceipt(success);
      toast.success(`Payment collected successfully for Flat ${selectedResident.flat}!`);
    }
  }

  // Print Official Receipt
  function handlePrintReceipt(acc) {
    const resPayments = payments.filter(
      (p) =>
        (acc.residentId && p.residentId === acc.residentId) ||
        (acc.flat && p.flat && String(p.flat).toLowerCase() === String(acc.flat).toLowerCase())
    );
    const latestPayment = resPayments.find(
      (p) =>
        (p.month === selectedMonth && Number(p.year) === Number(selectedYear)) ||
        (p.isAdvance && Array.isArray(p.coveredMonths) &&
         p.coveredMonths.some((cm) => cm.month === selectedMonth && Number(cm.year) === Number(selectedYear)))
    ) || resPayments[0];

    const bill = getBill(acc.id, acc.residentId);

    printPaymentReceipt({
      residentName: acc.residentName,
      flat: acc.flat,
      block: acc.block,
      plotNumber: acc.plotNumber || latestPayment?.plotNumber || acc.flat || "",
      floor: acc.floor || latestPayment?.floor || "",
      unitNumber: acc.unitNumber || latestPayment?.unitNumber || "",
      personType: acc.personType || latestPayment?.personType || "",
      amount: latestPayment?.amount || bill?.amount || acc.monthlyCharge || 80,
      totalPaidAmount: latestPayment?.totalPaidAmount || latestPayment?.amount || bill?.paidAmount || bill?.amount || acc.monthlyCharge || 80,
      paymentMethod: latestPayment?.paymentMethod || bill?.paymentMethod || "Cash",
      paymentDate: latestPayment?.paymentDate || bill?.paymentDate || new Date().toLocaleDateString("en-IN"),
      receiptNumber: latestPayment?.receiptNumber || bill?.paymentId || ("REC-" + (bill?.id || Date.now())),
      collector: latestPayment?.collector || user?.name || "Collector",
      isAdvance: Boolean(latestPayment?.isAdvance),
      periodLabel: latestPayment?.periodLabel || `${selectedMonth} ${selectedYear}`,
      coveredMonths: latestPayment?.coveredMonths || [{ month: selectedMonth, year: Number(selectedYear) }],
      month: selectedMonth,
      year: selectedYear,
    });
    toast.success(`Printing official receipt for Flat ${acc.flat}...`);
  }

  return (
    <>
      <div className="space-y-5">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-900">
              <FaRecycle className="text-emerald-600" />
              Garbage Collection
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              Monthly Billing: {selectedMonth} {selectedYear}
            </p>
          </div>
          <div>
            <PrinterQuickAction />
          </div>
        </div>

        {/* Synchronized Month & Year Selection Bar */}
        <CollectorMonthBar
          title={`Billing Period: ${selectedMonth} ${selectedYear}`}
          subtitle="Filter records, check pending/paid status & collect"
        />

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div className="relative">
            <FaSearch className="absolute left-4 top-3.5 text-gray-400 text-sm" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by flat, resident, or floor..."
              className="w-full border rounded-xl pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition"
            />
          </div>

          {/* Quick Filter Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                filter === "all"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All ({filterCounts.all})
            </button>
            <button
              onClick={() => setFilter("pending")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                filter === "pending"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Pending ({filterCounts.pending})
            </button>
            <button
              onClick={() => setFilter("paid")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                filter === "paid"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Paid ({filterCounts.paid})
            </button>
            <button
              onClick={() => setFilter("not_participating")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                filter === "not_participating"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Not Participating ({filterCounts.notPart})
            </button>
          </div>
        </div>

        {/* Residents / Accounts List */}
        <div className="space-y-3">
          {filteredAccounts.map((acc) => {
            const isNotPart = acc.status === "inactive";
            const paid = !isNotPart && isGarbagePaid(acc);

            return (
              <div
                key={acc.id}
                className="bg-white rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-100 hover:border-emerald-200 transition"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-gray-900">{acc.flat}</h3>
                    {acc.block && (
                      <span className="text-[11px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                        {acc.block}
                      </span>
                    )}
                    {acc.floor && (
                      <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/70 px-2 py-0.5 rounded">
                        {acc.floor}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mt-0.5 font-medium">{acc.residentName}</p>
                  <p className="text-gray-400 text-xs">
                    {acc.block ? `${acc.block} • ` : ""}{acc.floor ? `${acc.floor} • ` : ""}Monthly Rate: ₹{acc.monthlyCharge || 80}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                  {isNotPart ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-700 border border-gray-300">
                      Not Participating
                    </span>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        paid
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {paid ? "Paid" : "Pending"}
                    </span>
                  )}

                  {isNotPart ? (
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 rounded-xl text-gray-400 bg-gray-100 flex items-center gap-1.5 text-xs font-bold cursor-not-allowed border border-gray-200 select-none opacity-80"
                      title="Resident is not participating in garbage collection"
                    >
                      <FaMoneyBillWave className="text-gray-400" />
                      Collect
                    </button>
                  ) : paid ? (
                    <button
                      type="button"
                      onClick={() => handlePrintReceipt(acc)}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                      title="Print Official Payment Receipt"
                    >
                      <FaPrint className="text-xs" />
                      Print Receipt
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenCollect(acc)}
                      className="px-4 py-2 rounded-xl text-white flex items-center gap-1.5 text-xs font-bold shadow-xs transition bg-emerald-600 hover:bg-emerald-700 cursor-pointer active:scale-95"
                    >
                      <FaMoneyBillWave />
                      Collect
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredAccounts.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-500 text-sm">
              No matching garbage collection accounts found.
            </div>
          )}
        </div>
      </div>

      {/* ─── Working Full-Featured Payment Modal (Matches Collect Option with Single/Advance) ─── */}
      <PaymentModal
        open={openCollectModal}
        resident={selectedResident}
        month={selectedMonth}
        year={selectedYear}
        onClose={() => {
          setOpenCollectModal(false);
          setSelectedResident(null);
        }}
        onCollect={handleCollect}
      />

      {/* ─── Official Receipt Success Modal (with immediate Print Receipt & PDF) ─── */}
      <PaymentReceiptSuccessModal
        open={Boolean(successReceipt)}
        receipt={successReceipt}
        onClose={() => setSuccessReceipt(null)}
        title="Garbage Collection Recorded!"
        subtitle="Official RWA payment receipt is ready to print or download."
      />
    </>
  );
}


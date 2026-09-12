import { useState, useMemo } from "react";
import { FaMoneyBillWave, FaSearch, FaTimes, FaPhone, FaBan, FaFilter } from "react-icons/fa";

import PaymentModal from "../../components/collections/PaymentModal";
import PaymentReceiptSuccessModal from "../../components/collections/PaymentReceiptSuccessModal";

import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBilling } from "../../context/BillingContext";
import { useBills } from "../../context/BillContext";
import { useGarbage } from "../../context/GarbageContext";

import { collectResidentPayment } from "../../utils/collectPayment";
import { isGcParticipating } from "../../services/statisticsService";

import MonthSelector from "../../components/common/MonthSelector";

export default function Collections() {
  const { residents } = useResidents();

  const { payments, addPayment } = usePayments();

  const { bills } = useBills();

  const { garbageBills } = useGarbage();

  const {
    selectedMonth,
    selectedYear,
  } = useBilling();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("participating"); // "participating", "pending", "paid", "all"

  const [selectedResident, setSelectedResident] =
    useState(null);

  const [openModal, setOpenModal] =
    useState(false);

  const [successReceipt, setSuccessReceipt] =
    useState(null);

  function isPaid(residentId) {
    const inPayments = payments.some(
      (payment) =>
        payment.residentId === residentId &&
        payment.month === selectedMonth &&
        Number(payment.year) === Number(selectedYear)
    );
    if (inPayments) return true;

    const inGarbageBills = (garbageBills || []).some(
      (bill) =>
        bill.residentId === residentId &&
        bill.month === selectedMonth &&
        Number(bill.year) === Number(selectedYear) &&
        (bill.status === "Paid" || bill.status === "Exempted")
    );
    if (inGarbageBills) return true;

    const inBills = (bills || []).some(
      (bill) =>
        bill.residentId === residentId &&
        bill.month === selectedMonth &&
        Number(bill.year) === Number(selectedYear) &&
        (bill.status === "Paid" || bill.status === "Exempted")
    );
    return inBills;
  }

  const filteredResidents = useMemo(() => {
    return (residents || []).filter((resident) => {
      const isParticipating = isGcParticipating(resident);
      const paid = isPaid(resident.id);

      if (filterType === "participating" && !isParticipating) return false;
      if (filterType === "pending" && (!isParticipating || paid)) return false;
      if (filterType === "paid" && (!isParticipating || !paid)) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      const flat = (resident.flat || "").toLowerCase();
      const owner = (resident.owner || resident.name || "").toLowerCase();
      const mobile = (resident.mobile || resident.phone || "").toLowerCase();
      return flat.includes(q) || owner.includes(q) || mobile.includes(q);
    });
  }, [residents, search, filterType, payments, garbageBills, bills, selectedMonth, selectedYear]);

  async function handleCollect(paymentData) {
    const success = await collectResidentPayment({
      resident: selectedResident,
      month: selectedMonth,
      year: selectedYear,
      paymentData,
      bills,
      addPayment,
      collector: "Admin",
      collectorId: null,
    });

    if (success) {
      setOpenModal(false);
      setSelectedResident(null);
      setSuccessReceipt(success);
    }
  }

  return (
    <>
      <div className="space-y-6">

        <div>

          <h1 className="text-3xl font-bold">
            Collections
          </h1>

          <p className="text-gray-500">
            Manage monthly garbage fee collection
          </p>

        </div>

        <MonthSelector />

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "participating", label: "Participating" },
            { key: "pending", label: "Pending" },
            { key: "paid", label: "Paid" },
            { key: "all", label: "All Residents" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                filterType === tab.key
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-100 border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">

          <div className="relative">

            <FaSearch className="absolute left-4 top-4 text-gray-400" />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search Flat, Resident, or Mobile Number..."
              className="w-full border rounded-xl pl-12 pr-10 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />

            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 p-1 transition"
                title="Clear search"
              >
                <FaTimes />
              </button>
            )}

          </div>

        </div>

        <div className="grid gap-5">

          {filteredResidents.map((resident) => {
            const isParticipating = isGcParticipating(resident);
            const paid = isPaid(resident.id);

            return (
              <div
                key={resident.id}
                className="bg-white rounded-2xl shadow-sm p-6 flex flex-col lg:flex-row justify-between items-center gap-5"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-bold text-xl">{resident.flat}</h2>
                    {!isParticipating && (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                        Not Enrolled
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500">{resident.owner}</p>
                  {resident.mobile && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 font-mono">
                      <FaPhone className="text-[10px] text-gray-400" />
                      {resident.mobile}
                    </p>
                  )}
                </div>

                <div className="font-bold text-lg">
                  ₹{isParticipating ? (resident.charge || 0) : 0}
                </div>

                {isParticipating ? (
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      paid
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {paid ? "Paid" : "Pending"}
                  </span>
                ) : (
                  <span className="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
                    Not Participating
                  </span>
                )}

                {isParticipating ? (
                  <button
                    disabled={paid}
                    onClick={() => {
                      setSelectedResident(resident);
                      setOpenModal(true);
                    }}
                    className={`px-5 py-3 rounded-xl text-white flex items-center gap-2 text-sm font-semibold ${
                      paid
                        ? "bg-gray-400"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    <FaMoneyBillWave />
                    {paid ? "Collected" : "Collect"}
                  </button>
                ) : (
                  <button
                    disabled
                    className="px-5 py-3 rounded-xl text-gray-400 bg-gray-100 flex items-center gap-2 cursor-not-allowed text-sm font-medium border"
                  >
                    <FaBan className="text-gray-400" />
                    Not Enrolled
                  </button>
                )}
              </div>
            );
          })}

        </div>

      </div>

      <PaymentModal
        open={openModal}
        resident={selectedResident}
        month={selectedMonth}
        year={selectedYear}
        onClose={() => {
          setOpenModal(false);
          setSelectedResident(null);
        }}
        onCollect={handleCollect}
      />

      <PaymentReceiptSuccessModal
        open={Boolean(successReceipt)}
        receipt={successReceipt}
        onClose={() => setSuccessReceipt(null)}
      />
    </>
  );
}
import { useState } from "react";
import { FaMoneyBillWave, FaSearch, FaTimes, FaPhone } from "react-icons/fa";

import PaymentModal from "../../components/collections/PaymentModal";
import PaymentReceiptSuccessModal from "../../components/collections/PaymentReceiptSuccessModal";

import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBilling } from "../../context/BillingContext";
import { useBills } from "../../context/BillContext";
import { useGarbage } from "../../context/GarbageContext";

import { collectResidentPayment } from "../../utils/collectPayment";

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

  const [selectedResident, setSelectedResident] =
    useState(null);

  const [openModal, setOpenModal] =
    useState(false);

  const [successReceipt, setSuccessReceipt] =
    useState(null);

  const filteredResidents = residents.filter((resident) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const flat = (resident.flat || "").toLowerCase();
    const owner = (resident.owner || resident.name || "").toLowerCase();
    const mobile = (resident.mobile || resident.phone || "").toLowerCase();
    return flat.includes(q) || owner.includes(q) || mobile.includes(q);
  });

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

            const paid = isPaid(
              resident.id
            );

            return (

              <div
                key={resident.id}
                className="bg-white rounded-2xl shadow-sm p-6 flex flex-col lg:flex-row justify-between items-center gap-5"
              >

                <div>

                  <h2 className="font-bold text-xl">
                    {resident.flat}
                  </h2>

                  <p className="text-gray-500">
                    {resident.owner}
                  </p>

                  {resident.mobile && (
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 font-mono">
                      <FaPhone className="text-[10px] text-gray-400" />
                      {resident.mobile}
                    </p>
                  )}

                </div>

                <div className="font-bold text-lg">
                  ₹{resident.charge}
                </div>

                <span
                  className={`px-4 py-2 rounded-full ${
                    paid
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {paid ? "Paid" : "Pending"}
                </span>

                <button
                  disabled={paid}
                  onClick={() => {
                    setSelectedResident(
                      resident
                    );
                    setOpenModal(true);
                  }}
                  className={`px-5 py-3 rounded-xl text-white flex items-center gap-2 ${
                    paid
                      ? "bg-gray-400"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >

                  <FaMoneyBillWave />

                  {paid
                    ? "Collected"
                    : "Collect"}

                </button>

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
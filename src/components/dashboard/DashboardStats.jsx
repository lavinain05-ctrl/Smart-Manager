import {
  FaUsers,
  FaMoneyBillWave,
  FaCheckCircle,
  FaClock,
  FaWallet,
  FaMobileAlt,
  FaUniversity,
  FaReceipt,
} from "react-icons/fa";

import SummaryCard from "./SummaryCard";

export default function DashboardStats({
  residents = [],
  payments = [],
}) {
  const today = new Date().toLocaleDateString("en-IN");

  const totalResidents = residents.length;
  const paidResidents = payments.length;
  const pendingResidents = totalResidents - paidResidents;

  const collectedAmount = payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount || 0),
    0
  );

  const expectedAmount = residents.reduce(
    (sum, resident) =>
      sum + Number(resident.charge || 0),
    0
  );

  const pendingAmount = expectedAmount - collectedAmount;

  const collectionPercentage =
    expectedAmount === 0
      ? 0
      : Math.round(
          (collectedAmount / expectedAmount) * 100
        );

  const todayPayments = payments.filter((p) => p.paymentDate === today);
  const todayTotal = todayPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayCash = todayPayments.filter((p) => p.paymentMethod === "Cash").reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayUPI = todayPayments.filter((p) => p.paymentMethod === "UPI").reduce((s, p) => s + Number(p.amount || 0), 0);
  const todayBank = todayPayments.filter((p) => p.paymentMethod === "Bank Transfer").reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalReceipts = payments.length;

  return (
    <div className="space-y-6">

      {/* Primary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        <SummaryCard
          title="Total Residents"
          value={totalResidents}
          subtitle="Registered Residents"
          color="bg-gradient-to-r from-blue-600 to-blue-500"
          icon={<FaUsers />}
        />

        <SummaryCard
          title="Collected Amount"
          value={`₹${collectedAmount.toLocaleString()}`}
          subtitle={`${collectionPercentage}% Completed`}
          color="bg-gradient-to-r from-emerald-600 to-green-500"
          icon={<FaMoneyBillWave />}
        />

        <SummaryCard
          title="Paid Residents"
          value={paidResidents}
          subtitle={`${paidResidents} Payments This Month`}
          color="bg-gradient-to-r from-green-600 to-emerald-500"
          icon={<FaCheckCircle />}
        />

        <SummaryCard
          title="Pending Residents"
          value={pendingResidents}
          subtitle={`₹${pendingAmount.toLocaleString()} Pending`}
          color="bg-gradient-to-r from-red-600 to-orange-500"
          icon={<FaClock />}
        />

      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">

        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-emerald-500">
          <div className="flex items-center gap-3 text-emerald-600 mb-2">
            <FaMoneyBillWave />
            <span className="text-sm font-medium text-gray-500">Today's Total</span>
          </div>
          <h3 className="text-2xl font-bold">₹{todayTotal.toLocaleString()}</h3>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-green-500">
          <div className="flex items-center gap-3 text-green-600 mb-2">
            <FaWallet />
            <span className="text-sm font-medium text-gray-500">Today's Cash</span>
          </div>
          <h3 className="text-2xl font-bold">₹{todayCash.toLocaleString()}</h3>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-purple-500">
          <div className="flex items-center gap-3 text-purple-600 mb-2">
            <FaMobileAlt />
            <span className="text-sm font-medium text-gray-500">Today's UPI</span>
          </div>
          <h3 className="text-2xl font-bold">₹{todayUPI.toLocaleString()}</h3>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-blue-500">
          <div className="flex items-center gap-3 text-blue-600 mb-2">
            <FaUniversity />
            <span className="text-sm font-medium text-gray-500">Today's Bank</span>
          </div>
          <h3 className="text-2xl font-bold">₹{todayBank.toLocaleString()}</h3>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-orange-500">
          <div className="flex items-center gap-3 text-orange-600 mb-2">
            <FaReceipt />
            <span className="text-sm font-medium text-gray-500">Receipts</span>
          </div>
          <h3 className="text-2xl font-bold">{totalReceipts}</h3>
        </div>

      </div>

    </div>
  );
}
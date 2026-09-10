import { useMemo } from "react";

import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBilling } from "../../context/BillingContext";

import { calcResidentStats, calcPaymentStats } from "../../services/statisticsService";

import MonthSelector from "../../components/common/MonthSelector";
import ReportsBarChart from "../../components/dashboard/charts/ReportsBarChart";
import ReportActions from "../../components/reports/ReportActions";

export default function Reports() {
  const { residents } = useResidents();
  const { payments } = usePayments();
  const { selectedMonth, selectedYear } = useBilling();

  // ─── Statistics from shared engine ───
  const residentStats = useMemo(() => calcResidentStats(residents), [residents]);
  const paymentStats = useMemo(() => calcPaymentStats(payments, residents, selectedMonth, selectedYear), [payments, residents, selectedMonth, selectedYear]);

  return (
    <div className="space-y-6">

      {/* Month Selector (shared with Dashboard) */}

      <MonthSelector />

      {/* Actions */}

      <ReportActions
        payments={paymentStats.monthlyPayments}
        residents={residents}
        month={selectedMonth}
        year={selectedYear}
      />


      {/* Summary */}

      <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-5">

        <div className="bg-blue-600 text-white rounded-2xl p-5">
          <h3>Total Residents</h3>
          <h2 className="text-3xl font-bold mt-3">
            {residentStats.total}
          </h2>
        </div>

        <div className="bg-green-600 text-white rounded-2xl p-5">
          <h3>Paid</h3>
          <h2 className="text-3xl font-bold mt-3">
            {paymentStats.paidCount}
          </h2>
        </div>

        <div className="bg-red-600 text-white rounded-2xl p-5">
          <h3>Pending</h3>
          <h2 className="text-3xl font-bold mt-3">
            {paymentStats.pendingCount}
          </h2>
        </div>

        <div className="bg-emerald-600 text-white rounded-2xl p-5">
          <h3>Collected</h3>
          <h2 className="text-3xl font-bold mt-3">
            ₹{paymentStats.collectedAmount.toLocaleString()}
          </h2>
        </div>

        <div className="bg-orange-500 text-white rounded-2xl p-5">
          <h3>Pending ₹</h3>
          <h2 className="text-3xl font-bold mt-3">
            ₹{paymentStats.pendingAmount.toLocaleString()}
          </h2>
        </div>

        <div className="bg-purple-600 text-white rounded-2xl p-5">
          <h3>Collection %</h3>
          <h2 className="text-3xl font-bold mt-3">
            {paymentStats.collectionRate}%
          </h2>
        </div>

      </div>

      <ReportsBarChart
        residents={residents}
        payments={paymentStats.monthlyPayments}
      />

    </div>
  );
}
import { useMemo, useState, useEffect } from "react";
import { FaSearch, FaUndoAlt } from "react-icons/fa";

import { usePayments } from "../../context/PaymentContext";
import { useBilling } from "../../context/BillingContext";
import { useAuth } from "../../context/AuthContext";

import MonthSelector from "../../components/common/MonthSelector";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Pagination from "../../components/common/Pagination";

export default function PaymentHistory() {
  const { payments, reversePayment } = usePayments();
  const { user } = useAuth();

  const {
    selectedMonth,
    selectedYear,
  } = useBilling();

  const [search, setSearch] = useState("");
  const [reverseTarget, setReverseTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const isAdmin = user?.role === "admin";

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchMonth =
        payment.month === selectedMonth &&
        Number(payment.year) === Number(selectedYear);

      const matchSearch =
        `${payment.flat} ${payment.residentName} ${payment.paymentMethod} ${payment.collector || ""} ${payment.collectorName || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());

      return matchMonth && matchSearch;
    });
  }, [
    payments,
    search,
    selectedMonth,
    selectedYear,
  ]);

  useEffect(() => {
    setPage(1);
  }, [filteredPayments.length]);

  const pagedPayments = useMemo(() => {
    if (pageSize === "all" || pageSize === "All" || Number(pageSize) >= filteredPayments.length) {
      return filteredPayments;
    }
    const numericSize = Number(pageSize) || 25;
    const start = (page - 1) * numericSize;
    return filteredPayments.slice(start, start + numericSize);
  }, [filteredPayments, page, pageSize]);

  async function handleReverse() {
    if (!reverseTarget) return;
    await reversePayment(reverseTarget, user);
    setReverseTarget(null);
  }

  return (
    <>
      <div className="space-y-6">

        {/* Header */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          <div>

            <h1 className="text-3xl font-bold">
              Payment History
            </h1>

            <p className="text-gray-500">
              View all collected payments
            </p>

          </div>

          <MonthSelector />

        </div>

        {/* Search */}

        <div className="bg-white rounded-2xl shadow-sm p-5">

          <div className="relative">

            <FaSearch className="absolute left-4 top-4 text-gray-400" />

            <input
              type="text"
              placeholder="Search by Flat, Resident, Collector or Method..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-xl pl-12 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
            />

          </div>

        </div>

        {/* Table */}

        <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">

          <table className="w-full">

            <thead className="bg-gray-100">

              <tr>

                <th className="p-4 text-left">
                  Flat
                </th>

                <th className="p-4 text-left">
                  Resident
                </th>

                <th className="p-4 text-left">
                  Collector
                </th>

                <th className="p-4 text-left">
                  Amount
                </th>

                <th className="p-4 text-left">
                  Method
                </th>

                <th className="p-4 text-left">
                  Date
                </th>

                <th className="p-4 text-left">
                  Receipt
                </th>

                {isAdmin && (
                  <th className="p-4 text-center">
                    Action
                  </th>
                )}

              </tr>

            </thead>

            <tbody>

              {filteredPayments.length === 0 ? (

                <tr>

                  <td
                    colSpan={isAdmin ? "8" : "7"}
                    className="text-center py-10 text-gray-500"
                  >
                    No Payments Found
                  </td>

                </tr>

              ) : (

                pagedPayments.map((payment) => (

                  <tr
                    key={payment.id}
                    className="border-t hover:bg-gray-50"
                  >

                    <td className="p-4 font-semibold text-gray-800">
                      {payment.flat}
                    </td>

                    <td className="p-4 font-medium text-gray-700">
                      {payment.residentName}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800 text-sm">
                          {payment.collectorName || payment.collector || "General / Admin"}
                        </span>
                        {(payment.collectorRole === "committee" || payment.collectorDesignation) && (
                          <span className="w-fit text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded mt-0.5">
                            {payment.collectorDesignation || "Committee"}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 font-bold text-emerald-600">
                      ₹{payment.amount}
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        payment.paymentMethod === "Cash" ? "bg-green-100 text-green-700"
                        : payment.paymentMethod === "UPI" ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                      }`}>
                        {payment.paymentMethod}
                      </span>
                    </td>

                    <td className="p-4 text-gray-600">
                      {payment.paymentDate}
                    </td>

                    <td className="p-4 font-mono text-xs text-gray-500">
                      {payment.receiptNumber}
                    </td>

                    {isAdmin && (
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setReverseTarget(payment)}
                          className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-2 rounded-lg transition"
                          title="Reverse Payment"
                        >
                          <FaUndoAlt />
                        </button>
                      </td>
                    )}

                  </tr>

                ))

              )}

            </tbody>

          </table>

          {filteredPayments.length > 0 && (
            <Pagination
              currentPage={page}
              totalItems={filteredPayments.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100, "all"]}
            />
          )}

        </div>

      </div>

      <ConfirmDialog
        open={!!reverseTarget}
        title="Reverse Payment?"
        message="This will permanently remove this payment and restore the resident's bill to Pending."
        confirmText="Reverse Payment"
        onCancel={() => setReverseTarget(null)}
        onConfirm={handleReverse}
      />
    </>
  );
}
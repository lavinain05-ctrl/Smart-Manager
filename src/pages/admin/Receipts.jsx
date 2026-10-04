import { useMemo, useState } from "react";
import { FaPrint, FaSearch, FaUndoAlt } from "react-icons/fa";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import { useAuth } from "../../context/AuthContext";
import { generateReceipt } from "../../utils/receiptGenerator";
import { printPaymentReceipt } from "../../utils/printReceiptHelper";
import { formatResidentFloor } from "../../services/propertyService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PrinterQuickAction from "../../components/common/PrinterQuickAction";
import { TableLoadingSkeleton } from "../../components/common/TableLoadingSkeleton";

export default function Receipts() {
  const { payments, reversePayment, loading } = usePayments();
  const { residents } = useResidents();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [reverseTarget, setReverseTarget] = useState(null);

  const isAdmin = user?.role === "admin";

  function enrichPayment(payment) {
    const res = residents.find(
      (r) =>
        (payment.residentId && r.id === payment.residentId) ||
        (payment.flat && (r.flat === payment.flat || r.flatNumber === payment.flat))
    );
    return {
      ...payment,
      plotNumber: payment.plotNumber || res?.plotNumber || "",
      floor: payment.floor || res?.floor || "",
      unitNumber: payment.unitNumber || res?.unitNumber || "",
      personType: payment.personType || res?.personType || "",
      block: payment.block || res?.block || "",
    };
  }

  const filteredPayments = useMemo(() => {
    const value = search.toLowerCase();

    return payments.filter((payment) =>
      `${payment.flat} ${payment.residentName} ${payment.collector || ""} ${payment.collectorName || ""}`
        .toLowerCase()
        .includes(value)
    );
  }, [payments, search]);

  function printReceipt(payment) {
    printPaymentReceipt(enrichPayment(payment));
  }

  async function handleReverse() {
    if (!reverseTarget) return;
    await reversePayment(reverseTarget, user);
    setReverseTarget(null);
  }

  return (
    <>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Receipts</h1>
            <p className="text-gray-500">Print payment receipts</p>
          </div>
          <div>
            <PrinterQuickAction />
          </div>
        </div>

        {/* Search */}

        <div className="bg-white rounded-2xl shadow-sm p-5">

          <div className="relative">

            <FaSearch className="absolute left-4 top-4 text-gray-400" />

            <input
              type="text"
              placeholder="Search by Flat, Resident, Collector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-xl pl-12 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
            />

          </div>

        </div>

        {/* Table */}
        {loading ? (
          <TableLoadingSkeleton columns={7} rows={6} />
        ) : (
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
                  <th className="p-4 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="text-center py-10 text-gray-500"
                    >
                      No Receipts Available
                    </td>
                  </tr>
                ) : (

                filteredPayments.map((payment) => (

                  <tr
                    key={payment.id}
                    className="border-t hover:bg-gray-50"
                  >

                    <td className="p-4 font-semibold text-gray-800">
                      <div>
                        <span>{payment.flat}</span>
                        {enrichPayment(payment).floor && (
                          <span className="block text-[11px] font-normal text-blue-600">
                            {formatResidentFloor(enrichPayment(payment).floor)}
                          </span>
                        )}
                      </div>
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

                    <td className="p-4 text-center">

                      <div className="flex justify-center gap-2">

                        <button
                          onClick={() => printReceipt(payment)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2"
                        >
                          <FaPrint />
                          Print
                        </button>

                        <button
                          onClick={() => generateReceipt(enrichPayment(payment))}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2"
                        >
                          PDF
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => setReverseTarget(payment)}
                            className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white px-3 py-2 rounded-xl transition"
                            title="Reverse Payment"
                          >
                            <FaUndoAlt />
                          </button>
                        )}

                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>
      )}

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
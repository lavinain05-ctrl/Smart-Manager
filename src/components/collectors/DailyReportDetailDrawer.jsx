import { useMemo, useState } from "react";
import { FaTimes, FaUserTie, FaWallet, FaMobileAlt, FaUniversity, FaMoneyBillWave, FaUndoAlt } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import { usePayments } from "../../context/PaymentContext";
import ConfirmDialog from "../common/ConfirmDialog";
import { matchesCollector } from "../../utils/collectorHelper";

export default function DailyReportDetailDrawer({ open, collector, payments, onClose }) {
  const [reverseTarget, setReverseTarget] = useState(null);

  const { user } = useAuth();
  const { reversePayment } = usePayments();
  const isAdmin = user?.role === "admin";

  const collectorPayments = useMemo(() => {
    if (!collector) return [];
    return (payments || [])
      .filter((p) => matchesCollector(p, collector))
      .sort((a, b) => {
        const tsA = Number((a.receiptNumber || "").replace("REC-", "")) || 0;
        const tsB = Number((b.receiptNumber || "").replace("REC-", "")) || 0;
        return tsA - tsB;
      });
  }, [payments, collector]);

  const totalAmount = useMemo(() => collectorPayments.reduce((s, p) => s + Number(p.amount || 0), 0), [collectorPayments]);
  const cashTotal = useMemo(() => collectorPayments.filter((p) => p.paymentMethod === "Cash").reduce((s, p) => s + Number(p.amount || 0), 0), [collectorPayments]);
  const upiTotal = useMemo(() => collectorPayments.filter((p) => p.paymentMethod === "UPI").reduce((s, p) => s + Number(p.amount || 0), 0), [collectorPayments]);
  const bankTotal = useMemo(() => collectorPayments.filter((p) => p.paymentMethod === "Bank Transfer").reduce((s, p) => s + Number(p.amount || 0), 0), [collectorPayments]);
  const uniqueResidents = useMemo(() => new Set(collectorPayments.map((p) => p.residentId)).size, [collectorPayments]);

  if (!open || !collector) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-full max-w-3xl bg-white h-full overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-700 to-indigo-600 text-white p-6 flex justify-between items-center z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
              <FaUserTie />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{collector.name}</h2>
              <p className="text-blue-200">Daily Collection Details</p>
            </div>
          </div>
          <button onClick={onClose} className="text-2xl hover:text-red-300 transition">
            <FaTimes />
          </button>
        </div>

        {/* Stats */}
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <FaMoneyBillWave className="text-xl text-emerald-600 mx-auto" />
            <p className="text-xl font-bold text-emerald-700 mt-2">₹{totalAmount.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <FaWallet className="text-xl text-green-600 mx-auto" />
            <p className="text-xl font-bold text-green-700 mt-2">₹{cashTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Cash</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
            <FaMobileAlt className="text-xl text-purple-600 mx-auto" />
            <p className="text-xl font-bold text-purple-700 mt-2">₹{upiTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-500">UPI</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <FaUniversity className="text-xl text-blue-600 mx-auto" />
            <p className="text-xl font-bold text-blue-700 mt-2">₹{bankTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Bank</p>
          </div>
        </div>

        {/* Table */}
        <div className="px-6 pb-6">
          <div className="border rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left text-sm font-bold text-gray-600">#</th>
                  <th className="p-3 text-left text-sm font-bold text-gray-600">Time</th>
                  <th className="p-3 text-left text-sm font-bold text-gray-600">Resident</th>
                  <th className="p-3 text-left text-sm font-bold text-gray-600">Flat</th>
                  <th className="p-3 text-left text-sm font-bold text-gray-600">Block</th>
                  <th className="p-3 text-right text-sm font-bold text-gray-600">Amount</th>
                  <th className="p-3 text-left text-sm font-bold text-gray-600">Mode</th>
                  <th className="p-3 text-left text-sm font-bold text-gray-600">Receipt</th>
                  {isAdmin && <th className="p-3 text-center text-sm font-bold text-gray-600">Action</th>}
                </tr>
              </thead>
              <tbody>
                {collectorPayments.length === 0 ? (
                  <tr><td colSpan={isAdmin ? "9" : "8"} className="text-center py-10 text-gray-500">No collections found</td></tr>
                ) : (
                  collectorPayments.map((p, i) => (
                    <tr key={p.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 text-gray-500">{i + 1}</td>
                      <td className="p-3 text-sm font-medium">{p.paymentTime || "-"}</td>
                      <td className="p-3 font-medium">{p.residentName}</td>
                      <td className="p-3 font-bold">{p.flat}</td>
                      <td className="p-3">{p.block || "-"}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">₹{Number(p.amount).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          p.paymentMethod === "Cash" ? "bg-green-100 text-green-700"
                          : p.paymentMethod === "UPI" ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                        }`}>
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="p-3 text-sm font-mono text-gray-500">{p.receiptNumber}</td>
                      {isAdmin && (
                        <td className="p-3 text-center">
                          <button onClick={() => setReverseTarget(p)} className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-2 rounded-lg transition" title="Reverse Payment">
                            <FaUndoAlt />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Totals */}
          {collectorPayments.length > 0 && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div><span className="text-gray-500">Residents:</span> <strong>{uniqueResidents}</strong></div>
              <div><span className="text-gray-500">Total:</span> <strong className="text-emerald-700">₹{totalAmount.toLocaleString()}</strong></div>
              <div><span className="text-gray-500">Cash:</span> <strong className="text-green-700">₹{cashTotal.toLocaleString()}</strong></div>
              <div><span className="text-gray-500">UPI:</span> <strong className="text-purple-700">₹{upiTotal.toLocaleString()}</strong></div>
              <div><span className="text-gray-500">Bank:</span> <strong className="text-blue-700">₹{bankTotal.toLocaleString()}</strong></div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!reverseTarget}
        title="Reverse Payment?"
        message="This will permanently remove this payment and restore the resident's bill to Pending."
        confirmText="Reverse Payment"
        onCancel={() => setReverseTarget(null)}
        onConfirm={async () => { await reversePayment(reverseTarget, user); setReverseTarget(null); }}
      />
    </div>
  );
}

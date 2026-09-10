import { useMemo, useState } from "react";
import {
  FaMoneyBillWave,
  FaSearch,
  FaRecycle,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { useGarbage } from "../../context/GarbageContext";

export default function GarbageCollectorCollect() {
  const { user } = useAuth();
  const {
    garbageAccounts,
    garbageBills,
    recordPayment,
  } = useGarbage();

  const [search, setSearch] = useState("");
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "Cash" });

  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();

  // Assigned accounts
  const myAccounts = useMemo(
    () => garbageAccounts
      .filter((a) => (a.collectorId === user?.uid || !a.collectorId) && a.status === "active")
      .filter((a) =>
        `${a.residentName} ${a.flat} ${a.block}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [garbageAccounts, user, search]
  );

  // Check if paid for current month
  function getBill(accountId) {
    return garbageBills.find(
      (b) =>
        b.accountId === accountId &&
        b.month === currentMonth &&
        Number(b.year) === Number(currentYear)
    );
  }

  async function handleCollect() {
    if (!payModal) return;
    const bill = getBill(payModal.id);
    if (!bill) return;

    const success = await recordPayment(bill.id, {
      amount: payForm.amount || bill.amount,
      paymentMethod: payForm.paymentMethod,
      collectedById: user?.uid,
    });

    if (success) {
      setPayModal(null);
      setPayForm({ amount: "", paymentMethod: "Cash" });
    }
  }

  return (
    <>
      <div className="space-y-5">

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FaRecycle className="text-emerald-600" />
            Garbage Collection
          </h1>
          <p className="text-gray-500">{currentMonth} {currentYear}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="relative">
            <FaSearch className="absolute left-4 top-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search flat or resident name..."
              className="w-full border rounded-xl pl-12 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          {myAccounts.map((acc) => {
            const bill = getBill(acc.id);
            const paid = bill?.status === "Paid";

            return (
              <div
                key={acc.id}
                className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <h3 className="font-bold">{acc.flat}</h3>
                  <p className="text-gray-500 text-sm">{acc.residentName}</p>
                  <p className="text-gray-400 text-xs">{acc.block} • ₹{acc.monthlyCharge}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    !bill
                      ? "bg-gray-100 text-gray-500"
                      : paid
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {!bill ? "No Bill" : paid ? "Paid" : "Pending"}
                  </span>

                  {bill && !paid && (
                    <button
                      onClick={() => {
                        setPayModal(acc);
                        setPayForm({ amount: bill.amount, paymentMethod: "Cash" });
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 text-sm transition"
                    >
                      <FaMoneyBillWave /> Collect
                    </button>
                  )}

                  {paid && (
                    <span className="px-4 py-2 rounded-xl bg-gray-100 text-gray-500 text-sm">
                      Done
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {myAccounts.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-gray-500">
              No assigned residents found.
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-lg mb-1">Collect Garbage Payment</h3>
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
                onClick={handleCollect}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

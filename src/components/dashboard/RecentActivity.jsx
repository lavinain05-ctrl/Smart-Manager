import {
  FaCheckCircle,
  FaMoneyBillWave,
} from "react-icons/fa";

export default function RecentActivity({
  payments,
}) {
  // Sort by receiptNumber (contains timestamp "REC-<ms>")
  // which is a reliable creation-order proxy, unlike the
  // locale-dependent paymentDate string.
  const recent = [...payments]
    .sort((a, b) => {
      const tsA = Number((a.receiptNumber || "").replace("REC-", "")) || 0;
      const tsB = Number((b.receiptNumber || "").replace("REC-", "")) || 0;
      return tsB - tsA;
    })
    .slice(0, 6);

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">

      {/* Header */}

      <div className="flex justify-between items-center mb-6">

        <div>

          <h2 className="text-xl font-bold">
            Recent Collections
          </h2>

          <p className="text-gray-500 text-sm">
            Latest payment transactions
          </p>

        </div>

        <span className="text-sm font-medium text-gray-500">
          {recent.length} Records
        </span>

      </div>

      {recent.length === 0 ? (

        <div className="text-center py-12 text-gray-500">
          No payment records found.
        </div>

      ) : (

        <div className="space-y-4">

          {recent.map((payment) => (

            <div
              key={payment.id}
              className="flex justify-between items-center border rounded-2xl p-4 hover:bg-gray-50 transition"
            >

              <div className="flex items-center gap-4">

                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white">

                  <FaCheckCircle />

                </div>

                <div>

                  <h3 className="font-semibold">
                    {payment.flat}
                  </h3>

                  <p className="text-sm text-gray-500">
                    {payment.residentName}
                  </p>

                  <p className="text-xs text-gray-400">
                    {payment.month} {payment.year}
                  </p>

                </div>

              </div>

              <div className="text-right">

                <p className="font-bold text-emerald-600">
                  ₹{Number(
                    payment.amount
                  ).toLocaleString()}
                </p>

                <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs">

                  <FaMoneyBillWave />

                  {payment.paymentMethod}

                </span>

                <p className="text-xs text-gray-400 mt-2">
                  {payment.paymentDate}
                </p>

              </div>

            </div>

          ))}

        </div>

      )}

    </div>
  );
}
export default function MonthlySummary({
  residents,
  payments,
  month,
  year,
}) {
  const totalResidents = residents.length;

  const paidResidents = payments.length;

  const pendingResidents =
    totalResidents - paidResidents;

  const expectedCollection = residents.reduce(
    (sum, resident) =>
      sum + Number(resident.charge || 0),
    0
  );

  const collectedAmount = payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount || 0),
    0
  );

  const pendingAmount =
    expectedCollection - collectedAmount;

  const collectionRate =
    totalResidents === 0
      ? 0
      : Math.round(
          (paidResidents / totalResidents) * 100
        );

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">

      {/* Header */}

      <div className="mb-6">

        <h2 className="text-xl font-bold">
          Monthly Summary
        </h2>

        <p className="text-gray-500 text-sm">
          {month} {year}
        </p>

      </div>

      {/* Summary */}

      <div className="grid md:grid-cols-2 gap-4">

        <div className="bg-blue-50 rounded-2xl p-4">

          <p className="text-gray-500 text-sm">
            Total Residents
          </p>

          <h2 className="text-3xl font-bold text-blue-600 mt-2">
            {totalResidents}
          </h2>

        </div>

        <div className="bg-green-50 rounded-2xl p-4">

          <p className="text-gray-500 text-sm">
            Paid Residents
          </p>

          <h2 className="text-3xl font-bold text-green-600 mt-2">
            {paidResidents}
          </h2>

        </div>

        <div className="bg-red-50 rounded-2xl p-4">

          <p className="text-gray-500 text-sm">
            Pending Residents
          </p>

          <h2 className="text-3xl font-bold text-red-600 mt-2">
            {pendingResidents}
          </h2>

        </div>

        <div className="bg-purple-50 rounded-2xl p-4">

          <p className="text-gray-500 text-sm">
            Collection Rate
          </p>

          <h2 className="text-3xl font-bold text-purple-600 mt-2">
            {collectionRate}%
          </h2>

        </div>

      </div>

      {/* Financial Summary */}

      <div className="border-t mt-8 pt-6 space-y-4">

        <div className="flex justify-between">

          <span className="text-gray-600">
            Expected Collection
          </span>

          <strong>
            ₹{expectedCollection.toLocaleString()}
          </strong>

        </div>

        <div className="flex justify-between">

          <span className="text-green-600">
            Collected Amount
          </span>

          <strong className="text-green-600">
            ₹{collectedAmount.toLocaleString()}
          </strong>

        </div>

        <div className="flex justify-between">

          <span className="text-red-600">
            Pending Amount
          </span>

          <strong className="text-red-600">
            ₹{pendingAmount.toLocaleString()}
          </strong>

        </div>

      </div>

    </div>
  );
}
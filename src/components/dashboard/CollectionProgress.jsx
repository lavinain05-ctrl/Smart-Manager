export default function CollectionProgress({
  collected,
  target,
  paidResidents = 0,
  totalParticipants = 0,
}) {
  const percentage =
    target === 0
      ? 0
      : Math.round((collected / target) * 100);

  const pending = Math.max(0, target - collected);

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">

      {/* Header */}

      <div className="flex justify-between items-center mb-6">

        <div>
          <h2 className="text-xl font-bold text-gray-800">
            GC Collection Progress
          </h2>

          <p className="text-gray-500 text-sm">
            Current month's garbage fee collection
          </p>
        </div>

        <div className="text-right">
          <h3 className="text-3xl font-bold text-emerald-600">
            {percentage}%
          </h3>

          <p className="text-sm text-gray-500">
            Completed
          </p>
        </div>

      </div>

      {/* Progress Bar */}

      <div className="w-full h-5 bg-gray-200 rounded-full overflow-hidden">

        <div
          className="h-5 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-700"
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

      {/* Cards */}

      <div className="grid md:grid-cols-4 gap-5 mt-8">

        <div className="bg-emerald-50 rounded-2xl p-5">

          <p className="text-gray-500 text-sm">
            Collected
          </p>

          <h2 className="text-3xl font-bold text-emerald-600 mt-2">
            ₹{collected.toLocaleString()}
          </h2>

        </div>

        <div className="bg-blue-50 rounded-2xl p-5">

          <p className="text-gray-500 text-sm">
            Target
          </p>

          <h2 className="text-3xl font-bold text-blue-600 mt-2">
            ₹{target.toLocaleString()}
          </h2>

        </div>

        <div className="bg-red-50 rounded-2xl p-5">

          <p className="text-gray-500 text-sm">
            Pending
          </p>

          <h2 className="text-3xl font-bold text-red-600 mt-2">
            ₹{pending.toLocaleString()}
          </h2>

        </div>

        <div className="bg-purple-50 rounded-2xl p-5">

          <p className="text-gray-500 text-sm">
            Paid Residents
          </p>

          <h2 className="text-3xl font-bold text-purple-600 mt-2">
            {paidResidents} <span className="text-lg font-medium text-gray-500">of {totalParticipants}</span>
          </h2>

        </div>

      </div>

      {/* Footer */}

      <div className="mt-8 border-t pt-5 flex justify-between items-center text-sm">

        <span className="text-gray-500">
          Collection Efficiency
        </span>

        <span className={`font-bold ${percentage >= 75 ? 'text-emerald-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
          {percentage}% Achieved
        </span>

      </div>

    </div>
  );
}
import { useEffect, useState, useMemo } from "react";
import { FaCalendarAlt, FaMoneyBillWave, FaTimes, FaLayerGroup, FaCheckCircle } from "react-icons/fa";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function getCoveredMonths(startMonth, startYear, count) {
  let startIndex = MONTH_NAMES.indexOf(startMonth);
  if (startIndex === -1) startIndex = new Date().getMonth();
  let currentYear = Number(startYear) || new Date().getFullYear();
  const list = [];

  for (let i = 0; i < count; i++) {
    const monthIndex = (startIndex + i) % 12;
    const yearOffset = Math.floor((startIndex + i) / 12);
    list.push({
      month: MONTH_NAMES[monthIndex],
      year: currentYear + yearOffset,
    });
  }
  return list;
}

export default function PaymentModal({
  open,
  resident,
  month,
  year,
  onClose,
  onCollect,
}) {
  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();

  const displayMonth = month || currentMonth;
  const displayYear = Number(year) || currentYear;

  const [isAdvance, setIsAdvance] = useState(false);
  const [durationMonths, setDurationMonths] = useState(1);
  const [startMonth, setStartMonth] = useState(displayMonth);
  const [startYear, setStartYear] = useState(displayYear);
  const [monthlyRate, setMonthlyRate] = useState(resident?.charge || 80);
  const [amount, setAmount] = useState(resident?.charge || 80);
  const [method, setMethod] = useState("Cash");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && resident) {
      const charge = Number(resident.charge) > 0 ? Number(resident.charge) : 80;
      setMonthlyRate(charge);
      setIsAdvance(false);
      setDurationMonths(1);
      setStartMonth(displayMonth);
      setStartYear(displayYear);
      setAmount(charge);
      setMethod("Cash");
      setRemarks("");
      setSubmitting(false);
    }
  }, [open, resident, displayMonth, displayYear]);

  // Covered Months Calculation
  const coveredMonths = useMemo(() => {
    const count = isAdvance ? Math.max(1, Number(durationMonths) || 1) : 1;
    return getCoveredMonths(startMonth, startYear, count);
  }, [isAdvance, durationMonths, startMonth, startYear]);

  // Recalculate amount when duration, monthlyRate, or isAdvance changes
  function handleSelectDuration(num) {
    setDurationMonths(num);
    setAmount(num * monthlyRate);
  }

  function handleMonthlyRateChange(newRate) {
    const r = Number(newRate);
    setMonthlyRate(r);
    const count = isAdvance ? Number(durationMonths) || 1 : 1;
    setAmount(count * r);
  }

  function handleToggleAdvance(adv) {
    setIsAdvance(adv);
    if (!adv) {
      setDurationMonths(1);
      setAmount(monthlyRate);
    } else {
      const d = durationMonths > 1 ? durationMonths : 6;
      setDurationMonths(d);
      setAmount(d * monthlyRate);
    }
  }

  if (!open || !resident) return null;

  const startLabel = coveredMonths[0] ? `${coveredMonths[0].month} ${coveredMonths[0].year}` : "";
  const endLabel = coveredMonths.length > 0 ? `${coveredMonths[coveredMonths.length - 1].month} ${coveredMonths[coveredMonths.length - 1].year}` : "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      await onCollect({
        method,
        remarks,
        amount: method === "Exempted" ? 0 : Number(amount),
        monthlyRate: Number(monthlyRate),
        isAdvance: isAdvance && durationMonths > 1,
        durationMonths: isAdvance ? Number(durationMonths) : 1,
        startMonth,
        startYear: Number(startYear),
        coveredMonths,
        date: new Date().toLocaleDateString("en-IN"),
        time: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b p-5 sm:p-6 bg-gradient-to-r from-gray-50 to-emerald-50/40 shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FaMoneyBillWave className="text-emerald-600 text-lg sm:text-xl" />
              Collect Garbage Payment
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {resident.flat} • {resident.owner || resident.name} {resident.block ? `(${resident.block})` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Mode Switcher: Single Month vs Advance Multi-Month */}
          <div className="bg-gray-100 p-1 rounded-2xl flex items-center gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleToggleAdvance(false)}
              className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                !isAdvance
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FaCalendarAlt /> Single Month
            </button>
            <button
              type="button"
              onClick={() => handleToggleAdvance(true)}
              className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                isAdvance
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FaLayerGroup /> Advance Payment (Multi-Month)
            </button>
          </div>

          {/* If Advance Payment: Quick presets & Months Selector */}
          {isAdvance ? (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Select Advance Duration
                </span>
                <span className="text-[11px] font-semibold text-emerald-800">
                  Rate: ₹{monthlyRate}/mo
                </span>
              </div>

              {/* Preset Buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {[2, 3, 6, 10, 12].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSelectDuration(num)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition border text-center ${
                      durationMonths === num
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-gray-700 border-gray-200 hover:border-emerald-300"
                    }`}
                  >
                    {num} Mo
                  </button>
                ))}
              </div>

              {/* Start Month and Duration Inputs */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Start Month
                  </label>
                  <select
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl p-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {MONTH_NAMES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Number of Months
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="36"
                    value={durationMonths}
                    onChange={(e) => handleSelectDuration(Number(e.target.value) || 1)}
                    className="w-full bg-white border border-gray-200 rounded-xl p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Visual Coverage Preview Box */}
              <div className="bg-white rounded-xl p-3 border border-emerald-100 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Covered Period:</span>
                  <span className="font-bold text-emerald-900">
                    {startLabel} → {endLabel} ({coveredMonths.length} Months)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 pt-1 max-h-20 overflow-y-auto">
                  {coveredMonths.map((cm, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200"
                    >
                      {cm.month.slice(0, 3)} {cm.year}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Single Month selector */
            <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-lg shrink-0">
                  <FaCalendarAlt />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-blue-700 font-bold">
                    Billing Period
                  </p>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                    {displayMonth} {displayYear}
                  </h3>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-blue-900 bg-blue-100 px-2.5 py-1 rounded-lg">
                1 Month
              </span>
            </div>
          )}

          {/* Amount & Monthly Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Monthly Rate (₹)
              </label>
              <input
                type="number"
                min="0"
                value={monthlyRate}
                onChange={(e) => handleMonthlyRateChange(e.target.value)}
                disabled={submitting || method === "Exempted"}
                className="w-full border rounded-xl p-2.5 text-sm font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {isAdvance ? `Total Amount (₹) [${durationMonths} Mo]` : "Collection Amount (₹)"}
              </label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting || method === "Exempted"}
                className="w-full border rounded-xl p-2.5 text-sm font-mono font-extrabold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={submitting}
              className="w-full border rounded-xl p-2.5 text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Cash">💵 Cash</option>
              <option value="UPI">⚡ UPI</option>
              <option value="Bank Transfer">🏦 Bank Transfer</option>
              <option value="Exempted">🛡️ Exempted (Waive Fee)</option>
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Remarks (Optional)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={submitting}
              placeholder={isAdvance ? `Advance payment for ${durationMonths} months` : "e.g. Received in cash"}
              className="w-full border rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm ${
                method === "Exempted"
                  ? "bg-gray-700 hover:bg-gray-800"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {submitting ? (
                "Recording..."
              ) : method === "Exempted" ? (
                "Mark Exempted"
              ) : isAdvance ? (
                `Collect ₹${Number(amount).toLocaleString()} (${durationMonths} Months Advance)`
              ) : (
                `Collect ₹${Number(amount).toLocaleString()}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
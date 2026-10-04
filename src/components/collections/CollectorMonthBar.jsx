import { useMemo } from "react";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaRedo,
  FaClock,
} from "react-icons/fa";
import { useBilling } from "../../context/BillingContext";
import {
  MONTH_NAMES,
  COLLECTION_START_YEAR,
  COLLECTION_START_MONTH,
  isPriorToCollectionStart,
  getAvailableBillingYears,
  getAvailableBillingMonths,
} from "../../utils/billingCycle";

export default function CollectorMonthBar({
  title = "Billing Period",
  subtitle = "Filter & collect records month-wise",
  className = "",
  compact = false,
  showStatusPill = true,
  month: customMonth,
  year: customYear,
  onMonthChange: customOnMonthChange,
  onYearChange: customOnYearChange,
}) {
  const billing = useBilling();

  const selectedMonth = customMonth || billing?.selectedMonth || COLLECTION_START_MONTH;
  const selectedYear = customYear || billing?.selectedYear || COLLECTION_START_YEAR;

  const setSelectedMonth = customOnMonthChange || billing?.setSelectedMonth || (() => {});
  const setSelectedYear = customOnYearChange || billing?.setSelectedYear || (() => {});

  const now = new Date();
  const currentMonthName = now.toLocaleString("default", { month: "long" });
  const currentYearNum = now.getFullYear();

  const isCurrentMonth =
    selectedMonth === currentMonthName && Number(selectedYear) === currentYearNum;

  const currentMonthIndex = MONTH_NAMES.indexOf(currentMonthName);
  const selectedMonthIndex = MONTH_NAMES.indexOf(selectedMonth);

  const isPastMonth =
    Number(selectedYear) < currentYearNum ||
    (Number(selectedYear) === currentYearNum && selectedMonthIndex < currentMonthIndex);

  const years = useMemo(() => getAvailableBillingYears(3), []);
  const availableMonths = useMemo(() => getAvailableBillingMonths(selectedYear), [selectedYear]);

  const isPrevDisabled =
    Number(selectedYear) <= COLLECTION_START_YEAR &&
    selectedMonth === COLLECTION_START_MONTH;

  function handlePrevMonth() {
    if (isPrevDisabled) return;
    const idx = MONTH_NAMES.indexOf(selectedMonth);
    if (idx <= 0) {
      const prevYear = Number(selectedYear) - 1;
      if (prevYear >= COLLECTION_START_YEAR) {
        setSelectedMonth(MONTH_NAMES[11]);
        setSelectedYear(prevYear);
      }
    } else {
      const prevMonth = MONTH_NAMES[idx - 1];
      if (!isPriorToCollectionStart(prevMonth, selectedYear)) {
        setSelectedMonth(prevMonth);
      }
    }
  }

  function handleNextMonth() {
    const idx = MONTH_NAMES.indexOf(selectedMonth);
    if (idx >= 11) {
      setSelectedMonth(MONTH_NAMES[0]);
      setSelectedYear(Number(selectedYear) + 1);
    } else {
      setSelectedMonth(MONTH_NAMES[idx + 1]);
    }
  }

  function handleResetCurrent() {
    if (isPriorToCollectionStart(currentMonthName, currentYearNum)) {
      setSelectedMonth(COLLECTION_START_MONTH);
      setSelectedYear(COLLECTION_START_YEAR);
    } else {
      setSelectedMonth(currentMonthName);
      setSelectedYear(currentYearNum);
    }
  }

  if (compact) {
    return (
      <div
        className={`bg-white rounded-2xl shadow-sm border border-emerald-100 p-2.5 flex items-center justify-between gap-2 ${className}`}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={isPrevDisabled}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-100 disabled:hover:text-gray-600 flex items-center justify-center transition active:scale-95"
            title={isPrevDisabled ? "Collection starts September 2026" : "Previous Month"}
          >
            <FaChevronLeft className="text-xs" />
          </button>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent font-bold text-xs sm:text-sm text-gray-800 border-none outline-none cursor-pointer py-1"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent font-semibold text-xs sm:text-sm text-gray-500 border-none outline-none cursor-pointer py-1"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 flex items-center justify-center transition active:scale-95"
            title="Next Month"
          >
            <FaChevronRight className="text-xs" />
          </button>
        </div>

        {!isCurrentMonth && (
          <button
            type="button"
            onClick={handleResetCurrent}
            className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg flex items-center gap-1 transition shrink-0"
            title="Jump to Current Month"
          >
            <FaRedo className="text-[9px]" /> Current
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-emerald-100/80 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-lg shadow-sm shadow-emerald-500/20 shrink-0">
          <FaCalendarAlt />
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
              {title}
            </h3>
            {showStatusPill && (
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isCurrentMonth
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : isPastMonth
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}
              >
                {isCurrentMonth ? "Active Cycle" : isPastMonth ? "Past Record" : "Future Cycle"}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Month & Year Navigation Controls */}
      <div className="flex items-center gap-2 bg-gray-50/80 border border-gray-200/80 p-1.5 rounded-xl self-stretch sm:self-auto justify-between sm:justify-start">
        {/* Prev Month */}
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={isPrevDisabled}
          className="w-8 h-8 rounded-lg bg-white shadow-xs border border-gray-200 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
          title={isPrevDisabled ? "Collection starts September 2026" : "Previous Month"}
        >
          <FaChevronLeft className="text-[11px]" />
        </button>

        {/* Month Selector */}
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="appearance-none bg-white border border-gray-200 font-bold text-xs sm:text-sm text-gray-800 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer focus:ring-2 focus:ring-emerald-500 outline-none pr-6"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-gray-400 text-[10px]">
            ▼
          </div>
        </div>


        {/* Year Selector */}
        <div className="relative">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="appearance-none bg-white border border-gray-200 font-semibold text-xs sm:text-sm text-gray-700 px-2.5 py-1.5 rounded-lg shadow-xs cursor-pointer focus:ring-2 focus:ring-emerald-500 outline-none pr-5"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-gray-400 text-[10px]">
            ▼
          </div>
        </div>

        {/* Next Month */}
        <button
          type="button"
          onClick={handleNextMonth}
          className="w-8 h-8 rounded-lg bg-white shadow-xs border border-gray-200 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
          title="Next Month"
        >
          <FaChevronRight className="text-[11px]" />
        </button>

        {/* Quick jump to current month */}
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={handleResetCurrent}
            className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition shadow-xs active:scale-95 cursor-pointer shrink-0"
            title="Jump back to current month"
          >
            <FaClock className="text-[10px]" />
            <span className="hidden xs:inline">Today</span>
          </button>
        )}
      </div>
    </div>
  );
}

import { useBilling } from "../../context/BillingContext";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function MonthSelector() {
  const {
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
  } = useBilling();

  const currentYear = new Date().getFullYear();

  const years = [];

  for (let year = currentYear - 5; year <= currentYear + 5; year++) {
    years.push(year);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center justify-between">

      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800">
          Billing Period
        </h2>

        <p className="text-slate-500 text-xs sm:text-sm">
          Select month and year
        </p>
      </div>

      <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3 w-full sm:w-auto">

        <select
          value={selectedMonth}
          onChange={(e) =>
            setSelectedMonth(e.target.value)
          }
          className="border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium bg-slate-50 sm:bg-white focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-auto"
        >
          {months.map((month) => (
            <option
              key={month}
              value={month}
            >
              {month}
            </option>
          ))}
        </select>

        <select
          value={selectedYear}
          onChange={(e) =>
            setSelectedYear(Number(e.target.value))
          }
          className="border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium bg-slate-50 sm:bg-white focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-auto"
        >
          {years.map((year) => (
            <option
              key={year}
              value={year}
            >
              {year}
            </option>
          ))}
        </select>

      </div>

    </div>
  );
}
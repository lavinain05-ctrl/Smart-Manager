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
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col md:flex-row gap-4 items-center justify-between">

      <div>

        <h2 className="text-xl font-bold">
          Billing Period
        </h2>

        <p className="text-gray-500 text-sm">
          Select month and year
        </p>

      </div>

      <div className="flex gap-3">

        <select
          value={selectedMonth}
          onChange={(e) =>
            setSelectedMonth(e.target.value)
          }
          className="border rounded-xl px-4 py-3"
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
          className="border rounded-xl px-4 py-3"
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
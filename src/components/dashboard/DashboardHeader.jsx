import { FaCalendarAlt } from "react-icons/fa";

export default function DashboardHeader() {
  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-5">

      <div>
        <h1 className="text-4xl font-bold text-gray-800">
          Dashboard
        </h1>

        <p className="text-gray-500 mt-2">
          Welcome to Smart Garbage Manager
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm px-5 py-4 flex items-center gap-3">

        <FaCalendarAlt className="text-emerald-600 text-xl" />

        <div>

          <p className="text-sm text-gray-500">
            Today
          </p>

          <h3 className="font-semibold">
            {formattedDate}
          </h3>

        </div>

      </div>

    </div>
  );
}
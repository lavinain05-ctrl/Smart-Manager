import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Doughnut } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

export default function PaymentPieChart({
  residents,
  payments,
}) {
  const totalResidents = residents.length;

  const paidResidents = payments.length;

  const pendingResidents =
    totalResidents - paidResidents;

  const data = {
    labels: [
      "Paid Residents",
      "Pending Residents",
    ],

    datasets: [
      {
        data: [
          paidResidents,
          pendingResidents,
        ],

        backgroundColor: [
          "#10B981",
          "#EF4444",
        ],

        borderColor: [
          "#FFFFFF",
          "#FFFFFF",
        ],

        borderWidth: 3,

        hoverOffset: 8,
      },
    ],
  };

  const options = {
    responsive: true,

    maintainAspectRatio: false,

    cutout: "65%",

    plugins: {
      legend: {
        position: "bottom",

        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 13,
          },
        },
      },

      tooltip: {
        callbacks: {
          label(context) {
            return `${context.label}: ${context.raw}`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">

      <div className="mb-5">

        <h2 className="text-xl font-bold">
          Monthly Payment Status
        </h2>

        <p className="text-gray-500 text-sm">
          Current Month Collection
        </p>

      </div>

      <div className="h-72">

        <Doughnut
          data={data}
          options={options}
        />

      </div>

      <div className="mt-6 border-t pt-4 space-y-3">

        <div className="flex justify-between">

          <span>Total Residents</span>

          <strong>{totalResidents}</strong>

        </div>

        <div className="flex justify-between">

          <span className="text-green-600">
            Paid
          </span>

          <strong>
            {paidResidents}
          </strong>

        </div>

        <div className="flex justify-between">

          <span className="text-red-600">
            Pending
          </span>

          <strong>
            {pendingResidents}
          </strong>

        </div>

      </div>

    </div>
  );
}
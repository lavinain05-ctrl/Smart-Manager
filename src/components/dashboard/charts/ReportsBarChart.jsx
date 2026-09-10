import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

export default function ReportsBarChart({
  residents,
  payments,
}) {
  const totalResidents = residents.length;

  const paidResidents = payments.length;

  const pendingResidents =
    totalResidents - paidResidents;

  const collectedAmount = payments.reduce(
    (sum, payment) =>
      sum + Number(payment.amount || 0),
    0
  );

  const expectedAmount = residents.reduce(
    (sum, resident) =>
      sum + Number(resident.charge || 0),
    0
  );

  const pendingAmount =
    expectedAmount - collectedAmount;

  const data = {
    labels: [
      "Paid Residents",
      "Pending Residents",
      "Collected ₹",
      "Pending ₹",
    ],

    datasets: [
      {
        label: "Monthly Report",

        data: [
          paidResidents,
          pendingResidents,
          collectedAmount,
          pendingAmount,
        ],

        backgroundColor: [
          "#10B981",
          "#EF4444",
          "#3B82F6",
          "#F59E0B",
        ],

        borderRadius: 10,

        borderSkipped: false,
      },
    ],
  };

  const options = {
    responsive: true,

    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: false,
      },

      tooltip: {
        callbacks: {
          label(context) {
            const index =
              context.dataIndex;

            if (index < 2) {
              return `${context.raw} Residents`;
            }

            return `₹${Number(
              context.raw
            ).toLocaleString()}`;
          },
        },
      },
    },

    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">

      <div className="mb-6">

        <h2 className="text-2xl font-bold">
          Monthly Collection Report
        </h2>

        <p className="text-gray-500">
          Residents & Financial Summary
        </p>

      </div>

      <div className="h-96">

        <Bar
          data={data}
          options={options}
        />

      </div>

    </div>
  );
}
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

export default function CollectionChart({
  residents,
  payments,
}) {
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
      "Collected",
      "Pending",
    ],

    datasets: [
      {
        label: "Amount (₹)",

        data: [
          collectedAmount,
          pendingAmount,
        ],

        backgroundColor: [
          "#10B981",
          "#EF4444",
        ],

        borderRadius: 12,

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
            return (
              "₹" +
              Number(context.raw).toLocaleString()
            );
          },
        },
      },
    },

    scales: {
      y: {
        beginAtZero: true,

        ticks: {
          callback(value) {
            return (
              "₹" +
              Number(value).toLocaleString()
            );
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">

      <div className="flex justify-between items-center mb-6">

        <div>

          <h2 className="text-xl font-bold">
            Monthly Collection
          </h2>

          <p className="text-gray-500 text-sm">
            Current month's financial status
          </p>

        </div>

      </div>

      <div className="h-80">

        <Bar
          data={data}
          options={options}
        />

      </div>

    </div>
  );
}
import {
  FaFileInvoiceDollar,
  FaCheckCircle,
  FaClock,
  FaBan,
  FaExclamationTriangle,
  FaMoneyBillWave,
} from "react-icons/fa";

function Card({
  title,
  value,
  color,
  icon,
}) {
  return (
    <div
      className={`${color} text-white rounded-2xl p-5 shadow-lg`}
    >
      <div className="flex items-center justify-between">

        <div>

          <p className="text-sm opacity-90">
            {title}
          </p>

          <h2 className="text-3xl font-bold mt-2">
            {value}
          </h2>

        </div>

        <div className="text-4xl opacity-80">
          {icon}
        </div>

      </div>
    </div>
  );
}

export default function BillSummaryCards({
  bills,
}) {
  const totalBills = bills.length;

  const paid = bills.filter(
    (b) => (b.displayStatus || b.status) === "Paid"
  ).length;

  const pending = bills.filter(
    (b) => (b.displayStatus || b.status) === "Pending"
  ).length;

  const exempted = bills.filter(
    (b) => (b.displayStatus || b.status) === "Exempted"
  ).length;

  const overdue = bills.filter(
    (b) => (b.displayStatus || b.status) === "Overdue"
  ).length;

  const totalAmount = bills.reduce(
    (sum, bill) =>
      sum + Number(bill.amount || 0),
    0
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5">

      <Card
        title="Bills"
        value={totalBills}
        color="bg-blue-600"
        icon={<FaFileInvoiceDollar />}
      />

      <Card
        title="Paid"
        value={paid}
        color="bg-green-600"
        icon={<FaCheckCircle />}
      />

      <Card
        title="Pending"
        value={pending}
        color="bg-yellow-500"
        icon={<FaClock />}
      />

      <Card
        title="Exempted"
        value={exempted}
        color="bg-gray-600"
        icon={<FaBan />}
      />

      <Card
        title="Overdue"
        value={overdue}
        color="bg-red-600"
        icon={<FaExclamationTriangle />}
      />

      <Card
        title="Amount"
        value={`₹${totalAmount.toLocaleString()}`}
        color="bg-emerald-700"
        icon={<FaMoneyBillWave />}
      />

    </div>
  );
}
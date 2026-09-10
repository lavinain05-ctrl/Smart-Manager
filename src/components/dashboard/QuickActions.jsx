import {
  FaUserPlus,
  FaMoneyBillWave,
  FaFileAlt,
  FaUserTie,
  FaHistory,
  FaPrint,
  FaRecycle,
  FaFileInvoiceDollar,
} from "react-icons/fa";

import { useNavigate } from "react-router-dom";

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      title: "Add Resident",
      icon: <FaUserPlus />,
      color: "bg-emerald-600 hover:bg-emerald-700",
      path: "/admin/residents",
    },
    {
      title: "New Collection",
      icon: <FaMoneyBillWave />,
      color: "bg-blue-600 hover:bg-blue-700",
      path: "/admin/collections",
    },
    {
      title: "GC Accounts",
      icon: <FaRecycle />,
      color: "bg-teal-600 hover:bg-teal-700",
      path: "/admin/garbage/accounts",
    },
    {
      title: "Bills",
      icon: <FaFileInvoiceDollar />,
      color: "bg-amber-600 hover:bg-amber-700",
      path: "/admin/bills",
    },
    {
      title: "Payment History",
      icon: <FaHistory />,
      color: "bg-cyan-600 hover:bg-cyan-700",
      path: "/admin/payment-history",
    },
    {
      title: "Receipts",
      icon: <FaPrint />,
      color: "bg-pink-600 hover:bg-pink-700",
      path: "/admin/receipts",
    },
    {
      title: "Reports",
      icon: <FaFileAlt />,
      color: "bg-orange-500 hover:bg-orange-600",
      path: "/admin/reports",
    },
    {
      title: "Collectors",
      icon: <FaUserTie />,
      color: "bg-purple-600 hover:bg-purple-700",
      path: "/admin/collectors",
    },
  ];

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6">

      <div className="mb-6">

        <h2 className="text-xl font-bold">
          Quick Actions
        </h2>

        <p className="text-gray-500 text-sm">
          Frequently used shortcuts
        </p>

      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        {actions.map((action) => (

          <button
            key={action.title}
            onClick={() => navigate(action.path)}
            className={`${action.color} text-white rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl`}
          >

            <div className="text-4xl flex justify-center mb-4">
              {action.icon}
            </div>

            <p className="font-semibold text-center">
              {action.title}
            </p>

          </button>

        ))}

      </div>

    </div>
  );
}
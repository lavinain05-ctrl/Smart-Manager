import { NavLink } from "react-router-dom";
import {
  FaRecycle,
  FaFileInvoiceDollar,
  FaHistory,
  FaReceipt,
} from "react-icons/fa";

const garbageNavItems = [
  {
    name: "Overview & Status",
    path: "/resident/garbage",
    icon: <FaRecycle />,
  },
  {
    name: "My Bills",
    path: "/resident/bills",
    icon: <FaFileInvoiceDollar />,
  },
  {
    name: "Payment History",
    path: "/resident/payments",
    icon: <FaHistory />,
  },
  {
    name: "Receipts",
    path: "/resident/receipts",
    icon: <FaReceipt />,
  },
];

export default function GarbageModuleTabs() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-2 mb-6 border border-emerald-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-base">
            <FaRecycle />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Garbage Collection Module</h2>
            <p className="text-[11px] text-gray-500">Manage your monthly waste collection, bills, and payments</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Resident Service
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {garbageNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20"
                  : "text-gray-600 hover:bg-emerald-50/70 hover:text-emerald-700"
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.name}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

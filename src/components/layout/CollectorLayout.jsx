import { useMemo } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  FaHome,
  FaMoneyBillWave,
  FaHistory,
  FaSignOutAlt,
  FaRecycle,
  FaTrash,
  FaBuilding,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../notifications/NotificationBell";

export default function CollectorLayout() {
  const { user, logout } = useAuth();

  const assignedModules = useMemo(() => {
    if (Array.isArray(user?.assignedModules) && user.assignedModules.length > 0) {
      return user.assignedModules;
    }
    return ["garbage"];
  }, [user?.assignedModules]);

  const hasGarbage = assignedModules.includes("garbage");

  const navItems = useMemo(() => {
    const items = [
      {
        name: "Dashboard",
        icon: <FaHome />,
        path: "/collector/dashboard",
      },
      {
        name: "Collect",
        icon: <FaMoneyBillWave />,
        path: "/collector/collect",
      },
      {
        name: "History",
        icon: <FaHistory />,
        path: "/collector/history",
      },
    ];

    if (hasGarbage) {
      items.push({
        name: "GC Collect",
        icon: <FaTrash />,
        path: "/collector/garbage/collect",
      });
      items.push({
        name: "GC History",
        icon: <FaRecycle />,
        path: "/collector/garbage/history",
      });
    }

    return items;
  }, [hasGarbage]);

  return (
    <div className="flex flex-col h-screen bg-slate-100">

      {/* Header */}
      <header className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between shadow-md shrink-0">

        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-lg bg-white text-emerald-700 flex items-center justify-center text-xl shrink-0">
            <FaBuilding />
          </div>

          <div>
            <h1 className="font-bold leading-tight">
              Smart Manager
            </h1>

            <p className="text-xs text-emerald-200">
              {user?.name || "Collector"}
            </p>
          </div>

        </div>

        <div className="flex items-center gap-3">
          <NotificationBell isDark={true} />
          <button
            onClick={logout}
            aria-label="Logout"
            className="text-white/90 hover:text-white text-xl p-2 rounded-xl hover:bg-white/10 transition"
          >
            <FaSignOutAlt />
          </button>
        </div>

      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg flex justify-around py-2">

        {navItems.map((item) => (

          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium transition ${
                isActive
                  ? "text-emerald-700"
                  : "text-gray-500"
              }`
            }
          >
            <span className="text-xl">
              {item.icon}
            </span>

            {item.name}
          </NavLink>

        ))}

      </nav>

    </div>
  );
}
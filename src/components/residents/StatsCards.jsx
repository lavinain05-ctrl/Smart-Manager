import {
  FaUsers,
  FaCheckCircle,
  FaClock,
  FaUserCheck,
  FaUserTimes,
  FaRecycle,
} from "react-icons/fa";

import {
  calcResidentStats,
} from "../../services/statisticsService";

export default function StatsCards({ residents, payments = [], gcMonthlyStats, onOpenPendingModal }) {
  // Use centralized statistics engine — never calculate inline
  const residentStats = calcResidentStats(residents);

  // GC stats from the centralized helper (passed from parent)
  const gcParticipants = gcMonthlyStats?.participants ?? 0;
  const gcPaid = gcMonthlyStats?.paidResidents ?? 0;
  const gcPending = gcMonthlyStats?.pendingResidents ?? 0;

  const cards = [
    // ── Resident Stats ──
    {
      title: "Total Residents",
      value: residentStats.total,
      icon: <FaUsers />,
      color: "bg-blue-500",
    },
    {
      title: "Active",
      value: residentStats.active,
      icon: <FaUserCheck />,
      color: "bg-emerald-500",
    },
    {
      title: "Inactive",
      value: residentStats.inactive,
      icon: <FaUserTimes />,
      color: "bg-gray-500",
    },
    // ── GC Stats (from centralized getGarbageMonthlyStats) ──
    {
      title: "GC Participating",
      value: gcParticipants,
      icon: <FaRecycle />,
      color: "bg-teal-500",
    },
    {
      title: "GC Paid",
      value: gcPaid,
      icon: <FaCheckCircle />,
      color: "bg-green-500",
    },
    {
      title: "GC Pending",
      value: gcPending,
      icon: <FaClock />,
      color: "bg-red-500",
      clickable: true,
      onClick: onOpenPendingModal,
      badge: "View List →",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">

      {cards.map((card) => {
        const isClickable = Boolean(card.clickable && card.onClick);
        return (
          <div
            key={card.title}
            onClick={isClickable ? card.onClick : undefined}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            title={isClickable ? "Click to view pending residents checklist" : undefined}
            className={`bg-white rounded-2xl shadow-sm hover:shadow-lg transition p-5 ${
              isClickable
                ? "cursor-pointer ring-1 ring-red-100 hover:ring-2 hover:ring-red-400 hover:scale-[1.02] active:scale-[0.98]"
                : ""
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-gray-500 text-xs">
                    {card.title}
                  </p>
                  {card.badge && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                      {card.badge}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-bold mt-2">
                  {card.value}
                </h2>
              </div>

              <div
                className={`${card.color} w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-sm`}
              >
                {card.icon}
              </div>
            </div>
          </div>
        );
      })}

    </div>
  );
}
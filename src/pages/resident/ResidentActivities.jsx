import { useState, useMemo } from "react";
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUser,
  FaSearch,
  FaFilter,
  FaLeaf,
  FaTree,
  FaHandshake,
  FaStar,
  FaBullhorn,
  FaTint,
  FaEllipsisH,
} from "react-icons/fa";

import { useActivities } from "../../context/ActivityContext";
import { ACTIVITY_CATEGORIES } from "../../services/activityService";

const categoryIcons = {
  "Cleaning Drive": <FaLeaf className="text-green-500" />,
  "Tree Plantation": <FaTree className="text-emerald-600" />,
  "Meeting": <FaHandshake className="text-blue-500" />,
  "Festival Celebration": <FaStar className="text-yellow-500" />,
  "Social Activity": <FaHandshake className="text-purple-500" />,
  "Awareness Campaign": <FaBullhorn className="text-orange-500" />,
  "Blood Donation": <FaTint className="text-red-500" />,
  "Other": <FaEllipsisH className="text-gray-400" />,
};

const STATUS_CONFIG = {
  upcoming: { label: "Upcoming", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
};

export default function ResidentActivities() {
  const { activities } = useActivities();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const filtered = useMemo(() => {
    return activities
      .filter((a) => a.status !== "cancelled")
      .filter((a) => {
        if (filterCategory !== "All" && a.category !== filterCategory) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            a.title?.toLowerCase().includes(s) ||
            a.category?.toLowerCase().includes(s) ||
            a.location?.toLowerCase().includes(s)
          );
        }
        return true;
      });
  }, [activities, search, filterCategory]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Society Activities</h1>
        <p className="text-gray-500">Stay updated with RWA activities and drives</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <FaFilter className="text-gray-400 text-sm" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="All">All Categories</option>
            {ACTIVITY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-500">
          <FaCalendarAlt className="text-6xl text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Activities</h2>
          <p className="mt-2">Check back later for upcoming activities.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((activity) => {
            const statusCfg = STATUS_CONFIG[activity.status] || STATUS_CONFIG.upcoming;

            return (
              <div key={activity.id} className="bg-white rounded-2xl shadow-sm border p-5 hover:shadow-md transition">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
                    {categoryIcons[activity.category] || categoryIcons.Other}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                        {activity.category}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">{activity.title}</h3>
                    {activity.description && (
                      <p className="text-gray-600 text-sm mt-1">{activity.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                      {activity.date && (
                        <span className="flex items-center gap-1">
                          <FaCalendarAlt className="text-xs" /> {activity.date}
                          {activity.time && ` at ${activity.time}`}
                        </span>
                      )}
                      {activity.location && (
                        <span className="flex items-center gap-1">
                          <FaMapMarkerAlt className="text-xs" /> {activity.location}
                        </span>
                      )}
                      {activity.organizer && (
                        <span className="flex items-center gap-1">
                          <FaUser className="text-xs" /> {activity.organizer}
                        </span>
                      )}
                    </div>
                    {activity.highlights && (
                      <p className="text-sm text-gray-500 mt-2 italic">✨ {activity.highlights}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

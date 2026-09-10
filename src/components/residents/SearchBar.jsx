import { useState, useMemo } from "react";
import { FaSearch, FaFilter, FaTimes, FaChevronDown } from "react-icons/fa";

export default function SearchBar({
  search,
  setSearch,
  filters,
  onFilterChange,
  blocks = [],
  addedByCollectors = [],
  addedByCommittee = [],
}) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== "all") count++;
    if (filters.gc !== "all") count++;
    if (filters.payment !== "all") count++;
    if (filters.block !== "all") count++;
    if (filters.addedBy && filters.addedBy !== "all") count++;
    return count;
  }, [filters]);

  function handleChange(key, value) {
    onFilterChange({ ...filters, [key]: value });
  }

  function resetFilters() {
    onFilterChange({ status: "all", gc: "all", payment: "all", block: "all", addedBy: "all" });
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">

      <div className="flex flex-col md:flex-row gap-4">

        <div className="relative flex-1">
          <FaSearch className="absolute left-4 top-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Flat, Owner, Mobile or Block..."
            className="w-full border rounded-xl pl-12 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`border rounded-xl px-5 flex items-center justify-center gap-2 transition min-h-[48px] ${
            showFilters || activeFilterCount > 0
              ? "bg-emerald-50 border-emerald-300 text-emerald-700"
              : "hover:bg-gray-100"
          }`}
        >
          <FaFilter />
          Filter
          {activeFilterCount > 0 && (
            <span className="bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <FaChevronDown className={`text-xs transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* GC Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Garbage</label>
              <select
                value={filters.gc}
                onChange={(e) => handleChange("gc", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All</option>
                <option value="participating">Participating</option>
                <option value="not_participating">Not Participating</option>
              </select>
            </div>

            {/* Payment Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Payment</label>
              <select
                value={filters.payment}
                onChange={(e) => handleChange("payment", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Block Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Block</label>
              <select
                value={filters.block}
                onChange={(e) => handleChange("block", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All Blocks</option>
                {blocks.map((b) => (
                  <option key={b.id || b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Added By / Access Origin Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Access Origin</label>
              <select
                value={filters.addedBy || "all"}
                onChange={(e) => handleChange("addedBy", e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
              >
                <option value="all">All Origins</option>
                <option value="admin">🛡️ Admin</option>
                <option value="committee">🏛️ All Committee</option>
                <option value="collector">👤 All Collectors</option>
                {addedByCommittee.length > 0 && (
                  <optgroup label="Specific Committee Members">
                    {addedByCommittee.map((cmName) => (
                      <option key={cmName} value={`committee:${cmName}`}>
                        {cmName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {addedByCollectors.length > 0 && (
                  <optgroup label="Specific Collectors">
                    {addedByCollectors.map((colName) => (
                      <option key={colName} value={`collector:${colName}`}>
                        {colName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

          </div>

          {/* Reset button */}
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="mt-3 flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium transition"
            >
              <FaTimes className="text-xs" />
              Reset Filters
            </button>
          )}
        </div>
      )}

    </div>
  );
}
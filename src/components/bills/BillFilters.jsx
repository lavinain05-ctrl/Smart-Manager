import { FaSearch, FaFilter, FaBuilding, FaFileExcel, FaFilePdf, FaPrint } from "react-icons/fa";

export default function BillFilters({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  blockFilter = "All",
  setBlockFilter,
  blocks = [],
  onExportExcel,
  onExportPdf,
  onPrintBills,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <FaSearch className="absolute left-4 top-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Flat, Resident or Block..."
            className="w-full border rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>

        {/* Status Filter */}
        <div className="relative w-full lg:w-48">
          <FaFilter className="absolute left-4 top-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
          >
            <option value="All">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
            <option value="Exempted">Exempted</option>
          </select>
        </div>

        {/* Block Filter */}
        {setBlockFilter && (
          <div className="relative w-full lg:w-48">
            <FaBuilding className="absolute left-4 top-4 text-gray-400" />
            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="w-full border rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-white"
            >
              <option value="All">All Blocks</option>
              {blocks.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Export and Print Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {onPrintBills && (
            <button
              onClick={onPrintBills}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl text-sm font-semibold transition shadow-xs"
              title="Print All Monthly Bills (Block-Wise)"
            >
              <FaPrint className="text-purple-600" />
              <span>Print (Block-Wise)</span>
            </button>
          )}
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-sm font-semibold transition"
              title="Export to Excel"
            >
              <FaFileExcel className="text-emerald-600" />
              <span>Excel</span>
            </button>
          )}
          {onExportPdf && (
            <button
              onClick={onExportPdf}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-3 border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-semibold transition"
              title="Export to PDF"
            >
              <FaFilePdf className="text-red-600" />
              <span>PDF</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
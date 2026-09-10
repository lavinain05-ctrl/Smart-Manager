import {
  FaChevronLeft,
  FaChevronRight,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
} from "react-icons/fa";

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, "all"],
}) {
  const isAll = pageSize === "all" || pageSize === "All";
  const numericPageSize = isAll ? Math.max(1, totalItems) : (Number(pageSize) || 25);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / numericPageSize));
  const safePage = isAll ? 1 : Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : isAll ? 1 : (safePage - 1) * numericPageSize + 1;
  const endItem = isAll ? totalItems : Math.min(safePage * numericPageSize, totalItems);

  function getPageNumbers() {
    if (isAll) return [1];
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) {
        pages.push("...");
      }

      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (safePage < totalPages - 2) {
        pages.push("...");
      }
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  }

  if (totalItems <= numericPageSize && safePage === 1 && !onPageSizeChange) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-gray-100 text-sm">
      {/* Count & Page Size */}
      <div className="flex items-center gap-3 text-gray-500 text-xs sm:text-sm">
        <span>
          Showing <strong className="text-gray-800">{startItem}</strong> to{" "}
          <strong className="text-gray-800">{endItem}</strong> of{" "}
          <strong className="text-gray-800">{totalItems}</strong> entries
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-gray-400">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const raw = e.target.value;
                const val = (raw === "all" || raw === "All") ? "all" : Number(raw);
                onPageSizeChange(val);
                if (onPageChange) onPageChange(1);
              }}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white text-gray-700 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-medium"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "all" || opt === "All" ? "All" : opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={safePage === 1}
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition"
          title="First Page"
        >
          <FaAngleDoubleLeft />
        </button>

        <button
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage === 1}
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition"
          title="Previous Page"
        >
          <FaChevronLeft />
        </button>

        {getPageNumbers().map((p, idx) =>
          p === "..." ? (
            <span key={`dots-${idx}`} className="px-2 text-gray-400 text-xs">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition ${
                safePage === p
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage === totalPages}
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition"
          title="Next Page"
        >
          <FaChevronRight />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safePage === totalPages}
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition"
          title="Last Page"
        >
          <FaAngleDoubleRight />
        </button>
      </div>
    </div>
  );
}

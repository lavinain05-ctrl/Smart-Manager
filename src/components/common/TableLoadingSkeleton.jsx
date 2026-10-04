import React from "react";
import { FaSpinner } from "react-icons/fa";

/**
 * Reusable professional skeleton loader for summary / stat cards at the top of pages.
 */
export function StatCardsSkeleton({ count = 4, className = "grid grid-cols-2 md:grid-cols-4 gap-3" }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl p-4 bg-slate-50/80 border border-slate-100 animate-pulse relative overflow-hidden"
        >
          <div className="h-7 w-14 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-20 bg-slate-200/80 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Reusable professional table skeleton loader with realistic rows, badges, and shimmer effects.
 */
export function TableLoadingSkeleton({
  rows = 5,
  cols = 6,
  message = "Loading records...",
  subMessage = "Synchronizing live society database",
}) {
  const widths = ["w-16", "w-32", "w-24", "w-28", "w-20", "w-16", "w-24"];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Top micro-indicator */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaSpinner className="animate-spin text-emerald-600 text-xs" />
          <span className="text-xs font-semibold text-slate-700">{message}</span>
        </div>
        <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
          {subMessage}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              {Array.from({ length: cols }).map((_, idx) => (
                <th key={idx} className="p-4 text-left">
                  <div className="h-3.5 bg-slate-200/90 rounded w-16 animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50/50 transition">
                {Array.from({ length: cols }).map((_, cIdx) => {
                  const widthClass = widths[(rIdx + cIdx) % widths.length];
                  return (
                    <td key={cIdx} className="p-4">
                      {cIdx === 0 ? (
                        <div className="h-3.5 bg-slate-200 rounded w-14 font-mono animate-pulse" />
                      ) : cIdx === 1 ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0 animate-pulse" />
                          <div className="h-3.5 bg-slate-200 rounded w-28 animate-pulse" />
                        </div>
                      ) : cIdx === cols - 2 ? (
                        <div className="h-6 w-20 bg-slate-200 rounded-lg animate-pulse" />
                      ) : (
                        <div className={`h-3.5 bg-slate-200 rounded ${widthClass} animate-pulse`} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Reusable card grid skeleton loader for card-based pages (e.g. notices, events, activities, campaigns).
 */
export function CardGridSkeleton({ count = 6, colsClass = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" }) {
  return (
    <div className={colsClass}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-slate-200" />
            <div className="h-5 w-16 rounded-md bg-slate-200" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-5/6" />
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="h-3 bg-slate-200 rounded w-20" />
            <div className="h-3 bg-slate-200 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default TableLoadingSkeleton;

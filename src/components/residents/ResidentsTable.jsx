import { useState, useMemo, useEffect } from "react";
import { FaEdit, FaTrash, FaRecycle, FaKey, FaBan } from "react-icons/fa";
import toast from "react-hot-toast";

import { updateGarbageStatus } from "../../services/residentService";
import { logActivity } from "../../services/activityLogService";
import { isGcParticipating } from "../../services/statisticsService";
import Pagination from "../common/Pagination";

const GC_STATUSES = [
  { value: "participating", label: "Participating", color: "bg-green-100 text-green-700" },
  { value: "not_participating", label: "Not Participating", color: "bg-gray-100 text-gray-600" },
  { value: "temporary_stopped", label: "Temp. Stopped", color: "bg-yellow-100 text-yellow-700" },
  { value: "inactive", label: "Inactive", color: "bg-red-100 text-red-700" },
];

export default function ResidentsTable({
  residents,
  payments = [],
  bills = [],
  gcMonthlyStats = {},
  onEdit,
  onDelete,
  onResetPassword,
  onBlock,
}) {
  const [gcDropdown, setGcDropdown] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 whenever search/filters change residents list length
  useEffect(() => {
    setPage(1);
  }, [residents.length]);

  const pagedResidents = useMemo(() => {
    if (pageSize === "all" || pageSize === "All" || Number(pageSize) >= residents.length) {
      return residents;
    }
    const numericPageSize = Number(pageSize) || 25;
    const start = (page - 1) * numericPageSize;
    return residents.slice(start, start + numericPageSize);
  }, [residents, page, pageSize]);

  // Centralized set of paid resident IDs from gcMonthlyStats (computed for current billing period)
  const paidResidentIds = useMemo(() => {
    if (gcMonthlyStats?.paidResidentIds) {
      return gcMonthlyStats.paidResidentIds instanceof Set
        ? gcMonthlyStats.paidResidentIds
        : new Set(gcMonthlyStats.paidResidentIds);
    }
    // Fallback if gcMonthlyStats is not provided
    const set = new Set();
    (payments || []).forEach((p) => {
      if (p.residentId) set.add(p.residentId);
    });
    (bills || [])
      .filter((b) => b.status === "Paid" || b.status === "Exempted")
      .forEach((b) => {
        if (b.residentId) set.add(b.residentId);
      });
    return set;
  }, [gcMonthlyStats, payments, bills]);

  async function handleGcChange(residentId, status) {
    const resident = residents.find((r) => r.id === residentId);
    const oldStatus = resident?.garbageStatus || "not_participating";
    try {
      await updateGarbageStatus(residentId, status);

      await logActivity({
        action: `Changed GC status: ${oldStatus.replace("_", " ")} → ${status.replace("_", " ")}`,
        category: "gc",
        performedBy: "admin",
        performedByName: "Admin",
        targetId: residentId,
        targetName: resident?.owner || "Resident",
        details: `Flat: ${resident?.flat || "—"}`,
      });

      toast.success(`GC status updated to ${status.replace("_", " ")}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update GC status");
    }
    setGcDropdown(null);
  }

  if (residents.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
        <h2 className="text-xl font-semibold text-gray-700">
          No Residents Found
        </h2>

        <p className="text-gray-500 mt-2">
          Add your first resident to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
      <table className="w-full min-w-[1100px]">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-4 text-left">Flat</th>
            <th className="p-4 text-left">Owner</th>
            <th className="p-4 text-left">Mobile</th>
            <th className="p-4 text-left">Block</th>
            <th className="p-4 text-left">Charge</th>
            <th className="p-4 text-left">Payment</th>
            <th className="p-4 text-left">GC Status</th>
            <th className="p-4 text-left">Access Origin</th>
            <th className="p-4 text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {pagedResidents.map((resident) => {
            const isParticipating = isGcParticipating(resident);
            let effectiveGcStatus = resident.garbageStatus || resident.gcStatus;
            if (!effectiveGcStatus || (effectiveGcStatus === "not_participating" && isParticipating)) {
              effectiveGcStatus = isParticipating ? "participating" : "not_participating";
            }
            const gcConfig = GC_STATUSES.find((s) => s.value === effectiveGcStatus) || GC_STATUSES[1];

            // For participating residents: check GC payment via centralized stats
            // For non-participating: show N/A
            let paymentDisplay;
            let chargeDisplay;

            if (isParticipating) {
              const isPaid = paidResidentIds.has(resident.id);
              paymentDisplay = (
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    isPaid
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {isPaid ? "Paid" : "Pending"}
                </span>
              );
              chargeDisplay = `₹${Number(resident.charge) > 0 ? resident.charge : 80}`;
            } else {
              paymentDisplay = (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
                  N/A
                </span>
              );
              chargeDisplay = "₹0";
            }

            return (
              <tr
                key={resident.id}
                className="border-t hover:bg-gray-50 transition"
              >
                <td className="p-4 font-semibold">{resident.flat}</td>

                <td className="p-4">{resident.owner}</td>

                <td className="p-4">{resident.mobile}</td>

                <td className="p-4">{resident.block}</td>

                <td className="p-4">{chargeDisplay}</td>

                <td className="p-4">
                  {paymentDisplay}
                </td>

                {/* GC Status with dropdown */}
                <td className="p-4 relative">
                  <button
                    onClick={() => setGcDropdown(gcDropdown === resident.id ? null : resident.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer flex items-center gap-1.5 ${gcConfig.color}`}
                  >
                    <FaRecycle className="text-[10px]" />
                    {gcConfig.label}
                  </button>

                  {gcDropdown === resident.id && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border z-50 w-48 py-1">
                      {GC_STATUSES.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => handleGcChange(resident.id, s.value)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition flex items-center gap-2 ${
                            s.value === effectiveGcStatus ? "font-bold bg-gray-50" : ""
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${s.color.split(" ")[0]}`} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </td>

                {/* Access Origin / Provenance */}
                <td className="p-4">
                  {(() => {
                    const prov = resident.accessProvenance;
                    if (prov) {
                      const role = (prov.grantedByRole || "").toLowerCase();
                      const name = prov.grantedByName || "Official";
                      const desig = prov.grantedByDesignation ? `(${prov.grantedByDesignation})` : "";
                      const channelLabel =
                        prov.channel === "registration_approval"
                          ? "Approved Registration"
                          : prov.channel === "committee_portal"
                          ? "Committee Created"
                          : prov.channel === "collector_creation"
                          ? "Collector Onboarded"
                          : "Direct Admin Entry";
                      const dateStr = prov.grantedAt ? new Date(prov.grantedAt).toLocaleDateString("en-IN") : "";
                      const tooltip = `Access granted via ${channelLabel} by ${name} ${desig}${dateStr ? ` on ${dateStr}` : ""}`;

                      if (role === "committee") {
                        return (
                          <div title={tooltip} className="cursor-help inline-flex flex-col items-start">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-full text-xs font-semibold shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                              Committee: {name}
                            </span>
                            <span className="text-[10px] text-purple-600 font-medium pl-2 mt-0.5">
                              {prov.grantedByDesignation || "Member"} {dateStr ? `• ${dateStr}` : ""}
                            </span>
                          </div>
                        );
                      }

                      if (role === "collector") {
                        return (
                          <div title={tooltip} className="cursor-help inline-flex flex-col items-start">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              Collector: {name}
                            </span>
                            <span className="text-[10px] text-blue-600 font-medium pl-2 mt-0.5">
                              Onboarded {dateStr ? `• ${dateStr}` : ""}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div title={tooltip} className="cursor-help inline-flex flex-col items-start">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-semibold shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Admin: {name}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-medium pl-2 mt-0.5">
                            {channelLabel} {dateStr ? `• ${dateStr}` : ""}
                          </span>
                        </div>
                      );
                    }

                    if (resident.createdBy === "Collector") {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Collector: {resident.createdByName || resident.collectorName || "Collector"}
                        </span>
                      );
                    }

                    if (resident.createdBy === "Committee") {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                          Committee: {resident.createdByName || "Committee Member"}
                        </span>
                      );
                    }

                    return (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        {resident.createdByName && resident.createdByName !== "Admin" ? `Admin (${resident.createdByName})` : "Admin"}
                      </span>
                    );
                  })()}
                </td>

                <td className="p-4">
                  <div className="flex justify-center items-center gap-3">
                    <button
                      onClick={() => onBlock && onBlock(resident)}
                      title={
                        resident.isBlocked || resident.status === "Blocked"
                          ? "Account is Blocked — Click to manage or unblock"
                          : "Block or Temporarily Suspend Login"
                      }
                      className={`p-1.5 rounded-lg transition text-sm ${
                        resident.isBlocked || resident.status === "Blocked"
                          ? "text-red-600 bg-red-100 hover:bg-red-200 shadow-sm"
                          : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                      }`}
                    >
                      <FaBan />
                    </button>

                    <button
                      onClick={() => onResetPassword && onResetPassword(resident)}
                      title="Reset Password"
                      className="text-amber-600 hover:text-amber-800 p-1.5 rounded-lg hover:bg-amber-50 transition text-sm"
                    >
                      <FaKey />
                    </button>

                    <button
                      onClick={() => onEdit(resident)}
                      title="Edit Resident"
                      className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 transition"
                    >
                      <FaEdit />
                    </button>

                    <button
                      onClick={() => onDelete(resident.id)}
                      title="Delete Resident"
                      className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 transition"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {residents.length > 0 && (
        <Pagination
          currentPage={page}
          totalItems={residents.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[25, 50, 100, "all"]}
        />
      )}
    </div>
  );
}
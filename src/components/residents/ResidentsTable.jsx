import { useState, useMemo, useEffect } from "react";
import {
  FaEdit,
  FaTrash,
  FaRecycle,
  FaKey,
  FaBan,
  FaEye,
  FaBuilding,
  FaCrown,
  FaCar,
  FaPhoneAlt,
  FaCheckCircle,
  FaClock,
  FaUser,
  FaUserFriends,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaThLarge,
  FaTable,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { updateGarbageStatus } from "../../services/residentService";
import { logActivity } from "../../services/activityLogService";
import { isGcParticipating } from "../../services/statisticsService";
import { formatResidentFloor } from "../../services/propertyService";
import Pagination from "../common/Pagination";

const GC_STATUSES = [
  { value: "participating", label: "Participating", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "not_participating", label: "Not Participating", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "temporary_stopped", label: "Temp. Stopped", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "inactive", label: "Inactive", color: "bg-rose-50 text-rose-700 border-rose-200" },
];

function getFloorBadge(floor) {
  const raw = String(floor || "").trim().toLowerCase();
  if (raw.includes("penthouse") || raw === "ph") {
    return {
      label: "Penthouse",
      icon: <FaCrown className="text-purple-600 text-[11px]" />,
      className: "bg-purple-50 text-purple-700 border-purple-200/80",
    };
  }
  if (raw.includes("1st") || raw.includes("first") || raw === "1f" || raw === "1") {
    return {
      label: "1st Floor",
      icon: <FaBuilding className="text-emerald-600 text-[11px]" />,
      className: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    };
  }
  if (raw.includes("2nd") || raw.includes("second") || raw === "2f" || raw === "2") {
    return {
      label: "2nd Floor",
      icon: <FaBuilding className="text-blue-600 text-[11px]" />,
      className: "bg-blue-50 text-blue-700 border-blue-200/80",
    };
  }
  if (raw.includes("3rd") || raw.includes("third") || raw === "3f" || raw === "3") {
    return {
      label: "3rd Floor",
      icon: <FaBuilding className="text-blue-600 text-[11px]" />,
      className: "bg-blue-50 text-blue-700 border-blue-200/80",
    };
  }
  if (raw.includes("4th") || raw.includes("fourth") || raw === "4f" || raw === "4") {
    return {
      label: "4th Floor",
      icon: <FaBuilding className="text-blue-600 text-[11px]" />,
      className: "bg-blue-50 text-blue-700 border-blue-200/80",
    };
  }
  if (raw.includes("stilt") || raw.includes("parking")) {
    return {
      label: "Stilt Floor",
      icon: <FaCar className="text-amber-600 text-[11px]" />,
      className: "bg-amber-50 text-amber-700 border-amber-200/80",
    };
  }
  if (raw.includes("base") || raw.includes("b1") || raw.includes("b2")) {
    return {
      label: "Basement",
      icon: <FaBuilding className="text-slate-600 text-[11px]" />,
      className: "bg-slate-100 text-slate-700 border-slate-200/80",
    };
  }
  return {
    label: formatResidentFloor(floor) || "Ground Floor",
    icon: <FaBuilding className="text-blue-600 text-[11px]" />,
    className: "bg-blue-50 text-blue-700 border-blue-200/80",
  };
}

export default function ResidentsTable({
  residents,
  payments = [],
  bills = [],
  gcMonthlyStats = {},
  onViewDetails,
  onEdit,
  onDelete,
  onResetPassword,
  onBlock,
}) {
  const [gcDropdown, setGcDropdown] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [viewMode, setViewMode] = useState("auto"); // "auto", "table", "card"

  // Reset to page 1 whenever search/filters change residents list length
  useEffect(() => {
    setPage(1);
  }, [residents.length]);

  const handleSort = (key) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortKey(null);
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Centralized set of paid resident IDs from gcMonthlyStats (computed for current billing period)
  const paidResidentIds = useMemo(() => {
    if (gcMonthlyStats?.paidResidentIds) {
      return gcMonthlyStats.paidResidentIds instanceof Set
        ? gcMonthlyStats.paidResidentIds
        : new Set(gcMonthlyStats.paidResidentIds);
    }
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

  const sortedResidents = useMemo(() => {
    if (!sortKey) return residents;
    return [...residents].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      if (sortKey === "flat") {
        aVal = a.flat || a.plotNumber || "";
        bVal = b.flat || b.plotNumber || "";
      } else if (sortKey === "floor") {
        aVal = a.floor || "";
        bVal = b.floor || "";
      } else if (sortKey === "owner") {
        aVal = a.owner || "";
        bVal = b.owner || "";
      } else if (sortKey === "mobile") {
        aVal = a.mobile || "";
        bVal = b.mobile || "";
      } else if (sortKey === "block") {
        aVal = a.block || "";
        bVal = b.block || "";
      } else if (sortKey === "charge") {
        const numA = Number(a.charge) || 0;
        const numB = Number(b.charge) || 0;
        return sortDirection === "asc" ? numA - numB : numB - numA;
      } else if (sortKey === "payment") {
        const isPaidA = paidResidentIds.has(a.id) ? 1 : 0;
        const isPaidB = paidResidentIds.has(b.id) ? 1 : 0;
        return sortDirection === "asc" ? isPaidA - isPaidB : isPaidB - isPaidA;
      } else if (sortKey === "gcStatus") {
        aVal = a.garbageStatus || a.gcStatus || "";
        bVal = b.garbageStatus || b.gcStatus || "";
      } else if (sortKey === "accessOrigin") {
        aVal = a.accessProvenance?.grantedByName || a.createdByName || a.createdBy || "";
        bVal = b.accessProvenance?.grantedByName || b.createdByName || b.createdBy || "";
      }
      return sortDirection === "asc"
        ? String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
        : String(bVal).localeCompare(String(aVal), undefined, { numeric: true });
    });
  }, [residents, sortKey, sortDirection, paidResidentIds]);

  const pagedResidents = useMemo(() => {
    if (pageSize === "all" || pageSize === "All" || Number(pageSize) >= sortedResidents.length) {
      return sortedResidents;
    }
    const numericPageSize = Number(pageSize) || 25;
    const start = (page - 1) * numericPageSize;
    return sortedResidents.slice(start, start + numericPageSize);
  }, [sortedResidents, page, pageSize]);

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

  const renderSortIcon = (columnKey) => {
    if (sortKey !== columnKey) {
      return <FaSort className="text-[10px] text-slate-300 group-hover:text-slate-500 transition shrink-0" />;
    }
    if (sortDirection === "asc") {
      return <FaSortUp className="text-[11px] text-blue-600 shrink-0" />;
    }
    return <FaSortDown className="text-[11px] text-blue-600 shrink-0" />;
  };

  const getOriginBadge = (resident) => {
    const prov = resident.accessProvenance;
    if (prov) {
      const role = (prov.grantedByRole || "").toLowerCase();
      const name = prov.grantedByName || "Official";

      if (role === "collector") {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs">
            <FaUserFriends className="text-[11px]" /> Collector: {name}
          </span>
        );
      }
      if (role === "committee") {
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200/80 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs">
            <FaUserFriends className="text-[11px]" /> Committee: {name}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-medium whitespace-nowrap shadow-2xs">
          <FaUser className="text-[10px] text-slate-400" /> Admin: {name}
        </span>
      );
    }

    if (resident.createdBy === "Collector") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs">
          <FaUserFriends className="text-[11px]" /> Collector: {resident.createdByName || resident.collectorName || "Alok"}
        </span>
      );
    }

    if (resident.createdBy === "Committee") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200/80 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs">
          <FaUserFriends className="text-[11px]" /> Committee: {resident.createdByName || "Member"}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-medium whitespace-nowrap shadow-2xs">
        <FaUser className="text-[10px] text-slate-400" /> Admin
      </span>
    );
  };

  if (residents.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center border border-slate-200/80">
        <h2 className="text-xl font-semibold text-gray-700">No Residents Found</h2>
        <p className="text-gray-500 mt-2">Add your first resident to get started.</p>
      </div>
    );
  }

  const isCardViewActive = viewMode === "card";
  const isTableViewActive = viewMode === "table";

  return (
    <div className="space-y-3">
      {/* View Switcher (for devices / user preference) */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-400 font-medium hidden sm:block">
          Showing {pagedResidents.length} of {residents.length} resident records
        </p>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl ml-auto border border-slate-200/80">
          <button
            onClick={() => setViewMode("auto")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
              viewMode === "auto"
                ? "bg-white text-blue-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Auto-responsive (Table on laptop/tablet, Cards on phone)"
          >
            Auto
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition ${
              isTableViewActive
                ? "bg-white text-blue-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Force Table View"
          >
            <FaTable className="text-[10px]" /> Table
          </button>
          <button
            onClick={() => setViewMode("card")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg flex items-center gap-1 transition ${
              isCardViewActive
                ? "bg-white text-blue-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Force Mobile Cards View"
          >
            <FaThLarge className="text-[10px]" /> Cards
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DESKTOP & TABLET TABLE VIEW (Pixel-perfect to user image)
         ═══════════════════════════════════════════════════════════ */}
      <div
        className={`bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden ${
          isCardViewActive ? "hidden" : viewMode === "auto" ? "hidden md:block" : "block"
        }`}
      >
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
          <table className="w-full text-left border-collapse min-w-[1080px]">
            <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-xs font-bold uppercase tracking-wider select-none">
              <tr>
                <th className="py-3.5 px-4 text-center w-12 text-slate-400">#</th>

                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleSort("flat")}
                    className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-bold"
                  >
                    <span>Flat</span>
                    {renderSortIcon("flat")}
                  </button>
                </th>

                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleSort("floor")}
                    className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-bold"
                  >
                    <span>Floor</span>
                    {renderSortIcon("floor")}
                  </button>
                </th>

                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleSort("owner")}
                    className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-bold"
                  >
                    <span>Owner</span>
                    {renderSortIcon("owner")}
                  </button>
                </th>

                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleSort("mobile")}
                    className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-bold"
                  >
                    <span>Mobile</span>
                    {renderSortIcon("mobile")}
                  </button>
                </th>

                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleSort("block")}
                    className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-bold"
                  >
                    <span>Block</span>
                    {renderSortIcon("block")}
                  </button>
                </th>

                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleSort("charge")}
                    className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-bold"
                  >
                    <span>Charge</span>
                    {renderSortIcon("charge")}
                  </button>
                </th>

                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleSort("payment")}
                    className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-bold"
                  >
                    <span>Payment</span>
                    {renderSortIcon("payment")}
                  </button>
                </th>

                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleSort("gcStatus")}
                    className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-bold"
                  >
                    <span>GC Status</span>
                    {renderSortIcon("gcStatus")}
                  </button>
                </th>

                <th className="py-3.5 px-4">
                  <button
                    onClick={() => handleSort("accessOrigin")}
                    className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition font-bold"
                  >
                    <span>Access Origin</span>
                    {renderSortIcon("accessOrigin")}
                  </button>
                </th>

                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {pagedResidents.map((resident, idx) => {
                const serialNum = (page - 1) * (Number(pageSize) || 25) + idx + 1;
                const isParticipating = isGcParticipating(resident);
                let effectiveGcStatus = resident.garbageStatus || resident.gcStatus;
                if (!effectiveGcStatus || (effectiveGcStatus === "not_participating" && isParticipating)) {
                  effectiveGcStatus = isParticipating ? "participating" : "not_participating";
                }
                const gcConfig = GC_STATUSES.find((s) => s.value === effectiveGcStatus) || GC_STATUSES[1];
                const isPaid = paidResidentIds.has(resident.id);
                const chargeDisplay = isParticipating ? `₹${Number(resident.charge) > 0 ? resident.charge : 80}` : "₹0";
                const floorBadge = getFloorBadge(resident.floor);

                return (
                  <tr
                    key={resident.id}
                    className="hover:bg-slate-50/70 transition-colors duration-150 group"
                  >
                    {/* # Serial Column */}
                    <td className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400">
                      {serialNum}
                    </td>

                    {/* Flat Badge Column (Matching Screenshot) */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => onViewDetails && onViewDetails(resident)}
                        className="inline-flex items-center px-3 py-1.5 rounded-xl font-extrabold text-blue-700 bg-blue-50/90 hover:bg-blue-100 border border-blue-200/90 text-xs sm:text-sm tracking-wide shadow-2xs transition whitespace-nowrap cursor-pointer active:scale-95"
                        title="Click to view complete resident details"
                      >
                        {resident.flat || resident.plotNumber || "—"}
                      </button>
                    </td>

                    {/* Floor Column with contextual colored pill */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-2xs whitespace-nowrap ${floorBadge.className}`}
                      >
                        {floorBadge.icon}
                        <span>{floorBadge.label}</span>
                      </span>
                    </td>

                    {/* Owner Column with Avatar Circle */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                          {resident.owner ? resident.owner.charAt(0).toUpperCase() : <FaUser className="text-[10px]" />}
                        </div>
                        <button
                          onClick={() => onViewDetails && onViewDetails(resident)}
                          className="font-semibold text-slate-800 hover:text-blue-600 hover:underline cursor-pointer text-left text-sm truncate max-w-[180px]"
                          title="Click to view complete resident details"
                        >
                          {resident.owner}
                        </button>
                      </div>
                    </td>

                    {/* Mobile Column with Blue Phone Icon */}
                    <td className="py-3.5 px-4">
                      <a
                        href={`tel:${resident.mobile}`}
                        className="inline-flex items-center gap-2 text-slate-700 hover:text-blue-600 font-medium text-sm whitespace-nowrap group/phone"
                        title="Call resident"
                      >
                        <FaPhoneAlt className="text-blue-500 group-hover/phone:scale-110 transition text-xs shrink-0" />
                        <span>{resident.mobile}</span>
                      </a>
                    </td>

                    {/* Block Column */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-700 text-xs sm:text-sm uppercase tracking-wide whitespace-nowrap">
                        {resident.block || "—"}
                      </span>
                    </td>

                    {/* Charge Column */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                        {chargeDisplay}
                      </span>
                    </td>

                    {/* Payment Column (Clock Pending / Check Paid) */}
                    <td className="py-3.5 px-4">
                      {isParticipating ? (
                        isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shadow-2xs">
                            <FaCheckCircle className="text-[11px]" /> Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 whitespace-nowrap shadow-2xs">
                            <FaClock className="text-[11px]" /> Pending
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                          N/A
                        </span>
                      )}
                    </td>

                    {/* GC Status with Dropdown */}
                    <td className="py-3.5 px-4 relative">
                      <button
                        onClick={() => setGcDropdown(gcDropdown === resident.id ? null : resident.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap shadow-2xs cursor-pointer hover:opacity-90 transition active:scale-95 ${gcConfig.color}`}
                        title="Click to toggle or update GC status"
                      >
                        <FaRecycle className="text-[11px]" />
                        <span>{gcConfig.label}</span>
                      </button>

                      {gcDropdown === resident.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 w-48 py-1 animate-fadeIn">
                          {GC_STATUSES.map((s) => (
                            <button
                              key={s.value}
                              onClick={() => handleGcChange(resident.id, s.value)}
                              className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition flex items-center gap-2 ${
                                s.value === effectiveGcStatus ? "font-bold bg-slate-50 text-blue-700" : "text-slate-700"
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
                    <td className="py-3.5 px-4">
                      {getOriginBadge(resident)}
                    </td>

                    {/* Actions Column (5 sleek rounded square buttons matching screenshot) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                        {/* 1. View Details (Blue eye) */}
                        <button
                          onClick={() => onViewDetails && onViewDetails(resident)}
                          title="View Profile Details"
                          className="p-2 rounded-xl text-blue-600 bg-blue-50/70 border border-blue-200 hover:bg-blue-100 transition shadow-2xs cursor-pointer active:scale-90"
                        >
                          <FaEye className="text-xs" />
                        </button>

                        {/* 2. Block / Suspend (Slate ban) */}
                        <button
                          onClick={() => onBlock && onBlock(resident)}
                          title={
                            resident.isBlocked || resident.status === "Blocked"
                              ? "Account is Blocked — Click to manage"
                              : "Block / Suspend Login"
                          }
                          className={`p-2 rounded-xl transition shadow-2xs cursor-pointer active:scale-90 ${
                            resident.isBlocked || resident.status === "Blocked"
                              ? "text-red-700 bg-red-100 border border-red-300"
                              : "text-slate-400 bg-slate-50 border border-slate-200 hover:text-red-600 hover:bg-red-50"
                          }`}
                        >
                          <FaBan className="text-xs" />
                        </button>

                        {/* 3. Reset Password / Key (Amber key) */}
                        <button
                          onClick={() => onResetPassword && onResetPassword(resident)}
                          title="Reset Password Credentials"
                          className="p-2 rounded-xl text-amber-500 bg-amber-50/70 border border-amber-200 hover:bg-amber-100 transition shadow-2xs cursor-pointer active:scale-90"
                        >
                          <FaKey className="text-xs" />
                        </button>

                        {/* 4. Edit (Blue edit) */}
                        <button
                          onClick={() => onEdit(resident)}
                          title="Edit Resident"
                          className="p-2 rounded-xl text-blue-600 bg-blue-50/70 border border-blue-200 hover:bg-blue-100 transition shadow-2xs cursor-pointer active:scale-90"
                        >
                          <FaEdit className="text-xs" />
                        </button>

                        {/* 5. Delete (Red trash) */}
                        <button
                          onClick={() => onDelete(resident.id)}
                          title="Delete Resident"
                          className="p-2 rounded-xl text-rose-600 bg-rose-50/70 border border-rose-200 hover:bg-rose-100 transition shadow-2xs cursor-pointer active:scale-90"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE / TOUCH-OPTIMIZED CARD VIEW (Android & iOS Devices)
         ═══════════════════════════════════════════════════════════ */}
      <div
        className={`space-y-3 ${
          isTableViewActive ? "hidden" : viewMode === "auto" ? "block md:hidden" : "block"
        }`}
      >
        {pagedResidents.map((resident, idx) => {
          const serialNum = (page - 1) * (Number(pageSize) || 25) + idx + 1;
          const isParticipating = isGcParticipating(resident);
          let effectiveGcStatus = resident.garbageStatus || resident.gcStatus;
          if (!effectiveGcStatus || (effectiveGcStatus === "not_participating" && isParticipating)) {
            effectiveGcStatus = isParticipating ? "participating" : "not_participating";
          }
          const gcConfig = GC_STATUSES.find((s) => s.value === effectiveGcStatus) || GC_STATUSES[1];
          const isPaid = paidResidentIds.has(resident.id);
          const chargeDisplay = isParticipating ? `₹${Number(resident.charge) > 0 ? resident.charge : 80}` : "₹0";
          const floorBadge = getFloorBadge(resident.floor);

          return (
            <div
              key={resident.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 space-y-3.5 transition active:scale-[0.99]"
            >
              {/* Card Header: # Serial, Flat Pill, and Payment Status */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">
                    {serialNum}
                  </span>
                  <button
                    onClick={() => onViewDetails && onViewDetails(resident)}
                    className="inline-flex items-center px-3 py-1 rounded-xl font-extrabold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs sm:text-sm tracking-wide shadow-2xs"
                  >
                    {resident.flat || resident.plotNumber || "—"}
                  </button>
                </div>

                {/* Payment Badge */}
                {isParticipating ? (
                  isPaid ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                      <FaCheckCircle className="text-[10px]" /> Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs">
                      <FaClock className="text-[10px]" /> Pending
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                    N/A
                  </span>
                )}
              </div>

              {/* Owner Info & 1-Tap Call */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold shrink-0">
                    {resident.owner ? resident.owner.charAt(0).toUpperCase() : <FaUser />}
                  </div>
                  <div className="min-w-0">
                    <h4
                      onClick={() => onViewDetails && onViewDetails(resident)}
                      className="font-bold text-slate-900 text-sm truncate cursor-pointer hover:text-blue-600"
                    >
                      {resident.owner}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {resident.block || "No Block"}
                    </span>
                  </div>
                </div>

                {/* 1-Tap Phone Button for Android & iOS */}
                <a
                  href={`tel:${resident.mobile}`}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs shrink-0 active:scale-95"
                >
                  <FaPhoneAlt className="text-[10px]" />
                  <span>{resident.mobile}</span>
                </a>
              </div>

              {/* Floor, Charge, GC Status, & Origin Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-2.5 flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] font-semibold uppercase">Floor</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${floorBadge.className}`}
                  >
                    {floorBadge.icon}
                    <span>{floorBadge.label}</span>
                  </span>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-2.5 flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] font-semibold uppercase">Charge</span>
                  <span className="font-extrabold text-slate-900 text-xs">{chargeDisplay}</span>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-2.5 flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] font-semibold uppercase">GC Service</span>
                  <button
                    onClick={() => setGcDropdown(gcDropdown === resident.id ? null : resident.id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${gcConfig.color}`}
                  >
                    <FaRecycle className="text-[9px]" />
                    <span>{gcConfig.label}</span>
                  </button>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-2.5 flex items-center justify-between">
                  <span className="text-slate-400 text-[10px] font-semibold uppercase">Origin</span>
                  <span className="truncate max-w-[110px] text-right">{getOriginBadge(resident)}</span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-around gap-2">
                <button
                  onClick={() => onViewDetails && onViewDetails(resident)}
                  className="flex-1 py-2 rounded-xl text-blue-700 bg-blue-50/80 border border-blue-200 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs"
                >
                  <FaEye className="text-xs" /> View
                </button>

                <button
                  onClick={() => onResetPassword && onResetPassword(resident)}
                  className="p-2.5 rounded-xl text-amber-600 bg-amber-50 border border-amber-200 active:scale-95 shadow-2xs"
                  title="Reset Password"
                >
                  <FaKey className="text-xs" />
                </button>

                <button
                  onClick={() => onBlock && onBlock(resident)}
                  className={`p-2.5 rounded-xl border active:scale-95 shadow-2xs ${
                    resident.isBlocked || resident.status === "Blocked"
                      ? "text-red-700 bg-red-100 border-red-300"
                      : "text-slate-500 bg-slate-50 border-slate-200"
                  }`}
                  title="Block / Suspend"
                >
                  <FaBan className="text-xs" />
                </button>

                <button
                  onClick={() => onEdit(resident)}
                  className="p-2.5 rounded-xl text-blue-600 bg-blue-50 border border-blue-200 active:scale-95 shadow-2xs"
                  title="Edit Resident"
                >
                  <FaEdit className="text-xs" />
                </button>

                <button
                  onClick={() => onDelete(resident.id)}
                  className="p-2.5 rounded-xl text-rose-600 bg-rose-50 border border-rose-200 active:scale-95 shadow-2xs"
                  title="Delete Resident"
                >
                  <FaTrash className="text-xs" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {residents.length > 0 && (
        <Pagination
          currentPage={page}
          totalItems={sortedResidents.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100, "all"]}
        />
      )}
    </div>
  );
}
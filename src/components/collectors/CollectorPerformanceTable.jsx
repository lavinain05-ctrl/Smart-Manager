import { useMemo } from "react";
import {
  FaEdit,
  FaTrash,
  FaEye,
  FaKey,
  FaMoneyBillWave,
  FaWallet,
  FaMobileAlt,
  FaUniversity,
  FaBan,
  FaUnlock,
  FaShieldAlt,
} from "react-icons/fa";
import {
  matchesCollector,
  isValidConfirmedSpecialPayment,
  normalizePaymentMethod,
} from "../../utils/collectorHelper";

export default function CollectorPerformanceTable({
  collectors = [],
  payments = [],
  allPayments = [],
  specialPayments = [],
  allSpecialPayments = [],
  todayGcPayments = [],
  todayScPayments = [],
  collectionScope = "all", // "all" | "garbage" | "special"
  periodType = "today",
  periodLabel = "",
  onEdit,
  onDelete,
  onView,
  onResetPassword,
  onBlock,
}) {
  const collectorStats = useMemo(() => {
    return collectors.map((collector) => {
      // 1. Garbage Collections for active period
      const gcPayments = payments.filter((p) => matchesCollector(p, collector));
      const gcTotal = gcPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const gcToday = (todayGcPayments.length > 0 ? todayGcPayments : gcPayments)
        .filter((p) => matchesCollector(p, collector))
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const gcCash = gcPayments
        .filter((p) => normalizePaymentMethod(p) === "Cash")
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const gcUPI = gcPayments
        .filter((p) => normalizePaymentMethod(p) === "UPI")
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const gcBank = gcPayments
        .filter((p) => normalizePaymentMethod(p) === "Bank Transfer")
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const gcCount = gcPayments.length;

      // 2. Special Collections for active period (Confirmed only)
      const scPayments = (specialPayments || []).filter(
        (p) => matchesCollector(p, collector) && isValidConfirmedSpecialPayment(p)
      );
      const scTotal = scPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const scToday = (todayScPayments.length > 0 ? todayScPayments : scPayments)
        .filter((p) => matchesCollector(p, collector) && isValidConfirmedSpecialPayment(p))
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const scCash = scPayments
        .filter((p) => normalizePaymentMethod(p) === "Cash")
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const scUPI = scPayments
        .filter((p) => normalizePaymentMethod(p) === "UPI")
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const scBank = scPayments
        .filter((p) => normalizePaymentMethod(p) === "Bank Transfer")
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const scCount = scPayments.length;

      // Combined or Scoped values
      let displayTotal;
      let displayToday;
      let displayCash;
      let displayUPI;
      let displayBank;
      let displayCount;

      if (collectionScope === "garbage") {
        displayTotal = gcTotal;
        displayToday = gcToday;
        displayCash = gcCash;
        displayUPI = gcUPI;
        displayBank = gcBank;
        displayCount = gcCount;
      } else if (collectionScope === "special") {
        displayTotal = scTotal;
        displayToday = scToday;
        displayCash = scCash;
        displayUPI = scUPI;
        displayBank = scBank;
        displayCount = scCount;
      } else {
        // "all" Combined
        displayTotal = gcTotal + scTotal;
        displayToday = gcToday + scToday;
        displayCash = gcCash + scCash;
        displayUPI = gcUPI + scUPI;
        displayBank = gcBank + scBank;
        displayCount = gcCount + scCount;
      }

      // Most recent payment across all history
      const sourceGc = allPayments && allPayments.length > 0 ? allPayments : payments;
      const sourceSc = allSpecialPayments && allSpecialPayments.length > 0 ? allSpecialPayments : specialPayments;

      const allColPayments = [
        ...sourceGc.filter((p) => matchesCollector(p, collector)).map((p) => ({ ...p, _type: "gc" })),
        ...sourceSc.filter((p) => matchesCollector(p, collector) && isValidConfirmedSpecialPayment(p)).map((p) => ({ ...p, _type: "sc" })),
      ].sort((a, b) => {
        const tsA = Number((a.receiptNumber || "").replace(/[^0-9]/g, "")) || 0;
        const tsB = Number((b.receiptNumber || "").replace(/[^0-9]/g, "")) || 0;
        return tsB - tsA;
      });

      const lastPayment = allColPayments[0] || null;

      return {
        ...collector,
        gcTotal,
        gcToday,
        gcCash,
        gcUPI,
        gcBank,
        gcCount,
        scTotal,
        scToday,
        scCash,
        scUPI,
        scBank,
        scCount,
        displayTotal,
        displayToday,
        displayCash,
        displayUPI,
        displayBank,
        displayCount,
        lastDate: lastPayment?.paymentDate || "-",
        lastTime: lastPayment?.paymentTime || "-",
      };
    });
  }, [
    collectors,
    payments,
    allPayments,
    specialPayments,
    allSpecialPayments,
    todayGcPayments,
    todayScPayments,
    collectionScope,
  ]);

  if (collectors.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
        <h2 className="text-xl font-semibold text-gray-700">No Collectors Found</h2>
        <p className="text-gray-500 mt-2">Add your first collector to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-x-auto border border-gray-100">
      <table className="w-full min-w-[1250px]">
        <thead className="bg-gray-50/80 border-b">
          <tr>
            <th className="p-4 text-left font-bold text-gray-600">Collector</th>
            <th className="p-4 text-left font-bold text-gray-600">Status</th>
            <th className="p-4 text-left font-bold text-gray-600">Assigned Powers</th>
            <th className="p-4 text-right font-bold text-gray-700">
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <span>{periodType === "all_time" ? "All-Time Total" : `${periodLabel || "Period"} Total`}</span>
                {collectionScope === "all" ? (
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">ALL</span>
                ) : collectionScope === "garbage" ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">GC</span>
                ) : (
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">SC</span>
                )}
              </div>
            </th>
            <th className="p-4 text-right font-bold text-gray-700">
              {periodType === "particular" ? "Day Total" : "Today"}
            </th>
            <th className="p-4 text-center font-bold text-gray-700">Receipts</th>
            <th className="p-4 text-right font-bold text-gray-600">
              <span className="flex items-center justify-end gap-1"><FaWallet className="text-green-600" /> Cash</span>
            </th>
            <th className="p-4 text-right font-bold text-gray-600">
              <span className="flex items-center justify-end gap-1"><FaMobileAlt className="text-purple-600" /> UPI</span>
            </th>
            <th className="p-4 text-right font-bold text-gray-600">
              <span className="flex items-center justify-end gap-1"><FaUniversity className="text-blue-600" /> Bank</span>
            </th>
            <th className="p-4 text-left font-bold text-gray-600">Last Collection</th>
            <th className="p-4 text-center font-bold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {collectorStats.map((c) => (
            <tr key={c.id} className="border-t hover:bg-emerald-50/30 transition">
              <td className="p-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-800">{c.name}</h3>
                    {c.isAdmin && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">
                        🏛️ Society Office / Admin
                      </span>
                    )}
                    {c.isCommittee && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200">
                        {c.designation || "Committee"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{c.area} • {c.mobile}</p>
                </div>
              </td>
              <td className="p-4">
                {c.isAdmin ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                    System Office
                  </span>
                ) : c.isBlocked || c.status?.toLowerCase() === "blocked" ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1 w-fit">
                    <FaBan className="text-[10px]" /> Blocked
                  </span>
                ) : (
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    c.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  }`}>
                    {c.status || "Active"}
                  </span>
                )}
              </td>
              <td className="p-4">
                <div className="flex flex-col gap-1">
                  {(!c.assignedModules || c.assignedModules.includes("garbage")) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 w-fit">
                      🗑️ Garbage
                    </span>
                  )}
                  {c.assignedModules && c.assignedModules.includes("special_collections") && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-100 text-indigo-800 w-fit">
                      💝 Special
                      {c.assignedCampaigns && c.assignedCampaigns.length > 0 ? (
                        <span className="bg-indigo-200 text-indigo-900 rounded px-1 text-[9px] font-bold">
                          {c.assignedCampaigns.length}
                        </span>
                      ) : (
                        <span className="text-[10px] text-indigo-600">(All)</span>
                      )}
                    </span>
                  )}
                </div>
              </td>
              <td className="p-4 text-right">
                <div className="font-extrabold text-gray-900 text-base">
                  ₹{c.displayTotal.toLocaleString()}
                </div>
                {collectionScope === "all" ? (
                  <div className="flex items-center justify-end gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title="Garbage Collection Total">
                      GC: ₹{c.gcTotal.toLocaleString()}
                    </span>
                    {c.scTotal > 0 && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200" title="Special Collections Total">
                        SC: ₹{c.scTotal.toLocaleString()}
                      </span>
                    )}
                  </div>
                ) : collectionScope === "garbage" ? (
                  <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                    Garbage Data ({periodLabel})
                  </div>
                ) : (
                  <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                    Special Collections ({periodLabel})
                  </div>
                )}
              </td>
              <td className="p-4 text-right">
                <div className="font-bold text-blue-600">₹{c.displayToday.toLocaleString()}</div>
                {collectionScope === "all" && (c.gcToday > 0 || c.scToday > 0) && (
                  <div className="text-[10px] text-gray-500 font-medium">
                    GC: ₹{c.gcToday.toLocaleString()} • SC: ₹{c.scToday.toLocaleString()}
                  </div>
                )}
              </td>
              <td className="p-4 text-center">
                {collectionScope === "all" ? (
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="bg-gray-800 text-white px-2.5 py-0.5 rounded-full text-xs font-bold">
                      {c.displayCount} Total
                    </span>
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                        {c.gcCount} GC
                      </span>
                      {c.scCount > 0 && (
                        <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                          {c.scCount} SC
                        </span>
                      )}
                    </div>
                  </div>
                ) : collectionScope === "garbage" ? (
                  <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    {c.gcCount} GC
                  </span>
                ) : (
                  <span className="bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
                    {c.scCount} SC
                  </span>
                )}
              </td>
              <td className="p-4 text-right text-green-700 font-semibold">₹{c.displayCash.toLocaleString()}</td>
              <td className="p-4 text-right text-purple-700 font-semibold">₹{c.displayUPI.toLocaleString()}</td>
              <td className="p-4 text-right text-blue-700 font-semibold">₹{c.displayBank.toLocaleString()}</td>
              <td className="p-4">
                <div className="text-sm">
                  <p className="font-medium text-gray-700">{c.lastDate}</p>
                  <p className="text-gray-400 text-xs">{c.lastTime}</p>
                </div>
              </td>
              <td className="p-4">
                {c.isAdmin ? (
                  <div className="text-center text-xs text-indigo-700 font-bold bg-indigo-50 py-1.5 px-3 rounded-lg border border-indigo-100">
                    Direct Office
                  </div>
                ) : (
                  <div className="flex justify-center gap-1.5">
                    <button onClick={() => onResetPassword && onResetPassword(c)} className="bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white p-2 rounded-lg transition" title="Reset Password">
                      <FaKey />
                    </button>
                    <button onClick={() => onView(c)} className="bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white p-2 rounded-lg transition" title="View Details">
                      <FaEye />
                    </button>
                    {!c.isCommittee && (
                      <button onClick={() => onEdit(c)} className="bg-yellow-50 hover:bg-yellow-500 text-yellow-600 hover:text-white p-2 rounded-lg transition" title="Edit Collector">
                        <FaEdit />
                      </button>
                    )}
                    <button
                      onClick={() => onBlock && onBlock(c)}
                      className={`p-2 rounded-lg transition ${
                        c.isBlocked || c.status?.toLowerCase() === "blocked"
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                          : "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
                      }`}
                      title={c.isBlocked || c.status?.toLowerCase() === "blocked" ? "Restore Access" : "Block / Suspend Collector"}
                    >
                      {c.isBlocked || c.status?.toLowerCase() === "blocked" ? <FaUnlock /> : <FaBan />}
                    </button>
                    {!c.isCommittee && (
                      <button onClick={() => onDelete(c.id)} className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white p-2 rounded-lg transition" title="Delete Collector">
                        <FaTrash />
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

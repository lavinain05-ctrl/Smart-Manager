import { useMemo } from "react";
import { FaEye } from "react-icons/fa";
import { matchesCollector } from "../../utils/collectorHelper";

export default function DailyReportTable({ collectors, payments, residents, onView }) {
  const expectedPerResident = useMemo(() => {
    const map = {};
    residents.forEach((r) => { map[r.id] = Number(r.charge || 0); });
    return map;
  }, [residents]);

  const totalExpected = residents.reduce((s, r) => s + Number(r.charge || 0), 0);

  const rows = useMemo(() => {
    // Build collector map from payments (includes admin collections)
    const collectorMap = {};

    collectors.forEach((c) => {
      const key = c.id || c.uid || c.name;
      collectorMap[key] = {
        id: c.id || c.uid,
        name: c.name,
        mobile: c.mobile || "-",
        uid: c.uid || c.id,
        status: c.status || "Active",
        isCommittee: c.isCommittee,
        designation: c.designation,
        payments: [],
      };
    });

    payments.forEach((p) => {
      const matched = collectors.find((c) => matchesCollector(p, c));
      if (matched) {
        const key = matched.id || matched.uid || matched.name;
        if (!collectorMap[key]) {
          collectorMap[key] = {
            id: matched.id || matched.uid,
            name: matched.name,
            mobile: matched.mobile || "-",
            uid: matched.uid || matched.id,
            status: matched.status || "Active",
            isCommittee: matched.isCommittee,
            designation: matched.designation,
            payments: [],
          };
        }
        collectorMap[key].payments.push(p);
      } else {
        const key = p.collector || "General / Admin";
        if (!collectorMap[key]) {
          collectorMap[key] = {
            id: key,
            name: key,
            mobile: "-",
            uid: null,
            status: "-",
            isCommittee: p.collectorRole === "committee",
            designation: p.collectorDesignation || "",
            payments: [],
          };
        }
        collectorMap[key].payments.push(p);
      }
    });

    return Object.values(collectorMap)
      .map((c) => {
        const cPayments = c.payments;
        const totalAmount = cPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const cash = cPayments.filter((p) => p.paymentMethod === "Cash").reduce((s, p) => s + Number(p.amount || 0), 0);
        const upi = cPayments.filter((p) => p.paymentMethod === "UPI").reduce((s, p) => s + Number(p.amount || 0), 0);
        const bank = cPayments.filter((p) => p.paymentMethod === "Bank Transfer").reduce((s, p) => s + Number(p.amount || 0), 0);
        const residentsCollected = new Set(cPayments.map((p) => p.residentId)).size;

        // Expected: proportional based on residents collected vs total
        const collectorExpected = totalExpected > 0 && collectors.length > 0
          ? Math.round(totalExpected / Math.max(collectors.length, 1))
          : 0;
        const pending = Math.max(0, collectorExpected - totalAmount);
        const pct = collectorExpected === 0 ? 0 : Math.round((totalAmount / collectorExpected) * 100);

        // Times
        const sorted = [...cPayments].sort((a, b) => {
          const tsA = Number((a.receiptNumber || "").replace("REC-", "")) || 0;
          const tsB = Number((b.receiptNumber || "").replace("REC-", "")) || 0;
          return tsA - tsB;
        });
        const firstTime = sorted[0]?.paymentTime || "-";
        const lastTime = sorted.length > 0 ? sorted[sorted.length - 1]?.paymentTime || "-" : "-";

        return {
          ...c,
          totalAmount,
          cash,
          upi,
          bank,
          residentsCollected,
          receipts: cPayments.length,
          collectorExpected,
          pending,
          pct,
          firstTime,
          lastTime,
        };
      })
      .filter((c) => c.payments.length > 0 || collectors.some((col) => col.name === c.name))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [collectors, payments, totalExpected]);

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
      <div className="p-5 border-b">
        <h2 className="text-xl font-bold text-gray-800">Collector-wise Report</h2>
        <p className="text-gray-500 text-sm">{rows.length} collectors</p>
      </div>
      <table className="w-full min-w-[1400px]">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="p-4 text-left text-sm font-bold text-gray-600">Collector</th>
            <th className="p-4 text-left text-sm font-bold text-gray-600">Mobile</th>
            <th className="p-4 text-center text-sm font-bold text-gray-600">Residents</th>
            <th className="p-4 text-right text-sm font-bold text-gray-600">Collected</th>
            <th className="p-4 text-right text-sm font-bold text-green-700">Cash</th>
            <th className="p-4 text-right text-sm font-bold text-purple-700">UPI</th>
            <th className="p-4 text-right text-sm font-bold text-blue-700">Bank</th>
            <th className="p-4 text-right text-sm font-bold text-gray-600">Expected</th>
            <th className="p-4 text-right text-sm font-bold text-red-600">Pending</th>
            <th className="p-4 text-center text-sm font-bold text-gray-600">%</th>
            <th className="p-4 text-center text-sm font-bold text-gray-600">Receipts</th>
            <th className="p-4 text-left text-sm font-bold text-gray-600">First</th>
            <th className="p-4 text-left text-sm font-bold text-gray-600">Last</th>
            <th className="p-4 text-center text-sm font-bold text-gray-600">View</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan="14" className="text-center py-16 text-gray-500">No data for the selected period</td></tr>
          ) : (
            rows.map((c) => (
              <tr key={c.id || c.name} className="border-t hover:bg-emerald-50/30 transition cursor-pointer" onClick={() => onView(c)}>
                <td className="p-4 font-bold text-gray-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{c.name}</span>
                    {c.isCommittee && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200">
                        {c.designation || "Committee"}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-sm text-gray-600">{c.mobile}</td>
                <td className="p-4 text-center">
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">{c.residentsCollected}</span>
                </td>
                <td className="p-4 text-right font-bold text-emerald-600">₹{c.totalAmount.toLocaleString()}</td>
                <td className="p-4 text-right text-green-700 font-medium">₹{c.cash.toLocaleString()}</td>
                <td className="p-4 text-right text-purple-700 font-medium">₹{c.upi.toLocaleString()}</td>
                <td className="p-4 text-right text-blue-700 font-medium">₹{c.bank.toLocaleString()}</td>
                <td className="p-4 text-right text-gray-600 font-medium">₹{c.collectorExpected.toLocaleString()}</td>
                <td className="p-4 text-right text-red-600 font-medium">₹{c.pending.toLocaleString()}</td>
                <td className="p-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    c.pct >= 80 ? "bg-green-100 text-green-700"
                    : c.pct >= 50 ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                  }`}>
                    {c.pct}%
                  </span>
                </td>
                <td className="p-4 text-center font-medium">{c.receipts}</td>
                <td className="p-4 text-sm text-gray-500">{c.firstTime}</td>
                <td className="p-4 text-sm text-gray-500">{c.lastTime}</td>
                <td className="p-4 text-center">
                  <button onClick={(e) => { e.stopPropagation(); onView(c); }} className="bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white p-2 rounded-lg transition">
                    <FaEye />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

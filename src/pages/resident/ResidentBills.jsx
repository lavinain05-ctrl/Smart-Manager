import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useBills } from "../../context/BillContext";
import { useBilling } from "../../context/BillingContext";
import { usePayments } from "../../context/PaymentContext";
import { useResidents } from "../../context/ResidentContext";
import { getDisplayStatus } from "../../utils/billStatus";
import { FaFileInvoiceDollar } from "react-icons/fa";
import GarbageModuleTabs from "../../components/resident/GarbageModuleTabs";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function ResidentBills() {
  const { user } = useAuth();
  const { bills } = useBills();
  const { payments = [] } = usePayments();
  const { selectedYear } = useBilling();
  const { residents = [] } = useResidents();

  const [monthFilter, setMonthFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const cleanPhone = useMemo(() => {
    const raw = user?.phone || user?.mobile || (user?.email?.includes("@") ? user.email.split("@")[0] : "");
    const digits = String(raw).replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }, [user]);

  const canonicalResident = useMemo(() => {
    return (
      residents.find((r) => r.id === user?.residentId || r.id === user?.uid) ||
      residents.find((r) => {
        if (!cleanPhone) return false;
        const rDigits = String(r.mobile || r.phone || "").replace(/\D/g, "");
        const rClean = rDigits.length >= 10 ? rDigits.slice(-10) : rDigits;
        return rClean === cleanPhone;
      }) ||
      residents.find(
        (r) =>
          user?.email &&
          !user.email.includes("firebaseapp.com") &&
          r.email?.toLowerCase() === user.email.toLowerCase()
      ) ||
      residents.find(
        (r) =>
          user?.name &&
          r.owner?.toLowerCase() === user.name.toLowerCase()
      ) ||
      null
    );
  }, [residents, user, cleanPhone]);

  const canonicalResidentId = canonicalResident?.id || user?.residentId || user?.uid;

  const myBills = useMemo(() => {
    // 1. Raw bills for this resident
    const rawBills = bills.filter(
      (b) =>
        b.residentId === canonicalResidentId ||
        b.residentId === user?.residentId ||
        b.residentId === user?.uid ||
        (canonicalResident?.id && b.residentId === canonicalResident.id)
    );

    // 2. Payments for this resident
    const residentPayments = payments.filter((p) => {
      if (p.residentId === canonicalResidentId || p.residentId === user?.residentId || p.residentId === user?.uid) {
        return true;
      }
      if (canonicalResident?.id && p.residentId === canonicalResident.id) {
        return true;
      }
      if (cleanPhone && p.mobile) {
        const pClean = String(p.mobile).replace(/\D/g, "").slice(-10);
        if (pClean === cleanPhone) return true;
      }
      const residentOwnerName = (canonicalResident?.owner || user?.name || "").trim().toLowerCase();
      if (
        residentOwnerName &&
        p.residentName?.trim().toLowerCase() === residentOwnerName &&
        (!p.flat || p.flat === (canonicalResident?.flat || user?.flat))
      ) {
        return true;
      }
      return false;
    });

    // 3. Enrich existing bills with payment data
    const enrichedBills = rawBills.map((b) => {
      const matchPayment = residentPayments.find(
        (p) =>
          (p.billId && p.billId === b.id) ||
          (p.receiptNumber && p.receiptNumber === b.paymentId) ||
          (p.month === b.month && Number(p.year) === Number(b.year))
      );

      const effectiveStatus = matchPayment
        ? matchPayment.paymentMethod === "Exempted"
          ? "Exempted"
          : "Paid"
        : b.status;

      const effectiveAmount =
        Number(b.amount) > 0
          ? Number(b.amount)
          : matchPayment
          ? Number(matchPayment.amount || 0)
          : Number(canonicalResident?.charge || 0);

      const isAdv = Boolean(b.isAdvance || matchPayment?.isAdvance);
      const advPeriod = b.periodLabel || matchPayment?.periodLabel || "";

      return {
        ...b,
        amount: effectiveAmount,
        status: effectiveStatus,
        displayStatus: getDisplayStatus({ ...b, status: effectiveStatus }),
        paymentId: b.paymentId || matchPayment?.receiptNumber || "",
        paymentDate: b.paymentDate || matchPayment?.paymentDate || "",
        paymentMethod: b.paymentMethod || matchPayment?.paymentMethod || "",
        isAdvance: isAdv,
        periodLabel: advPeriod,
      };
    });

    // 4. Also include any payments that lack a document in bills
    const coveredKeys = new Set(enrichedBills.map((b) => `${b.month}-${b.year}`));
    const synthBills = residentPayments
      .filter((p) => !coveredKeys.has(`${p.month}-${p.year}`))
      .map((p) => {
        const isExempt = p.paymentMethod === "Exempted";
        return {
          id: `synth-${p.id || p.receiptNumber}-${p.month}-${p.year}`,
          month: p.month,
          year: Number(p.year),
          amount: Number(p.amount || 0),
          status: isExempt ? "Exempted" : "Paid",
          displayStatus: isExempt ? "Exempted" : "Paid",
          paymentId: p.receiptNumber,
          paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod,
          dueDate: `10 ${p.month} ${p.year}`,
          isAdvance: Boolean(p.isAdvance),
          periodLabel: p.periodLabel || "",
        };
      });

    return [...enrichedBills, ...synthBills]
      .filter((b) => {
        if (monthFilter !== "All" && b.month !== monthFilter) return false;
        if (statusFilter !== "All" && b.displayStatus !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const yearDiff = Number(b.year) - Number(a.year);
        if (yearDiff !== 0) return yearDiff;
        return MONTHS.indexOf(b.month) - MONTHS.indexOf(a.month);
      });
  }, [bills, payments, canonicalResidentId, user, canonicalResident, monthFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <GarbageModuleTabs />

      <div>
        <h1 className="text-3xl font-bold">My Bills</h1>
        <p className="text-gray-500">Year {selectedYear}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap gap-3">
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="border rounded-xl px-4 py-2.5">
          <option value="All">All Months</option>
          {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-xl px-4 py-2.5">
          <option value="All">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
          <option value="Exempted">Exempted</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-left font-bold text-gray-600">Month</th>
              <th className="p-4 text-left font-bold text-gray-600">Year</th>
              <th className="p-4 text-right font-bold text-gray-600">Amount</th>
              <th className="p-4 text-left font-bold text-gray-600">Status</th>
              <th className="p-4 text-left font-bold text-gray-600">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {myBills.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-16 text-gray-500">
                <FaFileInvoiceDollar className="text-5xl text-gray-300 mx-auto mb-3" />
                No bills found
              </td></tr>
            ) : (
              myBills.map((b) => (
                <tr key={b.id} className="border-t hover:bg-blue-50/30 transition">
                  <td className="p-4 font-medium">{b.month}</td>
                  <td className="p-4">{b.year}</td>
                  <td className="p-4 text-right font-bold text-emerald-600">₹{Number(b.amount).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                      b.isAdvance
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : b.displayStatus === "Paid"
                        ? "bg-green-100 text-green-700"
                        : b.displayStatus === "Overdue"
                        ? "bg-red-100 text-red-700"
                        : b.displayStatus === "Exempted"
                        ? "bg-gray-200 text-gray-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {b.isAdvance ? "Advance Paid" : b.displayStatus}
                    </span>
                    {b.isAdvance && b.periodLabel && (
                      <span className="block text-[10px] text-emerald-700 font-medium mt-0.5 max-w-[200px] truncate" title={b.periodLabel}>
                        {b.periodLabel}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-gray-500">
                    {b.isAdvance ? (
                      <span className="text-emerald-700 font-semibold text-xs">Covered in Advance</span>
                    ) : (
                      b.dueDate || "-"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

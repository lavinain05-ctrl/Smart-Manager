import { useMemo, useState } from "react";
import {
  FaRecycle,
  FaMoneyBillWave,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaHistory,
  FaPaperPlane,
  FaTimes,
  FaReceipt,
  FaUserTie,
  FaInfoCircle,
  FaPauseCircle,
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";
import { useGarbage } from "../../context/GarbageContext";
import { useResidents } from "../../context/ResidentContext";
import { usePayments } from "../../context/PaymentContext";
import { useBills } from "../../context/BillContext";
import GarbageModuleTabs from "../../components/resident/GarbageModuleTabs";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DEFAULT_JOIN_GC_MESSAGE = "I would like to enroll in the Society Door-to-Door Garbage Collection service. Please activate garbage collection for my flat.";
export const DEFAULT_LEAVE_GC_MESSAGE = "I would like to request pausing/stopping garbage collection for my flat.";

export default function ResidentGarbage() {
  const { user } = useAuth();
  const {
    garbageAccounts = [],
    garbageBills = [],
    garbageSettings = {},
    garbageRequests = [],
    submitRequest,
  } = useGarbage();
  const { residents = [] } = useResidents();
  const { payments = [] } = usePayments();
  const { bills = [] } = useBills();

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestReason, setRequestReason] = useState("");

  // Extract clean 10-digit mobile from phone or pseudo-email
  const cleanPhone = useMemo(() => {
    const raw = user?.phone || user?.mobile || (user?.email?.includes("@") ? user.email.split("@")[0] : "");
    const digits = String(raw).replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  }, [user]);

  // Robust Canonical Resident Resolution
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

  // My Garbage Account
  const myAccount = useMemo(
    () =>
      garbageAccounts.find(
        (a) =>
          a.residentId === canonicalResidentId ||
          a.residentId === canonicalResident?.id ||
          a.residentId === user?.residentId ||
          a.residentId === user?.uid ||
          (cleanPhone && (a.mobile || "").replace(/\D/g, "").slice(-10) === cleanPhone)
      ) || null,
    [garbageAccounts, canonicalResidentId, canonicalResident, user, cleanPhone]
  );

  // My Payments from payments collection
  const myPayments = useMemo(() => {
    return payments
      .filter((p) => {
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
      })
      .sort((a, b) => {
        const tsA = Number((a.receiptNumber || "").replace("REC-", "")) || 0;
        const tsB = Number((b.receiptNumber || "").replace("REC-", "")) || 0;
        return tsB - tsA;
      });
  }, [payments, canonicalResidentId, canonicalResident, user, cleanPhone]);

  // Monthly Charge synchronized
  const monthlyCharge = useMemo(() => {
    return (
      Number(canonicalResident?.charge) ||
      Number(myAccount?.monthlyCharge) ||
      Number(myPayments[0]?.amount) ||
      0
    );
  }, [canonicalResident, myAccount, myPayments]);

  // Participation Status
  const isEnrolled =
    canonicalResident?.garbageStatus === "participating" ||
    myAccount?.status === "active" ||
    myPayments.length > 0;

  const isPaused =
    canonicalResident?.garbageStatus === "temporary_stopped" ||
    myAccount?.status === "paused";

  const isInactive =
    canonicalResident?.garbageStatus === "inactive" ||
    myAccount?.status === "inactive";

  const statusLabel = isPaused
    ? "Paused"
    : isInactive
    ? "Inactive"
    : isEnrolled
    ? "Active"
    : "Not Enrolled";

  // Current month & year
  const currentMonth = new Date().toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();

  const currentMonthPayment = myPayments.find(
    (p) => p.month === currentMonth && Number(p.year) === Number(currentYear)
  );

  const currentMonthBill = useMemo(() => {
    return (
      garbageBills.find(
        (g) =>
          (g.residentId === canonicalResidentId || g.residentId === user?.uid || g.accountId === myAccount?.id) &&
          g.month === currentMonth &&
          Number(g.year) === Number(currentYear)
      ) ||
      bills.find(
        (b) =>
          (b.residentId === canonicalResidentId || b.residentId === user?.uid) &&
          b.month === currentMonth &&
          Number(b.year) === Number(currentYear)
      ) ||
      null
    );
  }, [garbageBills, bills, canonicalResidentId, user, myAccount, currentMonth, currentYear]);

  // Total Paid
  const totalPaid = useMemo(() => {
    return myPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  }, [myPayments]);

  // Outstanding calculation
  const outstanding = useMemo(() => {
    const paidKeys = new Set(myPayments.map((p) => `${p.month}-${p.year}`));
    let sum = 0;
    bills
      .filter((b) => b.residentId === canonicalResidentId || b.residentId === user?.uid)
      .forEach((b) => {
        if (b.status === "Pending" && !paidKeys.has(`${b.month}-${b.year}`)) {
          sum += Number(b.amount || monthlyCharge || 0);
        }
      });
    return sum;
  }, [bills, myPayments, canonicalResidentId, user, monthlyCharge]);

  // Collector Name
  const collectorName =
    myAccount?.collectorName ||
    canonicalResident?.collectorName ||
    myPayments[0]?.collector ||
    "Not Assigned";

  // Pending requests
  const myPendingRequest = useMemo(
    () =>
      garbageRequests.find(
        (r) =>
          (r.residentId === canonicalResidentId || r.residentId === user?.uid) &&
          r.status === "pending"
      ),
    [garbageRequests, canonicalResidentId, user]
  );

  async function handleSubmitRequest() {
    const requestType = isEnrolled ? "opt_out" : "opt_in";
    const defaultMsg = isEnrolled ? DEFAULT_LEAVE_GC_MESSAGE : DEFAULT_JOIN_GC_MESSAGE;

    await submitRequest({
      residentId: canonicalResidentId || user?.uid || "",
      requestType,
      reason: requestReason.trim() || defaultMsg,
    });

    setShowRequestForm(false);
    setRequestReason("");
  }

  return (
    <div className="space-y-6">

      {/* Garbage Module Navigation Tabs */}
      <GarbageModuleTabs />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <FaRecycle className="text-emerald-600" />
          Garbage Collection
        </h1>
        <p className="text-gray-500 mt-1">
          {garbageSettings.collectionTime
            ? `Collection Time: ${garbageSettings.collectionTime}`
            : "View your garbage collection status and bills"}
        </p>
      </div>

      {/* Status Card */}
      <div className={`rounded-2xl shadow-sm p-6 ${
        statusLabel === "Active"
          ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
          : statusLabel === "Paused"
          ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
          : "bg-gradient-to-r from-gray-500 to-gray-600 text-white"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Garbage Collection Status</p>
            <h2 className="text-2xl font-bold mt-1">{statusLabel}</h2>
            <p className="text-sm opacity-90 mt-1 font-medium">
              Monthly Charge: ₹{monthlyCharge.toLocaleString()}
            </p>
          </div>

          <div className="text-5xl opacity-40">
            {statusLabel === "Active" ? (
              <FaCheckCircle />
            ) : statusLabel === "Paused" ? (
              <FaPauseCircle />
            ) : (
              <FaTimesCircle />
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Current Month */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <p className="text-gray-500 text-sm">Current Month</p>
          <div className="mt-1">
            {currentMonthPayment || currentMonthBill?.status === "Paid" ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-base">
                <FaCheckCircle className="text-emerald-500 text-sm" /> Paid (₹{(currentMonthPayment?.amount ?? currentMonthBill?.amount ?? monthlyCharge).toLocaleString()})
              </span>
            ) : currentMonthBill?.status === "Pending" ? (
              <span className="text-amber-600 font-bold text-lg">
                ₹{Number(currentMonthBill.amount || monthlyCharge).toLocaleString()}
              </span>
            ) : (
              <span className="text-gray-600 font-medium text-base">
                {isEnrolled ? "₹" + monthlyCharge.toLocaleString() : "No Bill"}
              </span>
            )}
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <p className="text-gray-500 text-sm">Outstanding</p>
          <h3 className={`text-lg font-bold mt-1 ${outstanding > 0 ? "text-red-600" : "text-gray-700"}`}>
            ₹{outstanding.toLocaleString()}
          </h3>
        </div>

        {/* Total Paid */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <p className="text-gray-500 text-sm">Total Paid</p>
          <h3 className="text-lg font-bold text-emerald-700 mt-1">
            ₹{totalPaid.toLocaleString()}
          </h3>
        </div>

        {/* Collector */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <p className="text-gray-500 text-sm">Collector</p>
          <h3 className="text-lg font-bold text-gray-800 mt-1 truncate">
            {collectorName}
          </h3>
        </div>
      </div>

      {/* Opt-in/Opt-out Request Section */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">
              {isEnrolled ? "Opt-Out Request" : "Opt-In Request"}
            </h3>
            <p className="text-gray-500 text-sm">
              {isEnrolled
                ? "Request to pause or stop garbage collection"
                : "Request to enroll in garbage collection service"}
            </p>
          </div>

          {myPendingRequest ? (
            <span className="px-4 py-2 rounded-xl bg-amber-100 text-amber-800 text-sm font-medium">
              ⏳ Request Pending
            </span>
          ) : (
            <button
              onClick={() => {
                setRequestReason(isEnrolled ? DEFAULT_LEAVE_GC_MESSAGE : DEFAULT_JOIN_GC_MESSAGE);
                setShowRequestForm(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm"
            >
              <FaPaperPlane /> {isEnrolled ? "Opt-Out" : "Opt-In"}
            </button>
          )}
        </div>
      </div>

      {/* Payment History Section */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <FaHistory className="text-emerald-600" />
            Payment History
          </h3>
          <span className="text-xs text-gray-500 font-medium">
            {myPayments.length} payment{myPayments.length === 1 ? "" : "s"} recorded
          </span>
        </div>

        {myPayments.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No payment records found</p>
        ) : (
          <div className="space-y-3">
            {myPayments.map((pay) => (
              <div
                key={pay.id || pay.receiptNumber}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50/70 transition gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-800">
                      {pay.month} {pay.year}
                    </p>
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-50 text-blue-700 border border-blue-100">
                      {pay.receiptNumber}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    {pay.paymentDate || "—"}{pay.paymentTime ? ` • ${pay.paymentTime}` : ""}{pay.collector ? ` • Collector: ${pay.collector}` : ""}
                  </p>
                </div>

                <div className="flex items-center sm:justify-end gap-3">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {pay.paymentMethod || "Cash"}
                  </span>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600 text-base">
                      ₹{Number(pay.amount || 0).toLocaleString()}
                    </p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {pay.paymentMethod === "Exempted" ? "Exempted" : "Paid"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-800">
                {isEnrolled ? "Opt-Out Request" : "Opt-In Request"}
              </h3>
              <button
                onClick={() => setShowRequestForm(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isEnrolled ? "Reason for Opt-Out" : "Request Message to Admin"}
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  rows={4}
                  className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm text-gray-800 leading-relaxed"
                  placeholder={isEnrolled ? DEFAULT_LEAVE_GC_MESSAGE : DEFAULT_JOIN_GC_MESSAGE}
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  {isEnrolled
                    ? "Explain why you wish to pause or discontinue garbage collection."
                    : "Default message is pre-filled above. You can customize it or click Submit Request directly."}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRequestForm(false)}
                className="px-5 py-2.5 rounded-xl border hover:bg-gray-50 text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

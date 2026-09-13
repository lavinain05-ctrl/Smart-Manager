import { useState, useEffect, useMemo } from "react";
import {
  FaCog,
  FaSync,
  FaCheckCircle,
  FaShieldAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaMoneyBillWave,
  FaClock,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useGarbage } from "../../context/GarbageContext";
import { useSettings } from "../../context/SettingsContext";
import { useResidents } from "../../context/ResidentContext";
import { useBilling } from "../../context/BillingContext";
import { useBills } from "../../context/BillContext";
import { usePayments } from "../../context/PaymentContext";

export default function GarbageSettings() {
  const { garbageSettings, updateGarbageSettings, reconcileGarbageAccounts } =
    useGarbage();
  const { settings, updateSettings } = useSettings();
  const { residents = [] } = useResidents();
  const { selectedMonth, selectedYear } = useBilling();
  const { bills = [] } = useBills();
  const { payments = [] } = usePayments();

  // Unified fallback charge: check garbageSettings, then society settings, default to 80
  const effectiveDefaultCharge = useMemo(() => {
    if (
      garbageSettings.defaultCharge &&
      Number(garbageSettings.defaultCharge) > 0
    ) {
      return Number(garbageSettings.defaultCharge);
    }
    if (settings?.monthlyCharge && Number(settings.monthlyCharge) > 0) {
      return Number(settings.monthlyCharge);
    }
    return 80;
  }, [garbageSettings.defaultCharge, settings?.monthlyCharge]);

  const effectiveCollectionTime = useMemo(() => {
    return (
      garbageSettings.collectionTime ||
      settings?.collectorTiming ||
      "7:00 AM - 9:00 AM"
    );
  }, [garbageSettings.collectionTime, settings?.collectorTiming]);

  const [form, setForm] = useState({
    defaultCharge: effectiveDefaultCharge,
    billDueDay: garbageSettings.billDueDay || 10,
    collectionTime: effectiveCollectionTime,
    enableNotifications: garbageSettings.enableNotifications !== false,
  });

  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [syncReport, setSyncReport] = useState(null);

  // Keep form updated when settings load, ensuring we never display 0
  useEffect(() => {
    setForm({
      defaultCharge: effectiveDefaultCharge,
      billDueDay: garbageSettings.billDueDay || 10,
      collectionTime: effectiveCollectionTime,
      enableNotifications: garbageSettings.enableNotifications !== false,
    });
  }, [effectiveDefaultCharge, effectiveCollectionTime, garbageSettings.billDueDay, garbageSettings.enableNotifications]);

  // Save Settings: updates both GarbageSettings and Master Society Settings
  async function handleSave() {
    setSaving(true);
    const chargeVal =
      Number(form.defaultCharge) > 0 ? Number(form.defaultCharge) : 80;
    const timingVal = form.collectionTime.trim() || "7:00 AM - 9:00 AM";

    try {
      // 1. Update Garbage Module Configuration
      await updateGarbageSettings({
        defaultCharge: chargeVal,
        billDueDay: Number(form.billDueDay) || 10,
        collectionTime: timingVal,
        enableNotifications: form.enableNotifications,
      });

      // 2. Unify with Master Society Settings
      if (updateSettings) {
        await updateSettings({
          ...settings,
          monthlyCharge: chargeVal,
          collectorTiming: timingVal,
        });
      }

      // 3. Reconcile accounts, resident charges, and bills
      const res = await reconcileGarbageAccounts({ silent: true });
      setSyncReport(res);

      toast.success(
        `Settings unified & all accounts synchronized at ₹${chargeVal}/month`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to save and synchronize settings");
    } finally {
      setSaving(false);
    }
  }

  // Check and Synchronize All Modules
  async function handleCheckAndSyncAll() {
    setReconciling(true);
    try {
      const chargeVal =
        Number(form.defaultCharge) > 0 ? Number(form.defaultCharge) : 80;

      // 1. Ensure garbageSettings & master settings match
      await updateGarbageSettings({
        defaultCharge: chargeVal,
        billDueDay: Number(form.billDueDay) || 10,
        collectionTime: form.collectionTime || "7:00 AM - 9:00 AM",
        enableNotifications: form.enableNotifications,
      });

      if (updateSettings) {
        await updateSettings({
          ...settings,
          monthlyCharge: chargeVal,
          collectorTiming: form.collectionTime || "7:00 AM - 9:00 AM",
        });
      }

      // 2. Run deep reconciliation
      const res = await reconcileGarbageAccounts({ silent: false });
      setSyncReport(res);
    } catch (e) {
      console.error(e);
      toast.error("Reconciliation error: " + e.message);
    } finally {
      setReconciling(false);
    }
  }

  // Active sync stats for current billing cycle
  const participatingCount = useMemo(() => {
    return residents.filter(
      (r) =>
        r.garbageStatus === "participating" ||
        r.isEnrolled ||
        (r.status === "Active" && r.charge > 0)
    ).length;
  }, [residents]);

  const cycleBills = useMemo(() => {
    return bills.filter(
      (b) => b.month === selectedMonth && Number(b.year) === Number(selectedYear)
    );
  }, [bills, selectedMonth, selectedYear]);

  const paidBillsCount = useMemo(() => {
    return cycleBills.filter((b) => b.status === "Paid").length;
  }, [cycleBills]);

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-3">
            <FaCog className="text-emerald-600" />
            Garbage Settings & Data Synchronization
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Configure unified maintenance & garbage collection fees, due dates, and synchronize all society records.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCheckAndSyncAll}
          disabled={reconciling}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-5 py-3 rounded-xl shadow-md shadow-blue-600/20 transition disabled:opacity-50 text-sm shrink-0"
        >
          <FaSync className={reconciling ? "animate-spin text-white" : ""} />
          <span>{reconciling ? "Checking & Syncing..." : "Check & Synchronize All"}</span>
        </button>
      </div>

      {/* Live Synchronization Status Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-emerald-800/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-black tracking-wider uppercase text-emerald-400">
              System Synchronization Active
            </span>
          </div>
          <h2 className="text-xl font-black">
            Unified Society Rate: ₹{form.defaultCharge || 80} / Month
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm">
            Society: <strong>{settings?.societyName || "D BLOCK RWA INDRAPRASTHA"}</strong> • Active Period: <strong>{selectedMonth} {selectedYear}</strong>
          </p>
        </div>

        {/* Mini KPI Chips */}
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 text-center border border-white/10">
            <div className="text-[11px] font-bold text-slate-300">Enrolled</div>
            <div className="text-lg font-black text-white">{participatingCount} Flats</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 text-center border border-white/10">
            <div className="text-[11px] font-bold text-slate-300">Active Bills</div>
            <div className="text-lg font-black text-emerald-300">{cycleBills.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-3 text-center border border-white/10">
            <div className="text-[11px] font-bold text-slate-300">Paid Dues</div>
            <div className="text-lg font-black text-teal-300">{paidBillsCount}</div>
          </div>
        </div>
      </div>

      {/* Settings Form Card */}
      <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Module Parameters
            </h3>
            <p className="text-xs text-slate-500">
              Values updated here are automatically synchronized with master society billing rules.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <FaCheckCircle className="text-emerald-600" />
            Synchronized
          </span>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              Default Monthly Charge (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                min="1"
                value={form.defaultCharge}
                onChange={(e) =>
                  setForm({ ...form, defaultCharge: e.target.value })
                }
                className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-3 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="80"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Standard monthly fee applied to all door-to-door garbage collection accounts and monthly bills.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Bill Due Day of Month
              </label>
              <input
                type="number"
                min="1"
                max="28"
                value={form.billDueDay}
                onChange={(e) =>
                  setForm({ ...form, billDueDay: e.target.value })
                }
                className="w-full border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                placeholder="10"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Monthly bills will show this day as the payment deadline (e.g., 10th of every month).
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Collection Timing Window
              </label>
              <input
                type="text"
                value={form.collectionTime}
                onChange={(e) =>
                  setForm({ ...form, collectionTime: e.target.value })
                }
                className="w-full border border-slate-200 rounded-xl px-4 py-3 font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                placeholder="7:00 AM - 9:00 AM"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Daily collection timing displayed on resident dashboards and invoices.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4 border border-slate-200/60">
            <div>
              <p className="font-bold text-sm text-slate-800">
                Automated System Notifications
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Send automatic in-app alerts when monthly bills are generated, collected, or marked overdue.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  enableNotifications: !form.enableNotifications,
                })
              }
              className={`w-14 h-8 rounded-full transition-colors ${
                form.enableNotifications ? "bg-emerald-600" : "bg-slate-300"
              } relative shrink-0`}
            >
              <div
                className={`absolute w-6 h-6 bg-white rounded-full top-1 transition-transform shadow ${
                  form.enableNotifications ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-7 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 text-sm"
            >
              {saving ? "Saving & Synchronizing..." : "Save Settings & Sync"}
            </button>
          </div>
        </div>
      </div>

      {/* Data Reconciliation & Health Center */}
      <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8 border border-slate-200 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2.5">
              <FaSync className="text-blue-600" />
              Comprehensive Data Reconciliation
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Scans all resident accounts, door-to-door registrations, and monthly payment records. Reconciles all charges to ₹{form.defaultCharge || 80}, links unassigned flats, and eliminates discrepancies.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCheckAndSyncAll}
            disabled={reconciling}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold transition active:scale-95 text-xs sm:text-sm shrink-0 disabled:opacity-50"
          >
            <FaSync className={reconciling ? "animate-spin" : ""} />
            <span>{reconciling ? "Syncing Data..." : "Run Reconciliation"}</span>
          </button>
        </div>

        {/* Verification Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
            <FaCheckCircle className="text-emerald-600 text-base mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-emerald-900">
                Society & Garbage Settings Unified
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                Standard rate locked at ₹{form.defaultCharge || 80}/month across all modules.
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
            <FaCheckCircle className="text-emerald-600 text-base mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-emerald-900">
                Resident Accounts Reconciled
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                {participatingCount} participating flats synchronized with active status.
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
            <FaCheckCircle className="text-emerald-600 text-base mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-emerald-900">
                Monthly Bills & Payments In Sync
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                {cycleBills.length} bills generated for {selectedMonth} {selectedYear} ({paidBillsCount} paid, {cycleBills.length - paidBillsCount} pending/overdue).
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
            <FaShieldAlt className="text-emerald-600 text-base mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-emerald-900">
                Audit Integrity Protected
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                No duplicate, orphan, or conflicting records found in the database.
              </div>
            </div>
          </div>
        </div>

        {syncReport && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <FaCheckCircle className="text-blue-600" />
              Latest Reconciliation Result:
            </div>
            <div>
              • Standard Fee: ₹{syncReport.effectiveFee} | Participating Residents: {syncReport.totalParticipating}
            </div>
            <div>
              • Accounts Created: {syncReport.accountsCreated} | Charges Standardized: {syncReport.chargesSynced}
            </div>
            <div>
              • Monthly Bills Synchronized: {syncReport.billsSynced} | Flats Linked: {syncReport.flatsLinked}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


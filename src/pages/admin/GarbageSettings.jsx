import { useState, useEffect } from "react";
import { FaCog, FaSync } from "react-icons/fa";

import { useGarbage } from "../../context/GarbageContext";

export default function GarbageSettings() {
  const { garbageSettings, updateGarbageSettings, reconcileGarbageAccounts } = useGarbage();

  const [form, setForm] = useState({
    defaultCharge: garbageSettings.defaultCharge || 0,
    billDueDay: garbageSettings.billDueDay || 10,
    collectionTime: garbageSettings.collectionTime || "",
    enableNotifications: garbageSettings.enableNotifications !== false,
  });

  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  // Sync form when settings load from Firestore
  useEffect(() => {
    setForm({
      defaultCharge: garbageSettings.defaultCharge || 0,
      billDueDay: garbageSettings.billDueDay || 10,
      collectionTime: garbageSettings.collectionTime || "",
      enableNotifications: garbageSettings.enableNotifications !== false,
    });
  }, [garbageSettings]);

  async function handleSave() {
    setSaving(true);
    await updateGarbageSettings({
      defaultCharge: Number(form.defaultCharge),
      billDueDay: Number(form.billDueDay),
      collectionTime: form.collectionTime,
      enableNotifications: form.enableNotifications,
    });
    setSaving(false);
  }

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <FaCog className="text-emerald-600" />
          Garbage Settings
        </h1>
        <p className="text-gray-500 mt-1">
          Configure garbage collection module settings
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 max-w-2xl">
        <div className="space-y-6">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Monthly Charge (₹)
            </label>
            <input
              type="number"
              value={form.defaultCharge}
              onChange={(e) => setForm({ ...form, defaultCharge: e.target.value })}
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="150"
            />
            <p className="text-xs text-gray-400 mt-1">
              Applied when creating new garbage accounts without an explicit charge
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bill Due Day
            </label>
            <input
              type="number"
              min="1"
              max="28"
              value={form.billDueDay}
              onChange={(e) => setForm({ ...form, billDueDay: e.target.value })}
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="10"
            />
            <p className="text-xs text-gray-400 mt-1">
              Day of the month when bills are due
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Collection Timing
            </label>
            <input
              type="text"
              value={form.collectionTime}
              onChange={(e) => setForm({ ...form, collectionTime: e.target.value })}
              className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="7:00 AM - 9:00 AM"
            />
            <p className="text-xs text-gray-400 mt-1">
              Daily collection time window shown to residents
            </p>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div>
              <p className="font-medium text-sm">Enable Notifications</p>
              <p className="text-xs text-gray-500">
                Send automatic notifications for bills, payments, status changes
              </p>
            </div>
            <button
              onClick={() => setForm({ ...form, enableNotifications: !form.enableNotifications })}
              className={`w-14 h-8 rounded-full transition-colors ${
                form.enableNotifications ? "bg-emerald-600" : "bg-gray-300"
              } relative`}
            >
              <div className={`absolute w-6 h-6 bg-white rounded-full top-1 transition-transform shadow ${
                form.enableNotifications ? "translate-x-7" : "translate-x-1"
              }`} />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>

        </div>
      </div>

      {/* Data Reconciliation Section */}
      <div className="bg-white rounded-2xl shadow-sm p-6 max-w-2xl">
        <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
          <FaSync className="text-blue-600" />
          Data Reconciliation
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Scan for participating residents without garbage accounts and unlinked flats. This creates missing records without deleting any data.
        </p>
        <button
          onClick={async () => {
            setReconciling(true);
            try {
              await reconcileGarbageAccounts();
            } finally {
              setReconciling(false);
            }
          }}
          disabled={reconciling}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50"
        >
          <FaSync className={reconciling ? "animate-spin" : ""} />
          {reconciling ? "Reconciling..." : "Run Reconciliation"}
        </button>
      </div>
    </div>
  );
}

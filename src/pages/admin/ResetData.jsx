import { useState } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";

import { db, deleteAuthAccountFn } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  FaExclamationTriangle,
  FaTrash,
  FaShieldAlt,
  FaArrowLeft,
  FaCheckCircle,
  FaSpinner,
  FaHome,
  FaUsers,
  FaFileInvoiceDollar,
  FaBuilding,
  FaKey,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

// =============================================
// COMPLETE APPLICATION TEST DATA RESET
// =============================================

// Base test data collections to wipe completely
const CORE_WIPE_COLLECTIONS = [
  { id: "residents", name: "Residents", category: "members" },
  { id: "familyMembers", name: "Family Members", category: "members" },
  { id: "committee", name: "RWA Committee Officials", category: "members" },
  { id: "collectors", name: "Fee Collectors", category: "members" },
  { id: "bills", name: "Maintenance Bills", category: "finance" },
  { id: "payments", name: "Payment Transactions", category: "finance" },
  { id: "paymentAudit", name: "Payment Audits", category: "finance" },
  { id: "receipts", name: "Receipts", category: "finance" },
  { id: "garbageAccounts", name: "Garbage Accounts", category: "garbage" },
  { id: "garbageBills", name: "Garbage Bills", category: "garbage" },
  { id: "garbageCollections", name: "Garbage Collections", category: "garbage" },
  { id: "garbageCollectors", name: "Garbage Collectors", category: "garbage" },
  { id: "garbageRoutes", name: "Garbage Routes", category: "garbage" },
  { id: "garbageRequests", name: "Garbage Requests", category: "garbage" },
  { id: "garbageCollectionLogs", name: "Garbage Pickup Logs", category: "garbage" },
  { id: "garbageReports", name: "Garbage Reports", category: "garbage" },
  { id: "specialCollections", name: "Special Campaigns", category: "special" },
  { id: "specialCollectionPayments", name: "Special Campaign Payments", category: "special" },
  { id: "specialCollectionAudit", name: "Special Campaign Audits", category: "special" },
  { id: "utrLookup", name: "UTR Transaction Index", category: "special" },
  { id: "registrationRequests", name: "New Registrations", category: "requests" },
  { id: "profileUpdateRequests", name: "Profile Update Requests", category: "requests" },
  { id: "recoveryRequests", name: "Account Recovery Requests", category: "requests" },
  { id: "notifications", name: "In-App Notifications", category: "communication" },
  { id: "notices", name: "Notice Board Posts", category: "communication" },
  { id: "complaints", name: "Complaints & Grievances", category: "communication" },
  { id: "events", name: "Society Events", category: "communication" },
  { id: "activities", name: "Society Activities & Drives", category: "communication" },
  { id: "emergencyContacts", name: "Emergency Contacts", category: "communication" },
  { id: "activityLogs", name: "System & Portal Audit Logs", category: "audit" },
  { id: "portalLogins", name: "Login Session Logs", category: "audit" },
  { id: "blockedAccounts", name: "Blocked Account Enforcements", category: "audit" },
  { id: "deletedAccounts", name: "Deleted Account Archives", category: "audit" },
];

export default function ResetData() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [confirmText, setConfirmText] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentStep: "" });
  const [logs, setLogs] = useState([]);
  const [totalDeletedCount, setTotalDeletedCount] = useState(0);

  // Options
  const [wipeBlocksFlats, setWipeBlocksFlats] = useState(false);
  const [deleteAuthAccounts, setDeleteAuthAccounts] = useState(true);

  // Guard: Admin only
  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-md">
          <FaExclamationTriangle className="text-red-600 text-4xl mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-700">Administrator Access Required</h2>
          <p className="text-xs text-red-600 mt-2">
            Only administrators are authorized to access the system reset console.
          </p>
        </div>
      </div>
    );
  }

  function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  }

  // Delete all docs in a Firestore collection in batches of 400
  async function deleteCollection(collName) {
    const ref = collection(db, collName);
    const snapshot = await getDocs(ref);

    if (snapshot.empty) {
      addLog(`• ${collName}: 0 records (already empty)`);
      return 0;
    }

    let deleted = 0;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + 400);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += chunk.length;
    }

    addLog(`✓ ${collName}: ${deleted} records deleted`);
    return deleted;
  }

  // Clean authLookup collection — keep admin phone numbers, delete all test phone numbers
  async function cleanAuthLookup() {
    const ref = collection(db, "authLookup");
    const snapshot = await getDocs(ref);

    let deleted = 0;
    let kept = 0;

    // Admin UIDs and current user to preserve
    const adminUid = user?.uid;

    for (const d of snapshot.docs) {
      const data = d.data();
      // Check if this lookup belongs to the current admin
      if (data.uid === adminUid || data.authEmail?.includes("admin") || data.authEmail === user?.email) {
        kept++;
        addLog(`• authLookup: preserved admin phone index (${d.id}) 🔒`);
        continue;
      }

      await deleteDoc(doc(db, "authLookup", d.id));
      deleted++;
    }

    addLog(`✓ authLookup: freed ${deleted} mobile number(s) for fresh registration (${kept} admin kept)`);
    return deleted;
  }

  // Clean users collection — preserve all admins, remove test accounts
  async function cleanUsersExceptAdmins() {
    const ref = collection(db, "users");
    const snapshot = await getDocs(ref);

    let deleted = 0;
    let kept = 0;

    for (const d of snapshot.docs) {
      const data = d.data();
      // Preserve admin accounts
      if (data.role === "admin" || d.id === user?.uid) {
        kept++;
        addLog(`• users: preserved admin (${data.name || data.email || d.id}) 🔒`);
        continue;
      }

      // Best-effort: delete Firebase Auth account if option checked
      if (deleteAuthAccounts) {
        try {
          await deleteAuthAccountFn({ uid: d.id });
        } catch {
          // Cloud function might not be deployed or failed
        }
      }

      await deleteDoc(doc(db, "users", d.id));
      deleted++;
    }

    addLog(`✓ users: ${deleted} test user(s) removed (${kept} admin accounts kept)`);
    return deleted;
  }

  async function startResetProcess() {
    setShowModal(false);
    setRunning(true);
    setDone(false);
    setLogs([]);
    setTotalDeletedCount(0);

    const collectionsToWipe = [...CORE_WIPE_COLLECTIONS];
    if (wipeBlocksFlats) {
      collectionsToWipe.push(
        { id: "blocks", name: "Blocks", category: "structure" },
        { id: "flats", name: "Flats", category: "structure" }
      );
    }

    const totalSteps = collectionsToWipe.length + 2; // + authLookup + users
    let currentStepIndex = 0;
    let totalCount = 0;

    addLog("🚀 Starting complete test data purge...");
    addLog("Preserving: Admin accounts, System settings, GC settings.");

    try {
      // 1. Wipe collections
      for (const item of collectionsToWipe) {
        currentStepIndex++;
        setProgress({
          current: currentStepIndex,
          total: totalSteps,
          currentStep: `Wiping ${item.name}...`,
        });

        try {
          const count = await deleteCollection(item.id);
          totalCount += count;
        } catch (err) {
          addLog(`✗ Error clearing ${item.id}: ${err.message}`);
        }
      }

      // 2. Clean authLookup
      currentStepIndex++;
      setProgress({
        current: currentStepIndex,
        total: totalSteps,
        currentStep: "Clearing mobile lookup index...",
      });
      try {
        const count = await cleanAuthLookup();
        totalCount += count;
      } catch (err) {
        addLog(`✗ Error clearing authLookup: ${err.message}`);
      }

      // 3. Clean users collection
      currentStepIndex++;
      setProgress({
        current: currentStepIndex,
        total: totalSteps,
        currentStep: "Clearing non-admin user credentials...",
      });
      try {
        const count = await cleanUsersExceptAdmins();
        totalCount += count;
      } catch (err) {
        addLog(`✗ Error clearing users: ${err.message}`);
      }

      setTotalDeletedCount(totalCount);
      setDone(true);
      addLog("");
      addLog(`🎉 Purge complete! Successfully removed ${totalCount} test documents.`);
      addLog("✅ All test residents, committee officials, bills, and payments wiped.");
      addLog("✅ All mobile numbers freed for fresh registration.");
      addLog("🔒 System is clean and ready for fresh production entry.");
      toast.success("Test data successfully cleared!");
    } catch (fatalErr) {
      addLog(`❌ Fatal error during reset: ${fatalErr.message}`);
      toast.error("An error occurred during reset");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition text-sm font-semibold"
        >
          <FaArrowLeft /> Back
        </button>
      </div>

      {/* Main Alert Card */}
      <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-2xl shadow-inner">
            <FaTrash />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-red-900 tracking-tight">
              Reset Testing Data
            </h1>
            <p className="text-red-700 text-sm mt-1">
              Purge all test residents, committee officials, bills, payments, and activity records so you can start fresh with real data.
            </p>
          </div>
        </div>

        {/* Scope Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* What will be deleted */}
          <div className="bg-white rounded-2xl p-5 border border-red-200 shadow-xs">
            <p className="font-bold text-red-800 text-sm mb-3 flex items-center gap-2">
              <FaTrash className="text-red-500" />
              <span>Data That Will Be Completely Deleted:</span>
            </p>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li>
                <strong>Residents & Family:</strong> All resident profiles and family members
              </li>
              <li>
                <strong>Committee:</strong> All committee official accounts & designations
              </li>
              <li>
                <strong>Collectors:</strong> All fee collector accounts and route assignments
              </li>
              <li>
                <strong>Finance:</strong> All maintenance bills, payments, and receipts
              </li>
              <li>
                <strong>Garbage Collection:</strong> All garbage bills, logs, and accounts
              </li>
              <li>
                <strong>Special Collections:</strong> All campaign funds and transaction records
              </li>
              <li>
                <strong>Communications:</strong> All notices, complaints, and events
              </li>
              <li>
                <strong>Audit & Security:</strong> Activity logs, portal sessions, and blocked list
              </li>
              <li>
                <strong>Mobile Number Index:</strong> Non-admin mobile lookups freed for re-registration
              </li>
            </ul>
          </div>

          {/* What will be preserved */}
          <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-xs">
            <p className="font-bold text-emerald-800 text-sm mb-3 flex items-center gap-2">
              <FaShieldAlt className="text-emerald-600" />
              <span>Data That Will Be 100% Preserved:</span>
            </p>
            <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
              <li>
                <strong>Admin Accounts:</strong> Your current admin login and credentials
              </li>
              <li>
                <strong>System Settings:</strong> Society name, currency, billing configurations
              </li>
              <li>
                <strong>Garbage Collection Settings:</strong> Monthly fee rates and rules
              </li>
              <li>
                <strong>Code & Features:</strong> All forms, portals, and system features remain unchanged
              </li>
            </ul>

            {/* Optional Settings */}
            <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Optional Purge Preferences:</p>
              <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={wipeBlocksFlats}
                  onChange={(e) => setWipeBlocksFlats(e.target.checked)}
                  disabled={running || done}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                />
                <span>Also wipe society <strong>Blocks & Flats structure</strong> (uncheck to keep your blocks)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteAuthAccounts}
                  onChange={(e) => setDeleteAuthAccounts(e.target.checked)}
                  disabled={running || done}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500 cursor-pointer"
                />
                <span>Attempt to purge Auth credentials for deleted test users</span>
              </label>
            </div>
          </div>
        </div>

        {/* Confirmation Trigger Section */}
        {!done && (
          <div className="mt-6 bg-white rounded-2xl p-5 border border-red-200 space-y-3">
            <label className="block text-xs font-bold text-gray-700">
              Type <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono text-sm">DELETE</span> to confirm you want to purge test data:
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Type DELETE to confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={running}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base font-mono focus:ring-2 focus:ring-red-500 outline-none uppercase"
              />
              <button
                type="button"
                onClick={() => setShowModal(true)}
                disabled={confirmText.trim().toUpperCase() !== "DELETE" || running}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm"
              >
                {running ? (
                  <>
                    <FaSpinner className="animate-spin" /> Purging...
                  </>
                ) : (
                  <>
                    <FaTrash /> Reset All Test Data
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {done && (
          <div className="mt-6 bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 text-center space-y-3">
            <FaCheckCircle className="text-emerald-500 text-4xl mx-auto" />
            <h3 className="text-xl font-bold text-emerald-900">
              Test Data Purge Complete!
            </h3>
            <p className="text-xs text-emerald-800 max-w-lg mx-auto">
              All {totalDeletedCount} test records have been deleted. Your admin account and system settings were protected. You can now start adding real resident and committee data.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => navigate("/admin/dashboard")}
                className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <FaHome /> Go to Dashboard
              </button>
              <button
                onClick={() => navigate("/admin/residents")}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <FaUsers /> Add Real Residents
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar (While running) */}
        {running && (
          <div className="mt-6 bg-white rounded-2xl p-5 border border-red-200 space-y-2">
            <div className="flex justify-between text-xs font-bold text-gray-700">
              <span>{progress.currentStep}</span>
              <span>
                {Math.round((progress.current / (progress.total || 1)) * 100)}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600 transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.round(
                    (progress.current / (progress.total || 1)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Real-time Operation Logs */}
        {logs.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-bold text-gray-700 mb-2">Purge Console Log:</p>
            <div className="bg-slate-900 text-emerald-400 font-mono text-xs rounded-2xl p-4 max-h-64 overflow-y-auto space-y-1 shadow-inner">
              {logs.map((line, idx) => (
                <div key={idx} className={line.includes("Error") || line.includes("Fatal") ? "text-red-400" : ""}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto text-2xl">
              <FaExclamationTriangle />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900">
                Are you absolutely sure?
              </h3>
              <p className="text-xs text-gray-500 mt-2">
                This action will wipe all test residents, committee members, fee records, and bills. This cannot be undone. Admin accounts will not be touched.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startResetProcess}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow transition"
              >
                Yes, Purge Test Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

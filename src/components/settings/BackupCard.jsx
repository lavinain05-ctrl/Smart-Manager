import { useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { FaDownload, FaDatabase, FaSpinner, FaCheckCircle, FaFileCode } from "react-icons/fa";
import toast from "react-hot-toast";

export default function BackupCard() {
  const [exporting, setExporting] = useState(false);

  async function handleBackup() {
    setExporting(true);
    const toastId = toast.loading("Preparing society data backup...");
    try {
      const collectionsToBackup = [
        "residents",
        "familyMembers",
        "committee",
        "collectors",
        "blocks",
        "flats",
        "bills",
        "payments",
        "garbageAccounts",
        "garbageBills",
        "emergencyContacts",
        "notices",
        "complaints",
      ];

      const backupData = {
        exportedAt: new Date().toISOString(),
        application: "D Block RWA Indraprastha - Smart Manager",
        version: "2.0",
        collections: {},
      };

      // Export collections in parallel
      await Promise.all(
        collectionsToBackup.map(async (colName) => {
          try {
            const snap = await getDocs(collection(db, colName));
            backupData.collections[colName] = snap.docs.map((d) => ({
              _id: d.id,
              ...d.data(),
            }));
          } catch (err) {
            console.warn(`[Backup] Could not export collection "${colName}":`, err.message);
            backupData.collections[colName] = [];
          }
        })
      );

      // Also export society settings
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "society"));
        if (settingsSnap.exists()) {
          backupData.collections["settings"] = settingsSnap.data();
        }
      } catch (err) {
        console.warn("[Backup] Could not export settings:", err.message);
      }

      // Convert to JSON and trigger automatic file download
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `rwa-indrapastha-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalItems = Object.values(backupData.collections).reduce(
        (acc, curr) => acc + (Array.isArray(curr) ? curr.length : 1),
        0
      );

      toast.success(`Backup downloaded! (${totalItems} records exported)`, { id: toastId });
    } catch (error) {
      console.error("[Backup] Error generating backup:", error);
      toast.error("Failed to generate backup: " + (error.message || "Unknown error"), { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
            <FaDatabase />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Data Backup & Export
            </h2>
            <p className="text-gray-500 text-sm">
              Save an offline snapshot of your society records (residents, committee, bills, flats).
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200/70 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm text-gray-700">
          <FaFileCode className="text-blue-500 text-lg shrink-0" />
          <span>
            Downloads a timestamped <strong>.json</strong> file containing all active database collections.
          </span>
        </div>

        <button
          onClick={handleBackup}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium text-sm transition shadow-sm whitespace-nowrap"
        >
          {exporting ? (
            <>
              <FaSpinner className="animate-spin text-sm" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <FaDownload className="text-sm" />
              <span>Export Backup (JSON)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
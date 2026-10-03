import React, { useState, useEffect } from "react";
import { FaPrint, FaBolt, FaCog, FaBluetoothB } from "react-icons/fa";
import PrinterSettingsModal from "./PrinterSettingsModal";
import { getPrinterConfig } from "../../utils/posiflowPrinterService";

export default function PrinterQuickAction({ className = "" }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [config, setConfig] = useState(getPrinterConfig());

  useEffect(() => {
    function handleConfigChange(e) {
      setConfig(e.detail || getPrinterConfig());
    }
    window.addEventListener("posiflow-printer-config-changed", handleConfigChange);
    return () => {
      window.removeEventListener("posiflow-printer-config-changed", handleConfigChange);
    };
  }, []);

  const isBt = config.mode === "bluetooth";

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        type="button"
        title="POSIFLOW PSF588 Thermal Printer Settings (Direct In-Webpage Printing)"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer shadow-2xs ${
          isBt
            ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
            : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-300"
        } ${className}`}
      >
        <FaPrint className="text-emerald-600 text-xs shrink-0" />
        <span className="truncate max-w-[110px] sm:max-w-none">
          {config.bluetoothDeviceName ? "POSIFLOW 588" : "POSIFLOW 588"}
        </span>
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shrink-0">
          <FaBolt className="text-[8px]" /> Direct
        </span>
        <FaCog className="text-gray-400 hover:text-emerald-700 text-[11px] ml-0.5 shrink-0" />
      </button>

      <PrinterSettingsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

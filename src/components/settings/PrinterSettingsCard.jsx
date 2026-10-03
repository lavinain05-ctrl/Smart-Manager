import React, { useState, useEffect } from "react";
import {
  FaPrint,
  FaBluetoothB,
  FaBolt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaUsb,
  FaFileInvoice,
  FaLeaf,
} from "react-icons/fa";
import toast from "react-hot-toast";
import {
  getPrinterConfig,
  savePrinterConfig,
  connectPosiflowBluetooth,
  executePosiflowTestPrint,
  isBluetoothSupported,
} from "../../utils/posiflowPrinterService";

export default function PrinterSettingsCard() {
  const [config, setConfig] = useState(getPrinterConfig());
  const [pairing, setPairing] = useState(false);
  const [testing, setTesting] = useState(false);
  const btSupported = isBluetoothSupported();

  useEffect(() => {
    function handleConfigChange(e) {
      setConfig(e.detail || getPrinterConfig());
    }
    window.addEventListener("posiflow-printer-config-changed", handleConfigChange);
    return () => {
      window.removeEventListener("posiflow-printer-config-changed", handleConfigChange);
    };
  }, []);

  async function handlePair() {
    setPairing(true);
    try {
      const res = await connectPosiflowBluetooth(true);
      setConfig(getPrinterConfig());
      toast.success(`Paired with ${res.name || "POSIFLOW PSF588"}!`);
    } catch (err) {
      console.warn("Pair error:", err);
    } finally {
      setPairing(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      await executePosiflowTestPrint();
    } catch (err) {
      console.error(err);
    } finally {
      setTesting(false);
    }
  }

  function handleMode(mode) {
    const updated = savePrinterConfig({ mode });
    setConfig(updated);
    toast.success(`Active mode: ${mode === "bluetooth" ? "Direct Web Bluetooth" : mode === "usb" ? "USB Cable" : "In-Browser 58mm"}`);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
            <FaPrint />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Thermal Receipt Printer (POSIFLOW PSF588)
            </h2>
            <p className="text-gray-500 text-sm">
              100% In-Webpage Direct Printing • Zero Android Apps Required
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <FaBolt className="text-emerald-500" /> Web Bluetooth Ready
        </span>
      </div>

      {/* Printer Status Banner */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Target Device: {config.bluetoothDeviceName || "POSIFLOW PSF588 (58mm)"}
            </span>
          </div>
          <p className="text-xs text-emerald-950/80 max-w-lg">
            Directly transmits binary ESC/POS commands from Google Chrome to POSIFLOW PSF588 over Web Bluetooth. Bypasses Android Spooler completely to prevent format rejection.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handlePair}
            disabled={pairing || !btSupported}
            className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
          >
            <FaBolt /> {pairing ? "Pairing..." : "Pair POSIFLOW 588"}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex-1 md:flex-none px-4 py-2.5 bg-white hover:bg-gray-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
          >
            <FaPrint /> {testing ? "Printing..." : "Test Receipt"}
          </button>
        </div>
      </div>

      {/* Engine Selection */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
          Printing Engine Mode
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() => handleMode("bluetooth")}
            className={`p-4 rounded-2xl border cursor-pointer transition ${
              config.mode === "bluetooth"
                ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                <FaBluetoothB />
              </div>
              {config.mode === "bluetooth" && <FaCheckCircle className="text-emerald-600 text-sm" />}
            </div>
            <div className="font-bold text-sm text-gray-900">Web Bluetooth</div>
            <div className="text-xs text-gray-500 mt-1">
              Direct wireless 1-click print. Zero external apps, fast & zero-margin.
            </div>
          </div>

          <div
            onClick={() => handleMode("system")}
            className={`p-4 rounded-2xl border cursor-pointer transition ${
              config.mode === "system"
                ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
                <FaFileInvoice />
              </div>
              {config.mode === "system" && <FaCheckCircle className="text-emerald-600 text-sm" />}
            </div>
            <div className="font-bold text-sm text-gray-900">In-Browser 58mm HTML</div>
            <div className="text-xs text-gray-500 mt-1">
              Zero-margin 58mm roll preview formatted for system dialogs.
            </div>
          </div>

          <div
            onClick={() => handleMode("usb")}
            className={`p-4 rounded-2xl border cursor-pointer transition ${
              config.mode === "usb"
                ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20"
                : "bg-white border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
                <FaUsb />
              </div>
              {config.mode === "usb" && <FaCheckCircle className="text-emerald-600 text-sm" />}
            </div>
            <div className="font-bold text-sm text-gray-900">USB / OTG Cable</div>
            <div className="text-xs text-gray-500 mt-1">
              Connect PC or phone to POSIFLOW via USB data cable.
            </div>
          </div>
        </div>
      </div>

      {/* Paper-Saving Features Card */}
      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
        <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl text-lg shrink-0">
          <FaLeaf />
        </div>
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-emerald-950">Roll-Saving Architecture Enabled</h4>
          <p className="text-emerald-900/80 leading-relaxed">
            The ESC/POS layout is customized for 58mm paper rolls: 22-dot tight line pitch saves 50%+ roll length; condensed receipt number, resident name, and date formatting; and 2-line auto cut feed reaches the tear blade without blank paper waste.
          </p>
        </div>
      </div>
    </div>
  );
}

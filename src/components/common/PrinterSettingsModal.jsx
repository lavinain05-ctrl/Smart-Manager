import React, { useState, useEffect } from "react";
import {
  FaTimes,
  FaPrint,
  FaBluetoothB,
  FaUsb,
  FaCheckCircle,
  FaExclamationTriangle,
  FaBolt,
  FaFileInvoice,
} from "react-icons/fa";
import toast from "react-hot-toast";
import {
  getPrinterConfig,
  savePrinterConfig,
  connectPosiflowBluetooth,
  executePosiflowTestPrint,
  isBluetoothSupported,
} from "../../utils/posiflowPrinterService";

export default function PrinterSettingsModal({ isOpen, onClose }) {
  const [config, setConfig] = useState(getPrinterConfig());
  const [pairing, setPairing] = useState(false);
  const [testing, setTesting] = useState(false);
  const btSupported = isBluetoothSupported();

  useEffect(() => {
    if (isOpen) {
      setConfig(getPrinterConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handlePairBluetooth() {
    setPairing(true);
    try {
      const res = await connectPosiflowBluetooth(true);
      setConfig(getPrinterConfig());
      toast.success(`Paired with ${res.name || "POSIFLOW PSF588"}!`);
    } catch (err) {
      console.warn("Pairing error:", err);
    } finally {
      setPairing(false);
    }
  }

  async function handleTestPrint() {
    setTesting(true);
    try {
      await executePosiflowTestPrint();
    } catch (e) {
      console.error(e);
    } finally {
      setTesting(false);
    }
  }

  function handleModeChange(mode) {
    const updated = savePrinterConfig({ mode });
    setConfig(updated);
    toast.success(`Printer mode set to: ${mode === "bluetooth" ? "Direct Web Bluetooth" : mode === "usb" ? "USB / Cable" : "In-Browser 58mm"}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-emerald-100 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition cursor-pointer"
            title="Close"
          >
            <FaTimes className="text-sm" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
              <FaPrint />
            </div>
            <div>
              <h3 className="text-lg font-bold">POSIFLOW PSF588 Setup</h3>
              <p className="text-xs text-emerald-100">100% In-Webpage Direct Printing (Zero Apps)</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-gray-700 text-sm overflow-y-auto max-h-[75vh]">
          {/* Bluetooth Status Box */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <FaBluetoothB className="text-emerald-600" /> Bluetooth Device Status
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {config.bluetoothDeviceName || "POSIFLOW PSF588"}
              </span>
            </div>
            <p className="text-xs text-emerald-950/80">
              Web Bluetooth communicates directly from Chrome to your printer. No Android spooler, no RawBT, no third-party apps required.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                onClick={handlePairBluetooth}
                disabled={pairing || !btSupported}
                className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <FaBolt /> {pairing ? "Pairing..." : "Pair POSIFLOW 588"}
              </button>

              <button
                onClick={handleTestPrint}
                disabled={testing}
                className="flex-1 py-2.5 px-3 bg-white hover:bg-gray-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <FaPrint /> {testing ? "Printing..." : "Test Print"}
              </button>
            </div>

            {!btSupported && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <FaExclamationTriangle className="shrink-0" />
                <span>Web Bluetooth requires Chrome on Android or Desktop.</span>
              </div>
            )}
          </div>

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Printing Engine
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => handleModeChange("bluetooth")}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                  config.mode === "bluetooth"
                    ? "bg-emerald-50/80 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500 font-semibold"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${config.mode === "bluetooth" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                    <FaBluetoothB />
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm">Web Bluetooth (Recommended)</div>
                    <div className="text-[11px] text-gray-500">Fast wireless 1-click print directly to POSIFLOW PSF588</div>
                  </div>
                </div>
                {config.mode === "bluetooth" && <FaCheckCircle className="text-emerald-600 text-base" />}
              </button>

              <button
                onClick={() => handleModeChange("system")}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                  config.mode === "system"
                    ? "bg-emerald-50/80 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500 font-semibold"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${config.mode === "system" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                    <FaFileInvoice />
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm">In-Browser 58mm HTML Print</div>
                    <div className="text-[11px] text-gray-500">Zero-margin roll preview inside the browser</div>
                  </div>
                </div>
                {config.mode === "system" && <FaCheckCircle className="text-emerald-600 text-base" />}
              </button>

              <button
                onClick={() => handleModeChange("usb")}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                  config.mode === "usb"
                    ? "bg-emerald-50/80 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500 font-semibold"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${config.mode === "usb" ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                    <FaUsb />
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm">USB / Serial Cable</div>
                    <div className="text-[11px] text-gray-500">Via OTG cable on Android or USB on PC</div>
                  </div>
                </div>
                {config.mode === "usb" && <FaCheckCircle className="text-emerald-600 text-base" />}
              </button>
            </div>
          </div>

          {/* Paper roll saving features */}
          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200/70 text-xs space-y-1.5">
            <div className="font-bold text-gray-800 flex items-center gap-1.5">
              <span>🌱</span> Paper Roll Saving Optimized
            </div>
            <p className="text-gray-500 text-[11px] leading-relaxed">
              • Tight line pitch: 22-dot spacing saves 50%+ roll length.<br/>
              • Compact single-line bold headers and combined property keys.<br/>
              • 2-line partial feed: perfect tear blade clearance without roll waste.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}

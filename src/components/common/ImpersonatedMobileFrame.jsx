import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  FaMobileAlt,
  FaRedo,
  FaLaptop,
  FaWifi,
  FaBatteryFull,
  FaSignal,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

const DEVICES = {
  iphone15: {
    name: "iPhone 15 Pro",
    width: 393,
    height: 844,
    radius: "rounded-[50px]",
    notch: "island", // dynamic island
  },
  pixel: {
    name: "Google Pixel 8",
    width: 412,
    height: 890,
    radius: "rounded-[46px]",
    notch: "punch", // punch hole
  },
  compact: {
    name: "Compact Phone",
    width: 375,
    height: 720,
    radius: "rounded-[40px]",
    notch: "notch", // classic notch
  },
};

export default function ImpersonatedMobileFrame() {
  const { impersonatedUser, setImpersonatedDeviceMode } = useAuth();
  const location = useLocation();
  const [selectedDevice, setSelectedDevice] = useState("iphone15");
  const [currentTime, setCurrentTime] = useState("");
  const iframeRef = useRef(null);

  // Update real-time clock for status bar
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).replace(" ", "")
      );
    }
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  const device = DEVICES[selectedDevice] || DEVICES.iphone15;

  // Build iframe URL with frame query parameter to prevent nested banners
  const buildIframeUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set("simulated_frame", "true");
    return `${location.pathname}?${searchParams.toString()}${location.hash}`;
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = buildIframeUrl();
    }
  };

  return (
    <div className="min-h-[calc(100vh-50px)] bg-slate-950 text-white flex flex-col items-center py-6 px-4 select-none animate-fadeIn">
      {/* Top Device Simulator Control Bar */}
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-3 mb-6 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-200">
            Simulating Mobile Device:
          </span>
          <span className="text-emerald-400 font-semibold underline decoration-emerald-500/50">
            {impersonatedUser?.name || "Resident"}
          </span>
        </div>

        {/* Device Switcher & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Device Model Selector */}
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="iphone15">📱 iPhone 15 Pro (393 × 844)</option>
            <option value="pixel">📱 Pixel 8 (412 × 890)</option>
            <option value="compact">📱 Compact (375 × 720)</option>
          </select>

          {/* Reload inside phone */}
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Reload mobile screen"
          >
            <FaRedo className="text-xs" />
          </button>

          {/* Switch back to Desktop View */}
          <button
            onClick={() => setImpersonatedDeviceMode("desktop")}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs"
            title="Switch back to full desktop view"
          >
            <FaLaptop className="text-xs" />
            <span>Switch to Desktop View</span>
          </button>
        </div>
      </div>

      {/* Realistic Smartphone Chassis */}
      <div
        style={{
          width: `${device.width}px`,
          height: `${device.height}px`,
        }}
        className={`relative bg-slate-900 ${device.radius} shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-[11px] border-slate-800 ring-2 ring-slate-700/60 overflow-hidden flex flex-col transition-all duration-300`}
      >
        {/* Notch / Dynamic Island / Punch Hole */}
        {device.notch === "island" && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-between px-3 shadow-md pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-950 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-900" />
            </div>
          </div>
        )}

        {device.notch === "punch" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-black rounded-full z-50 shadow-md pointer-events-none border border-slate-800" />
        )}

        {device.notch === "notch" && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-5 bg-black rounded-b-xl z-50 shadow-md pointer-events-none flex items-center justify-center">
            <div className="w-12 h-1 bg-slate-800 rounded-full" />
          </div>
        )}

        {/* Smartphone Status Bar */}
        <div className="w-full h-8 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 px-6 flex items-center justify-between text-[11px] font-semibold select-none shrink-0 z-40 border-b border-slate-100 dark:border-slate-800/60">
          <span>{currentTime || "9:41"}</span>
          <div className="flex items-center gap-1.5 text-xs">
            <FaSignal className="text-[10px]" />
            <FaWifi className="text-[10px]" />
            <FaBatteryFull className="text-xs text-emerald-500" />
          </div>
        </div>

        {/* Live Portal Screen within Phone Viewport */}
        <div className="flex-1 w-full relative bg-white dark:bg-slate-900 overflow-hidden">
          <iframe
            ref={iframeRef}
            key={`${location.pathname}-${selectedDevice}`}
            src={buildIframeUrl()}
            title="Mobile Screen Portal Simulator"
            className="w-full h-full border-0"
          />
        </div>

        {/* Bottom Home Swipe Bar Indicator */}
        <div className="w-full h-4 bg-white dark:bg-slate-950 flex items-center justify-center shrink-0 z-40">
          <div className="w-32 h-1 bg-slate-400 dark:bg-slate-600 rounded-full" />
        </div>
      </div>

      {/* Helper Guidance Below Phone */}
      <div className="mt-4 text-center text-slate-400 text-xs max-w-sm">
        <p className="flex items-center justify-center gap-1 font-medium">
          <FaMobileAlt className="text-emerald-400" />
          <span>True Mobile Viewport: Tap, swipe, and test resident features.</span>
        </p>
      </div>
    </div>
  );
}

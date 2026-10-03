import React, { useState, useEffect } from "react";

export default function BrandPageLoader({ message = "Loading portal..." }) {
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const slowTimer = setTimeout(() => {
      setSlowNetwork(true);
    }, 3500);

    const retryTimer = setTimeout(() => {
      setShowRetry(true);
    }, 7000);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(retryTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white p-6">
      <div className="w-16 h-16 rounded-2xl bg-white shadow-xl shadow-blue-500/20 flex items-center justify-center p-2.5 mb-3 transition-transform animate-pulse">
        <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="24" width="14" height="30" rx="2" fill="#1e3a8a" />
          <rect x="12" y="28" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="16.5" y="28" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="12" y="34" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="16.5" y="34" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="12" y="40" width="2.5" height="3" rx="0.5" fill="#93c5fd" />
          <rect x="16.5" y="40" width="2.5" height="3" rx="0.5" fill="#93c5fd" />

          <rect x="24" y="10" width="18" height="44" rx="2.5" fill="#0f172a" />
          <polygon points="33,4 23,10 43,10" fill="#1d4ed8" />
          <rect x="28" y="15" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="15" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="28" y="21" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="21" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="28" y="27" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="27" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="28" y="33" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="33" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="28" y="39" width="3" height="3.5" rx="0.5" fill="#60a5fa" />
          <rect x="34" y="39" width="3" height="3.5" rx="0.5" fill="#60a5fa" />

          <rect x="44" y="20" width="13" height="34" rx="2" fill="#1e3a8a" />
          <rect x="47.5" y="25" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="51.5" y="25" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="47.5" y="31" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="51.5" y="31" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="47.5" y="37" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />
          <rect x="51.5" y="37" width="2.5" height="3" rx="0.5" fill="#bfdbfe" />

          <path d="M4 52 C18 48, 38 49, 60 52 C52 56, 12 56, 4 52Z" fill="#15803d" />
          <path d="M6 53.5 C20 50, 42 51, 58 53.5 C48 57, 16 57, 6 53.5Z" fill="#22c55e" />
          <circle cx="10" cy="48" r="3" fill="#15803d" />
          <circle cx="22" cy="49" r="2.5" fill="#16a34a" />
          <circle cx="55" cy="49" r="3" fill="#15803d" />
        </svg>
      </div>

      <div className="w-28 h-1 bg-slate-800 rounded-full overflow-hidden relative mb-3">
        <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-[splashShimmer_1.4s_infinite_ease-in-out]" />
      </div>

      <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase text-center">
        {message}
      </div>

      {slowNetwork && (
        <div className="mt-4 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-medium text-amber-300 animate-in fade-in duration-300 text-center">
          ⚠️ Slow network connection detected. Connecting to society server...
        </div>
      )}

      {showRetry && (
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
        >
          Refresh Page
        </button>
      )}
    </div>
  );
}

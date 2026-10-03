import React from "react";
import { FaExclamationTriangle, FaRedo, FaHome } from "react-icons/fa";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({ errorInfo });

    // If this error is due to a stale chunk from a new deployment, auto-reload once
    const msg = String(error?.message || error || "");
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Expected a JavaScript-or-Wasm module script") ||
      msg.includes("error loading dynamically imported module")
    ) {
      const lastReload = sessionStorage.getItem("rwa_chunk_auto_reload");
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 15000) {
        sessionStorage.setItem("rwa_chunk_auto_reload", String(now));
        window.location.reload();
      }
    }
  }

  handleReload = async () => {
    if (typeof window !== "undefined" && "caches" in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((k) => caches.delete(k)));
      } catch {}
    }
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4 w-full">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Header Icon */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 text-2xl shadow-inner">
              <FaExclamationTriangle />
            </div>

            <h1 className="text-xl font-bold text-slate-900 mb-2">
              Something went wrong
            </h1>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              The application encountered an unexpected error. You can refresh the page to restore your session immediately.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 transition cursor-pointer"
              >
                <FaRedo className="text-xs" />
                Reload Page
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                <FaHome className="text-xs" />
                Go to Home
              </button>
            </div>

            {/* Error snippet if available */}
            {this.state.error?.message && (
              <div className="mt-6 text-left">
                <details className="text-xs text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <summary className="cursor-pointer font-medium text-slate-500 hover:text-slate-700">
                    Technical Details
                  </summary>
                  <p className="mt-2 font-mono text-[11px] text-red-600 break-words whitespace-pre-wrap">
                    {this.state.error.toString()}
                  </p>
                </details>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

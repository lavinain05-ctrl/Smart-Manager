import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

import { Toaster } from "react-hot-toast";

import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import DataProviders from "./components/common/DataProviders";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <DataProviders>
          <Toaster
            position="top-center"
            reverseOrder={false}
            gutter={8}
            toastOptions={{
              duration: 3500,
            }}
          />
          <App />
        </DataProviders>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);

// Service Worker registration for instant cached startup and offline support
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// ══════════════════════════════════════════════════════════════════
// Auto-Recovery for Stale Chunk Version Mismatch
// When new code is deployed, previously open tabs requesting old chunks
// automatically refresh once to fetch the latest bundle smoothly.
// ══════════════════════════════════════════════════════════════════
if (typeof window !== "undefined") {
  const triggerAutoReload = (reason) => {
    const lastReload = sessionStorage.getItem("rwa_chunk_auto_reload");
    const now = Date.now();
    // Throttle to at most one automatic reload every 15 seconds to prevent reload loops
    if (!lastReload || now - Number(lastReload) > 15000) {
      sessionStorage.setItem("rwa_chunk_auto_reload", String(now));
      console.warn(`[App] Stale bundle version detected (${reason}). Reloading for latest updates...`);
      window.location.reload();
    }
  };

  // Vite official event for failed dynamic module preload
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    triggerAutoReload("vite:preloadError");
  });

  // Catch dynamic import errors from unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const msg = String(event?.reason?.message || event?.reason || "");
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Expected a JavaScript-or-Wasm module script") ||
      msg.includes("error loading dynamically imported module")
    ) {
      event.preventDefault();
      triggerAutoReload("unhandledrejection");
    }
  });

  // Global window error listener
  window.addEventListener("error", (event) => {
    const msg = String(event?.message || "");
    if (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Expected a JavaScript-or-Wasm module script")
    ) {
      event.preventDefault();
      triggerAutoReload("window:error");
    }
  });
}
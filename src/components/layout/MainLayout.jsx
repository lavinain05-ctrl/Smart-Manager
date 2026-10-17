import { useState, Suspense } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import ErrorBoundary from "../common/ErrorBoundary";

function LayoutFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/50 flex items-center justify-center shadow-lg">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <span className="text-xs text-slate-500 font-semibold tracking-wide">Loading...</span>
      </div>
    </div>
  );
}

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("rwa_admin_sidebar_open");
      if (stored !== null) return stored === "true";
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("rwa_admin_sidebar_open", String(next));
      }
      return next;
    });
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("rwa_admin_sidebar_open", "false");
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* Mobile Overlay (Only on screens < 1024px when sidebar is open) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-2xs transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Wrapper */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 shrink-0 ${
          sidebarOpen
            ? "translate-x-0 lg:w-72"
            : "-translate-x-full lg:w-0 lg:overflow-hidden lg:opacity-0 lg:pointer-events-none"
        }`}
      >
        <Sidebar onClose={closeSidebar} />
      </div>

      {/* Main Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300">

        {/* Navbar */}
        <Navbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
        />

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
          <ErrorBoundary>
            <Suspense fallback={<LayoutFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>

      </div>

    </div>
  );
}
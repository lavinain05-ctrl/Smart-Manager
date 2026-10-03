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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Area */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Navbar */}
        <Navbar onToggleSidebar={() => setSidebarOpen(true)} />

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
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  FaEye,
  FaSignOutAlt,
  FaArrowLeft,
  FaShieldAlt,
  FaUserCheck,
  FaMobileAlt,
  FaLaptop,
  FaHome,
  FaReceipt,
  FaMoneyBillWave,
  FaExclamationCircle,
} from "react-icons/fa";

export default function ImpersonationBanner() {
  const {
    isImpersonating,
    impersonatedUser,
    stopImpersonating,
    impersonatedDeviceMode,
    setImpersonatedDeviceMode,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isInsideFrame =
    typeof window !== "undefined" &&
    (window.self !== window.top ||
      new URLSearchParams(location.search).has("simulated_frame"));

  if (!isImpersonating || !impersonatedUser || isInsideFrame) return null;

  const role = (impersonatedUser.role || "resident").toLowerCase();

  const handleExit = () => {
    stopImpersonating();
    navigate("/admin/activity-logs");
  };

  // Portal-specific quick navigation links
  const getQuickLinks = () => {
    if (role === "resident") {
      return [
        { label: "Dashboard", path: "/resident/dashboard" },
        { label: "Bills", path: "/resident/bills" },
        { label: "Payments", path: "/resident/payments" },
        { label: "Receipts", path: "/resident/receipts" },
        { label: "Complaints", path: "/resident/complaints" },
      ];
    }
    if (role === "collector") {
      return [
        { label: "Dashboard", path: "/collector/dashboard" },
        { label: "Collect", path: "/collector/collect" },
        { label: "History", path: "/collector/history" },
      ];
    }
    if (role === "committee") {
      return [
        { label: "Dashboard", path: "/committee/dashboard" },
        { label: "Garbage", path: "/committee/garbage" },
      ];
    }
    return [{ label: "Dashboard", path: "/admin/dashboard" }];
  };


  const quickLinks = getQuickLinks();

  return (
    <aside aria-label="Portal simulation debug banner" className="sticky top-0 z-[9999] bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-lg border-b-2 border-amber-400">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        {/* Left: User identity & Simulation Indicator */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 font-bold text-[11px] shadow-sm">
            <FaEye className="text-white" /> Admin Live Mirror (Real Data)
          </span>

          <span className="text-amber-100 hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5 font-semibold text-white">
            <span className="text-amber-200">Viewing exact portal screen of:</span>
            <span className="font-bold underline decoration-amber-300 underline-offset-2">
              {impersonatedUser.name || "User"}
            </span>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-black/20 font-semibold uppercase text-[10px] tracking-wider text-amber-100 border border-white/10">
            {role}
          </span>

          {impersonatedUser.mobile && (
            <span className="text-amber-100 font-mono text-[11px]">
              📞 {impersonatedUser.mobile}
            </span>
          )}

          {impersonatedUser.flat && (
            <span className="bg-amber-800/60 px-2 py-0.5 rounded font-semibold text-[11px]">
              Flat: {impersonatedUser.flat}
            </span>
          )}
        </div>

        {/* Center: Quick navigation links across this user's portal */}
        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
          <span className="text-amber-200 text-[11px] font-medium hidden lg:inline mr-1">
            Jump to screen:
          </span>
          {quickLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-2 py-1 rounded-lg font-medium transition text-[11px] ${
                  isActive
                    ? "bg-white text-orange-800 font-bold shadow-sm"
                    : "bg-black/15 hover:bg-black/30 text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Right: Device Switcher & Exit Button */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Device Switcher */}
          <div className="flex items-center bg-black/30 p-1 rounded-xl border border-white/20 shadow-inner">
            <button
              type="button"
              onClick={() => setImpersonatedDeviceMode("desktop")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                impersonatedDeviceMode === "desktop"
                  ? "bg-white text-slate-900 shadow-sm font-bold"
                  : "text-amber-100 hover:text-white"
              }`}
              title="View full desktop portal screen"
            >
              <FaLaptop className="text-xs" />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setImpersonatedDeviceMode("mobile")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                impersonatedDeviceMode === "mobile"
                  ? "bg-emerald-500 text-white shadow-sm font-bold"
                  : "text-amber-100 hover:text-white"
              }`}
              title="View as simulated mobile device screen"
            >
              <FaMobileAlt className="text-xs" />
              <span>Mobile Screen</span>
            </button>
          </div>

          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-800 hover:bg-red-900 active:scale-95 text-white font-bold rounded-xl shadow transition border border-red-400 text-xs"
            title="Exit simulation and return to Admin Portal"
          >
            <FaSignOutAlt />
            <span>Exit to Admin</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

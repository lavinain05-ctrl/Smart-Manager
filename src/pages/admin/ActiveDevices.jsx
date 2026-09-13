import { useState, useEffect } from "react";
import {
  FaLaptop,
  FaMobileAlt,
  FaTabletAlt,
  FaDesktop,
  FaSignOutAlt,
  FaShieldAlt,
  FaCheckCircle,
  FaClock,
  FaGlobe,
  FaExclamationTriangle,
  FaSpinner,
  FaSyncAlt,
} from "react-icons/fa";
import toast from "react-hot-toast";

import { useAuth } from "../../context/AuthContext";
import {
  subscribeUserActiveSessions,
  terminateSession,
  terminateAllOtherSessions,
  getOrCreateSessionId,
  initDeviceSession,
} from "../../services/sessionService";

export default function ActiveDevices() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [terminatingAll, setTerminatingAll] = useState(false);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const currentSessionId = getOrCreateSessionId();

  // Subscribe to real-time active sessions for current admin
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Ensure device session is registered
    initDeviceSession(user).catch(() => {});

    // Safety timeout: Never hang in loading state longer than 1.5 seconds
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    const unsubscribe = subscribeUserActiveSessions(user.uid, (list) => {
      clearTimeout(safetyTimer);
      setSessions(list || []);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [user?.uid]);

  // Terminate a single specific device session
  async function handleLogoutDevice(sessionId, deviceName) {
    if (!sessionId) return;
    try {
      setActionLoadingId(sessionId);
      await terminateSession(sessionId, "This device was logged out by the Administrator.");
      toast.success(`Successfully logged out ${deviceName || "device"}!`);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to log out device.");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Terminate all other sessions except current device
  async function handleLogoutAllOtherDevices() {
    if (!user?.uid) return;
    try {
      setTerminatingAll(true);
      await terminateAllOtherSessions(
        user.uid,
        currentSessionId,
        "All other devices were logged out by the Administrator."
      );
      toast.success("Successfully logged out from all other devices!");
      setConfirmLogoutAll(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to log out other devices.");
    } finally {
      setTerminatingAll(false);
    }
  }

  function getDeviceIcon(deviceType) {
    const dev = (deviceType || "").toLowerCase();
    if (dev.includes("mobile") || dev.includes("phone")) {
      return <FaMobileAlt className="text-emerald-600 text-2xl" />;
    }
    if (dev.includes("tablet") || dev.includes("ipad")) {
      return <FaTabletAlt className="text-purple-600 text-2xl" />;
    }
    if (dev.includes("desktop")) {
      return <FaDesktop className="text-blue-600 text-2xl" />;
    }
    return <FaLaptop className="text-emerald-600 text-2xl" />;
  }

  function formatTime(timestamp) {
    if (!timestamp) return "Recently";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return "Recently";
    }
  }

  const otherSessionsCount = sessions.filter((s) => !s.isCurrentDevice).length;
  const currentSession = sessions.find((s) => s.isCurrentDevice);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
              <FaShieldAlt />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Active Devices & Logins</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Monitor and manage all browsers and devices where your Administrator ID is signed in
              </p>
            </div>
          </div>
        </div>

        {otherSessionsCount > 0 && (
          <div>
            {!confirmLogoutAll ? (
              <button
                type="button"
                onClick={() => setConfirmLogoutAll(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-semibold text-xs transition shadow-sm"
              >
                <FaSignOutAlt />
                <span>Log Out All Other Devices ({otherSessionsCount})</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 p-2 rounded-xl border border-red-200">
                <span className="text-xs text-red-800 font-medium">Log out all other {otherSessionsCount} devices?</span>
                <button
                  type="button"
                  disabled={terminatingAll}
                  onClick={handleLogoutAllOtherDevices}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  {terminatingAll ? <FaSpinner className="animate-spin text-xs" /> : null}
                  <span>Confirm</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmLogoutAll(false)}
                  className="px-2.5 py-1.5 text-gray-600 hover:text-gray-800 text-xs font-medium"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
            <FaLaptop />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Active Devices</p>
            <p className="text-2xl font-bold text-gray-900">{sessions.length || 1}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
            <FaCheckCircle />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">This Device</p>
            <p className="text-sm font-bold text-gray-900 truncate">
              {currentSession ? `${currentSession.os} • ${currentSession.browser}` : "Current Browser"}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
            <FaGlobe />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Other Active Devices</p>
            <p className="text-2xl font-bold text-gray-900">{otherSessionsCount}</p>
          </div>
        </div>
      </div>

      {/* Device List Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
            Connected Devices ({sessions.length})
          </h2>
          <span className="text-xs text-emerald-600 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync Active
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
            <FaSpinner className="animate-spin text-2xl text-emerald-600" />
            <span className="text-xs font-medium">Loading active sessions...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FaLaptop className="text-4xl mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium text-gray-600">No active sessions found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sessions.map((session) => {
              const isCurrent = session.isCurrentDevice;
              const isTerminating = actionLoadingId === session.id;
              const deviceLabel = `${session.os || "Device"} • ${session.browser || "Browser"}`;

              return (
                <div
                  key={session.id}
                  className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isCurrent ? "bg-emerald-50/40" : "hover:bg-gray-50/60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0">
                      {getDeviceIcon(session.device)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">
                          {deviceLabel}
                        </span>

                        {isCurrent ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            This Device (Current)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Active Device
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        {session.screen && session.screen !== "Unknown" && (
                          <span>Screen: {session.screen}</span>
                        )}
                        <span>Device Type: {session.device || "Desktop"}</span>
                        <span>Logged in: {formatTime(session.createdAt)}</span>
                        <span>Last active: {formatTime(session.lastActiveAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isCurrent ? (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/70 py-1.5 px-3 rounded-xl">
                        Active Now
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isTerminating}
                        onClick={() => handleLogoutDevice(session.id, deviceLabel)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200 rounded-xl text-xs font-semibold transition shadow-sm"
                      >
                        {isTerminating ? (
                          <>
                            <FaSpinner className="animate-spin text-xs" />
                            <span>Logging out...</span>
                          </>
                        ) : (
                          <>
                            <FaSignOutAlt className="text-xs" />
                            <span>Log Out Device</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Guidance Card */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3.5">
        <FaExclamationTriangle className="text-amber-600 text-lg shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-amber-900 leading-relaxed">
          <p className="font-bold text-sm text-amber-950">Security Notice & Device Protection</p>
          <p>
            • If you see any browser or device you do not recognize, click <strong>"Log Out Device"</strong> immediately.
          </p>
          <p>
            • <strong>Automatic Security Invalidation:</strong> Whenever you change or reset your administrator password, all other devices are automatically logged out for your security.
          </p>
        </div>
      </div>
    </div>
  );
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import {
  login as loginService,
  logout as logoutService,
  subscribeAuth,
  fetchUserProfile,
} from "../services/authService";
import { ensureActiveSessionLogged } from "../services/loginTrackerService";
import {
  initDeviceSession,
  touchSession,
  subscribeCurrentSession,
  terminateSession,
  getOrCreateSessionId,
} from "../services/sessionService";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [impersonatedUser, setImpersonatedUser] = useState(() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const raw = sessionStorage.getItem("admin_impersonated_user");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [impersonatedDeviceMode, setImpersonatedDeviceModeState] = useState(() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return sessionStorage.getItem("admin_impersonated_device_mode") || "desktop";
    }
    return "desktop";
  });

  function setImpersonatedDeviceMode(mode) {
    const validMode = mode === "mobile" ? "mobile" : "desktop";
    setImpersonatedDeviceModeState(validMode);
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.setItem("admin_impersonated_device_mode", validMode);
    }
  }

  useEffect(() => {
    let sessionUnsubscribe = null;
    let touchInterval = null;
    let userDocUnsub = null;
    let regDocUnsub = null;

    const unsubscribe = subscribeAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }
      if (regDocUnsub) {
        regDocUnsub();
        regDocUnsub = null;
      }

      if (currentUser?.uid) {
        ensureActiveSessionLogged(currentUser);

        // Register active device session & listen for remote logout
        initDeviceSession(currentUser);
        const currentSessionId = getOrCreateSessionId();

        if (sessionUnsubscribe) {
          sessionUnsubscribe();
        }

        sessionUnsubscribe = subscribeCurrentSession(currentSessionId, async (reason) => {
          console.warn("[AuthContext] Active session revoked remotely:", reason);
          stopImpersonating();
          await logoutService();
          setUser(null);
          toast.error(reason || "You have been logged out from this device.", {
            id: "remote-device-logout",
            duration: 6000,
          });
        });

        // Touch session every 5 minutes to keep lastActive timestamp fresh
        if (touchInterval) clearInterval(touchInterval);
        touchInterval = setInterval(() => {
          touchSession(currentSessionId);
        }, 5 * 60 * 1000);

        // Real-time Firestore profile listener on users/{uid}
        // Guarantees immediate UI sync when admin approves registration, activates account, or changes role
        userDocUnsub = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUser((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                ...data,
                role: (data.role || prev.role || "").toLowerCase(),
                status: (data.status || prev.status || "active").toLowerCase(),
                mobile: data.mobile || data.phone || prev.mobile || prev.phone || "",
                phone: data.phone || data.mobile || prev.phone || prev.mobile || "",
                mustChangePassword: data.mustChangePassword === true,
              };
            });
          }
        }, (err) => {
          // If users doc doesn't exist yet (e.g. pending request), ignore permission warning
        });

        // If user is pending registration, also listen to registrationRequests/{uid}
        if (currentUser.role === "pending_registration" || currentUser.status === "pending") {
          regDocUnsub = onSnapshot(doc(db, "registrationRequests", currentUser.uid), async (docSnap) => {
            if (docSnap.exists()) {
              const regData = docSnap.data();
              if (regData.status === "approved") {
                console.log("[AuthContext] Real-time approval detected for:", currentUser.uid);
                if (auth.currentUser) {
                  const refreshed = await fetchUserProfile(auth.currentUser);
                  if (refreshed) {
                    setUser(refreshed);
                    toast.success("🎉 Your registration has been approved!");
                  }
                }
              } else if (regData.status === "rejected") {
                setUser((prev) => prev ? ({
                  ...prev,
                  status: "rejected",
                  rejectionReason: regData.rejectionReason || "",
                }) : null);
              }
            }
          }, () => {});
        }

        // Only actual admins are allowed to have an active impersonation session
        if (currentUser.role !== "admin") {
          setImpersonatedUser(null);
          setImpersonatedDeviceModeState("desktop");
          if (typeof window !== "undefined" && window.sessionStorage) {
            sessionStorage.removeItem("admin_impersonated_user");
            sessionStorage.removeItem("admin_impersonated_device_mode");
          }
        }
      } else {
        if (sessionUnsubscribe) {
          sessionUnsubscribe();
          sessionUnsubscribe = null;
        }
        if (touchInterval) {
          clearInterval(touchInterval);
          touchInterval = null;
        }
        setImpersonatedUser(null);
        setImpersonatedDeviceModeState("desktop");
      }
    });

    return () => {
      unsubscribe();
      if (sessionUnsubscribe) sessionUnsubscribe();
      if (touchInterval) clearInterval(touchInterval);
      if (userDocUnsub) userDocUnsub();
      if (regDocUnsub) regDocUnsub();
    };
  }, []);

  // =============================
  // Login (mobile or email)
  // =============================

  async function login(identifier, password) {
    try {
      const user = await loginService(identifier, password);
      // Synchronously set in context immediately to avoid navigation race condition
      setUser(user);

      if (user.mustChangePassword) {
        toast("You must set a new password to continue", { icon: "🔐" });
      } else if (user.role === "pending_registration" || user.status === "pending") {
        toast("Your registration is pending approval", { icon: "⏳" });
      } else if (user.status === "rejected") {
        toast.error("Your registration was rejected");
      } else {
        toast.success(`Welcome ${user.name || "back"}!`);
      }

      return user;
    } catch (error) {
      console.error(error);

      if (error.code === "auth/invalid-credential") {
        toast.error("Invalid mobile number or password");
      } else {
        toast.error(error.message || "Login failed");
      }

      throw error;
    }
  }

  // =============================
  // Impersonate / View As User (Admin Support Tool)
  // =============================

  function impersonateUser(targetProfile, deviceMode) {
    if (!targetProfile) return;
    const profile = {
      ...targetProfile,
      role: (targetProfile.role || "resident").toLowerCase(),
      status: "Active",
      isImpersonated: true,
      originalAdminUid: user?.uid || "",
      originalAdminName: user?.name || "Admin",
    };
    setImpersonatedUser(profile);
    if (deviceMode) {
      setImpersonatedDeviceMode(deviceMode);
    }
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.setItem("admin_impersonated_user", JSON.stringify(profile));
    }
    toast.success(
      `Simulating ${profile.name || "User"}'s portal (${deviceMode === "mobile" ? "Mobile View" : "Desktop View"})`,
      {
        icon: deviceMode === "mobile" ? "📱" : "👁️",
      }
    );
  }

  function stopImpersonating(silent = false) {
    const wasImpersonating = Boolean(impersonatedUser);
    setImpersonatedUser(null);
    setImpersonatedDeviceMode("desktop");
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.removeItem("admin_impersonated_user");
      sessionStorage.removeItem("admin_impersonated_device_mode");
    }
    if (wasImpersonating && !silent) {
      toast.success("Returned to Admin Portal", { icon: "🛡️" });
    }
  }

  // =============================
  // Clear mustChangePassword flag (after password change)
  // =============================

  function clearMustChangePassword() {
    if (user) {
      setUser({ ...user, mustChangePassword: false });
    }
  }

  // =============================
  // Logout
  // =============================

  async function logout() {
    try {
      stopImpersonating(true);
      try {
        const currentSessionId = getOrCreateSessionId();
        await terminateSession(currentSessionId, "User signed out");
      } catch (sessErr) {
        console.warn("[AuthContext] Session terminate on logout error:", sessErr.message);
      }

      await logoutService();
      setUser(null);
      toast.success("Logged out");
    } catch (error) {
      console.error(error);
      toast.error("Logout failed");
    }
  }

  async function refreshUser() {
    if (auth.currentUser) {
      const refreshed = await fetchUserProfile(auth.currentUser);
      if (refreshed) {
        setUser(refreshed);
        return refreshed;
      }
    }
    return null;
  }

  // Effective user: if admin is viewing as another user, return that user profile
  const effectiveUser = impersonatedUser || user;

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        realUser: user,
        impersonatedUser,
        isImpersonating: Boolean(impersonatedUser),
        impersonatedDeviceMode,
        setImpersonatedDeviceMode,
        impersonateUser,
        stopImpersonating,
        loading,
        login,
        logout,
        setUser,
        refreshUser,
        clearMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import toast from "react-hot-toast";

import { doc, onSnapshot, getDocs, collection, query, where, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import {
  login as loginService,
  logout as logoutService,
  subscribeAuth,
  fetchUserProfile,
  normalizeMobile,
} from "../services/authService";
import { ensureActiveSessionLogged } from "../services/loginTrackerService";
import {
  initDeviceSession,
  touchSession,
  subscribeCurrentSession,
  terminateSession,
  getOrCreateSessionId,
  startNewSessionId,
  resetSessionId,
} from "../services/sessionService";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const sessionUnsubscribeRef = useRef(null);
  const touchIntervalRef = useRef(null);
  const isLoggingOutRef = useRef(false);

  const [user, setUser] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const cached = localStorage.getItem("rwa_cached_user_profile");
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        return !localStorage.getItem("rwa_cached_user_profile");
      } catch {
        return true;
      }
    }
    return true;
  });

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
    let userDocUnsub = null;
    let regDocUnsub = null;

    // Liveness fallback: never leave user stuck on loader if network is slow
    const livenessTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("[Auth] Auth state check timed out on slow network — clearing loader");
          return false;
        }
        return prev;
      });
    }, 3000);

    const unsubscribe = subscribeAuth((currentUser) => {
      clearTimeout(livenessTimer);
      setUser(currentUser);
      setLoading(false);

      if (currentUser?.uid) {
        try {
          localStorage.setItem("rwa_cached_user_profile", JSON.stringify(currentUser));
        } catch {}

        try {
          if (!localStorage.getItem("rwa_session_login_time")) {
            localStorage.setItem("rwa_session_login_time", Date.now().toString());
          }
        } catch {}

        try {
          if (!sessionStorage.getItem("rwa_session_counted")) {
            sessionStorage.setItem("rwa_session_counted", "true");
            const prevCount = parseInt(localStorage.getItem("rwa_user_login_count") || "0", 10);
            localStorage.setItem("rwa_user_login_count", String(prevCount + 1));
          }
        } catch {}
      } else {
        try {
          localStorage.removeItem("rwa_cached_user_profile");
        } catch {}
        if (sessionUnsubscribeRef.current) {
          sessionUnsubscribeRef.current();
          sessionUnsubscribeRef.current = null;
        }
        if (touchIntervalRef.current) {
          clearInterval(touchIntervalRef.current);
          touchIntervalRef.current = null;
        }
      }

      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }
      if (regDocUnsub) {
        regDocUnsub();
        regDocUnsub = null;
      }

      if (currentUser?.uid) {
        isLoggingOutRef.current = false;
        ensureActiveSessionLogged(currentUser);

        // Register active device session & listen for remote logout
        initDeviceSession(currentUser);
        const currentSessionId = getOrCreateSessionId();

        if (sessionUnsubscribeRef.current) {
          sessionUnsubscribeRef.current();
          sessionUnsubscribeRef.current = null;
        }

        sessionUnsubscribeRef.current = subscribeCurrentSession(currentSessionId, async (reason) => {
          if (isLoggingOutRef.current || reason === "User signed out") {
            return;
          }
          console.warn("[AuthContext] Active session revoked remotely:", reason);
          if (sessionUnsubscribeRef.current) {
            sessionUnsubscribeRef.current();
            sessionUnsubscribeRef.current = null;
          }
          stopImpersonating();
          await logoutService();
          setUser(null);
          toast.error(reason || "You have been logged out from this device.", {
            id: "remote-device-logout",
            duration: 6000,
          });
        });

        // Touch session every 5 minutes to keep lastActive timestamp fresh
        if (touchIntervalRef.current) clearInterval(touchIntervalRef.current);
        touchIntervalRef.current = setInterval(() => {
          touchSession(currentSessionId);
        }, 5 * 60 * 1000);

        // Real-time Firestore profile listener on users/{uid}
        // Guarantees immediate UI sync when admin approves registration, activates account, or changes role
        userDocUnsub = onSnapshot(doc(db, "users", currentUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            let data = docSnap.data();

            // Real-time multi-device logout: Detect if password was changed on another device
            if (data.passwordChangedAt) {
              const pwChangedMillis = data.passwordChangedAt?.toMillis
                ? data.passwordChangedAt.toMillis()
                : data.passwordChangedAt ? new Date(data.passwordChangedAt).getTime() : 0;

              const sessionLoginTime = parseInt(
                localStorage.getItem("rwa_session_login_time") || "0",
                10
              );

              // If this device was logged in before the password change (allow 2s buffer)
              if (pwChangedMillis > 0 && sessionLoginTime > 0 && sessionLoginTime < pwChangedMillis - 2000) {
                if (!isLoggingOutRef.current) {
                  isLoggingOutRef.current = true;
                  console.warn("[AuthContext] Password was changed on another device. Revoking this session immediately.");
                  if (sessionUnsubscribeRef.current) {
                    sessionUnsubscribeRef.current();
                    sessionUnsubscribeRef.current = null;
                  }
                  if (touchIntervalRef.current) {
                    clearInterval(touchIntervalRef.current);
                    touchIntervalRef.current = null;
                  }
                  stopImpersonating(true);
                  resetSessionId();
                  try {
                    localStorage.removeItem("rwa_cached_user_profile");
                    localStorage.removeItem("rwa_session_login_time");
                  } catch {}
                  logoutService().catch(() => {});
                  setUser(null);
                  toast.error("Your password was changed. You have been logged out from this device.", {
                    id: "remote-pw-changed-logout",
                    duration: 7000,
                  });
                  return;
                }
              }
            }

            // Self-healing: If user is an active committee member, guarantee role is 'committee'
            if (data.role !== "admin" && data.role !== "committee") {
              const emailPrefix = (currentUser.email || "").split("@")[0];
              const fallbackMob = /^\d{10}$/.test(emailPrefix) ? emailPrefix : "";
              const mob = normalizeMobile(data.phone || data.mobile || fallbackMob);
              if (mob) {
                try {
                  const commSnap = await getDocs(query(collection(db, "committee"), where("phone", "==", mob)));
                  if (!commSnap.empty) {
                    const cData = commSnap.docs[0].data();
                    data.role = "committee";
                    data.isResident = true;
                    data.designation = cData.designation || data.designation || "Member";
                    data.permissions = cData.permissions || data.permissions || {};
                    setDoc(
                      doc(db, "users", currentUser.uid),
                      { role: "committee", isResident: true, designation: data.designation, permissions: data.permissions },
                      { merge: true }
                    ).catch(() => {});
                  }
                } catch (checkErr) {
                  console.warn("[AuthContext] Committee check error:", checkErr.message);
                }
              }
            }

            setUser((prev) => {
              if (!prev) return null;
              const updated = {
                ...prev,
                ...data,
                role: (data.role || prev.role || "").toLowerCase(),
                status: (data.status || prev.status || "active").toLowerCase(),
                mobile: data.mobile || data.phone || prev.mobile || prev.phone || "",
                phone: data.phone || data.mobile || prev.phone || prev.mobile || "",
                mustChangePassword: data.mustChangePassword === true,
              };
              try {
                localStorage.setItem("rwa_cached_user_profile", JSON.stringify(updated));
              } catch {}
              return updated;
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
                if (regDocUnsub) {
                  regDocUnsub();
                  regDocUnsub = null;
                }
                if (auth.currentUser) {
                  const refreshed = await fetchUserProfile(auth.currentUser);
                  if (refreshed) {
                    setUser(refreshed);
                    toast.success("🎉 Your registration has been approved!", { id: "reg-approved" });
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
        if (sessionUnsubscribeRef.current) {
          sessionUnsubscribeRef.current();
          sessionUnsubscribeRef.current = null;
        }
        if (touchIntervalRef.current) {
          clearInterval(touchIntervalRef.current);
          touchIntervalRef.current = null;
        }
        setImpersonatedUser(null);
        setImpersonatedDeviceModeState("desktop");
      }
    });

    return () => {
      unsubscribe();
      if (sessionUnsubscribeRef.current) {
        sessionUnsubscribeRef.current();
        sessionUnsubscribeRef.current = null;
      }
      if (touchIntervalRef.current) {
        clearInterval(touchIntervalRef.current);
        touchIntervalRef.current = null;
      }
      if (userDocUnsub) userDocUnsub();
      if (regDocUnsub) regDocUnsub();
    };
  }, []);

  // =============================
  // Login (mobile or email)
  // =============================

  async function login(identifier, password) {
    try {
      isLoggingOutRef.current = false;
      // Ensure this new login gets a clean, fresh session ID
      startNewSessionId();
      try {
        const prevCount = parseInt(localStorage.getItem("rwa_user_login_count") || "0", 10);
        localStorage.setItem("rwa_user_login_count", String(prevCount + 1));
        sessionStorage.setItem("rwa_session_counted", "true");
        sessionStorage.removeItem("rwa_notif_banner_dismissed_session");
      } catch {}
      const user = await loginService(identifier, password);
      // Synchronously set in context immediately to avoid navigation race condition
      setUser(user);
      try {
        localStorage.setItem("rwa_cached_user_profile", JSON.stringify(user));
      } catch {}

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
      console.error("[AuthContext] Login error:", error);
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
      const updated = { ...user, mustChangePassword: false };
      setUser(updated);
      try {
        localStorage.setItem("rwa_cached_user_profile", JSON.stringify(updated));
      } catch {}
    }
  }

  // =============================
  // Logout
  // =============================

  async function logout() {
    isLoggingOutRef.current = true;
    try {
      // 1. Immediately unsubscribe from session changes before modifying Firestore or Auth
      if (sessionUnsubscribeRef.current) {
        sessionUnsubscribeRef.current();
        sessionUnsubscribeRef.current = null;
      }
      if (touchIntervalRef.current) {
        clearInterval(touchIntervalRef.current);
        touchIntervalRef.current = null;
      }

      stopImpersonating(true);
      try {
        localStorage.removeItem("rwa_cached_user_profile");
        sessionStorage.removeItem("rwa_session_counted");
        sessionStorage.removeItem("rwa_notif_banner_dismissed_session");
      } catch {}

      const currentSessionId = getOrCreateSessionId();
      resetSessionId();

      // Graceful session termination in Firestore (best effort)
      try {
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
    } finally {
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 1000);
    }
  }

  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      const refreshed = await fetchUserProfile(auth.currentUser);
      if (refreshed) {
        setUser(refreshed);
        return refreshed;
      }
    }
    return null;
  }, []);

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
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  login as loginService,
  logout as logoutService,
  subscribeAuth,
} from "../services/authService";
import { ensureActiveSessionLogged } from "../services/loginTrackerService";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeAuth((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        ensureActiveSessionLogged(currentUser);
      }
    });

    return () => unsubscribe();
  }, []);

  // =============================
  // Login (mobile or email)
  // =============================

  async function login(identifier, password) {
    try {
      const user = await loginService(identifier, password);

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

  // =============================
  // Impersonate / View As User (Admin Support Tool)
  // =============================

  function impersonateUser(targetProfile) {
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
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.setItem("admin_impersonated_user", JSON.stringify(profile));
    }
    toast.success(`Simulating Portal as ${profile.name || "User"} (${profile.role || "member"})`, {
      icon: "👁️",
    });
  }


  function stopImpersonating() {
    setImpersonatedUser(null);
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionStorage.removeItem("admin_impersonated_user");
    }
    toast.success("Returned to Admin Portal", { icon: "🛡️" });
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
      stopImpersonating();
      await logoutService();

      setUser(null);

      toast.success("Logged out");
    } catch (error) {
      console.error(error);

      toast.error("Logout failed");
    }
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
        impersonateUser,
        stopImpersonating,
        loading,
        login,
        logout,
        setUser,
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
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../services/authService";

export default function CollectorRoute({ children }) {
  const { user, loading, isImpersonating } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  // Admin live portal simulation mode - allow immediate bypass
  if (isImpersonating) {
    return children;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const role = (user.role || "").toLowerCase();
  if (role !== "collector") {
    return <Navigate to={getHomeRouteForRole(role)} replace />;
  }

  return children;
}
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../services/authService";

export default function CommitteeRoute({ children }) {
  const { user, loading, isImpersonating } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600" />
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

  const role = (user?.role || "").toLowerCase();
  if (role !== "committee") {
    return <Navigate to={getHomeRouteForRole(role)} replace />;
  }

  return children;
}


import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../services/authService";
import BrandPageLoader from "../../components/common/BrandPageLoader";

export default function CollectorRoute({ children }) {
  const { user, loading, isImpersonating } = useAuth();

  if (loading) {
    return <BrandPageLoader message="Opening Collector Portal..." />;
  }

  // Admin live portal simulation mode - allow immediate bypass
  if (isImpersonating) {
    return children;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const role = (user.role || "").toLowerCase();
  if (!role) {
    return <BrandPageLoader message="Opening Collector Portal..." />;
  }
  if (role !== "collector") {
    return <Navigate to={getHomeRouteForRole(role)} replace />;
  }

  return children;
}
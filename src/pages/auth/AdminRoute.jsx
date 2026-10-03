import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../services/authService";
import BrandPageLoader from "../../components/common/BrandPageLoader";

export default function AdminRoute({ children }) {
  const { user, realUser, loading, isImpersonating } = useAuth();

  if (loading) {
    return <BrandPageLoader message="Opening Admin Portal..." />;
  }

  const effectiveUser = realUser || user;
  if (!effectiveUser) {
    return <Navigate to="/" replace />;
  }

  // If currently simulating a portal, check if the underlying actual user is admin
  const effectiveRole = (effectiveUser.role || "").toLowerCase();

  // If profile is still resolving its role, hold on the official brand loader
  if (!effectiveRole) {
    return <BrandPageLoader message="Opening Admin Portal..." />;
  }

  if (effectiveRole !== "admin") {
    return <Navigate to={getHomeRouteForRole(effectiveRole)} replace />;
  }

  return children;
}
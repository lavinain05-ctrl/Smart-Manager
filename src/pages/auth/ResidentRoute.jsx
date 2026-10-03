import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../services/authService";
import BrandPageLoader from "../../components/common/BrandPageLoader";

export default function ResidentRoute({ children }) {
  const { user, loading, isImpersonating } = useAuth();

  if (loading) {
    return <BrandPageLoader message="Opening Resident Portal..." />;
  }

  // Admin live portal simulation mode - allow immediate bypass
  if (isImpersonating) {
    return children;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const role = (user?.role || "").toLowerCase();
  if (!role) {
    return <BrandPageLoader message="Opening Resident Portal..." />;
  }

  const canAccessResident =
    role === "resident" ||
    role === "committee";

  if (!canAccessResident) {
    return <Navigate to={getHomeRouteForRole(role)} replace />;
  }

  // Block pending or rejected residents
  const status = (user?.status || "").toLowerCase();
  if (status === "pending" || status === "rejected") {
    return <Navigate to="/pending-approval" replace />;
  }

  return children;
}


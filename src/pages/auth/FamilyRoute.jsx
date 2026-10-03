import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../services/authService";
import BrandPageLoader from "../../components/common/BrandPageLoader";

export default function FamilyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <BrandPageLoader message="Opening Family Portal..." />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const role = (user?.role || "").toLowerCase();
  if (!role) {
    return <BrandPageLoader message="Opening Family Portal..." />;
  }
  if (role !== "family") {
    return <Navigate to={getHomeRouteForRole(role)} replace />;
  }

  return children;
}

import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getHomeRouteForRole } from "../../services/authService";

export default function FamilyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const role = (user?.role || "").toLowerCase();
  if (role !== "family") {
    return <Navigate to={getHomeRouteForRole(role)} replace />;
  }

  return children;
}

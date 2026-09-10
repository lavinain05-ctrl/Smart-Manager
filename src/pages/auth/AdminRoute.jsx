import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function AdminRoute({ children }) {
  const { user, realUser, loading, isImpersonating } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user && !realUser) {
    return <Navigate to="/" replace />;
  }

  // If currently simulating a portal, check if the underlying actual user is admin
  const effectiveRole = ((realUser || user)?.role || "").toLowerCase();
  if (effectiveRole !== "admin") {
    return <Navigate to="/collector/dashboard" replace />;
  }

  return children;
}
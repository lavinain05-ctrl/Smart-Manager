import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ResidentRoute({ children }) {
  const { user, loading, isImpersonating } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600" />
      </div>
    );
  }

  // Admin live portal simulation mode - allow immediate bypass
  if (isImpersonating) {
    return children;
  }

  const role = (user?.role || "").toLowerCase();
  if (!user || role !== "resident") {
    return <Navigate to="/" replace />;
  }

  // Block pending or rejected residents
  const status = (user?.status || "").toLowerCase();
  if (status === "pending" || status === "rejected") {
    return <Navigate to="/pending-approval" replace />;
  }

  return children;
}


import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function FamilyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user || user.role !== "family") {
    return <Navigate to="/" replace />;
  }

  return children;
}

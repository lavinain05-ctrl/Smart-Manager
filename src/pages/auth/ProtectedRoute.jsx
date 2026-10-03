import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import BrandPageLoader from "../../components/common/BrandPageLoader";

export default function ProtectedRoute({
  children,
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <BrandPageLoader message="Verifying session..." />;
  }

  if (!user) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return children;
}
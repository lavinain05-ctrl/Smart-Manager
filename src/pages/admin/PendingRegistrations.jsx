import { Navigate } from "react-router-dom";

// Redirect to the new RegistrationRequests page
export default function PendingRegistrations() {
  return <Navigate to="/admin/registrations" replace />;
}

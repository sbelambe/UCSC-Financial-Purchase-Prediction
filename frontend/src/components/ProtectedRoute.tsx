import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// -----------------------------------------------------------------------------
// PROTECTED ROUTE
// Redirects unauthenticated users to the login page and renders nested content.
// -----------------------------------------------------------------------------
export default function ProtectedRoute() {
  const { user } = useAuth();

  // If not logged in, force them to the Login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If logged in, let them see the content (Dashboard)
  return <Outlet />;
}
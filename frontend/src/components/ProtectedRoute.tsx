import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component
 * Acts as a security guard for routes.
 * * Logic:
 * 1. Checks if a user is present in the AuthContext.
 * 2. If NO user -> Redirects to /login.
 * 3. If YES user -> Renders the child route (Outlet).
 */
export default function ProtectedRoute() {
  const { user } = useAuth();

  // If not logged in, force them to the Login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If logged in, let them see the content (Dashboard)
  return <Outlet />;
}
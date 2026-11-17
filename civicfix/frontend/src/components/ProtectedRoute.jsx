import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader"><span className="loader" />Loading CivicFix…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

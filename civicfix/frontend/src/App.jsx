import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './components/AppShell.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import Dashboard from './pages/Dashboard.jsx';
import IssuesPage from './pages/IssuesPage.jsx';
import NewIssuePage from './pages/NewIssuePage.jsx';
import IssueDetailPage from './pages/IssueDetailPage.jsx';
import TeamPage from './pages/TeamPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import LiveMapPage from './pages/LiveMapPage.jsx';
import WorkerPortal from './pages/WorkerPortal.jsx';
import SlaPage from './pages/SlaPage.jsx';
import PublicDashboard from './pages/PublicDashboard.jsx';
import QrLocationsPage from './pages/QrLocationsPage.jsx';
import QrReportPage from './pages/QrReportPage.jsx';
import FeedbackPage from './pages/FeedbackPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import BillingPage from './pages/BillingPage.jsx';
import SuperAdminPage from './pages/SuperAdminPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

function ManagerOnly({ children }) {
  const { isManager, loading } = useAuth();
  if (loading) return null;
  return isManager ? children : <Navigate to="/dashboard" replace />;
}

function SuperAdminOnly({ children }) {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return null;
  return isSuperAdmin ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public Unauthenticated Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/portal/:slug" element={<PublicDashboard />} />
      <Route path="/transparency/:slug" element={<PublicDashboard />} />
      <Route path="/public-dashboard/:slug" element={<PublicDashboard />} />
      <Route path="/p/:slug" element={<PublicDashboard />} />
      <Route path="/report/qr/:code" element={<QrReportPage />} />
      <Route path="/qr/:code" element={<QrReportPage />} />

      {/* Authenticated Workspace Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/issues/new" element={<NewIssuePage />} />
          <Route path="/issues/:id" element={<IssueDetailPage />} />
          <Route path="/map" element={<LiveMapPage />} />
          <Route path="/worker" element={<WorkerPortal />} />
          
          {/* Manager & Owner Features */}
          <Route path="/sla" element={<ManagerOnly><SlaPage /></ManagerOnly>} />
          <Route path="/qr-locations" element={<ManagerOnly><QrLocationsPage /></ManagerOnly>} />
          <Route path="/qr-scan" element={<QrLocationsPage />} />
          <Route path="/feedback" element={<ManagerOnly><FeedbackPage /></ManagerOnly>} />
          <Route path="/analytics" element={<ManagerOnly><AnalyticsPage /></ManagerOnly>} />
          <Route path="/team" element={<ManagerOnly><TeamPage /></ManagerOnly>} />
          <Route path="/reports" element={<ManagerOnly><ReportsPage /></ManagerOnly>} />
          <Route path="/billing" element={<ManagerOnly><BillingPage /></ManagerOnly>} />

          {/* Super Admin Control Center */}
          <Route path="/admin/super" element={<SuperAdminOnly><SuperAdminPage /></SuperAdminOnly>} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

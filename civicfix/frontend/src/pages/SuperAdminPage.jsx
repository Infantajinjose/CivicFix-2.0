import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  Layers,
  CreditCard,
  RefreshCw,
  Power,
  CheckCircle2,
  AlertTriangle,
  History,
  Sliders
} from 'lucide-react';
import { format } from 'date-fns';
import { api, getApiError } from '../lib/api.js';

export default function SuperAdminPage() {
  const [metrics, setMetrics] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyTenantId, setBusyTenantId] = useState(null);

  const loadPlatformData = async () => {
    setLoading(true);
    setError('');
    try {
      const [mRes, tRes, aRes] = await Promise.all([
        api.get('/superadmin/metrics'),
        api.get('/superadmin/tenants'),
        api.get('/superadmin/audit-logs')
      ]);
      setMetrics(mRes.data.data);
      setTenants(tRes.data.data.tenants);
      setAuditLogs(aRes.data.data.logs);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, []);

  const toggleTenantStatus = async (tenantId, currentStatus) => {
    setBusyTenantId(tenantId);
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/superadmin/tenants/${tenantId}/status`, { status: newStatus });
      await loadPlatformData();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusyTenantId(null);
    }
  };

  const changeTenantPlan = async (tenantId, newPlan) => {
    setBusyTenantId(tenantId);
    try {
      await api.patch(`/superadmin/tenants/${tenantId}/plan`, { plan: newPlan });
      await loadPlatformData();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusyTenantId(null);
    }
  };

  if (loading) {
    return <div className="screen-loader"><span className="loader" /> Loading Super Admin Console…</div>;
  }

  return (
    <div className="content-page superadmin-page-layout">
      <div className="page-intro-row">
        <div>
          <h2>Super Admin Platform Operations</h2>
          <p>Global multi-tenant governance, organization subscriptions, and platform audit trail.</p>
        </div>
        <button className="secondary-button" onClick={loadPlatformData} disabled={loading}>
          <RefreshCw size={15} /> Refresh Platform
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Global SaaS Platform Metrics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Building2 size={19} /></div>
          <div className="stat-label">Total Registered Tenants</div>
          <div className="stat-value">{metrics?.totalTenants ?? 0}</div>
          <div className="stat-hint">{metrics?.activeTenants ?? 0} active, {metrics?.suspendedTenants ?? 0} suspended</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><Users size={19} /></div>
          <div className="stat-label">Total Platform Users</div>
          <div className="stat-value">{metrics?.totalUsers ?? 0}</div>
          <div className="stat-hint">Across all client organisations</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple"><Layers size={19} /></div>
          <div className="stat-label">Total Platform Issues</div>
          <div className="stat-value">{metrics?.totalIssues ?? 0}</div>
          <div className="stat-hint">{metrics?.resolvedIssues ?? 0} verified resolved</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber"><CreditCard size={19} /></div>
          <div className="stat-label">Gross Platform Revenue</div>
          <div className="stat-value">₹{(metrics?.totalRevenueINR ?? 0).toLocaleString('en-IN')}</div>
          <div className="stat-hint">SaaS subscription billing total</div>
        </div>
      </div>

      {/* Tenants Management Table */}
      <section className="panel mt-4">
        <div className="panel-heading">
          <div>
            <h3>Registered SaaS Organisations</h3>
            <p>Manage tenant approvals, operational status, and subscription tier assignments.</p>
          </div>
        </div>

        <div className="standard-table-wrap">
          <table className="standard-table">
            <thead>
              <tr>
                <th>Organisation Name</th>
                <th>Public Slug</th>
                <th>Current Plan</th>
                <th>Users</th>
                <th>Complaints</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t._id}>
                  <td><strong>{t.name}</strong></td>
                  <td><code>/public/{t.slug}</code></td>
                  <td>
                    <select
                      value={t.plan}
                      onChange={e => changeTenantPlan(t._id, e.target.value)}
                      disabled={busyTenantId === t._id}
                      className="table-select"
                    >
                      <option value="starter">Starter</option>
                      <option value="professional">Professional</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </td>
                  <td>{t.userCount || 0}</td>
                  <td>{t.issueCount || 0}</td>
                  <td>
                    <span className={`status-pill pill-${t.status}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`secondary-button compact ${t.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => toggleTenantStatus(t._id, t.status)}
                      disabled={busyTenantId === t._id}
                    >
                      <Power size={13} /> {t.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Platform System Audit Log */}
      <section className="panel mt-4">
        <div className="panel-heading">
          <div>
            <h3>Security & Administrative Audit Trail</h3>
            <p>Immutable log of administrative operations, plan overrides, and account suspensions.</p>
          </div>
          <History size={18} className="panel-muted-icon" />
        </div>

        <div className="audit-feed">
          {auditLogs.length === 0 ? (
            <p className="text-muted p-4">No recent audit events.</p>
          ) : (
            auditLogs.map(log => (
              <div key={log._id} className="audit-item">
                <span className="audit-action-pill">{log.action}</span>
                <div className="audit-content">
                  <strong>{log.resourceType}: {log.resourceId}</strong>
                  <small>Executed by {log.userId?.name || 'Superadmin'} on {format(new Date(log.createdAt), 'dd MMM yyyy, hh:mm a')}</small>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

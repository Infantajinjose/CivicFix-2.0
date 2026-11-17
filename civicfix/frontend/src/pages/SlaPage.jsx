import { useState, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ShieldAlert,
  ArrowUpRight,
  RefreshCw,
  Save,
  Check
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { api, getApiError } from '../lib/api.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function SlaPage() {
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadSlaData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, configRes, escRes] = await Promise.all([
        api.get('/sla/stats'),
        api.get('/sla/config'),
        api.get('/sla/escalations')
      ]);
      setStats(statsRes.data.data);
      setConfig(configRes.data.data.config);
      setEscalations(escRes.data.data.escalations);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlaData();
  }, []);

  const handleRuleChange = (index, field, value) => {
    const updated = [...config.rules];
    updated[index][field] = Number(value) || 0;
    setConfig(prev => ({ ...prev, rules: updated }));
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch('/sla/config', {
        rules: config.rules,
        autoEscalate: config.autoEscalate
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const acknowledgeEscalation = async (escalationId) => {
    try {
      await api.patch(`/sla/escalations/${escalationId}/acknowledge`, {
        notes: 'Acknowledged by department management.'
      });
      await loadSlaData();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  return (
    <div className="content-page sla-page-layout">
      <div className="page-intro-row">
        <div>
          <h2>Service Level Agreements (SLA) & Escalation Hub</h2>
          <p>Configure resolution targets, monitor real-time SLA compliance, and manage automated manager escalations.</p>
        </div>
        <button className="secondary-button" onClick={loadSlaData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Metrics Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={19} /></div>
          <div className="stat-label">SLA Compliance Rate</div>
          <div className="stat-value">{stats?.complianceRate ?? 100}%</div>
          <div className="stat-hint">{stats?.withinSlaCount ?? 0} tickets resolved within target</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue"><Clock size={19} /></div>
          <div className="stat-label">Average Resolution Time</div>
          <div className="stat-value">{stats?.avgResolutionHours ?? 0} hrs</div>
          <div className="stat-hint">Across all resolved community issues</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={19} /></div>
          <div className="stat-label">Active Escalations</div>
          <div className="stat-value">{stats?.openEscalations ?? 0}</div>
          <div className="stat-hint">Breached deadlines awaiting review</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber"><ShieldAlert size={19} /></div>
          <div className="stat-label">Total Breached Issues</div>
          <div className="stat-value">{stats?.breachedCount ?? 0}</div>
          <div className="stat-hint">Historical tickets past SLA</div>
        </div>
      </div>

      <div className="dashboard-grid main-dashboard-grid mt-4">
        {/* Active Escalation Queue */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Active Escalation Queue</h3>
              <p>Tickets that breached target resolution time without completion.</p>
            </div>
            <span className="sla-pill-count">{escalations.filter(e => e.status === 'open').length} Open</span>
          </div>

          <div className="escalation-feed">
            {escalations.length === 0 ? (
              <div className="empty-sub-state">
                <CheckCircle2 size={32} className="text-brand" />
                <p>No breached escalations. All complaints are within SLA targets!</p>
              </div>
            ) : (
              escalations.map(esc => {
                const issue = esc.issueId;
                if (!issue) return null;
                const isOpen = esc.status === 'open';

                return (
                  <div key={esc._id} className={`escalation-item ${isOpen ? 'is-open' : 'is-ack'}`}>
                    <div className="esc-header">
                      <div className="esc-title-col">
                        <span className="esc-ticket">{issue.ticketNumber}</span>
                        <Link to={`/issues/${issue._id}`} className="esc-link">
                          <strong>{issue.title}</strong>
                        </Link>
                        <span className={`priority-chip priority-${issue.priority}`}>{issue.priority}</span>
                      </div>
                      <span className={`esc-badge ${isOpen ? 'badge-open' : 'badge-ack'}`}>
                        {isOpen ? `⚠️ Overdue ${esc.overdueHours}h` : 'Acknowledged'}
                      </span>
                    </div>

                    <p className="esc-reason">{esc.reason}</p>

                    <div className="esc-footer">
                      <small>Triggered {formatDistanceToNow(new Date(esc.createdAt), { addSuffix: true })}</small>
                      {isOpen && (
                        <button
                          className="secondary-button compact"
                          onClick={() => acknowledgeEscalation(esc._id)}
                        >
                          Acknowledge Escalation
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* SLA Configuration Matrix */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Organisation SLA Target Matrix</h3>
              <p>Configure allowable resolution windows for each priority tier.</p>
            </div>
            <Sliders size={18} className="panel-muted-icon" />
          </div>

          <form onSubmit={saveConfig} className="sla-config-form">
            <div className="sla-table-wrap">
              <table className="sla-matrix-table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Resolution Target</th>
                    <th>Warning Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {(config?.rules || []).map((rule, idx) => (
                    <tr key={rule.priority}>
                      <td>
                        <strong className={`priority-text priority-${rule.priority}`}>
                          {rule.priority.toUpperCase()}
                        </strong>
                      </td>
                      <td>
                        <div className="input-unit-wrap">
                          <input
                            type="number"
                            min="1"
                            max="720"
                            value={rule.resolutionHours}
                            onChange={e => handleRuleChange(idx, 'resolutionHours', e.target.value)}
                          />
                          <span>hours</span>
                        </div>
                      </td>
                      <td>
                        <div className="input-unit-wrap">
                          <input
                            type="number"
                            min="1"
                            max="72"
                            value={rule.warningHours}
                            onChange={e => handleRuleChange(idx, 'warningHours', e.target.value)}
                          />
                          <span>hours before</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sla-toggle-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config?.autoEscalate ?? true}
                  onChange={e => setConfig(prev => ({ ...prev, autoEscalate: e.target.checked }))}
                />
                <span>Automatically escalate overdue complaints to department managers via Socket.IO</span>
              </label>
            </div>

            <div className="form-submit-row mt-3">
              {saveSuccess && (
                <span className="text-green text-sm flex-center">
                  <Check size={16} /> SLA Targets Saved Successfully!
                </span>
              )}
              <button className="primary-button" disabled={saving}>
                <Save size={16} /> {saving ? 'Saving…' : 'Save SLA Targets'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

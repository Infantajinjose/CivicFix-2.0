import { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Users,
  Building2,
  MapPin,
  Sparkles,
  CheckCircle2,
  Clock,
  Printer
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { api, getApiError } from '../lib/api.js';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await api.get('/analytics');
      setData(res.data);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const exportCsv = () => {
    const token = localStorage.getItem('civicfix_token');
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    window.open(`${baseUrl}/analytics/export-csv?token=${token}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="screen-loader"><span className="loader" /> Generating predictive analytics…</div>;
  }

  const {
    metrics,
    categoryTrends,
    departmentMetrics,
    workerWorkload,
    hotspots,
    predictiveForecast,
    departmentRecommendations
  } = data || {};

  return (
    <div className="content-page analytics-page-layout">
      <div className="page-intro-row">
        <div>
          <h2>Advanced Analytics & Predictive Insights</h2>
          <p>Historical resolution intelligence, repeat problem hotspots, and algorithmic workload forecasts.</p>
        </div>
        <div className="btn-group">
          <button className="secondary-button" onClick={exportCsv}>
            <Download size={15} /> Export CSV Report
          </button>
          <button className="secondary-button" onClick={handlePrint}>
            <Printer size={15} /> Print / Save PDF
          </button>
          <button className="secondary-button" onClick={loadAnalytics}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* KPI Overview Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><FileBarChart size={19} /></div>
          <div className="stat-label">Total Logged Complaints</div>
          <div className="stat-value">{metrics?.total ?? 0}</div>
          <div className="stat-hint">{metrics?.pendingTotal ?? 0} currently active/pending</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={19} /></div>
          <div className="stat-label">Resolution Closure Rate</div>
          <div className="stat-value">{metrics?.resolutionRate ?? 0}%</div>
          <div className="stat-hint">{metrics?.resolved ?? 0} issues successfully verified</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber"><Clock size={19} /></div>
          <div className="stat-label">SLA Compliance Rate</div>
          <div className="stat-value">{metrics?.slaComplianceRate ?? 100}%</div>
          <div className="stat-hint">Avg {metrics?.avgResolutionHours ?? 0}h resolution duration</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple"><Sparkles size={19} /></div>
          <div className="stat-label">User Satisfaction Score</div>
          <div className="stat-value">{metrics?.userSatisfaction ?? '4.8'} / 5</div>
          <div className="stat-hint">Citizen rating index</div>
        </div>
      </div>

      {/* Predictive Workload Forecast Banner */}
      <section className="panel predictive-forecast-card mt-4">
        <div className="panel-heading">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand" />
            <div>
              <h3>Workload Forecast (Next 4 Weeks)</h3>
              <p>Predictive model based on 30-day moving averages and historical intake velocity.</p>
            </div>
          </div>
          <span className="prediction-disclaimer-pill">
            Statistical Projection &middot; Not Guaranteed
          </span>
        </div>

        <div className="forecast-grid">
          {(predictiveForecast || []).map((fc, i) => (
            <div key={i} className="forecast-item">
              <span className="fc-period">{fc.period}</span>
              <strong className="fc-expected">~{fc.expectedComplaints} complaints</strong>
              <small className="fc-confidence">Model Confidence: {fc.confidence}</small>
            </div>
          ))}
        </div>
      </section>

      {/* Charts Grid */}
      <div className="dashboard-grid main-dashboard-grid mt-4">
        {/* Department Efficiency */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Department Efficiency & Volumes</h3>
              <p>Work intake versus verified closure by department</p>
            </div>
          </div>

          <div className="chart-wrap" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: 'var(--muted)' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="total" name="Total Ingested" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Worker Workload Index */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Field Worker Workload Distribution</h3>
              <p>Current active tickets per registered technician</p>
            </div>
            <Users size={18} className="panel-muted-icon" />
          </div>

          <div className="worker-workload-list">
            {(workerWorkload || []).length === 0 ? (
              <p className="text-muted p-4">No active field workers registered.</p>
            ) : (
              workerWorkload.map(w => (
                <div key={w.workerId} className="worker-load-item">
                  <div className="worker-load-header">
                    <strong>{w.name}</strong>
                    <span className={`load-badge load-${w.loadStatus}`}>
                      {w.activeTasks} Active Tasks ({w.loadStatus})
                    </span>
                  </div>
                  <div className="worker-load-sub">
                    <span>Dept: {w.department || 'Field'}</span>
                    <span>Completed: {w.completedTasks} total</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Repeated Complaint Hotspots & Resource Recommendations */}
      <div className="dashboard-grid lower-dashboard-grid mt-4">
        {/* Hotspots */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Repeat Problem Hotspots (Clustered Zones)</h3>
              <p>Locations with recurrent incidents within 150m radius</p>
            </div>
            <MapPin size={18} className="panel-muted-icon" />
          </div>

          <div className="hotspot-list">
            {(hotspots || []).length === 0 ? (
              <div className="empty-sub-state">
                <CheckCircle2 size={32} className="text-brand" />
                <p>No acute geographic repeat hotspots detected in the community.</p>
              </div>
            ) : (
              hotspots.map((hs, idx) => (
                <div key={idx} className="hotspot-card">
                  <div className="hotspot-header">
                    <span className="hotspot-pin">📍</span>
                    <strong>{hs.address}</strong>
                    <span className="hotspot-count-pill">{hs.incidentCount} incidents</span>
                  </div>
                  <div className="hotspot-meta">
                    <span>Frequent Category: <strong>{hs.primaryCategory}</strong></span>
                    <span className="hotspot-tickets">Tickets: {hs.tickets.join(', ')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Resource Allocation Recommendations */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Staffing & Resource Recommendations</h3>
              <p>Algorithmic capacity suggestions based on active backlog</p>
            </div>
            <TrendingUp size={18} className="panel-muted-icon" />
          </div>

          <div className="recommendations-list">
            {(departmentRecommendations || []).map((rec, i) => (
              <div key={i} className={`rec-card urgency-${rec.urgency}`}>
                <div className="rec-header">
                  <strong>{rec.department}</strong>
                  <span className={`urgency-pill urgency-${rec.urgency}`}>{rec.urgency} priority</span>
                </div>
                <p className="rec-text">{rec.recommendation}</p>
                <div className="rec-stats">
                  <span>Pending Backlog: <strong>{rec.pending}</strong></span>
                  <span>Total Received: <strong>{rec.total}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

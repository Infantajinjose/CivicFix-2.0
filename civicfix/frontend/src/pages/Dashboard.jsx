import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Plus,
  RefreshCw,
  TrendingUp,
  Users,
  MapPin,
  QrCode,
  Star,
  FileBarChart,
  HardHat,
  Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { api, getApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import IssueMap from '../components/IssueMap.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [mapIssues, setMapIssues] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { user, tenant, isManager, isWorker, isResident } = useAuth();
  const navigate = useNavigate();

  // If worker, redirect to mobile worker portal
  useEffect(() => {
    if (isWorker) {
      navigate('/worker', { replace: true });
    }
  }, [isWorker, navigate]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, issues] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/issues?limit=100')
      ]);
      setData(summary.data.data);
      setMapIssues(issues.data.data.issues);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = data?.stats || {};

  const cards = [
    {
      label: isResident ? 'My Reported Issues' : 'Total complaints',
      value: stats.total ?? '—',
      icon: ClipboardList,
      tone: 'blue',
      hint: `${stats.pendingTotal ?? (stats.submitted + stats.assigned + stats.inProgress || 0)} awaiting full resolution`,
      to: '/issues'
    },
    {
      label: 'SLA Overdue / Warning',
      value: stats.overdueCount ?? 0,
      icon: Clock3,
      tone: stats.overdueCount > 0 ? 'red' : 'amber',
      hint: stats.overdueCount > 0 ? 'Requires immediate attention' : 'All tickets within SLA',
      to: '/sla'
    },
    {
      label: 'In Progress in Field',
      value: stats.inProgress ?? '—',
      icon: RefreshCw,
      tone: 'violet',
      hint: 'Assigned technicians working on site',
      to: '/issues?status=in_progress'
    },
    {
      label: 'Verified Resolved',
      value: stats.resolved ?? '—',
      icon: CheckCircle2,
      tone: 'green',
      hint: `${stats.resolutionRate || 0}% overall closure rate`,
      to: '/issues?status=resolved'
    }
  ];

  return (
    <div className="dashboard-page">
      <div className="welcome-row">
        <div>
          <div className="welcome-kicker">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <h2>Good to see you, {user?.name?.split(' ')[0] || 'there'}</h2>
          <p>
            {isResident
              ? 'Track your community problem reports and verified resolutions in real time.'
              : `Operational overview for ${tenant?.name || 'Metropolis Platform'}.`}
          </p>
        </div>

        <div className="btn-group">
          {isResident ? (
            <Link to="/issues/new" className="primary-button">
              <Plus size={17} /> Report an Issue
            </Link>
          ) : (
            <>
              <Link to="/map" className="secondary-button">
                <MapPin size={16} /> Live Intelligence Map
              </Link>
              <Link to="/issues/new" className="primary-button">
                <Plus size={16} /> New Report
              </Link>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="form-error page-error">
          {error} <button onClick={load}>Retry</button>
        </div>
      )}

      {/* SLA Alert Banner if complaints are overdue */}
      {isManager && stats.overdueCount > 0 && (
        <div className="escalation-alert-banner mb-4">
          <AlertTriangle size={20} />
          <div>
            <strong>{stats.overdueCount} Complaint(s) Exceeded SLA Resolution Deadlines!</strong>
            <p>Immediate manager intervention recommended to maintain compliance targets.</p>
          </div>
          <Link to="/sla" className="secondary-button compact ml-auto">
            Review Escalations <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {/* Quick Action Hub for Managers */}
      {isManager && (
        <div className="quick-access-strip mb-4">
          <Link to="/map" className="quick-chip">
            <MapPin size={15} /> Live Map & Hotspots
          </Link>
          <Link to="/sla" className="quick-chip">
            <Clock3 size={15} /> SLA Management ({stats.overdueCount || 0} overdue)
          </Link>
          <Link to="/qr-locations" className="quick-chip">
            <QrCode size={15} /> Facility QR Codes
          </Link>
          <Link to="/feedback" className="quick-chip">
            <Star size={15} /> Citizen Ratings
          </Link>
          <Link to="/analytics" className="quick-chip">
            <FileBarChart size={15} /> Predictive Forecast
          </Link>
        </div>
      )}

      {/* Main KPI Stats Grid */}
      <div className="stats-grid">
        {cards.map(({ label, value, icon: Icon, tone, hint, to }) => (
          <Link to={to} className="stat-card" key={label}>
            <ArrowUpRight className="stat-go" size={17} />
            <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{loading ? '···' : value}</div>
            <div className="stat-hint">{hint}</div>
          </Link>
        ))}
      </div>

      <div className="dashboard-grid main-dashboard-grid mt-4">
        {/* Recent Reports */}
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Complaints Feed</h3>
              <p>Live stream of incoming community reports</p>
            </div>
            <Link className="text-link" to="/issues">View all <ArrowUpRight size={15} /></Link>
          </div>

          {loading ? (
            <div className="skeleton-stack"><div /><div /><div /></div>
          ) : data?.recent?.length ? (
            <div className="recent-list">
              {data.recent.map(issue => (
                <Link className="recent-item" to={`/issues/${issue._id}`} key={issue._id}>
                  <div className={`category-icon cat-${issue.category?.toLowerCase()}`}>
                    <ClipboardList size={17} />
                  </div>
                  <div className="recent-main">
                    <strong>{issue.title}</strong>
                    <span>{issue.ticketNumber} &middot; {issue.category}</span>
                  </div>
                  <div className="recent-meta">
                    <StatusBadge status={issue.status} />
                    <small>{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No reports logged yet"
              description="Create the first issue report to start tracking community resolutions."
            />
          )}
        </section>

        {/* Priority & Urgent Action Panel */}
        <section className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <h3>Urgent Priority Attention</h3>
              <p>Critical safety and infrastructure hazards</p>
            </div>
            <span className="mini-icon-alert"><AlertTriangle size={17} /></span>
          </div>

          <div className="attention-number">{loading ? '—' : stats.urgent || 0}</div>
          <p className="attention-copy">Open urgent complaints requiring expedited field dispatch.</p>

          <div className="attention-divider" />
          <div className="attention-footer">
            <span>Keep emergency reports moving.</span>
            <Link to="/issues?priority=urgent">
              Review Urgent <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      </div>

      <div className="dashboard-grid lower-dashboard-grid mt-4">
        {/* Category Breakdown Chart */}
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Complaints by Civic Category</h3>
            </div>
            <span className="chart-caption">All time records</span>
          </div>

          {data?.categories?.length ? (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.categories} margin={{ top: 12, right: 10, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} interval={0} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: 'var(--sunken)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }}
                  />
                  <Bar dataKey="count" name="Complaints" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">Category distribution will appear as complaints are submitted.</div>
          )}
        </section>

        {/* Mapped Incidents Card */}
        <section className="panel map-panel">
          <div className="panel-heading">
            <div>
              <h3>Geographic Pinpoints</h3>
            </div>
            <Link to="/map" className="text-link">
              Full Map <ArrowUpRight size={14} />
            </Link>
          </div>

          <IssueMap issues={mapIssues} height={250} />
          <div className="map-footnote">
            {mapIssues.filter(i => i.location?.lat && i.location?.lng).length} geotagged complaints on map.
          </div>
        </section>
      </div>

      {isManager && (
        <div className="bottom-callout mt-4">
          <div className="callout-icon"><Sparkles size={19} /></div>
          <div>
            <strong>CivicFix AI & SLA Escalation Automation Active</strong>
            <p>Complaints are continuously monitored for SLA compliance and automatic dispatch notifications.</p>
          </div>
          <Link to="/sla" className="secondary-button">
            View SLA Targets <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
    </div>
  );
}

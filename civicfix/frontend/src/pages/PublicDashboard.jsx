import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Building2,
  BarChart2,
  AlertCircle
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import { api, getApiError } from '../lib/api.js';
import IssueMap from '../components/IssueMap.jsx';

export default function PublicDashboard() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: res } = await api.get(`/public/org/${slug}`);
        setData(res.data);
      } catch (err) {
        setError(getApiError(err, 'Unable to load public transparency dashboard.'));
      } finally {
        setLoading(false);
      }
    };
    fetchPublicData();
  }, [slug]);

  if (loading) {
    return (
      <div className="public-page-wrap">
        <div className="screen-loader">
          <span className="loader" /> Loading public transparency records…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="public-page-wrap">
        <div className="public-error-card">
          <AlertCircle size={36} className="text-red" />
          <h2>Transparency Portal Unavailable</h2>
          <p>{error || 'This organisation does not exist or has disabled public transparency records.'}</p>
          <Link to="/login" className="primary-button mt-4">Return to CivicFix Portal</Link>
        </div>
      </div>
    );
  }

  const { organisation, stats, categoryBreakdown, departmentBreakdown, recentResolved, mapIssues } = data;

  return (
    <div className="public-page-wrap">
      {/* Public Top Navbar */}
      <header className="public-navbar">
        <div className="public-nav-container">
          <div className="public-brand">
            <div className="brand-mark"><Activity size={20} strokeWidth={2.6} /></div>
            <div>
              <strong>CivicFix</strong>
              <span>Transparency Portal</span>
            </div>
          </div>
          <div className="public-nav-right">
            <span className="public-live-indicator">
              <span className="live-dot" /> Live Public Data
            </span>
            <Link to="/login" className="secondary-button compact">
              Staff & Resident Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="public-hero">
        <div className="public-hero-container">
          <div className="public-org-badge">
            <Building2 size={16} /> {organisation.name}
          </div>
          <h1>{organisation.title}</h1>
          <p>{organisation.description}</p>
        </div>
      </section>

      {/* Main KPI Stats Bar */}
      <main className="public-main-container">
        <div className="public-stats-grid">
          <div className="pub-stat-card">
            <div className="pub-stat-icon blue"><Layers size={22} /></div>
            <div className="pub-stat-data">
              <strong>{stats.totalReceived}</strong>
              <span>Total Received</span>
            </div>
          </div>

          <div className="pub-stat-card">
            <div className="pub-stat-icon green"><CheckCircle2 size={22} /></div>
            <div className="pub-stat-data">
              <strong>{stats.resolvedCount}</strong>
              <span>Resolved Issues</span>
            </div>
          </div>

          <div className="pub-stat-card">
            <div className="pub-stat-icon purple"><TrendingUp size={22} /></div>
            <div className="pub-stat-data">
              <strong>{stats.resolutionRate}%</strong>
              <span>Closure Rate</span>
            </div>
          </div>

          <div className="pub-stat-card">
            <div className="pub-stat-icon amber"><Clock size={22} /></div>
            <div className="pub-stat-data">
              <strong>{stats.avgResolutionHours}h</strong>
              <span>Avg Resolution Time</span>
            </div>
          </div>
        </div>

        {/* Charts & Map Grid */}
        <div className="public-content-grid">
          {/* Category Distribution Chart */}
          <section className="panel pub-panel">
            <div className="panel-heading">
              <div>
                <h3>Issue Categories Breakdown</h3>
                <p>Volume of complaints logged across civic domains</p>
              </div>
            </div>

            <div className="pub-chart-wrapper">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }}
                  />
                  <Bar dataKey="count" name="Complaints" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Department Performance */}
          <section className="panel pub-panel">
            <div className="panel-heading">
              <div>
                <h3>Department Performance</h3>
                <p>Public service resolution by response unit</p>
              </div>
            </div>

            <div className="pub-dept-list">
              {departmentBreakdown.map(dept => {
                const total = dept.count || 1;
                const resolved = dept.resolved || 0;
                const pct = Math.round((resolved / total) * 100);

                return (
                  <div key={dept._id} className="pub-dept-item">
                    <div className="pub-dept-header">
                      <strong>{dept._id || 'General Services'}</strong>
                      <span>{resolved}/{total} resolved ({pct}%)</span>
                    </div>
                    <div className="pub-progress-track">
                      <div className="pub-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Public Safe Map */}
        {organisation.showMap && (
          <section className="panel pub-panel mt-4">
            <div className="panel-heading">
              <div>
                <h3>Geographic Resolution Map</h3>
                <p>Anonymized spatial pinpoints of logged community incidents.</p>
              </div>
              <span className="map-count">📍 {mapIssues.length} mapped incidents</span>
            </div>

            <IssueMap
              issues={mapIssues}
              height={340}
              isPublic={true}
            />
            <div className="map-footnote">
              Privacy Notice: Resident identities, phone numbers, and private attachments are strictly omitted from public maps.
            </div>
          </section>
        )}

        {/* Recently Resolved Showcase */}
        {organisation.showRecentResolved && (
          <section className="panel pub-panel mt-4">
            <div className="panel-heading">
              <div>
                <h3>Recently Resolved Community Complaints</h3>
                <p>Verified public problem resolutions with action notes</p>
              </div>
            </div>

            <div className="pub-resolved-grid">
              {recentResolved.map(item => (
                <div key={item.ticketNumber} className="pub-resolved-card">
                  <div className="pub-resolved-card-top">
                    <span className="pub-ticket-num">{item.ticketNumber}</span>
                    <span className="pub-resolved-pill">
                      <CheckCircle2 size={13} /> Resolved
                    </span>
                  </div>
                  <h4>{item.title}</h4>
                  <div className="pub-resolved-meta">
                    <span>Category: <strong>{item.category}</strong></span>
                    <span>Dept: <strong>{item.department || 'General'}</strong></span>
                  </div>
                  {item.resolutionNote && (
                    <p className="pub-action-note">"{item.resolutionNote}"</p>
                  )}
                  <small>Completed {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}</small>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="public-footer">
        <p>&copy; {new Date().getFullYear()} {organisation.name} &middot; Powered by CivicFix 2.0 Smart SaaS Platform</p>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Search, SlidersHorizontal, AlertTriangle, Clock, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { api, getApiError } from '../lib/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import SlaCountdown from '../components/SlaCountdown.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  ['all', 'All Issues'],
  ['submitted', 'Submitted'],
  ['assigned', 'Assigned'],
  ['in_progress', 'In Progress'],
  ['resolved', 'Verified Resolved'],
  ['rejected', 'Rejected']
];

const CATEGORIES = ['Garbage', 'Water', 'Roads', 'Streetlights', 'Drainage', 'Sanitation', 'Electrical', 'Buildings', 'Other'];
const DEPARTMENTS = ['Sanitation', 'Water & Sewage', 'Roads & Infrastructure', 'Streetlights', 'Drainage', 'Electrical', 'Civil Maintenance', 'General Services'];

export default function IssuesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isWorker, isResident } = useAuth();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') || 'all';
  const category = searchParams.get('category') || 'all';
  const priority = searchParams.get('priority') || 'all';
  const department = searchParams.get('department') || 'all';
  const [qInput, setQInput] = useState(q);

  const setParam = (key, value) => setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    return next;
  }, { replace: true });

  useEffect(() => { setQInput(q); }, [q]);

  useEffect(() => {
    if (qInput.trim() === q) return undefined;
    const timer = setTimeout(() => setParam('q', qInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [qInput]);

  const queryString = searchParams.toString();

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    api.get(`/issues?${queryString}`)
      .then(({ data }) => {
        if (id === requestId.current) setIssues(data.data.issues);
      })
      .catch(err => {
        if (id === requestId.current) setError(getApiError(err));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [queryString]);

  const hasFilters = Boolean(q || category !== 'all' || priority !== 'all' || status !== 'all' || department !== 'all');

  const clear = () => {
    setQInput('');
    setSearchParams({}, { replace: true });
  };

  const openRow = (e, id) => {
    if (!e.target.closest('a')) navigate(`/issues/${id}`);
  };

  return (
    <div className="content-page">
      <div className="page-intro-row">
        <div>
          <h2>{isResident ? 'My Community Reports' : 'Issues & Complaint Registry'}</h2>
          <p>Real-time lifecycle tracking, SLA compliance, and dispatch management.</p>
        </div>
        <Link to="/issues/new" className="primary-button">
          <Plus size={16} /> Report an Issue
        </Link>
      </div>

      <div className="panel issues-panel">
        <div className="status-tabs" role="tablist" aria-label="Filter by status">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={status === value}
              className={`tab ${status === value ? 'active' : ''}`}
              onClick={() => setParam('status', value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="filter-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search by title, ticket ID, or address..."
              aria-label="Search reports"
              value={qInput}
              onChange={e => setQInput(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <select
              aria-label="Category"
              value={category}
              onChange={e => setParam('category', e.target.value)}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>

            <select
              aria-label="Priority"
              value={priority}
              onChange={e => setParam('priority', e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              aria-label="Department"
              value={department}
              onChange={e => setParam('department', e.target.value)}
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {hasFilters && (
              <button className="clear-filters-btn" onClick={clear}>Clear</button>
            )}
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="issues-table-wrap">
          <table className="issues-table" aria-label="Issues table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Title & Category</th>
                <th>Status</th>
                <th>SLA Target</th>
                <th>Department</th>
                <th>Assigned Worker</th>
                <th>Reported</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center p-6 text-muted">
                    Loading complaints…
                  </td>
                </tr>
              ) : issues.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No complaints match your filters"
                      description="Try clearing search filters or report a new community issue."
                    />
                  </td>
                </tr>
              ) : (
                issues.map(item => {
                  const isResolved = item.status === 'resolved';

                  return (
                    <tr key={item._id} onClick={(e) => openRow(e, item._id)} className="clickable-row">
                      <td className="ticket-cell">
                        <strong>{item.ticketNumber}</strong>
                      </td>
                      <td className="title-cell">
                        <div className="title-stack">
                          <Link to={`/issues/${item._id}`} className="issue-row-link">
                            {item.title}
                          </Link>
                          <div className="meta-sub">
                            <span className="category-pill">{item.category}</span>
                            <span className={`pri-tag pri-${item.priority}`}>{item.priority}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <SlaCountdown
                          dueAt={item.dueAt}
                          isEscalated={item.sla?.isEscalated}
                          isResolved={isResolved}
                        />
                      </td>
                      <td>
                        <span className="dept-cell-tag">{item.department || 'General'}</span>
                      </td>
                      <td>
                        <span className="worker-name-tag">
                          {item.assignedTo?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="date-cell">
                        {format(new Date(item.createdAt), 'dd MMM yyyy')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

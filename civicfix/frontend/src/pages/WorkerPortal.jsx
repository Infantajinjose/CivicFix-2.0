import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  HardHat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  CheckCheck,
  Navigation,
  RefreshCw,
  Camera,
  Calendar,
  X,
  UploadCloud
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { api, assetUrl, getApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SlaCountdown from '../components/SlaCountdown.jsx';

export default function WorkerPortal() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'today', 'active', 'pending_acceptance', 'completed'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Modals for worker actions
  const [rejectingTask, setRejectingTask] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pausingTask, setPausingTask] = useState(null);
  const [pauseReason, setPauseReason] = useState('');
  const [completingTask, setCompletingTask] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles, setAfterFiles] = useState([]);

  const loadWorkerData = async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, statsRes] = await Promise.all([
        api.get(`/worker/tasks?filter=${filter}`),
        api.get('/worker/stats')
      ]);
      setTasks(tasksRes.data.data.tasks);
      setStats(statsRes.data.data);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkerData();
  }, [filter]);

  const handleAction = async (issueId, action, extra = {}) => {
    setBusyId(issueId);
    setError('');
    try {
      const form = new FormData();
      form.append('action', action);
      if (extra.reason) form.append('reason', extra.reason);
      if (extra.completionNotes) form.append('completionNotes', extra.completionNotes);
      (extra.beforePhotos || []).forEach(f => form.append('beforePhotos', f));
      (extra.afterPhotos || []).forEach(f => form.append('afterPhotos', f));

      await api.patch(`/issues/${issueId}/worker-action`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setRejectingTask(null);
      setPausingTask(null);
      setCompletingTask(null);
      setBeforeFiles([]);
      setAfterFiles([]);
      await loadWorkerData();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="content-page worker-portal-layout">
      {/* Mobile-Friendly Worker Header */}
      <div className="worker-header-card">
        <div className="worker-avatar-badge">
          <HardHat size={28} />
        </div>
        <div className="worker-welcome">
          <h2>Field Operations Dashboard</h2>
          <p>Welcome, <strong>{user?.name}</strong> &middot; Department: {user?.department || 'Field Services'}</p>
        </div>
        <button className="secondary-button compact" onClick={loadWorkerData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Quick KPI Cards */}
      <div className="worker-kpi-grid">
        <div className="worker-kpi-card" onClick={() => setFilter('today')}>
          <div className="kpi-icon-wrap amber"><Clock size={18} /></div>
          <div className="kpi-data">
            <strong>{stats?.pendingAcceptance ?? 0}</strong>
            <span>Awaiting Accept</span>
          </div>
        </div>

        <div className="worker-kpi-card" onClick={() => setFilter('active')}>
          <div className="kpi-icon-wrap blue"><Play size={18} /></div>
          <div className="kpi-data">
            <strong>{stats?.inProgress ?? 0}</strong>
            <span>Active in Field</span>
          </div>
        </div>

        <div className="worker-kpi-card" onClick={() => setFilter('completed')}>
          <div className="kpi-icon-wrap green"><CheckCheck size={18} /></div>
          <div className="kpi-data">
            <strong>{stats?.completedToday ?? 0}</strong>
            <span>Completed Today</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="worker-tabs-bar">
        <button className={`w-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All Assigned ({stats?.totalAssigned ?? 0})
        </button>
        <button className={`w-tab ${filter === 'today' ? 'active' : ''}`} onClick={() => setFilter('today')}>
          Today's Tasks
        </button>
        <button className={`w-tab ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>
          In Progress ({stats?.inProgress ?? 0})
        </button>
        <button className={`w-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
          Completed ({stats?.totalCompleted ?? 0})
        </button>
      </div>

      {/* Tasks Feed */}
      <div className="worker-task-feed">
        {loading ? (
          <div className="skeleton-stack"><div /><div /><div /></div>
        ) : tasks.length === 0 ? (
          <div className="panel empty-worker-panel">
            <CheckCircle2 size={36} className="text-brand" />
            <h3>No pending tasks found</h3>
            <p>You're all caught up! New assigned complaints will appear here in real time.</p>
          </div>
        ) : (
          tasks.map(task => {
            const isUrgent = task.priority === 'urgent';
            const sub = task.subStatus || task.status;

            return (
              <div key={task._id} className={`panel worker-task-card ${isUrgent ? 'border-urgent' : ''}`}>
                <div className="task-card-top">
                  <div className="task-header-meta">
                    <span className="task-ticket">{task.ticketNumber}</span>
                    <span className={`priority-chip priority-${task.priority}`}>{task.priority}</span>
                    <StatusBadge status={task.status} />
                  </div>
                  <SlaCountdown dueAt={task.dueAt} isEscalated={task.sla?.isEscalated} />
                </div>

                <h3 className="task-title">
                  <Link to={`/issues/${task._id}`}>{task.title}</Link>
                </h3>
                <p className="task-desc">{task.description}</p>

                {/* Location & Navigation */}
                <div className="task-location-row">
                  <div className="location-text">
                    <MapPin size={16} />
                    <span>{task.location?.address || 'Location coordinates on map'}</span>
                  </div>
                  {task.location?.lat && task.location?.lng && (
                    <a
                      className="nav-btn"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${task.location.lat},${task.location.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation size={14} /> Open Maps Navigation
                    </a>
                  )}
                </div>

                {/* Photos */}
                {task.attachments?.length > 0 && (
                  <div className="task-thumb-strip">
                    {task.attachments.map((att, i) => (
                      <a key={i} href={assetUrl(att.url)} target="_blank" rel="noreferrer">
                        <img src={assetUrl(att.url)} alt="Evidence" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Task Execution Action Bar */}
                <div className="task-card-actions">
                  {sub === 'assigned' && (
                    <div className="action-button-row">
                      <button
                        className="primary-button"
                        onClick={() => handleAction(task._id, 'accept')}
                        disabled={busyId === task._id}
                      >
                        <CheckCircle2 size={16} /> Accept Task
                      </button>
                      <button
                        className="secondary-button btn-danger"
                        onClick={() => setRejectingTask(task)}
                        disabled={busyId === task._id}
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {(sub === 'accepted' || sub === 'paused') && (
                    <button
                      className="primary-button full-width"
                      onClick={() => handleAction(task._id, 'start')}
                      disabled={busyId === task._id}
                    >
                      <Play size={16} /> Start Work on Site
                    </button>
                  )}

                  {sub === 'in_progress' && (
                    <div className="action-button-row">
                      <button
                        className="primary-button"
                        onClick={() => setCompletingTask(task)}
                        disabled={busyId === task._id}
                      >
                        <CheckCheck size={16} /> Complete & Upload Proof
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => setPausingTask(task)}
                        disabled={busyId === task._id}
                      >
                        <Pause size={16} /> Pause
                      </button>
                    </div>
                  )}

                  {sub === 'completed' && (
                    <div className="status-pill-resolved">
                      <CheckCheck size={16} /> Submitted for Manager Verification
                    </div>
                  )}

                  <Link to={`/issues/${task._id}`} className="view-details-link">
                    Full History →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reject Modal */}
      {rejectingTask && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Reject Assignment: {rejectingTask.ticketNumber}</h3>
            <p>Provide a clear reason why this task cannot be executed.</p>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Beyond skill domain, equipment unavailable, or out of district…"
            />
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setRejectingTask(null)}>Cancel</button>
              <button
                className="primary-button btn-danger"
                onClick={() => handleAction(rejectingTask._id, 'reject', { reason: rejectReason })}
                disabled={!rejectReason.trim() || busyId === rejectingTask._id}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {pausingTask && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Pause Work: {pausingTask.ticketNumber}</h3>
            <p>Please log why active work is temporarily paused.</p>
            <textarea
              required
              rows={3}
              value={pauseReason}
              onChange={e => setPauseReason(e.target.value)}
              placeholder="e.g. Sourcing pipe fittings or adverse weather…"
            />
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setPausingTask(null)}>Cancel</button>
              <button
                className="primary-button"
                onClick={() => handleAction(pausingTask._id, 'pause', { reason: pauseReason })}
                disabled={!pauseReason.trim() || busyId === pausingTask._id}
              >
                Confirm Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal with Photo Uploads */}
      {completingTask && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Complete Task: {completingTask.ticketNumber}</h3>
            <p>Provide notes of the resolution and attach photographic proof.</p>

            <label className="field-label-sm">Work Completion Notes *</label>
            <textarea
              required
              rows={3}
              value={completionNotes}
              onChange={e => setCompletionNotes(e.target.value)}
              placeholder="Describe repairs, cleaning, or parts replaced on site…"
            />

            <div className="modal-photo-uploads mt-3">
              <label className="field-label-sm">After / Resolution Photos (Required)</label>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={e => setAfterFiles(Array.from(e.target.files || []).slice(0, 3))}
              />
              {afterFiles.length > 0 && <small>{afterFiles.length} photo(s) selected</small>}
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setCompletingTask(null)}>Cancel</button>
              <button
                className="primary-button"
                onClick={() => handleAction(completingTask._id, 'complete', {
                  completionNotes,
                  beforePhotos: beforeFiles,
                  afterPhotos: afterFiles
                })}
                disabled={!completionNotes.trim() || busyId === completingTask._id}
              >
                {busyId === completingTask._id ? 'Submitting…' : 'Submit Completion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquareText,
  UserRound,
  Wrench,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  CheckCheck,
  Star,
  Sparkles,
  Bot,
  ExternalLink,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { api, assetUrl, getApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import IssueMap from '../components/IssueMap.jsx';
import SlaCountdown from '../components/SlaCountdown.jsx';
import FeedbackModal from '../components/FeedbackModal.jsx';

const PIPELINE = [
  ['submitted', 'Submitted'],
  ['assigned', 'Assigned'],
  ['in_progress', 'In progress'],
  ['completed', 'Completed'],
  ['resolved', 'Verified']
];

export default function IssueDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isManager, isWorker, isResident } = useAuth();

  const [issue, setIssue] = useState(null);
  const [users, setUsers] = useState([]);
  const [workerId, setWorkerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Worker Action state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles, setAfterFiles] = useState([]);

  // Manager Verify / Reopen
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenNotes, setReopenNotes] = useState('');

  // Admin AI Override
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideCat, setOverrideCat] = useState('');
  const [overridePri, setOverridePri] = useState('');
  const [overrideDept, setOverrideDept] = useState('');

  // Resident Feedback Modal
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [issueRes, usersRes] = await Promise.all([
        api.get(`/issues/${id}`),
        isManager ? api.get('/users') : Promise.resolve({ data: { data: { users: [] } } })
      ]);
      const item = issueRes.data.data.issue;
      setIssue(item);
      setWorkerId(item.assignedTo?._id || '');
      setUsers(usersRes.data.data.users);
      setOverrideCat(item.category);
      setOverridePri(item.priority);
      setOverrideDept(item.department || 'General Services');
    } catch (err) {
      setError(getApiError(err));
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  // Assign worker
  const assign = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.patch(`/issues/${id}/assign`, { workerId: workerId || null });
      await load();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  // Execute Worker Action
  const handleWorkerAction = async (action, extraData = {}) => {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('action', action);
      if (extraData.reason) form.append('reason', extraData.reason);
      if (extraData.completionNotes) form.append('completionNotes', extraData.completionNotes);

      (extraData.beforePhotos || []).forEach(f => form.append('beforePhotos', f));
      (extraData.afterPhotos || []).forEach(f => form.append('afterPhotos', f));

      await api.patch(`/issues/${id}/worker-action`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setRejectModalOpen(false);
      setPauseModalOpen(false);
      setCompleteModalOpen(false);
      setBeforeFiles([]);
      setAfterFiles([]);
      await load();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  // Manager Verify or Reopen
  const handleManagerVerification = async (decision, notes = '') => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/issues/${id}/verify`, { decision, notes });
      setVerifyModalOpen(false);
      setReopenModalOpen(false);
      await load();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  // Admin AI Override
  const handleAiOverride = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.patch(`/issues/${id}/ai-override`, {
        category: overrideCat,
        priority: overridePri,
        department: overrideDept
      });
      setOverrideModalOpen(false);
      await load();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!issue && !error) {
    return <div className="screen-loader"><span className="loader" /> Loading issue report…</div>;
  }

  if (!issue) {
    return (
      <div className="content-page">
        <div className="form-error">
          {error} <button onClick={() => navigate('/issues')}>Back to reports</button>
        </div>
      </div>
    );
  }

  const isAssignedWorker = isWorker && issue.assignedTo?._id === user?.id;
  const isReporter = issue.createdBy?._id === user?.id;
  const isResolved = issue.status === 'resolved';

  const allAttachments = issue.attachments || [];
  const resolutionAttachments = issue.resolutionAttachments || [];
  const beforePhotos = issue.beforeAfterPhotos?.before || [];
  const afterPhotos = issue.beforeAfterPhotos?.after || [];

  return (
    <div className="content-page detail-page">
      <div className="back-row">
        <Link className="back-link" to="/issues">
          <ArrowLeft size={16} /> Back to issues
        </Link>
        <div className="header-chips">
          <SlaCountdown
            dueAt={issue.dueAt}
            isEscalated={issue.sla?.isEscalated}
            isResolved={isResolved}
          />
          <span>{issue.ticketNumber}</span>
        </div>
      </div>

      <div className="detail-heading">
        <div>
          <h2>{issue.title}</h2>
          <div className="detail-subline">
            <span>{issue.ticketNumber}</span>
            <span>Reported {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</span>
            <StatusBadge status={issue.status} />
            {issue.department && (
              <span className="dept-tag">Dept: {issue.department}</span>
            )}
          </div>
        </div>
        <div className={`priority-chip priority-${issue.priority}`}>
          {issue.priority} priority
        </div>
      </div>

      {error && <div className="form-error page-error">{error}</div>}

      {/* SLA Escalation Warning Banner */}
      {issue.sla?.isEscalated && !isResolved && (
        <div className="escalation-alert-banner">
          <AlertTriangle size={20} />
          <div>
            <strong>SLA Breached & Escalated to Department Management</strong>
            <p>This complaint exceeded resolution SLA deadlines without completion. Escalation level {issue.sla.escalationLevel || 1}.</p>
          </div>
        </div>
      )}

      {/* Progress Pipeline */}
      <section className="panel pipeline-card" aria-label="Resolution Pipeline">
        <ol className={`pipeline ${issue.status === 'rejected' ? 'is-rejected' : ''}`}>
          {PIPELINE.map(([key, label], i) => {
            const currentSub = issue.subStatus || issue.status;
            const atIndex = PIPELINE.findIndex(([k]) => k === currentSub);
            const isDone = i < atIndex || (isResolved && i <= 4);
            const isCurrent = i === atIndex;

            return (
              <li
                key={key}
                className={`pipe-step ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              >
                <span className="pipe-dot" />
                {label}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="detail-grid">
        <div className="detail-main-column">
          {/* Main Details Panel */}
          <section className="panel detail-panel">
            <div className="panel-heading">
              <div><h3>Complaint Details</h3></div>
              <span className="detail-created">{format(new Date(issue.createdAt), 'dd MMM yyyy, hh:mm a')}</span>
            </div>

            <p className="issue-description">{issue.description}</p>

            <div className="detail-meta-grid">
              <div>
                <span>Category</span>
                <strong>{issue.category}</strong>
              </div>
              <div>
                <span>Priority</span>
                <strong className={`priority-text priority-${issue.priority}`}>{issue.priority}</strong>
              </div>
              <div>
                <span>Reported By</span>
                <strong>{issue.createdBy?.name || 'Community Resident'}</strong>
              </div>
              <div>
                <span>Assigned Worker</span>
                <strong>{issue.assignedTo?.name || 'Not assigned yet'}</strong>
              </div>
            </div>

            {/* AI Analysis Summary Card */}
            {issue.aiAnalysis && (
              <div className="ai-audit-box">
                <div className="ai-audit-header">
                  <div className="ai-title">
                    <Bot size={17} className="text-brand" />
                    <strong>AI Complaint Intelligence</strong>
                    {issue.aiAnalysis.confidence > 0 && (
                      <span className="ai-confidence-pill">
                        {Math.round(issue.aiAnalysis.confidence * 100)}% match
                      </span>
                    )}
                  </div>
                  {isManager && (
                    <button
                      className="ai-override-link"
                      onClick={() => setOverrideModalOpen(true)}
                    >
                      <Sparkles size={13} /> Override AI Suggestions
                    </button>
                  )}
                </div>

                <div className="ai-audit-grid">
                  <div>
                    <span>AI Suggested Category:</span>
                    <strong>{issue.aiAnalysis.suggestedCategory || issue.category}</strong>
                  </div>
                  <div>
                    <span>AI Suggested Priority:</span>
                    <strong>{issue.aiAnalysis.suggestedPriority || issue.priority}</strong>
                  </div>
                  <div>
                    <span>Suggested Dept:</span>
                    <strong>{issue.aiAnalysis.suggestedDepartment || issue.department}</strong>
                  </div>
                </div>

                {issue.aiAnalysis.summary && (
                  <div className="ai-audit-summary">
                    <span>Summary:</span> {issue.aiAnalysis.summary}
                  </div>
                )}

                {issue.aiAnalysis.isOverridden && (
                  <div className="ai-overridden-badge">
                    <ShieldCheck size={14} /> Manually reviewed and modified by management.
                  </div>
                )}
              </div>
            )}

            {/* Attached Photos */}
            {allAttachments.length > 0 && (
              <div className="attachments-block">
                <h4><Camera size={16} /> Reported Evidence Photos</h4>
                <div className="photo-grid">
                  {allAttachments.map((file, idx) => (
                    <a key={idx} href={assetUrl(file.url)} target="_blank" rel="noreferrer">
                      <img src={assetUrl(file.url)} alt="Report Attachment" />
                      <span>Report Photo #{idx + 1}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Before and After Photos */}
            {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
              <div className="attachments-block before-after-block">
                <h4><Wrench size={16} /> Before & After Resolution Evidence</h4>
                <div className="before-after-grid">
                  <div>
                    <strong>Before Work:</strong>
                    {beforePhotos.length === 0 ? <p className="text-muted">None uploaded</p> : (
                      <div className="photo-grid">
                        {beforePhotos.map((f, i) => (
                          <a key={i} href={assetUrl(f.url)} target="_blank" rel="noreferrer">
                            <img src={assetUrl(f.url)} alt="Before" />
                            <span>Before Fix</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <strong>After Resolution:</strong>
                    {afterPhotos.length === 0 ? <p className="text-muted">None uploaded</p> : (
                      <div className="photo-grid">
                        {afterPhotos.map((f, i) => (
                          <a key={i} href={assetUrl(f.url)} target="_blank" rel="noreferrer">
                            <img src={assetUrl(f.url)} alt="After" />
                            <span>Resolution Proof</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Resolution Notes */}
            {issue.resolutionNote && (
              <div className="resolution-notes-panel">
                <h4><CheckCircle2 size={16} /> Resolution & Work Summary</h4>
                <p>{issue.resolutionNote}</p>
                {issue.verification?.verifiedAt && (
                  <small>
                    Verified by management on {format(new Date(issue.verification.verifiedAt), 'dd MMM yyyy, hh:mm a')}
                  </small>
                )}
              </div>
            )}

            {/* Resident Feedback Showcase */}
            {issue.feedback && (
              <div className="resident-feedback-showcase">
                <h4><Star size={16} className="text-amber" /> Resident Resolution Review</h4>
                <div className="feedback-stars-row">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star
                      key={s}
                      size={18}
                      fill={issue.feedback.rating >= s ? '#f59e0b' : 'none'}
                      stroke={issue.feedback.rating >= s ? '#f59e0b' : '#cbd5e1'}
                    />
                  ))}
                  <strong>{issue.feedback.rating} / 5 Stars</strong>
                </div>
                {issue.feedback.comment && <p>"{issue.feedback.comment}"</p>}
                <small>Submitted by {issue.createdBy?.name || 'Resident'}</small>
              </div>
            )}
          </section>

          {/* Activity Timeline */}
          <section className="panel timeline-panel">
            <div className="panel-heading">
              <div><h3>Activity & Audit Timeline</h3></div>
              <Clock3 size={18} className="panel-muted-icon" />
            </div>
            <div className="timeline">
              {[...(issue.history || [])].reverse().map((item, index) => (
                <div className="timeline-item" key={`${item.changedAt}-${index}`}>
                  <div className={`timeline-dot ${item.status}`} />
                  <div className="timeline-content">
                    <div className="timeline-title">
                      <strong>{item.status.replace('_', ' ')}</strong>
                      <span>{format(new Date(item.changedAt), 'dd MMM, hh:mm a')}</span>
                    </div>
                    <p>{item.note}</p>
                    <small>Updated by {item.changedBy?.name || 'Team member'}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <aside className="detail-side-column">
          {/* Location & Navigation */}
          <section className="panel side-detail-panel">
            <div className="panel-heading">
              <div><h3>Location</h3></div>
              <MapPin size={17} className="panel-muted-icon" />
            </div>
            <p className="location-address">{issue.location?.address || 'No address provided'}</p>
            {Number.isFinite(issue.location?.lat) && Number.isFinite(issue.location?.lng) ? (
              <>
                <IssueMap
                  issues={[issue]}
                  selected={{ lat: issue.location.lat, lng: issue.location.lng }}
                  height={210}
                />
                <div className="map-links-row">
                  <a
                    className="external-map-link"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${issue.location.lat},${issue.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Navigation ↗
                  </a>
                  <a
                    className="external-map-link"
                    href={`https://www.openstreetmap.org/?mlat=${issue.location.lat}&mlon=${issue.location.lng}#map=17/${issue.location.lat}/${issue.location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    OSM Map ↗
                  </a>
                </div>
              </>
            ) : (
              <div className="location-empty">
                <MapPin size={20} />
                <span>No GPS coordinates were attached to this report.</span>
              </div>
            )}
          </section>

          {/* Manager: Worker Assignment */}
          {isManager && issue.status !== 'resolved' && (
            <section className="panel side-detail-panel">
              <div className="panel-heading">
                <div><h3>Assign Field Worker</h3></div>
                <UserRound size={17} className="panel-muted-icon" />
              </div>
              <form onSubmit={assign} className="side-form">
                <select value={workerId} onChange={e => setWorkerId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.filter(u => u.role === 'worker').map(u => (
                    <option value={u._id} key={u._id}>
                      {u.name} {u.department ? `(${u.department})` : ''}
                    </option>
                  ))}
                </select>
                <button className="secondary-button full-width" disabled={busy}>
                  Save Assignment
                </button>
              </form>
            </section>
          )}

          {/* Worker Actions (Smart Task Execution) */}
          {(isAssignedWorker || isManager) && issue.status !== 'resolved' && (
            <section className="panel side-detail-panel worker-action-card">
              <div className="panel-heading">
                <div><h3>Task Execution</h3></div>
                <Wrench size={17} className="panel-muted-icon" />
              </div>

              <div className="worker-actions-stack">
                {issue.subStatus === 'assigned' && (
                  <div className="btn-action-group">
                    <button
                      className="primary-button full-width"
                      onClick={() => handleWorkerAction('accept')}
                      disabled={busy}
                    >
                      <CheckCircle2 size={16} /> Accept Assignment
                    </button>
                    <button
                      className="secondary-button full-width btn-danger"
                      onClick={() => setRejectModalOpen(true)}
                      disabled={busy}
                    >
                      Reject with Reason
                    </button>
                  </div>
                )}

                {(issue.subStatus === 'accepted' || issue.subStatus === 'paused') && (
                  <button
                    className="primary-button full-width"
                    onClick={() => handleWorkerAction('start')}
                    disabled={busy}
                  >
                    <Play size={16} /> Start Work on Site
                  </button>
                )}

                {issue.subStatus === 'in_progress' && (
                  <div className="btn-action-group">
                    <button
                      className="primary-button full-width"
                      onClick={() => setCompleteModalOpen(true)}
                      disabled={busy}
                    >
                      <CheckCheck size={16} /> Complete & Submit Evidence
                    </button>
                    <button
                      className="secondary-button full-width"
                      onClick={() => setPauseModalOpen(true)}
                      disabled={busy}
                    >
                      <Pause size={16} /> Pause Work
                    </button>
                  </div>
                )}

                {issue.subStatus === 'completed' && (
                  <div className="status-notice-box">
                    <CheckCheck size={18} className="text-green" />
                    <div>
                      <strong>Work Completed</strong>
                      <p>Awaiting manager verification.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Manager Verification & Reopen Panel */}
          {isManager && issue.subStatus === 'completed' && (
            <section className="panel side-detail-panel verify-panel">
              <div className="panel-heading">
                <div><h3>Manager Verification</h3></div>
                <ShieldCheck size={17} className="text-brand" />
              </div>
              <p className="side-copy">
                The field worker marked this task completed. Inspect before approving.
              </p>
              <div className="btn-action-group">
                <button
                  className="primary-button full-width"
                  onClick={() => setVerifyModalOpen(true)}
                  disabled={busy}
                >
                  <CheckCircle2 size={16} /> Verify & Approve Resolution
                </button>
                <button
                  className="secondary-button full-width btn-danger"
                  onClick={() => setReopenModalOpen(true)}
                  disabled={busy}
                >
                  <RotateCcw size={16} /> Reopen Task
                </button>
              </div>
            </section>
          )}

          {/* Resident Feedback Action */}
          {isResolved && !issue.feedback && (isReporter || isManager) && (
            <section className="panel side-detail-panel rate-callout-panel">
              <div className="panel-heading">
                <div><h3>Rate Resolution</h3></div>
                <Star size={17} className="text-amber" />
              </div>
              <p className="side-copy">
                The response team marked this issue resolved. Please review the work and rate the resolution quality.
              </p>
              <button
                className="primary-button full-width"
                onClick={() => setFeedbackModalOpen(true)}
              >
                <Star size={16} /> Rate Resolution & Feedback
              </button>
            </section>
          )}
        </aside>
      </div>

      {/* Reject Task Modal */}
      {rejectModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Reject Task Assignment</h3>
            <p>Explain why you cannot accept this assignment so dispatchers can reassign.</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Requires specialized electrical license or out of coverage zone…"
            />
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setRejectModalOpen(false)}>Cancel</button>
              <button
                className="primary-button btn-danger"
                onClick={() => handleWorkerAction('reject', { reason: rejectReason })}
                disabled={busy || !rejectReason.trim()}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Task Modal */}
      {pauseModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Pause Active Work</h3>
            <p>Provide a reason for temporarily pausing work on site.</p>
            <textarea
              rows={3}
              value={pauseReason}
              onChange={e => setPauseReason(e.target.value)}
              placeholder="e.g. Awaiting replacement valves or heavy rain disruption…"
            />
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setPauseModalOpen(false)}>Cancel</button>
              <button
                className="primary-button"
                onClick={() => handleWorkerAction('pause', { reason: pauseReason })}
                disabled={busy || !pauseReason.trim()}
              >
                Confirm Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Task Modal with Before/After Photos */}
      {completeModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Complete Task & Submit Proof</h3>
            <p>Provide detailed notes of work completed and attach proof photographs.</p>

            <label className="field-label-sm">Completion Notes *</label>
            <textarea
              required
              rows={3}
              value={completionNotes}
              onChange={e => setCompletionNotes(e.target.value)}
              placeholder="Describe repairs conducted, parts replaced, and cleanup completed…"
            />

            <div className="modal-photo-uploads mt-3">
              <label className="field-label-sm">Before Photos (Optional)</label>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={e => setBeforeFiles(Array.from(e.target.files || []).slice(0, 3))}
              />
              {beforeFiles.length > 0 && <small>{beforeFiles.length} photo(s) selected</small>}

              <label className="field-label-sm mt-2">After / Resolution Proof Photos *</label>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={e => setAfterFiles(Array.from(e.target.files || []).slice(0, 3))}
              />
              {afterFiles.length > 0 && <small>{afterFiles.length} photo(s) selected</small>}
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setCompleteModalOpen(false)}>Cancel</button>
              <button
                className="primary-button"
                onClick={() => handleWorkerAction('complete', {
                  completionNotes,
                  beforePhotos: beforeFiles,
                  afterPhotos: afterFiles
                })}
                disabled={busy || !completionNotes.trim()}
              >
                {busy ? 'Submitting…' : 'Submit Completion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {verifyModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Approve & Verify Resolution</h3>
            <p>Mark this complaint officially resolved. This updates the public dashboard and invites resident rating.</p>
            <textarea
              rows={3}
              value={verifyNotes}
              onChange={e => setVerifyNotes(e.target.value)}
              placeholder="Verification notes (optional)…"
            />
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setVerifyModalOpen(false)}>Cancel</button>
              <button
                className="primary-button"
                onClick={() => handleManagerVerification('verify', verifyNotes)}
                disabled={busy}
              >
                Confirm Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {reopenModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Reopen Complaint</h3>
            <p>Explain why the completed work does not satisfy quality standards.</p>
            <textarea
              required
              rows={3}
              value={reopenNotes}
              onChange={e => setReopenNotes(e.target.value)}
              placeholder="e.g. Debris was left on pavement or water pressure test failed…"
            />
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setReopenModalOpen(false)}>Cancel</button>
              <button
                className="primary-button btn-danger"
                onClick={() => handleManagerVerification('reopen', reopenNotes)}
                disabled={busy || !reopenNotes.trim()}
              >
                Reopen Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin AI Override Modal */}
      {overrideModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Review & Override AI Suggestions</h3>
            <p>Correct or adjust the category, priority, and department assigned to this ticket.</p>
            <form onSubmit={handleAiOverride}>
              <label className="field-label-sm">Category</label>
              <select value={overrideCat} onChange={e => setOverrideCat(e.target.value)} className="form-select mb-2">
                {['Garbage', 'Water', 'Roads', 'Streetlights', 'Drainage', 'Sanitation', 'Electrical', 'Buildings', 'Other'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <label className="field-label-sm">Priority</label>
              <select value={overridePri} onChange={e => setOverridePri(e.target.value)} className="form-select mb-2">
                {['low', 'medium', 'high', 'urgent'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <label className="field-label-sm">Department</label>
              <input
                type="text"
                value={overrideDept}
                onChange={e => setOverrideDept(e.target.value)}
                className="mb-3"
              />

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setOverrideModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={busy}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resident Feedback Modal */}
      {feedbackModalOpen && (
        <FeedbackModal
          issue={issue}
          onClose={() => setFeedbackModalOpen(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}

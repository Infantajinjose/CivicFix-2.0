import { useState, useEffect } from 'react';
import {
  Star,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Building2,
  ExternalLink
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { api, getApiError } from '../lib/api.js';

export default function FeedbackPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFeedbackStats = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/feedback/stats');
      setStats(data.data);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbackStats();
  }, []);

  return (
    <div className="content-page feedback-page-layout">
      <div className="page-intro-row">
        <div>
          <h2>Resident Satisfaction & Resolution Feedback</h2>
          <p>Analyze post-resolution resident reviews, service quality scores, and reopening rate trends.</p>
        </div>
        <button className="secondary-button" onClick={loadFeedbackStats} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon amber"><Star size={19} /></div>
          <div className="stat-label">Average Citizen Rating</div>
          <div className="stat-value">{stats?.avgRating ?? '5.0'} / 5</div>
          <div className="stat-hint">Based on {stats?.totalReviews ?? 0} verified reviews</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle2 size={19} /></div>
          <div className="stat-label">Verified Resolution Rate</div>
          <div className="stat-value">{stats?.satisfactionRate ?? 100}%</div>
          <div className="stat-hint">Confirmed resolved by reporters</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red"><RotateCcw size={19} /></div>
          <div className="stat-label">Reopen Request Rate</div>
          <div className="stat-value">{stats?.reopenRate ?? 0}%</div>
          <div className="stat-hint">Tasks flagged for rework by residents</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue"><MessageSquare size={19} /></div>
          <div className="stat-label">Total Reviews Logged</div>
          <div className="stat-value">{stats?.totalReviews ?? 0}</div>
          <div className="stat-hint">Resident feedback records</div>
        </div>
      </div>

      <div className="dashboard-grid main-dashboard-grid mt-4">
        {/* Recent Feedback Feed */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Citizen Reviews</h3>
              <p>Direct feedback and quality ratings from community members</p>
            </div>
          </div>

          <div className="feedback-list">
            {(stats?.recentFeedbacks || []).length === 0 ? (
              <div className="empty-sub-state">
                <Star size={32} className="text-muted" />
                <p>No resident feedback submitted yet. Reviews appear when residents rate completed work.</p>
              </div>
            ) : (
              stats.recentFeedbacks.map(item => (
                <div key={item._id} className="feedback-item-card">
                  <div className="feedback-item-top">
                    <div className="feedback-user">
                      <strong>{item.userId?.name || 'Resident'}</strong>
                      <div className="star-row-small">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star
                            key={s}
                            size={14}
                            fill={item.rating >= s ? '#f59e0b' : 'none'}
                            stroke={item.rating >= s ? '#f59e0b' : '#cbd5e1'}
                          />
                        ))}
                      </div>
                    </div>
                    {item.issueId && (
                      <Link to={`/issues/${item.issueId._id}`} className="feedback-ticket-pill">
                        {item.issueId.ticketNumber} <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>

                  {item.comment ? (
                    <p className="feedback-comment">"{item.comment}"</p>
                  ) : (
                    <p className="feedback-comment text-muted italic">No written comment provided.</p>
                  )}

                  {item.reopenRequested && (
                    <div className="reopen-badge-notice">
                      <RotateCcw size={13} /> Reopen Requested: {item.reopenReason || 'Unresolved'}
                    </div>
                  )}

                  <div className="feedback-item-bottom">
                    <small>Rated {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</small>
                    <span className="feedback-dept-tag">Dept: {item.department || 'General'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Department Satisfaction Ranking */}
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Department Satisfaction Index</h3>
              <p>Average resident ratings ranked by responding department</p>
            </div>
            <TrendingUp size={18} className="panel-muted-icon" />
          </div>

          <div className="dept-rating-list">
            {(stats?.departmentStats || []).length === 0 ? (
              <div className="empty-sub-state">
                <p>Department ratings will populate as tickets are closed.</p>
              </div>
            ) : (
              stats.departmentStats.map(dept => (
                <div key={dept._id} className="dept-rating-row">
                  <div className="dept-rating-title">
                    <Building2 size={16} />
                    <strong>{dept._id || 'General Services'}</strong>
                  </div>
                  <div className="dept-rating-score">
                    <div className="dept-stars">
                      <Star size={14} fill="#f59e0b" stroke="#f59e0b" />
                      <strong>{Math.round((dept.avgRating || 0) * 10) / 10}</strong>
                    </div>
                    <span>({dept.reviewCount} reviews)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

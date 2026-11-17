import { useState } from 'react';
import { Star, UploadCloud, X, CheckCircle2, RotateCcw } from 'lucide-react';
import { api, getApiError } from '../lib/api.js';

export default function FeedbackModal({ issue, onClose, onSuccess }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isResolved, setIsResolved] = useState(true);
  const [reopenReason, setReopenReason] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setEvidenceFiles(prev => [...prev, ...files].slice(0, 3));
    e.target.value = '';
  };

  const removeFile = (idx) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const form = new FormData();
      form.append('rating', rating);
      form.append('comment', comment);
      form.append('isResolved', isResolved);
      form.append('reopenRequested', !isResolved);
      if (!isResolved) {
        form.append('reopenReason', reopenReason);
      }
      evidenceFiles.forEach(file => form.append('evidence', file));

      await api.post(`/feedback/issue/${issue._id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h3>Rate Resolution & Feedback</h3>
            <p>Ticket: <strong>{issue.ticketNumber}</strong></p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="feedback-section">
            <label className="field-label-sm">Was the problem completely resolved?</label>
            <div className="resolution-confirm-toggle">
              <button
                type="button"
                className={`toggle-option ${isResolved ? 'selected-yes' : ''}`}
                onClick={() => setIsResolved(true)}
              >
                <CheckCircle2 size={16} /> Yes, Problem Fixed
              </button>
              <button
                type="button"
                className={`toggle-option ${!isResolved ? 'selected-no' : ''}`}
                onClick={() => setIsResolved(false)}
              >
                <RotateCcw size={16} /> No, Request Reopen
              </button>
            </div>
          </div>

          <div className="feedback-section">
            <label className="field-label-sm">How satisfied are you with the response?</label>
            <div className="star-rating-row">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  className="star-btn"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    size={28}
                    fill={(hoverRating || rating) >= star ? '#f59e0b' : 'none'}
                    stroke={(hoverRating || rating) >= star ? '#f59e0b' : 'var(--line-strong)'}
                  />
                </button>
              ))}
              <span className="rating-text-label">
                {rating === 5 && 'Outstanding'}
                {rating === 4 && 'Good'}
                {rating === 3 && 'Average'}
                {rating === 2 && 'Needs Improvement'}
                {rating === 1 && 'Unsatisfactory'}
              </span>
            </div>
          </div>

          {!isResolved && (
            <div className="feedback-section reopen-alert-block">
              <label className="field-label-sm text-red">
                Why was this not resolved? (Reopen Reason) *
              </label>
              <textarea
                required
                rows={3}
                value={reopenReason}
                onChange={e => setReopenReason(e.target.value)}
                placeholder="Explain what is still broken or incomplete on site…"
              />

              <label className="field-label-sm mt-3">Upload evidence photo (optional)</label>
              <div className="evidence-upload-zone">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={handleFileChange}
                />
                <div className="upload-icon"><UploadCloud size={18} /></div>
                <span>Upload proof of incomplete work (up to 3 photos)</span>
              </div>
              {evidenceFiles.length > 0 && (
                <div className="selected-files">
                  {evidenceFiles.map((file, idx) => (
                    <div key={idx} className="selected-file">
                      <span>{file.name}</span>
                      <button type="button" onClick={() => removeFile(idx)}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="feedback-section">
            <label className="field-label-sm">Feedback comments or notes</label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Share your experience or note any details for the team…"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Submitting…' : isResolved ? 'Submit Rating' : 'Reopen Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

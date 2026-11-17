const labels = { submitted: 'Submitted', assigned: 'Assigned', in_progress: 'In progress', resolved: 'Resolved', rejected: 'Rejected' };
export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status || 'submitted'}`}><span className="status-dot" />{labels[status] || status}</span>;
}

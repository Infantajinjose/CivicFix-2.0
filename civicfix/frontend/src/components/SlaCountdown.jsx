import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';

export default function SlaCountdown({ dueAt, isEscalated, isResolved }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);
  const [urgency, setUrgency] = useState('normal'); // 'normal', 'warning', 'overdue'

  useEffect(() => {
    if (!dueAt || isResolved) return;

    function updateTimer() {
      const target = new Date(dueAt).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setIsOverdue(true);
        setUrgency('overdue');
        const overdueHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
        const overdueMins = Math.floor((Math.abs(diff) % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${overdueHours}h ${overdueMins}m overdue`);
      } else {
        setIsOverdue(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours < 4) {
          setUrgency('warning');
        } else {
          setUrgency('normal');
        }

        setTimeLeft(`${hours}h ${mins}m left`);
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // update every minute
    return () => clearInterval(interval);
  }, [dueAt, isResolved]);

  if (isResolved) {
    return (
      <span className="sla-chip sla-resolved">
        <CheckCircle size={13} /> SLA Resolved
      </span>
    );
  }

  if (!dueAt) return null;

  return (
    <span className={`sla-chip sla-${urgency} ${isEscalated ? 'sla-escalated' : ''}`}>
      {isOverdue || isEscalated ? <AlertTriangle size={13} /> : <Clock size={13} />}
      <span>{isEscalated ? `⚠️ Escalated (${timeLeft})` : `SLA: ${timeLeft}`}</span>
    </span>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Clock3, AlertCircle, Wrench, CheckCircle2, MessageSquare, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '../context/SocketContext.jsx';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const dropdownRef = useRef(null);
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useSocket();

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = tab === 'unread' ? notifications.filter(n => !n.read) : notifications;

  const getIcon = (type) => {
    switch (type) {
      case 'ISSUE_CREATED': return <AlertCircle size={15} className="text-blue" />;
      case 'ISSUE_ASSIGNED': return <Wrench size={15} className="text-amber" />;
      case 'WORKER_ACCEPTED':
      case 'WORKER_COMPLETED':
      case 'ISSUE_VERIFIED': return <CheckCircle2 size={15} className="text-green" />;
      case 'SLA_WARNING':
      case 'SLA_OVERDUE': return <AlertCircle size={15} className="text-red" />;
      case 'FEEDBACK_RECEIVED': return <MessageSquare size={15} className="text-purple" />;
      default: return <Clock3 size={15} />;
    }
  };

  return (
    <div className="notif-wrapper" ref={dropdownRef}>
      <button
        className={`icon-button notif-bell-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown-card">
          <div className="notif-header">
            <div className="notif-header-title">
              <strong>Notifications</strong>
              {unreadCount > 0 && <span className="notif-unread-pill">{unreadCount} new</span>}
            </div>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={markAllAsRead}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="notif-tabs">
            <button className={`notif-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
              All ({notifications.length})
            </button>
            <button className={`notif-tab ${tab === 'unread' ? 'active' : ''}`} onClick={() => setTab('unread')}>
              Unread ({unreadCount})
            </button>
          </div>

          <div className="notif-list">
            {filtered.length === 0 ? (
              <div className="notif-empty">
                <Bell size={24} />
                <p>No {tab === 'unread' ? 'unread' : ''} notifications right now</p>
              </div>
            ) : (
              filtered.map(item => (
                <div
                  key={item._id}
                  className={`notif-item ${item.read ? 'read' : 'unread'}`}
                  onClick={() => !item.read && markAsRead(item._id)}
                >
                  <div className="notif-item-icon">{getIcon(item.type)}</div>
                  <div className="notif-item-content">
                    <div className="notif-item-title">
                      <strong>{item.title}</strong>
                      {!item.read && <span className="unread-dot" />}
                    </div>
                    <p>{item.message}</p>
                    <div className="notif-item-footer">
                      <small>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</small>
                      {item.issueId && (
                        <Link
                          to={`/issues/${item.issueId._id || item.issueId}`}
                          onClick={() => setOpen(false)}
                          className="notif-issue-link"
                        >
                          View Issue <ExternalLink size={12} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

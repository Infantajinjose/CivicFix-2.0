import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { api } from '../lib/api.js';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!localStorage.getItem('civicfix_token')) return;
    try {
      const { data } = await api.get('/notifications?limit=20');
      setNotifications(data.data.notifications);
      setUnreadCount(data.data.unreadCount);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user) {
      if (socket) socket.disconnect();
      setSocket(null);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    const token = localStorage.getItem('civicfix_token');
    const socketUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

    const s = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    s.on('connect', () => {
      // Connected
    });

    s.on('notification', ({ notification }) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Trigger subtle toast
      setToast({
        id: notification._id || Date.now(),
        title: notification.title,
        message: notification.message,
        type: notification.type
      });

      // Auto dismiss toast after 5s
      setTimeout(() => {
        setToast(current => (current?.id === notification._id ? null : current));
      }, 5000);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const dismissToast = () => setToast(null);

  return (
    <SocketContext.Provider
      value={{
        socket,
        unreadCount,
        notifications,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        toast,
        dismissToast
      }}
    >
      {children}
      {toast && (
        <div className="live-toast-container" onClick={dismissToast}>
          <div className="live-toast-card">
            <div className="live-toast-badge" />
            <div className="live-toast-body">
              <strong>{toast.title}</strong>
              <p>{toast.message}</p>
            </div>
            <button className="live-toast-close" onClick={dismissToast}>&times;</button>
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);

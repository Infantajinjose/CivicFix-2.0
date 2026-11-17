import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

let ioInstance = null;

export function initSocketIO(httpServer) {
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(v => v.trim());

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(null, true); // Dev fallback
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.sub).select('_id name role tenantId');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      socket.tenantId = user.tenantId?.toString();
      next();
    } catch (err) {
      next(new Error('Invalid socket authentication'));
    }
  });

  io.on('connection', (socket) => {
    const { user, tenantId } = socket;

    // Join specific rooms
    socket.join(`user:${user._id.toString()}`);
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
      socket.join(`tenant:${tenantId}:${user.role}`);
    }

    socket.on('disconnect', () => {
      // Clean up if needed
    });
  });

  ioInstance = io;
  return io;
}

export function getIO() {
  return ioInstance;
}

/**
 * Creates persistent notification and broadcasts via Socket.IO
 */
export async function sendNotification({
  tenantId,
  recipientId,
  type,
  title,
  message,
  issueId = null,
  metadata = {}
}) {
  try {
    const notification = await Notification.create({
      tenantId,
      recipient: recipientId,
      type,
      title,
      message,
      issueId,
      metadata
    });

    if (ioInstance) {
      ioInstance.to(`user:${recipientId.toString()}`).emit('notification', {
        notification
      });
    }

    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
}

/**
 * Broadcast event to an entire tenant or specific role within tenant
 */
export function broadcastTenantEvent(tenantId, event, data, role = null) {
  if (!ioInstance || !tenantId) return;
  const room = role ? `tenant:${tenantId.toString()}:${role}` : `tenant:${tenantId.toString()}`;
  ioInstance.to(room).emit(event, data);
}

import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';

// Services
import { initSocketIO } from './services/socketService.js';
import { initSlaScheduler } from './services/slaScheduler.js';

// Route Handlers
import authRoutes from './routes/auth.js';
import issueRoutes from './routes/issues.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import workerRoutes from './routes/worker.js';
import slaRoutes from './routes/sla.js';
import publicRoutes from './routes/public.js';
import qrRoutes from './routes/qr.js';
import feedbackRoutes from './routes/feedback.js';
import analyticsRoutes from './routes/analytics.js';
import subscriptionRoutes from './routes/subscriptions.js';
import superadminRoutes from './routes/superadmin.js';

const app = express();
const server = http.createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(v => v.trim());

// Security & Middlewares
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return callback(null, true);
    return callback(null, true); // Fallback for dev ease
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Static Uploads
app.use('/uploads', express.static(path.resolve('uploads'), { maxAge: '1d', immutable: false }));

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

// Mount Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/worker', workerRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/superadmin', superadminRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({
  success: true,
  message: 'CivicFix 2.0 API is running',
  version: '2.0.0',
  timestamp: new Date().toISOString()
}));

// Fallback 404
app.use((_req, res) => res.status(404).json({ success: false, message: 'API route not found.' }));

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: err.code === 'LIMIT_FILE_SIZE' ? `Each image must be under ${process.env.MAX_UPLOAD_MB || 5} MB.` : err.message
    });
  }
  if (err.message?.startsWith('Only JPG, PNG')) return res.status(400).json({ success: false, message: err.message });
  if (err.code === 11000) return res.status(409).json({ success: false, message: 'This record already exists.' });
  if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: Object.values(err.errors).map(e => e.message).join(', ') });
  res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : (err.message || 'Internal server error.')
  });
});

const port = Number(process.env.PORT || 5000);

connectDB().then(() => {
  initSocketIO(server);
  initSlaScheduler();
  server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 CivicFix 2.0 API and Socket.IO listening on port ${port}`);
  });
}).catch(error => {
  console.error('Unable to start CivicFix 2.0 API:', error);
  process.exit(1);
});

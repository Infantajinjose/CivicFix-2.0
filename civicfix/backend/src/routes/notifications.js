import { Router } from 'express';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(protect);

// Get user notifications with unread count
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, filter = 'all' } = req.query;
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  const query = { recipient: req.user._id };
  if (filter === 'unread') query.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('issueId', 'ticketNumber title status priority category'),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: req.user._id, read: false })
  ]);

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    }
  });
}));

// Mark single notification as read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { read: true },
    { new: true }
  );
  if (!notif) return res.status(404).json({ success: false, message: 'Notification not found.' });

  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });
  res.json({ success: true, data: { notification: notif, unreadCount } });
}));

// Mark all notifications as read
router.patch('/mark-all-read', asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { read: true }
  );
  res.json({ success: true, message: 'All notifications marked as read.', unreadCount: 0 });
}));

// Delete a notification
router.delete('/:id', asyncHandler(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, read: false });
  res.json({ success: true, data: { unreadCount } });
}));

export default router;

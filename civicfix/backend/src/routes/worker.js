import { Router } from 'express';
import Issue from '../models/Issue.js';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(protect);

// Worker Tasks Endpoint (Mobile portal backend)
router.get('/tasks', asyncHandler(async (req, res) => {
  const { filter = 'all' } = req.query;
  const workerId = req.user._id;

  const baseQuery = {
    tenantId: req.tenantId,
    assignedTo: workerId
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  if (filter === 'today') {
    // Tasks due today or updated today
    baseQuery.$or = [
      { dueAt: { $gte: startOfToday, $lte: endOfToday } },
      { 'workerResponse.startedAt': { $gte: startOfToday } },
      { priority: 'urgent', status: { $in: ['assigned', 'in_progress'] } }
    ];
  } else if (filter === 'active') {
    baseQuery.status = 'in_progress';
    baseQuery.subStatus = { $in: ['accepted', 'in_progress', 'paused', 'reopened'] };
  } else if (filter === 'pending_acceptance') {
    baseQuery.subStatus = 'assigned';
  } else if (filter === 'completed') {
    baseQuery.subStatus = { $in: ['completed', 'verified'] };
  } else if (filter === 'upcoming') {
    baseQuery.status = { $in: ['assigned', 'in_progress'] };
    baseQuery.subStatus = { $ne: 'completed' };
  }

  const tasks = await Issue.find(baseQuery)
    .sort({ priority: -1, dueAt: 1, createdAt: -1 })
    .populate('createdBy', 'name phone')
    .populate('history.changedBy', 'name role');

  res.json({
    success: true,
    data: { tasks }
  });
}));

// Worker Dashboard KPI statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const workerId = req.user._id;
  const baseQuery = { tenantId: req.tenantId, assignedTo: workerId };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalAssigned, pendingAcceptance, inProgress, completedToday, totalCompleted] = await Promise.all([
    Issue.countDocuments(baseQuery),
    Issue.countDocuments({ ...baseQuery, subStatus: 'assigned' }),
    Issue.countDocuments({ ...baseQuery, subStatus: { $in: ['accepted', 'in_progress', 'paused', 'reopened'] } }),
    Issue.countDocuments({
      ...baseQuery,
      subStatus: { $in: ['completed', 'verified'] },
      'workerResponse.completedAt': { $gte: startOfToday }
    }),
    Issue.countDocuments({ ...baseQuery, subStatus: { $in: ['completed', 'verified'] } })
  ]);

  res.json({
    success: true,
    data: {
      totalAssigned,
      pendingAcceptance,
      inProgress,
      completedToday,
      totalCompleted
    }
  });
}));

export default router;

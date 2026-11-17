import { Router } from 'express';
import SLAConfiguration from '../models/SLAConfiguration.js';
import Escalation from '../models/Escalation.js';
import Issue from '../models/Issue.js';
import { protect, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(protect);

// Get Organization SLA Configuration
router.get('/config', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  let config = await SLAConfiguration.findOne({ tenantId: req.tenantId });
  if (!config) {
    config = await SLAConfiguration.create({ tenantId: req.tenantId });
  }
  res.json({ success: true, data: { config } });
}));

// Update Organization SLA Configuration
router.patch('/config', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const { rules, autoEscalate, escalationRole } = req.body;
  let config = await SLAConfiguration.findOne({ tenantId: req.tenantId });
  if (!config) {
    config = new SLAConfiguration({ tenantId: req.tenantId });
  }

  if (Array.isArray(rules)) config.rules = rules;
  if (autoEscalate !== undefined) config.autoEscalate = Boolean(autoEscalate);
  if (escalationRole) config.escalationRole = escalationRole;

  await config.save();
  res.json({ success: true, data: { config } });
}));

// List Escalations
router.get('/escalations', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const { status = 'all' } = req.query;
  const filter = { tenantId: req.tenantId };
  if (status !== 'all') filter.status = status;

  const escalations = await Escalation.find(filter)
    .sort({ createdAt: -1 })
    .populate('issueId', 'ticketNumber title category priority status dueAt location')
    .populate('assignedWorker', 'name role department')
    .populate('acknowledgedBy', 'name role');

  res.json({ success: true, data: { escalations } });
}));

// Acknowledge Escalation
router.patch('/escalations/:id/acknowledge', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const { notes = '' } = req.body;
  const escalation = await Escalation.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!escalation) return res.status(404).json({ success: false, message: 'Escalation record not found.' });

  escalation.status = 'acknowledged';
  escalation.acknowledgedBy = req.user._id;
  escalation.acknowledgedAt = new Date();
  if (notes.trim()) escalation.notes = notes.trim();
  await escalation.save();

  res.json({ success: true, data: { escalation } });
}));

// SLA Compliance Statistics
router.get('/stats', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const base = { tenantId: req.tenantId };
  const closedBase = { tenantId: req.tenantId, status: { $in: ['resolved', 'rejected'] } };

  const [totalResolved, withinSlaCount, breachedCount, openEscalations, avgResolutionResult] = await Promise.all([
    Issue.countDocuments(closedBase),
    Issue.countDocuments({ ...closedBase, 'sla.resolvedWithinSla': true }),
    Issue.countDocuments({ ...closedBase, 'sla.resolvedWithinSla': false }),
    Escalation.countDocuments({ tenantId: req.tenantId, status: 'open' }),
    Issue.aggregate([
      { $match: { ...closedBase, 'sla.actualResolutionHours': { $ne: null } } },
      { $group: { _id: null, avgHours: { $avg: '$sla.actualResolutionHours' } } }
    ])
  ]);

  const complianceRate = totalResolved > 0
    ? Math.round((withinSlaCount / totalResolved) * 100)
    : 100;

  const avgResolutionHours = avgResolutionResult[0]?.avgHours
    ? Math.round(avgResolutionResult[0].avgHours * 10) / 10
    : 0;

  res.json({
    success: true,
    data: {
      complianceRate,
      withinSlaCount,
      breachedCount,
      openEscalations,
      avgResolutionHours,
      totalResolved
    }
  });
}));

export default router;

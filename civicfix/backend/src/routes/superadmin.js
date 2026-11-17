import { Router } from 'express';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Issue from '../models/Issue.js';
import Subscription from '../models/Subscription.js';
import Payment from '../models/Payment.js';
import AuditLog from '../models/AuditLog.js';
import { protect, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { PLANS } from '../services/billingService.js';

const router = Router();
router.use(protect);
router.use(allowRoles('superadmin'));

// Super Admin Platform Statistics
router.get('/metrics', asyncHandler(async (req, res) => {
  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalUsers,
    totalIssues,
    resolvedIssues,
    revenueData,
    planDistribution
  ] = await Promise.all([
    Tenant.countDocuments(),
    Tenant.countDocuments({ status: 'active' }),
    Tenant.countDocuments({ status: 'suspended' }),
    User.countDocuments(),
    Issue.countDocuments(),
    Issue.countDocuments({ status: 'resolved' }),
    Payment.aggregate([
      { $match: { status: 'captured' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ]),
    Subscription.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ])
  ]);

  const totalRevenuePaise = revenueData[0]?.totalRevenue || 0;

  res.json({
    success: true,
    data: {
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalIssues,
      resolvedIssues,
      totalRevenueINR: Math.round(totalRevenuePaise / 100),
      planDistribution
    }
  });
}));

// List all tenants with stats
router.get('/tenants', asyncHandler(async (req, res) => {
  const tenants = await Tenant.find().sort({ createdAt: -1 });

  const tenantsWithStats = await Promise.all(
    tenants.map(async (t) => {
      const [userCount, issueCount] = await Promise.all([
        User.countDocuments({ tenantId: t._id }),
        Issue.countDocuments({ tenantId: t._id })
      ]);
      return {
        ...t.toObject(),
        userCount,
        issueCount
      };
    })
  );

  res.json({ success: true, data: { tenants: tenantsWithStats } });
}));

// Suspend or Activate Tenant
router.patch('/tenants/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  const tenant = await Tenant.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

  // Log audit
  await AuditLog.create({
    userId: req.user._id,
    action: `TENANT_STATUS_${status.toUpperCase()}`,
    resourceType: 'Tenant',
    resourceId: tenant._id,
    details: { newStatus: status }
  });

  res.json({ success: true, data: { tenant } });
}));

// Super Admin Update Tenant Plan
router.patch('/tenants/:id/plan', asyncHandler(async (req, res) => {
  const { plan } = req.body;
  const planConfig = PLANS[plan];
  if (!planConfig) return res.status(400).json({ success: false, message: 'Invalid plan selection.' });

  const tenant = await Tenant.findByIdAndUpdate(
    req.params.id,
    { plan: planConfig.id },
    { new: true }
  );

  await Subscription.findOneAndUpdate(
    { tenantId: tenant._id },
    { plan: planConfig.id, limits: planConfig.limits, status: 'active' },
    { upsert: true }
  );

  res.json({ success: true, data: { tenant } });
}));

// System Audit Logs
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const logs = await AuditLog.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('userId', 'name email role');

  res.json({ success: true, data: { logs } });
}));

export default router;

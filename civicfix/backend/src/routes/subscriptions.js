import { Router } from 'express';
import Subscription from '../models/Subscription.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import { protect, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  PLANS,
  getOrCreateSubscription,
  createSubscriptionOrder,
  verifyPaymentAndActivate
} from '../services/billingService.js';

const router = Router();
router.use(protect);
router.use(allowRoles('superadmin', 'owner', 'manager'));

// Get current subscription & usage limits
router.get('/current', asyncHandler(async (req, res) => {
  const subscription = await getOrCreateSubscription(req.tenantId);
  const planConfig = PLANS[subscription.plan] || PLANS.starter;

  // Calculate current usage
  const [workerCount, departmentCount] = await Promise.all([
    User.countDocuments({ tenantId: req.tenantId, role: 'worker', active: true }),
    Tenant.findById(req.tenantId).select('departments').then(t => t?.departments?.length || 0)
  ]);

  res.json({
    success: true,
    data: {
      subscription,
      planConfig,
      allPlans: Object.values(PLANS),
      usage: {
        workersUsed: workerCount,
        maxWorkers: subscription.limits?.maxWorkers || planConfig.limits.maxWorkers,
        departmentsUsed: departmentCount,
        maxDepartments: subscription.limits?.maxDepartments || planConfig.limits.maxDepartments
      }
    }
  });
}));

// Create payment order
router.post('/create-order', asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const orderData = await createSubscriptionOrder({
    tenantId: req.tenantId,
    planId,
    customerUser: req.user
  });
  res.json({ success: true, data: orderData });
}));

// Verify payment and upgrade plan
router.post('/verify-payment', asyncHandler(async (req, res) => {
  const { orderId, razorpayPaymentId, razorpaySignature, planId } = req.body;
  if (!orderId || !planId) {
    return res.status(400).json({ success: false, message: 'Order ID and Plan ID are required.' });
  }

  const result = await verifyPaymentAndActivate({
    tenantId: req.tenantId,
    orderId,
    razorpayPaymentId,
    razorpaySignature,
    planId
  });

  res.json({
    success: true,
    message: `Successfully upgraded to ${result.plan.name}!`,
    data: result
  });
}));

// Direct upgrade for dev / sandbox mode
router.post('/sandbox-upgrade', asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ success: false, message: 'Invalid plan.' });

  const sub = await Subscription.findOneAndUpdate(
    { tenantId: req.tenantId },
    {
      plan: plan.id,
      status: 'active',
      limits: plan.limits,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    { upsert: true, new: true }
  );

  await Tenant.findByIdAndUpdate(req.tenantId, { plan: plan.id });

  // Create audit payment record
  await Payment.create({
    tenantId: req.tenantId,
    orderId: `sandbox_${Date.now()}`,
    paymentId: `pay_sandbox_${Date.now()}`,
    signature: 'sandbox_approved',
    amount: plan.price * 100,
    currency: 'INR',
    status: 'captured',
    plan: plan.id,
    receipt: `rcpt_sandbox_${Date.now()}`,
    invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: req.user.name,
    customerEmail: req.user.email
  });

  res.json({ success: true, message: `Activated ${plan.name} in sandbox mode.`, data: { subscription: sub } });
}));

// List invoices & payment history
router.get('/invoices', asyncHandler(async (req, res) => {
  const invoices = await Payment.find({ tenantId: req.tenantId })
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({ success: true, data: { invoices } });
}));

export default router;

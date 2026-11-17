import crypto from 'crypto';
import Subscription from '../models/Subscription.js';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';

export const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter Tier',
    price: 0,
    interval: 'month',
    limits: {
      maxWorkers: 5,
      maxDepartments: 3,
      aiAnalysis: false,
      slaManagement: false,
      qrReporting: false,
      advancedAnalytics: false,
      publicDashboard: true
    },
    features: [
      'Up to 5 Field Workers',
      'Up to 3 Departments',
      'Basic Issue Tracking',
      'Community Public Dashboard',
      'Standard Email Support'
    ]
  },
  professional: {
    id: 'professional',
    name: 'Professional Tier',
    price: 3999,
    interval: 'month',
    limits: {
      maxWorkers: 25,
      maxDepartments: 10,
      aiAnalysis: true,
      slaManagement: true,
      qrReporting: true,
      advancedAnalytics: true,
      publicDashboard: true
    },
    features: [
      'Up to 25 Field Workers',
      'Up to 10 Departments',
      'AI Complaint Classification & Duplicate Detection',
      'Automated SLA Deadlines & Escalation Engine',
      'Facility QR Code Fast Reporting',
      'Advanced Predictive Analytics & Hotspots',
      'Exportable CSV & Performance Audits'
    ]
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Tier',
    price: 9999,
    interval: 'month',
    limits: {
      maxWorkers: 200,
      maxDepartments: 50,
      aiAnalysis: true,
      slaManagement: true,
      qrReporting: true,
      advancedAnalytics: true,
      publicDashboard: true
    },
    features: [
      'Unlimited Field Workers & Scaled Operations',
      'Unlimited Departments & Facilities',
      'Full AI Suite & Custom Priority Rules',
      'Custom SLA Escalation Workflows',
      'Unlimited QR Code Reporting Hubs',
      'Dedicated Account Manager & 24/7 SLA Support',
      'Multi-Facility Aggregation'
    ]
  }
};

/**
 * Ensures or retrieves a tenant's subscription
 */
export async function getOrCreateSubscription(tenantId, preferredPlan = 'starter') {
  let sub = await Subscription.findOne({ tenantId });
  if (!sub) {
    const planConfig = PLANS[preferredPlan] || PLANS.starter;
    sub = await Subscription.create({
      tenantId,
      plan: planConfig.id,
      status: 'active',
      limits: planConfig.limits
    });
    await Tenant.findByIdAndUpdate(tenantId, { plan: planConfig.id, subscription: sub._id });
  }
  return sub;
}

/**
 * Creates order for Razorpay or mock test checkout
 */
export async function createSubscriptionOrder({ tenantId, planId, customerUser }) {
  const plan = PLANS[planId];
  if (!plan) throw new Error('Invalid plan selection.');

  const orderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const receipt = `rcpt_${tenantId.toString().slice(-6)}_${Date.now()}`;
  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const payment = await Payment.create({
    tenantId,
    orderId,
    amount: plan.price * 100, // paise
    currency: 'INR',
    status: 'created',
    plan: plan.id,
    receipt,
    invoiceNumber,
    customerName: customerUser.name,
    customerEmail: customerUser.email
  });

  return {
    orderId,
    amount: plan.price * 100,
    currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_civicfix_sandbox',
    plan,
    paymentId: payment._id
  };
}

/**
 * Verifies Razorpay signature or handles mock test verification
 */
export async function verifyPaymentAndActivate({
  tenantId,
  orderId,
  razorpayPaymentId = '',
  razorpaySignature = '',
  planId
}) {
  const payment = await Payment.findOne({ tenantId, orderId });
  if (!payment) throw new Error('Payment transaction not found.');

  // Check Razorpay signature if key secret is configured
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (secret && razorpayPaymentId && razorpaySignature) {
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      payment.status = 'failed';
      await payment.save();
      throw new Error('Invalid payment signature verification failed.');
    }
  }

  // Update payment record to captured
  payment.status = 'captured';
  payment.paymentId = razorpayPaymentId || `pay_mock_${Date.now()}`;
  payment.signature = razorpaySignature || 'signature_verified_mock';
  await payment.save();

  // Upgrade or update subscription
  const planConfig = PLANS[planId] || PLANS.professional;
  const sub = await Subscription.findOneAndUpdate(
    { tenantId },
    {
      plan: planConfig.id,
      status: 'active',
      limits: planConfig.limits,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    { upsert: true, new: true }
  );

  await Tenant.findByIdAndUpdate(tenantId, { plan: planConfig.id, subscription: sub._id });

  return { success: true, plan: planConfig, subscription: sub };
}

/**
 * Middleware: Verify if tenant plan includes a specific feature limit
 */
export function checkPlanFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const sub = await getOrCreateSubscription(req.tenantId);
      if (sub.limits && sub.limits[featureKey] === false) {
        return res.status(403).json({
          success: false,
          code: 'PLAN_FEATURE_LOCKED',
          message: `This feature requires an upgraded SaaS subscription (${featureKey}). Please upgrade your plan.`
        });
      }
      req.subscription = sub;
      next();
    } catch (err) {
      next(err);
    }
  };
}

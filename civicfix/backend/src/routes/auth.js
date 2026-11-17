import { Router } from 'express';
import slugify from 'slugify';
import Tenant from '../models/Tenant.js';
import User from '../models/User.js';
import SLAConfiguration from '../models/SLAConfiguration.js';
import Subscription from '../models/Subscription.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { signToken } from '../utils/tokens.js';
import { protect } from '../middleware/auth.js';
import { PLANS } from '../services/billingService.js';

const router = Router();

router.post('/register', asyncHandler(async (req, res) => {
  const { organizationName, name, email, password } = req.body;
  if (!organizationName?.trim() || !name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ success: false, message: 'Organisation, full name, email and password are required.' });
  }
  if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must contain at least 8 characters.' });
  const normalizedEmail = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

  const baseSlug = slugify(organizationName, { lower: true, strict: true }) || 'organisation';
  const tenant = await Tenant.create({
    name: organizationName.trim(),
    slug: `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`,
    plan: 'starter'
  });

  try {
    const user = await User.create({
      tenantId: tenant._id,
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'owner'
    });

    // Create default SLA configuration
    await SLAConfiguration.create({ tenantId: tenant._id });

    // Create default starter subscription
    const sub = await Subscription.create({
      tenantId: tenant._id,
      plan: 'starter',
      status: 'active',
      limits: PLANS.starter.limits
    });
    tenant.subscription = sub._id;
    await tenant.save();

    const token = signToken(user);
    return res.status(201).json({
      success: true,
      data: {
        token,
        user: user.toSafeObject(),
        tenant: { id: tenant._id, name: tenant.name, plan: tenant.plan, slug: tenant.slug }
      }
    });
  } catch (error) {
    await Tenant.findByIdAndDelete(tenant._id);
    throw error;
  }
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
  
  const user = await User.findOne({ email: email.toLowerCase().trim(), active: true })
    .select('+password')
    .populate('tenantId');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
  }

  // Allow Superadmin to log in even without specific tenantId
  if (user.role === 'superadmin') {
    const token = signToken(user);
    return res.json({
      success: true,
      data: {
        token,
        user: user.toSafeObject(),
        tenant: user.tenantId ? { id: user.tenantId._id, name: user.tenantId.name, plan: user.tenantId.plan } : null
      }
    });
  }

  if (!user.tenantId || user.tenantId.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'This organisation account is suspended or unavailable.' });
  }

  const token = signToken(user);
  res.json({
    success: true,
    data: {
      token,
      user: user.toSafeObject(),
      tenant: { id: user.tenantId._id, name: user.tenantId.name, plan: user.tenantId.plan, slug: user.tenantId.slug }
    }
  });
}));

router.get('/me', protect, asyncHandler(async (req, res) => {
  let tenant = null;
  if (req.tenantId) {
    tenant = await Tenant.findById(req.tenantId).select('name slug plan status departments publicDashboard');
  }
  res.json({ success: true, data: { user: req.user.toSafeObject(), tenant } });
}));

router.patch('/profile', protect, asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name && name.trim()) req.user.name = name.trim();
  if (phone !== undefined) req.user.phone = String(phone).trim();
  await req.user.save();
  res.json({ success: true, data: { user: req.user.toSafeObject() } });
}));

router.patch('/preferences', protect, asyncHandler(async (req, res) => {
  const { inApp, email, statusChange, assignment, slaAlert } = req.body;
  req.user.notificationPreferences = {
    ...req.user.notificationPreferences,
    ...(inApp !== undefined && { inApp }),
    ...(email !== undefined && { email }),
    ...(statusChange !== undefined && { statusChange }),
    ...(assignment !== undefined && { assignment }),
    ...(slaAlert !== undefined && { slaAlert })
  };
  await req.user.save();
  res.json({ success: true, data: { preferences: req.user.notificationPreferences } });
}));

export default router;

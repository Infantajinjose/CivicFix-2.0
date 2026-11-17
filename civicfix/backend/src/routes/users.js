import { Router } from 'express';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { protect, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getOrCreateSubscription } from '../services/billingService.js';

const router = Router();
router.use(protect);

router.get('/', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const users = await User.find({ tenantId: req.tenantId, active: true })
    .select('name email role department phone active createdAt')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: { users } });
}));

router.post('/', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const { name, email, password, role = 'worker', department = '', phone = '' } = req.body;
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and temporary password are required.' });
  }
  if (!['manager', 'worker', 'resident'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid team role.' });
  }
  if (req.user.role === 'manager' && role === 'manager') {
    return res.status(403).json({ success: false, message: 'Only an organisation owner can add another manager.' });
  }

  // Plan limit check for workers
  if (role === 'worker') {
    const sub = await getOrCreateSubscription(req.tenantId);
    const currentWorkers = await User.countDocuments({ tenantId: req.tenantId, role: 'worker', active: true });
    const maxAllowed = sub.limits?.maxWorkers || 5;
    if (currentWorkers >= maxAllowed) {
      return res.status(403).json({
        success: false,
        message: `Your current SaaS plan has reached its worker limit (${maxAllowed} workers). Please upgrade to Professional or Enterprise.`
      });
    }
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Temporary password must have at least 8 characters.' });
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.findOne({ tenantId: req.tenantId, email: normalizedEmail })) {
    return res.status(409).json({ success: false, message: 'This email is already used in your organisation.' });
  }

  const user = await User.create({
    tenantId: req.tenantId,
    name: name.trim(),
    email: normalizedEmail,
    password,
    role,
    department: department.trim(),
    phone: phone.trim()
  });

  res.status(201).json({ success: true, data: { user: user.toSafeObject() } });
}));

// Update team member (e.g. department, role, phone)
router.patch('/:id', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const { department, role, phone, active } = req.body;
  const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!user) return res.status(404).json({ success: false, message: 'Team member not found.' });

  if (department !== undefined) user.department = String(department).trim();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (active !== undefined) user.active = Boolean(active);
  if (role && ['manager', 'worker', 'resident'].includes(role)) {
    if (req.user.role === 'manager' && role === 'manager' && user.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Only owners can promote to manager.' });
    }
    user.role = role;
  }

  await user.save();
  res.json({ success: true, data: { user: user.toSafeObject() } });
}));

// Remove team member
router.delete('/:id', allowRoles('superadmin', 'owner'), asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  if (user._id.toString() === req.user._id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot remove your own account.' });
  }

  user.active = false;
  await user.save();
  res.json({ success: true, message: 'Team member removed from workspace.' });
}));

export default router;

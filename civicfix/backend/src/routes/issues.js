import { Router } from 'express';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import AIAnalysis from '../models/AIAnalysis.js';
import { protect, allowRoles } from '../middleware/auth.js';
import { uploadIssueImages } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { analyzeComplaint, calculateDistanceMeters } from '../services/aiService.js';
import { calculateIssueSla } from '../services/slaScheduler.js';
import { sendNotification, broadcastTenantEvent } from '../services/socketService.js';

const router = Router();
router.use(protect);

const populateIssue = (query) => query
  .populate('createdBy', 'name email role phone')
  .populate('assignedTo', 'name email role department phone')
  .populate('history.changedBy', 'name role')
  .populate('aiAnalysis.potentialDuplicateOf', 'ticketNumber title status createdAt')
  .populate('verification.verifiedBy', 'name role')
  .populate('feedback');

const ticketNumber = () => `CF-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const isManager = (role) => ['superadmin', 'owner', 'manager'].includes(role);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const refId = (value) => value?._id?.toString?.() || value?.toString?.();
const canView = (issue, user) => isManager(user.role) || (user.role === 'worker' ? refId(issue.assignedTo) === user._id.toString() : refId(issue.createdBy) === user._id.toString());

// Real-time AI Assistant for Pre-submission Analysis & Duplicate Checking
router.post('/check-ai', asyncHandler(async (req, res) => {
  const { title, description, category, lat, lng } = req.body;
  const location = (lat && lng) ? { lat: Number(lat), lng: Number(lng) } : null;
  const analysis = await analyzeComplaint({
    title: title || '',
    description: description || '',
    category: category || '',
    location,
    tenantId: req.tenantId
  });

  let duplicateIssue = null;
  if (analysis.potentialDuplicateOf) {
    duplicateIssue = await Issue.findById(analysis.potentialDuplicateOf)
      .select('ticketNumber title category status priority createdAt location');
  }

  res.json({
    success: true,
    data: {
      ...analysis,
      potentialDuplicateIssue: duplicateIssue
    }
  });
}));

// Find Nearby Issues
router.get('/nearby', asyncHandler(async (req, res) => {
  const { lat, lng, radiusMeters = 500 } = req.query;
  if (!lat || !lng) return res.status(400).json({ success: false, message: 'Latitude and longitude are required.' });

  const targetLat = Number(lat);
  const targetLng = Number(lng);
  const maxRadius = Math.min(Number(radiusMeters) || 500, 5000);

  const issues = await Issue.find({
    tenantId: req.tenantId,
    'location.lat': { $ne: null },
    'location.lng': { $ne: null },
    status: { $in: ['submitted', 'assigned', 'in_progress'] }
  }).select('ticketNumber title category priority status location createdAt');

  const nearby = [];
  for (const issue of issues) {
    const dist = calculateDistanceMeters(targetLat, targetLng, issue.location.lat, issue.location.lng);
    if (dist !== null && dist <= maxRadius) {
      nearby.push({
        ...issue.toObject(),
        distanceMeters: dist
      });
    }
  }

  nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
  res.json({ success: true, data: { nearby } });
}));

// List & Search Issues
router.get('/', asyncHandler(async (req, res) => {
  const { status, subStatus, category, priority, department, q, page = 1, limit = 50 } = req.query;
  const filter = { tenantId: req.tenantId };
  const statuses = ['submitted', 'assigned', 'in_progress', 'resolved', 'rejected'];
  const categories = ['Garbage', 'Water', 'Roads', 'Streetlights', 'Drainage', 'Sanitation', 'Electrical', 'Buildings', 'Other'];
  const priorities = ['low', 'medium', 'high', 'urgent'];

  if (status && status !== 'all') {
    if (statuses.includes(status)) filter.status = status;
  }
  if (subStatus && subStatus !== 'all') {
    filter.subStatus = subStatus;
  }
  if (category && category !== 'all') {
    if (categories.includes(category)) filter.category = category;
  }
  if (priority && priority !== 'all') {
    if (priorities.includes(priority)) filter.priority = priority;
  }
  if (department && department !== 'all') {
    filter.department = department;
  }

  if (req.user.role === 'resident') filter.createdBy = req.user._id;
  if (req.user.role === 'worker') filter.assignedTo = req.user._id;

  if (typeof q === 'string' && q.trim()) {
    filter.$or = [
      { title: { $regex: escapeRegex(q.trim().slice(0, 80)), $options: 'i' } },
      { ticketNumber: { $regex: escapeRegex(q.trim().slice(0, 80)), $options: 'i' } },
      { 'location.address': { $regex: escapeRegex(q.trim().slice(0, 80)), $options: 'i' } },
      { department: { $regex: escapeRegex(q.trim().slice(0, 80)), $options: 'i' } }
    ];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const [issues, total] = await Promise.all([
    populateIssue(
      Issue.find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
    ),
    Issue.countDocuments(filter)
  ]);

  res.json({
    success: true,
    data: {
      issues,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    }
  });
}));

// Create Issue with AI Analysis and SLA Deadline computation
router.post('/', uploadIssueImages.array('images', 5), asyncHandler(async (req, res) => {
  const { title, description, category, priority = 'medium', department, address = '', lat, lng, qrLocationId } = req.body;
  if (!title?.trim() || !description?.trim() || !category) {
    return res.status(400).json({ success: false, message: 'Title, description and category are required.' });
  }

  const validCategories = ['Garbage', 'Water', 'Roads', 'Streetlights', 'Drainage', 'Sanitation', 'Electrical', 'Buildings', 'Other'];
  if (!validCategories.includes(category)) return res.status(400).json({ success: false, message: 'Choose a valid issue category.' });

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const chosenPriority = validPriorities.includes(priority) ? priority : 'medium';

  const files = (req.files || []).map(file => ({
    url: `/uploads/${file.filename}`,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size
  }));

  const parsedLat = lat === '' || lat == null ? null : Number(lat);
  const parsedLng = lng === '' || lng == null ? null : Number(lng);
  const locationIsValid = (parsedLat === null && parsedLng === null) ||
    (Number.isFinite(parsedLat) && Number.isFinite(parsedLng) && Math.abs(parsedLat) <= 90 && Math.abs(parsedLng) <= 180);
  if (!locationIsValid) return res.status(400).json({ success: false, message: 'Location coordinates are invalid.' });

  const locationObj = (parsedLat !== null && parsedLng !== null) ? { lat: parsedLat, lng: parsedLng } : null;

  // 1. Run AI Analysis
  const aiResult = await analyzeComplaint({
    title: title.trim(),
    description: description.trim(),
    category,
    location: locationObj,
    tenantId: req.tenantId
  });

  // 2. Calculate SLA Deadline & Warning Threshold
  const slaResult = await calculateIssueSla(req.tenantId, category, chosenPriority);

  const tNumber = ticketNumber();
  const assignedDept = department || aiResult.suggestedDepartment || 'General Services';

  const issue = await Issue.create({
    tenantId: req.tenantId,
    ticketNumber: tNumber,
    title: title.trim(),
    description: description.trim(),
    category,
    priority: chosenPriority,
    department: assignedDept,
    status: 'submitted',
    subStatus: 'submitted',
    location: {
      address: String(address).trim().slice(0, 250),
      lat: parsedLat,
      lng: parsedLng
    },
    qrLocation: qrLocationId || null,
    attachments: files,
    createdBy: req.user._id,
    dueAt: slaResult.deadline,
    sla: {
      deadline: slaResult.deadline,
      warningAt: slaResult.warningAt,
      isEscalated: false,
      escalationLevel: 0,
      warningSent: false
    },
    aiAnalysis: {
      suggestedCategory: aiResult.suggestedCategory,
      suggestedPriority: aiResult.suggestedPriority,
      suggestedDepartment: aiResult.suggestedDepartment,
      summary: aiResult.summary,
      confidence: aiResult.confidence,
      isDuplicate: aiResult.duplicateRisk !== 'none',
      potentialDuplicateOf: aiResult.potentialDuplicateOf,
      similarityScore: aiResult.similarityScore,
      distanceMeters: aiResult.distanceMeters,
      isOverridden: false
    },
    history: [{ status: 'submitted', note: 'Issue reported', changedBy: req.user._id }]
  });

  // Record AI Analysis Audit Log
  await AIAnalysis.create({
    tenantId: req.tenantId,
    issueId: issue._id,
    inputText: `${title}\n${description}`,
    hasImages: files.length > 0,
    provider: aiResult.provider,
    suggestedCategory: aiResult.suggestedCategory,
    suggestedPriority: aiResult.suggestedPriority,
    suggestedDepartment: aiResult.suggestedDepartment,
    summary: aiResult.summary,
    confidence: aiResult.confidence,
    duplicateRisk: aiResult.duplicateRisk,
    potentialDuplicateOf: aiResult.potentialDuplicateOf,
    similarityScore: aiResult.similarityScore,
    distanceMeters: aiResult.distanceMeters
  });

  // Notify Managers of new issue
  const managers = await User.find({ tenantId: req.tenantId, role: { $in: ['owner', 'manager'] }, active: true });
  for (const m of managers) {
    await sendNotification({
      tenantId: req.tenantId,
      recipientId: m._id,
      type: 'ISSUE_CREATED',
      title: `New Issue: ${tNumber}`,
      message: `${req.user.name} reported "${issue.title}" (${issue.category})`,
      issueId: issue._id
    });
  }

  broadcastTenantEvent(req.tenantId, 'issue:created', { issueId: issue._id, ticketNumber: tNumber });

  const populated = await populateIssue(Issue.findOne({ _id: issue._id, tenantId: req.tenantId }));
  res.status(201).json({ success: true, data: { issue: populated } });
}));

// Get Issue by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const issue = await populateIssue(Issue.findOne({ _id: req.params.id, tenantId: req.tenantId }));
  if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });
  if (!canView(issue, req.user)) return res.status(403).json({ success: false, message: 'You cannot view this issue.' });
  res.json({ success: true, data: { issue } });
}));

// Admin Review & Override AI Suggestions
router.patch('/:id/ai-override', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const { category, priority, department } = req.body;
  const issue = await Issue.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

  const changes = [];
  if (category && category !== issue.category) {
    changes.push(`Category: ${issue.category} → ${category}`);
    issue.category = category;
  }
  if (priority && priority !== issue.priority) {
    changes.push(`Priority: ${issue.priority} → ${priority}`);
    issue.priority = priority;
    // Recompute SLA with new priority
    const newSla = await calculateIssueSla(req.tenantId, issue.category, priority);
    issue.dueAt = newSla.deadline;
    issue.sla.deadline = newSla.deadline;
    issue.sla.warningAt = newSla.warningAt;
  }
  if (department && department !== issue.department) {
    changes.push(`Dept: ${issue.department} → ${department}`);
    issue.department = department;
  }

  issue.aiAnalysis.isOverridden = true;
  issue.aiAnalysis.overriddenBy = req.user._id;
  issue.aiAnalysis.overriddenAt = new Date();

  issue.history.push({
    status: issue.status,
    note: `AI Suggestions overridden by ${req.user.name}: ${changes.join(', ')}`,
    changedBy: req.user._id
  });

  await issue.save();
  const populated = await populateIssue(Issue.findOne({ _id: issue._id, tenantId: req.tenantId }));
  res.json({ success: true, data: { issue: populated } });
}));

// Worker Actions (Accept, Reject, Start, Pause, Complete)
router.patch('/:id/worker-action', uploadIssueImages.fields([{ name: 'beforePhotos', maxCount: 3 }, { name: 'afterPhotos', maxCount: 3 }]), asyncHandler(async (req, res) => {
  const { action, reason = '', completionNotes = '' } = req.body;
  const issue = await Issue.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

  if (!isManager(req.user.role) && (req.user.role !== 'worker' || issue.assignedTo?.toString() !== req.user._id.toString())) {
    return res.status(403).json({ success: false, message: 'You are not assigned to this issue.' });
  }

  const now = new Date();

  if (action === 'accept') {
    issue.subStatus = 'accepted';
    issue.workerResponse.acceptedAt = now;
    issue.history.push({ status: issue.status, note: `Worker accepted task.`, changedBy: req.user._id });

    // Notify managers
    const managers = await User.find({ tenantId: req.tenantId, role: { $in: ['owner', 'manager'] }, active: true });
    for (const m of managers) {
      await sendNotification({
        tenantId: req.tenantId,
        recipientId: m._id,
        type: 'WORKER_ACCEPTED',
        title: `Task Accepted: ${issue.ticketNumber}`,
        message: `${req.user.name} accepted task "${issue.title}"`,
        issueId: issue._id
      });
    }
  } else if (action === 'reject') {
    if (!reason.trim()) return res.status(400).json({ success: false, message: 'Please provide a reason for rejecting the task.' });
    issue.status = 'submitted';
    issue.subStatus = 'submitted';
    issue.assignedTo = null;
    issue.workerResponse.rejectionReason = reason.trim();
    issue.history.push({ status: 'submitted', note: `Worker rejected assignment: ${reason.trim()}`, changedBy: req.user._id });

    // Notify managers
    const managers = await User.find({ tenantId: req.tenantId, role: { $in: ['owner', 'manager'] }, active: true });
    for (const m of managers) {
      await sendNotification({
        tenantId: req.tenantId,
        recipientId: m._id,
        type: 'WORKER_REJECTED',
        title: `Task Rejected: ${issue.ticketNumber}`,
        message: `${req.user.name} rejected task "${issue.title}": ${reason.trim()}`,
        issueId: issue._id
      });
    }
  } else if (action === 'start') {
    issue.status = 'in_progress';
    issue.subStatus = 'in_progress';
    issue.workerResponse.startedAt = now;
    issue.history.push({ status: 'in_progress', note: `Work started on site.`, changedBy: req.user._id });
  } else if (action === 'pause') {
    if (!reason.trim()) return res.status(400).json({ success: false, message: 'Please provide a reason for pausing work.' });
    issue.subStatus = 'paused';
    issue.workerResponse.pausedAt = now;
    issue.workerResponse.pauseReason = reason.trim();
    issue.history.push({ status: issue.status, note: `Work paused: ${reason.trim()}`, changedBy: req.user._id });

    const managers = await User.find({ tenantId: req.tenantId, role: { $in: ['owner', 'manager'] }, active: true });
    for (const m of managers) {
      await sendNotification({
        tenantId: req.tenantId,
        recipientId: m._id,
        type: 'WORKER_PAUSED',
        title: `Work Paused: ${issue.ticketNumber}`,
        message: `${req.user.name} paused work on "${issue.title}": ${reason.trim()}`,
        issueId: issue._id
      });
    }
  } else if (action === 'complete') {
    if (!completionNotes.trim()) return res.status(400).json({ success: false, message: 'Please provide completion work notes.' });
    issue.subStatus = 'completed';
    issue.workerResponse.completedAt = now;
    issue.workerResponse.completionNotes = completionNotes.trim();

    // Map uploaded before & after photos
    const beforeFiles = (req.files?.beforePhotos || []).map(f => ({
      url: `/uploads/${f.filename}`,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size
    }));
    const afterFiles = (req.files?.afterPhotos || []).map(f => ({
      url: `/uploads/${f.filename}`,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size
    }));

    if (beforeFiles.length) issue.beforeAfterPhotos.before.push(...beforeFiles);
    if (afterFiles.length) {
      issue.beforeAfterPhotos.after.push(...afterFiles);
      issue.resolutionAttachments.push(...afterFiles);
    }

    issue.history.push({
      status: 'in_progress',
      note: `Worker marked work completed: ${completionNotes.trim()}. Awaiting manager verification.`,
      changedBy: req.user._id
    });

    // Notify managers for verification
    const managers = await User.find({ tenantId: req.tenantId, role: { $in: ['owner', 'manager'] }, active: true });
    for (const m of managers) {
      await sendNotification({
        tenantId: req.tenantId,
        recipientId: m._id,
        type: 'WORKER_COMPLETED',
        title: `Work Completed: ${issue.ticketNumber}`,
        message: `${req.user.name} marked "${issue.title}" completed. Verification requested.`,
        issueId: issue._id
      });
    }
  } else {
    return res.status(400).json({ success: false, message: 'Invalid worker action.' });
  }

  await issue.save();
  const populated = await populateIssue(Issue.findOne({ _id: issue._id, tenantId: req.tenantId }));
  res.json({ success: true, data: { issue: populated } });
}));

// Manager Verification & Reopen Workflow
router.patch('/:id/verify', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const { decision, notes = '' } = req.body; // 'verify' or 'reopen'
  const issue = await Issue.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

  const now = new Date();

  if (decision === 'verify') {
    issue.status = 'resolved';
    issue.subStatus = 'verified';
    issue.resolutionNote = notes.trim() || issue.workerResponse.completionNotes || 'Verified and approved by manager.';
    issue.verification = {
      verifiedBy: req.user._id,
      verifiedAt: now,
      notes: notes.trim()
    };

    // Calculate actual resolution hours and SLA compliance
    const durationMs = now - issue.createdAt;
    const hours = Math.round(durationMs / (1000 * 60 * 60));
    issue.sla.actualResolutionHours = hours;
    issue.sla.resolvedWithinSla = issue.dueAt ? now <= issue.dueAt : true;

    issue.history.push({
      status: 'resolved',
      note: `Verified and marked resolved by manager ${req.user.name}. ${notes.trim()}`,
      changedBy: req.user._id
    });

    // Notify reporter and worker
    await sendNotification({
      tenantId: req.tenantId,
      recipientId: issue.createdBy,
      type: 'ISSUE_VERIFIED',
      title: `Issue Resolved: ${issue.ticketNumber}`,
      message: `Your reported issue "${issue.title}" has been verified and resolved. Please rate the service!`,
      issueId: issue._id
    });

    if (issue.assignedTo) {
      await sendNotification({
        tenantId: req.tenantId,
        recipientId: issue.assignedTo,
        type: 'ISSUE_VERIFIED',
        title: `Work Verified: ${issue.ticketNumber}`,
        message: `Manager ${req.user.name} approved and verified your resolution for "${issue.title}".`,
        issueId: issue._id
      });
    }
  } else if (decision === 'reopen') {
    if (!notes.trim()) return res.status(400).json({ success: false, message: 'Please provide notes explaining why the issue is reopened.' });
    issue.status = 'in_progress';
    issue.subStatus = 'reopened';
    issue.history.push({
      status: 'in_progress',
      note: `Manager reopened issue: ${notes.trim()}`,
      changedBy: req.user._id
    });

    // Notify assigned worker
    if (issue.assignedTo) {
      await sendNotification({
        tenantId: req.tenantId,
        recipientId: issue.assignedTo,
        type: 'ISSUE_REOPENED',
        title: `Issue Reopened: ${issue.ticketNumber}`,
        message: `Task "${issue.title}" was reopened by ${req.user.name}: ${notes.trim()}`,
        issueId: issue._id
      });
    }
  } else {
    return res.status(400).json({ success: false, message: 'Invalid verification decision.' });
  }

  await issue.save();
  const populated = await populateIssue(Issue.findOne({ _id: issue._id, tenantId: req.tenantId }));
  res.json({ success: true, data: { issue: populated } });
}));

// Assign Worker
router.patch('/:id/assign', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const { workerId } = req.body;
  const issue = await Issue.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

  const worker = workerId ? await User.findOne({ _id: workerId, tenantId: req.tenantId, role: 'worker', active: true }) : null;
  if (workerId && !worker) return res.status(400).json({ success: false, message: 'Select an active worker from your organisation.' });

  issue.assignedTo = worker?._id || null;
  if (worker) {
    if (issue.status === 'submitted') {
      issue.status = 'assigned';
      issue.subStatus = 'assigned';
    }
    issue.history.push({ status: issue.status, note: `Assigned to ${worker.name}`, changedBy: req.user._id });

    // Send notification to worker
    await sendNotification({
      tenantId: req.tenantId,
      recipientId: worker._id,
      type: 'ISSUE_ASSIGNED',
      title: `New Task Assigned: ${issue.ticketNumber}`,
      message: `You have been assigned to "${issue.title}" (${issue.priority} priority).`,
      issueId: issue._id
    });
  } else {
    if (issue.status === 'assigned') {
      issue.status = 'submitted';
      issue.subStatus = 'submitted';
    }
    issue.history.push({ status: issue.status, note: 'Assignment removed', changedBy: req.user._id });
  }

  await issue.save();
  broadcastTenantEvent(req.tenantId, 'issue:assigned', { issueId: issue._id, workerId: worker?._id });

  const populated = await populateIssue(Issue.findOne({ _id: issue._id, tenantId: req.tenantId }));
  res.json({ success: true, data: { issue: populated } });
}));

// Update Status (Standard)
router.patch('/:id/status', uploadIssueImages.array('images', 5), asyncHandler(async (req, res) => {
  const { status, note = '' } = req.body;
  const allowed = ['assigned', 'in_progress', 'resolved', 'rejected'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Choose a valid next status.' });

  const issue = await Issue.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

  if (!isManager(req.user.role) && (req.user.role !== 'worker' || issue.assignedTo?.toString() !== req.user._id.toString())) {
    return res.status(403).json({ success: false, message: 'Only the assigned worker or a manager can update this issue.' });
  }

  if (status === 'resolved' && !isManager(req.user.role) && !note.trim()) {
    return res.status(400).json({ success: false, message: 'Add a short resolution note before marking this issue resolved.' });
  }

  issue.status = status;
  if (status === 'resolved') {
    issue.subStatus = 'completed';
    issue.resolutionNote = String(note).trim().slice(0, 1000);
    const now = new Date();
    issue.sla.actualResolutionHours = Math.round((now - issue.createdAt) / (1000 * 60 * 60));
    issue.sla.resolvedWithinSla = issue.dueAt ? now <= issue.dueAt : true;
  } else if (status === 'in_progress') {
    issue.subStatus = 'in_progress';
  } else if (status === 'rejected') {
    issue.subStatus = 'rejected';
  }

  const files = (req.files || []).map(file => ({
    url: `/uploads/${file.filename}`,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size
  }));
  if (files.length) issue.resolutionAttachments.push(...files);

  issue.history.push({
    status,
    note: String(note).trim().slice(0, 500) || `Status changed to ${status.replace('_', ' ')}`,
    changedBy: req.user._id
  });

  await issue.save();

  // Notify reporter
  await sendNotification({
    tenantId: req.tenantId,
    recipientId: issue.createdBy,
    type: 'STATUS_CHANGED',
    title: `Issue Status Updated: ${issue.ticketNumber}`,
    message: `Status of "${issue.title}" is now ${status.replace('_', ' ')}.`,
    issueId: issue._id
  });

  broadcastTenantEvent(req.tenantId, 'issue:status_changed', { issueId: issue._id, status });

  const populated = await populateIssue(Issue.findOne({ _id: issue._id, tenantId: req.tenantId }));
  res.json({ success: true, data: { issue: populated } });
}));

export default router;

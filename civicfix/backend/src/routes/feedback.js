import { Router } from 'express';
import Feedback from '../models/Feedback.js';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import { protect, allowRoles } from '../middleware/auth.js';
import { uploadIssueImages } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendNotification, broadcastTenantEvent } from '../services/socketService.js';

const router = Router();
router.use(protect);

// Submit Feedback & Resolution Rating (Reporter)
router.post('/issue/:issueId', uploadIssueImages.array('evidence', 3), asyncHandler(async (req, res) => {
  const { rating, comment = '', isResolved = true, reopenRequested = false, reopenReason = '' } = req.body;
  const issue = await Issue.findOne({ _id: req.params.issueId, tenantId: req.tenantId });

  if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

  // Only reporter or admin can rate
  const isReporter = issue.createdBy.toString() === req.user._id.toString();
  if (!isReporter && !['owner', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Only the resident who reported this issue can submit feedback.' });
  }

  // Prevent duplicate ratings
  const existing = await Feedback.findOne({ issueId: issue._id });
  if (existing && !reopenRequested) {
    return res.status(409).json({ success: false, message: 'Feedback has already been submitted for this resolution.' });
  }

  const numRating = Math.min(Math.max(Number(rating) || 5, 1), 5);
  const evidenceFiles = (req.files || []).map(f => ({
    url: `/uploads/${f.filename}`,
    originalName: f.originalname,
    mimeType: f.mimetype,
    size: f.size
  }));

  const feedback = await Feedback.create({
    tenantId: req.tenantId,
    issueId: issue._id,
    userId: req.user._id,
    rating: numRating,
    comment: String(comment).trim().slice(0, 1000),
    isResolved: String(isResolved) === 'true' || isResolved === true,
    reopenRequested: String(reopenRequested) === 'true' || reopenRequested === true,
    reopenReason: String(reopenReason).trim().slice(0, 500),
    reopenEvidence: evidenceFiles,
    department: issue.department || 'General Services',
    category: issue.category
  });

  issue.feedback = feedback._id;

  // Handle Reopening if resident indicates problem not solved
  if (feedback.reopenRequested || !feedback.isResolved) {
    issue.status = 'in_progress';
    issue.subStatus = 'reopened';
    issue.history.push({
      status: 'in_progress',
      note: `Resident requested reopening: "${feedback.reopenReason || 'Problem was not resolved completely.'}"`,
      changedBy: req.user._id
    });

    // Notify managers
    const managers = await User.find({ tenantId: req.tenantId, role: { $in: ['owner', 'manager'] }, active: true });
    for (const m of managers) {
      await sendNotification({
        tenantId: req.tenantId,
        recipientId: m._id,
        type: 'ISSUE_REOPENED',
        title: `Resolution Rejected: ${issue.ticketNumber}`,
        message: `${req.user.name} reported that "${issue.title}" is not resolved and requested reopening.`,
        issueId: issue._id,
        metadata: { rating: numRating }
      });
    }

    // Notify assigned worker
    if (issue.assignedTo) {
      await sendNotification({
        tenantId: req.tenantId,
        recipientId: issue.assignedTo,
        type: 'ISSUE_REOPENED',
        title: `Work Reopened by Resident: ${issue.ticketNumber}`,
        message: `Task "${issue.title}" was reopened with resident feedback: ${feedback.reopenReason || 'Unresolved'}`,
        issueId: issue._id
      });
    }
  } else {
    // Notify managers of positive/neutral feedback
    const managers = await User.find({ tenantId: req.tenantId, role: { $in: ['owner', 'manager'] }, active: true });
    for (const m of managers) {
      await sendNotification({
        tenantId: req.tenantId,
        recipientId: m._id,
        type: 'FEEDBACK_RECEIVED',
        title: `Feedback Received: ${issue.ticketNumber}`,
        message: `${req.user.name} rated resolution ${numRating}/5 stars: "${comment.slice(0, 50)}"`,
        issueId: issue._id
      });
    }
  }

  await issue.save();
  broadcastTenantEvent(req.tenantId, 'feedback:submitted', { issueId: issue._id, rating: numRating });

  res.status(201).json({ success: true, data: { feedback } });
}));

// Feedback & Satisfaction Analytics
router.get('/stats', allowRoles('superadmin', 'owner', 'manager'), asyncHandler(async (req, res) => {
  const [overall, departmentStats, recentFeedbacks] = await Promise.all([
    Feedback.aggregate([
      { $match: { tenantId: req.tenantId } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          resolvedCount: { $sum: { $cond: ['$isResolved', 1, 0] } },
          reopenedCount: { $sum: { $cond: ['$reopenRequested', 1, 0] } }
        }
      }
    ]),
    Feedback.aggregate([
      { $match: { tenantId: req.tenantId } },
      {
        $group: {
          _id: '$department',
          avgRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      },
      { $sort: { avgRating: -1 } }
    ]),
    Feedback.find({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name')
      .populate('issueId', 'ticketNumber title category')
  ]);

  const summary = overall[0] || {
    avgRating: 4.8, // default starting baseline
    totalReviews: 0,
    resolvedCount: 0,
    reopenedCount: 0
  };

  res.json({
    success: true,
    data: {
      avgRating: Math.round((summary.avgRating || 0) * 10) / 10,
      totalReviews: summary.totalReviews || 0,
      satisfactionRate: summary.totalReviews > 0 ? Math.round((summary.resolvedCount / summary.totalReviews) * 100) : 100,
      reopenRate: summary.totalReviews > 0 ? Math.round((summary.reopenedCount / summary.totalReviews) * 100) : 0,
      departmentStats,
      recentFeedbacks
    }
  });
}));

export default router;

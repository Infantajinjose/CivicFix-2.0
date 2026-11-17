import cron from 'node-cron';
import Issue from '../models/Issue.js';
import SLAConfiguration from '../models/SLAConfiguration.js';
import Escalation from '../models/Escalation.js';
import User from '../models/User.js';
import { sendNotification, broadcastTenantEvent } from './socketService.js';

const DEFAULT_SLA_HOURS = {
  urgent: { resolutionHours: 4, warningHours: 1 },
  high: { resolutionHours: 24, warningHours: 4 },
  medium: { resolutionHours: 72, warningHours: 12 },
  low: { resolutionHours: 168, warningHours: 24 }
};

/**
 * Calculates dueAt and warningAt for a given issue based on SLA rules
 */
export async function calculateIssueSla(tenantId, category, priority) {
  let resolutionHours = DEFAULT_SLA_HOURS[priority]?.resolutionHours || 72;
  let warningHours = DEFAULT_SLA_HOURS[priority]?.warningHours || 12;

  try {
    const config = await SLAConfiguration.findOne({ tenantId });
    if (config?.rules?.length) {
      // Find matching rule
      const rule = config.rules.find(r => (r.category === category || r.category === 'All') && r.priority === priority);
      if (rule) {
        resolutionHours = rule.resolutionHours;
        warningHours = rule.warningHours || Math.round(rule.resolutionHours * 0.2);
      }
    }
  } catch (error) {
    console.error('Error fetching SLA config, using defaults:', error);
  }

  const now = Date.now();
  const deadline = new Date(now + resolutionHours * 60 * 60 * 1000);
  const warningAt = new Date(deadline.getTime() - warningHours * 60 * 60 * 1000);

  return {
    deadline,
    warningAt,
    resolutionHours,
    warningHours
  };
}

/**
 * Run SLA check and automatic escalation check across all tenants
 */
export async function checkSlaAndEscalations() {
  try {
    const now = new Date();

    // 1. Check for issues that are OVERDUE and not yet escalated
    const overdueIssues = await Issue.find({
      status: { $in: ['submitted', 'assigned', 'in_progress'] },
      dueAt: { $lt: now },
      'sla.isEscalated': false
    }).populate('assignedTo', 'name email role').populate('createdBy', 'name');

    for (const issue of overdueIssues) {
      const overdueMs = now - issue.dueAt;
      const overdueHours = Math.round(overdueMs / (1000 * 60 * 60));

      // Find managers of the tenant
      const managers = await User.find({
        tenantId: issue.tenantId,
        role: { $in: ['owner', 'manager'] },
        active: true
      });

      // Create Escalation record
      const escalation = await Escalation.create({
        tenantId: issue.tenantId,
        issueId: issue._id,
        level: 1,
        reason: `Exceeded SLA deadline by ${overdueHours} hours without resolution.`,
        overdueHours,
        assignedWorker: issue.assignedTo?._id || null,
        notifiedManagers: managers.map(m => m._id),
        status: 'open'
      });

      // Update issue SLA status
      issue.sla.isEscalated = true;
      issue.sla.escalatedAt = now;
      issue.sla.escalationLevel = 1;
      issue.history.push({
        status: issue.status,
        note: `⚠️ SLA Breached: Automatically escalated to management. Overdue by ${overdueHours}h.`,
        changedBy: managers[0]?._id || issue.createdBy?._id || issue.tenantId
      });
      await issue.save();

      // Notify managers
      for (const manager of managers) {
        await sendNotification({
          tenantId: issue.tenantId,
          recipientId: manager._id,
          type: 'SLA_OVERDUE',
          title: `Overdue SLA Escalation: ${issue.ticketNumber}`,
          message: `Issue "${issue.title}" is ${overdueHours}h overdue. SLA breached.`,
          issueId: issue._id,
          metadata: { escalationId: escalation._id }
        });
      }

      // Notify assigned worker if present
      if (issue.assignedTo?._id) {
        await sendNotification({
          tenantId: issue.tenantId,
          recipientId: issue.assignedTo._id,
          type: 'SLA_OVERDUE',
          title: `Task Overdue: ${issue.ticketNumber}`,
          message: `Your assigned task "${issue.title}" is overdue and escalated to managers.`,
          issueId: issue._id
        });
      }

      broadcastTenantEvent(issue.tenantId, 'sla:escalated', {
        issueId: issue._id,
        ticketNumber: issue.ticketNumber,
        escalationId: escalation._id
      });
    }

    // 2. Check for SLA Warnings (Approaching Deadline)
    const warningIssues = await Issue.find({
      status: { $in: ['submitted', 'assigned', 'in_progress'] },
      dueAt: { $gt: now },
      'sla.warningAt': { $lt: now },
      'sla.warningSent': { $ne: true }
    }).populate('assignedTo', 'name email');

    for (const issue of warningIssues) {
      issue.sla.warningSent = true;
      await issue.save();

      const hoursLeft = Math.max(1, Math.round((issue.dueAt - now) / (1000 * 60 * 60)));

      if (issue.assignedTo?._id) {
        await sendNotification({
          tenantId: issue.tenantId,
          recipientId: issue.assignedTo._id,
          type: 'SLA_WARNING',
          title: `SLA Deadline Approaching: ${issue.ticketNumber}`,
          message: `Task "${issue.title}" has ~${hoursLeft} hours left before SLA breach.`,
          issueId: issue._id
        });
      }
    }
  } catch (error) {
    console.error('Error during SLA escalation check:', error);
  }
}

/**
 * Initialize background scheduler (runs every 60 seconds)
 */
export function initSlaScheduler() {
  cron.schedule('*/1 * * * *', () => {
    checkSlaAndEscalations();
  });
  console.log('SLA & Escalation background scheduler initialized (1m interval).');
}

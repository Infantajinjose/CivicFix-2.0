import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: [
      'ISSUE_CREATED',
      'ISSUE_ASSIGNED',
      'STATUS_CHANGED',
      'WORKER_ACCEPTED',
      'WORKER_REJECTED',
      'WORKER_PAUSED',
      'WORKER_COMPLETED',
      'ISSUE_VERIFIED',
      'ISSUE_REOPENED',
      'SLA_WARNING',
      'SLA_OVERDUE',
      'FEEDBACK_RECEIVED',
      'SYSTEM'
    ],
    required: true,
    index: true
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
  read: { type: Boolean, default: false, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);

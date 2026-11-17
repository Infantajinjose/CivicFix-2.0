import mongoose from 'mongoose';

const escalationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true, index: true },
  level: { type: Number, default: 1 },
  reason: { type: String, required: true },
  overdueHours: { type: Number, default: 0 },
  assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notifiedManagers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open', index: true },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgedAt: { type: Date, default: null },
  notes: { type: String, default: '' }
}, { timestamps: true });

escalationSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export default mongoose.model('Escalation', escalationSchema);

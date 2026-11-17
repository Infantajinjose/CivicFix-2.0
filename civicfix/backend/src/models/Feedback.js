import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 1000, default: '' },
  isResolved: { type: Boolean, required: true },
  reopenRequested: { type: Boolean, default: false },
  reopenReason: { type: String, trim: true, maxlength: 500, default: '' },
  reopenEvidence: [{ url: String, originalName: String, mimeType: String, size: Number }],
  department: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: '' }
}, { timestamps: true });

feedbackSchema.index({ tenantId: 1, rating: 1 });
feedbackSchema.index({ tenantId: 1, department: 1 });

export default mongoose.model('Feedback', feedbackSchema);

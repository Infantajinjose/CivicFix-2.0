import mongoose from 'mongoose';

const aiAnalysisSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true, index: true },
  inputText: { type: String, required: true },
  hasImages: { type: Boolean, default: false },
  provider: { type: String, enum: ['gemini', 'rules-engine'], default: 'rules-engine' },
  suggestedCategory: { type: String, required: true },
  suggestedPriority: { type: String, required: true },
  suggestedDepartment: { type: String, required: true },
  summary: { type: String, default: '' },
  confidence: { type: Number, default: 0.8 },
  duplicateRisk: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' },
  potentialDuplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
  similarityScore: { type: Number, default: 0 },
  distanceMeters: { type: Number, default: null },
  overridden: { type: Boolean, default: false },
  overriddenDetails: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

aiAnalysisSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model('AIAnalysis', aiAnalysisSchema);

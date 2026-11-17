import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  status: { type: String, required: true },
  note: { type: String, default: '' },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const issueSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  ticketNumber: { type: String, required: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  category: {
    type: String,
    enum: ['Garbage', 'Water', 'Roads', 'Streetlights', 'Drainage', 'Sanitation', 'Electrical', 'Buildings', 'Other'],
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    enum: ['submitted', 'assigned', 'in_progress', 'resolved', 'rejected'],
    default: 'submitted',
    index: true
  },
  subStatus: {
    type: String,
    enum: ['submitted', 'assigned', 'accepted', 'in_progress', 'paused', 'completed', 'verified', 'rejected', 'reopened'],
    default: 'submitted',
    index: true
  },
  department: { type: String, trim: true, default: 'General Services', index: true },
  location: {
    address: { type: String, trim: true, default: '' },
    lat: { type: Number, min: -90, max: 90, default: null },
    lng: { type: Number, min: -180, max: 180, default: null }
  },
  qrLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QRLocation',
    default: null
  },
  attachments: [{ url: String, originalName: String, mimeType: String, size: Number }],
  resolutionAttachments: [{ url: String, originalName: String, mimeType: String, size: Number }],
  beforeAfterPhotos: {
    before: [{ url: String, originalName: String, mimeType: String, size: Number }],
    after: [{ url: String, originalName: String, mimeType: String, size: Number }]
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  dueAt: { type: Date, default: null, index: true },
  resolutionNote: { type: String, default: '' },
  
  // AI-Powered Analysis
  aiAnalysis: {
    suggestedCategory: { type: String, default: '' },
    suggestedPriority: { type: String, default: '' },
    suggestedDepartment: { type: String, default: '' },
    summary: { type: String, default: '' },
    confidence: { type: Number, default: 0 },
    isDuplicate: { type: Boolean, default: false },
    potentialDuplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', default: null },
    similarityScore: { type: Number, default: 0 },
    distanceMeters: { type: Number, default: null },
    isOverridden: { type: Boolean, default: false },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    overriddenAt: { type: Date, default: null }
  },

  // SLA & Escalation Tracking
  sla: {
    deadline: { type: Date, default: null },
    warningAt: { type: Date, default: null },
    isEscalated: { type: Boolean, default: false, index: true },
    escalatedAt: { type: Date, default: null },
    escalationLevel: { type: Number, default: 0 },
    warningSent: { type: Boolean, default: false },
    resolvedWithinSla: { type: Boolean, default: null },
    actualResolutionHours: { type: Number, default: null }
  },

  // Worker Execution Lifecycle
  workerResponse: {
    acceptedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    pauseReason: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    completionNotes: { type: String, default: '' }
  },

  // Manager Verification
  verification: {
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    notes: { type: String, default: '' }
  },

  // Resident Feedback reference
  feedback: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feedback',
    default: null
  },

  history: { type: [historySchema], default: [] }
}, { timestamps: true });

issueSchema.index({ tenantId: 1, createdAt: -1 });
issueSchema.index({ tenantId: 1, ticketNumber: 1 }, { unique: true });
issueSchema.index({ tenantId: 1, status: 1, priority: 1 });
issueSchema.index({ tenantId: 1, 'location.lat': 1, 'location.lng': 1 });
issueSchema.index({ title: 'text', description: 'text', ticketNumber: 'text' });

export default mongoose.model('Issue', issueSchema);

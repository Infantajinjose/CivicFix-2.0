import mongoose from 'mongoose';

const slaRuleSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['All', 'Garbage', 'Water', 'Roads', 'Streetlights', 'Drainage', 'Sanitation', 'Electrical', 'Buildings', 'Other'],
    default: 'All'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    required: true
  },
  resolutionHours: { type: Number, required: true },
  warningHours: { type: Number, default: 2 }
}, { _id: false });

const slaConfigurationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
  rules: {
    type: [slaRuleSchema],
    default: [
      { category: 'All', priority: 'urgent', resolutionHours: 4, warningHours: 1 },
      { category: 'All', priority: 'high', resolutionHours: 24, warningHours: 4 },
      { category: 'All', priority: 'medium', resolutionHours: 72, warningHours: 12 },
      { category: 'All', priority: 'low', resolutionHours: 168, warningHours: 24 }
    ]
  },
  autoEscalate: { type: Boolean, default: true },
  escalationRole: { type: String, enum: ['owner', 'manager'], default: 'manager' }
}, { timestamps: true });

export default mongoose.model('SLAConfiguration', slaConfigurationSchema);

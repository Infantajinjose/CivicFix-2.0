import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true },
  plan: { type: String, enum: ['starter', 'professional', 'enterprise'], default: 'starter' },
  status: { type: String, enum: ['active', 'suspended', 'trial'], default: 'active' },
  departments: {
    type: [String],
    default: ['Sanitation', 'Water & Sewage', 'Roads & Infrastructure', 'Streetlights', 'Drainage', 'Electrical', 'Civil Maintenance', 'General Services']
  },
  publicDashboard: {
    enabled: { type: Boolean, default: true },
    title: { type: String, default: 'Community Transparency Portal' },
    description: { type: String, default: 'Live public resolution metrics and community service records.' },
    showRecentResolved: { type: Boolean, default: true },
    showMap: { type: Boolean, default: true }
  },
  slaSettings: [{
    category: { type: String, required: true },
    priority: { type: String, required: true },
    resolutionHours: { type: Number, required: true },
    warningHours: { type: Number, default: 2 }
  }],
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  contactEmail: { type: String, trim: true, lowercase: true },
  contactPhone: { type: String, trim: true }
}, { timestamps: true });

// tenantSchema.index({ slug: 1 }); already indexed via unique: true
tenantSchema.index({ status: 1 });

export default mongoose.model('Tenant', tenantSchema);

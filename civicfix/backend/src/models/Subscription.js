import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
  plan: {
    type: String,
    enum: ['starter', 'professional', 'enterprise'],
    default: 'starter',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'trial', 'past_due', 'cancelled'],
    default: 'trial',
    index: true
  },
  trialEndsAt: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  },
  currentPeriodStart: { type: Date, default: Date.now },
  currentPeriodEnd: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  },
  limits: {
    maxWorkers: { type: Number, default: 5 },
    maxDepartments: { type: Number, default: 3 },
    aiAnalysis: { type: Boolean, default: false },
    slaManagement: { type: Boolean, default: false },
    qrReporting: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    publicDashboard: { type: Boolean, default: false }
  },
  razorpaySubscriptionId: { type: String, default: '' },
  razorpayCustomerId: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('Subscription', subscriptionSchema);

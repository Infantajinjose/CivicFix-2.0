import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  orderId: { type: String, required: true },
  paymentId: { type: String, default: '' },
  signature: { type: String, default: '' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['created', 'captured', 'failed', 'refunded'],
    default: 'created',
    index: true
  },
  plan: { type: String, required: true },
  receipt: { type: String, required: true },
  invoiceNumber: { type: String, required: true },
  invoiceDate: { type: Date, default: Date.now },
  customerName: { type: String, default: '' },
  customerEmail: { type: String, default: '' }
}, { timestamps: true });

paymentSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model('Payment', paymentSchema);

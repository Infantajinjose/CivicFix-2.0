import mongoose from 'mongoose';

const qrLocationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  label: { type: String, required: true, trim: true, maxlength: 150 },
  department: { type: String, trim: true, default: 'General Services' },
  category: {
    type: String,
    enum: ['Garbage', 'Water', 'Roads', 'Streetlights', 'Drainage', 'Sanitation', 'Electrical', 'Buildings', 'Other'],
    default: 'Other'
  },
  address: { type: String, trim: true, default: '' },
  lat: { type: Number, min: -90, max: 90, default: null },
  lng: { type: Number, min: -180, max: 180, default: null },
  active: { type: Boolean, default: true, index: true },
  scanCount: { type: Number, default: 0 },
  qrCodeDataUrl: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

qrLocationSchema.index({ tenantId: 1, code: 1 });
qrLocationSchema.index({ tenantId: 1, active: 1 });

export default mongoose.model('QRLocation', qrLocationSchema);

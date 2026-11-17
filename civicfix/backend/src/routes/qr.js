import { Router } from 'express';
import QRLocation from '../models/QRLocation.js';
import Tenant from '../models/Tenant.js';
import { protect, allowRoles } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createQrLocationSpot, generateQrCodeString } from '../services/qrService.js';
import QRCode from 'qrcode';

const router = Router();

// Public: Scan and Validate QR Code (Accessible without login)
router.get('/scan/:code', asyncHandler(async (req, res) => {
  const { code } = req.params;
  const spot = await QRLocation.findOne({ code: code.toUpperCase() })
    .populate('tenantId', 'name slug status');

  if (!spot || !spot.active) {
    return res.status(404).json({
      success: false,
      message: 'This QR code is invalid, inactive or has been decommissioned.'
    });
  }

  // Increment scan count
  spot.scanCount = (spot.scanCount || 0) + 1;
  await spot.save();

  res.json({
    success: true,
    data: {
      qrLocationId: spot._id,
      code: spot.code,
      label: spot.label,
      department: spot.department,
      category: spot.category,
      address: spot.address,
      lat: spot.lat,
      lng: spot.lng,
      organisation: {
        id: spot.tenantId._id,
        name: spot.tenantId.name,
        slug: spot.tenantId.slug
      }
    }
  });
}));

// The remaining endpoints require authentication
router.use(protect);
router.use(allowRoles('superadmin', 'owner', 'manager'));

// List all QR spots for tenant
router.get('/', asyncHandler(async (req, res) => {
  const spots = await QRLocation.find({ tenantId: req.tenantId })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name');

  res.json({ success: true, data: { spots } });
}));

// Create a new QR Spot
router.post('/', asyncHandler(async (req, res) => {
  const { label, department, category, address, lat, lng } = req.body;
  if (!label?.trim()) {
    return res.status(400).json({ success: false, message: 'Facility or location label is required.' });
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const spot = await createQrLocationSpot({
    tenantId: req.tenantId,
    label,
    department: department || 'General Services',
    category: category || 'Other',
    address: address || '',
    lat: lat ? Number(lat) : null,
    lng: lng ? Number(lng) : null,
    userId: req.user._id,
    frontendUrl
  });

  res.status(201).json({ success: true, data: { spot } });
}));

// Toggle Active/Inactive
router.patch('/:id/toggle', asyncHandler(async (req, res) => {
  const spot = await QRLocation.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!spot) return res.status(404).json({ success: false, message: 'QR location spot not found.' });

  spot.active = !spot.active;
  await spot.save();

  res.json({ success: true, data: { spot } });
}));

// Regenerate QR Code
router.post('/:id/regenerate', asyncHandler(async (req, res) => {
  const spot = await QRLocation.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!spot) return res.status(404).json({ success: false, message: 'QR location spot not found.' });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  spot.code = generateQrCodeString();
  const scanUrl = `${frontendUrl}/report/qr/${spot.code}`;

  spot.qrCodeDataUrl = await QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    color: { dark: '#0f172a', light: '#ffffff' },
    width: 320
  });

  await spot.save();
  res.json({ success: true, data: { spot } });
}));

// Delete QR Location
router.delete('/:id', asyncHandler(async (req, res) => {
  await QRLocation.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
  res.json({ success: true, message: 'QR location spot removed successfully.' });
}));

export default router;

import QRCode from 'qrcode';
import crypto from 'crypto';
import QRLocation from '../models/QRLocation.js';

export function generateQrCodeString() {
  return `QR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function createQrLocationSpot({
  tenantId,
  label,
  department = 'General Services',
  category = 'Other',
  address = '',
  lat = null,
  lng = null,
  userId,
  frontendUrl = 'http://localhost:5173'
}) {
  const code = generateQrCodeString();
  const scanUrl = `${frontendUrl}/report/qr/${code}`;

  const qrCodeDataUrl = await QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    },
    width: 320
  });

  const locationSpot = await QRLocation.create({
    tenantId,
    code,
    label: label.trim(),
    department,
    category,
    address: address.trim(),
    lat,
    lng,
    active: true,
    qrCodeDataUrl,
    createdBy: userId
  });

  return locationSpot;
}

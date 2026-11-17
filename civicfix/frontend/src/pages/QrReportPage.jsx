import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  QrCode,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Building2,
  Camera,
  Plus
} from 'lucide-react';
import { api, getApiError } from '../lib/api.js';

export default function QrReportPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const scanQr = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: res } = await api.get(`/qr/scan/${code}`);
        setData(res.data);
      } catch (err) {
        setError(getApiError(err, 'This QR code is invalid or deactivated.'));
      } finally {
        setLoading(false);
      }
    };
    scanQr();
  }, [code]);

  if (loading) {
    return (
      <div className="qr-landing-page">
        <div className="screen-loader">
          <span className="loader" /> Scanning facility QR location…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="qr-landing-page">
        <div className="qr-error-card panel">
          <AlertTriangle size={36} className="text-red" />
          <h2>Invalid or Inactive QR Code</h2>
          <p>{error || 'This QR placard is no longer active in CivicFix.'}</p>
          <button className="primary-button mt-4" onClick={() => navigate('/issues/new')}>
            Report Issue Manually
          </button>
        </div>
      </div>
    );
  }

  const handleContinueToReport = () => {
    const params = new URLSearchParams({
      address: `${data.label}${data.address ? ` (${data.address})` : ''}`,
      department: data.department || '',
      category: data.category || 'Other',
      qrId: data.qrLocationId || ''
    });
    if (data.lat && data.lng) {
      params.append('lat', data.lat);
      params.append('lng', data.lng);
    }
    navigate(`/issues/new?${params.toString()}`);
  };

  return (
    <div className="qr-landing-page">
      <div className="qr-landing-card panel">
        <div className="qr-brand-row">
          <span className="qr-verified-badge">
            <CheckCircle2 size={15} /> Verified Location QR
          </span>
          <span className="qr-org-tag">{data.organisation?.name}</span>
        </div>

        <div className="qr-location-header">
          <div className="qr-pin-circle">
            <MapPin size={28} />
          </div>
          <h2>{data.label}</h2>
          {data.address && <p className="qr-address">{data.address}</p>}
        </div>

        <div className="qr-prefill-info">
          <p>
            You are reporting an issue at this specific location. The department and location coordinates will be pre-filled automatically:
          </p>
          <div className="prefill-chips">
            <span>Department: <strong>{data.department}</strong></span>
            <span>Category: <strong>{data.category}</strong></span>
          </div>
        </div>

        <div className="qr-landing-actions">
          <button className="primary-button full-width lg" onClick={handleContinueToReport}>
            Continue to Complaint Form <ArrowRight size={18} />
          </button>
          <Link to="/dashboard" className="text-link text-center block mt-3">
            Go to Resident Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

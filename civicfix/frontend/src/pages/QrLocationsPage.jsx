import { useState, useEffect } from 'react';
import {
  QrCode,
  Plus,
  Download,
  RefreshCw,
  Power,
  Trash2,
  ExternalLink,
  MapPin,
  Building2,
  Copy,
  Check
} from 'lucide-react';
import { api, getApiError } from '../lib/api.js';

const categories = ['Garbage', 'Water', 'Roads', 'Streetlights', 'Drainage', 'Sanitation', 'Electrical', 'Buildings', 'Other'];
const departments = ['Sanitation', 'Water & Sewage', 'Roads & Infrastructure', 'Streetlights', 'Drainage', 'Electrical', 'Civil Maintenance', 'General Services'];

export default function QrLocationsPage() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // New spot form
  const [newSpot, setNewSpot] = useState({
    label: '',
    department: 'Sanitation',
    category: 'Sanitation',
    address: '',
    lat: '',
    lng: ''
  });
  const [creating, setCreating] = useState(false);

  const loadSpots = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/qr');
      setSpots(data.data.spots);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpots();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.post('/qr', newSpot);
      setCreateModalOpen(false);
      setNewSpot({
        label: '',
        department: 'Sanitation',
        category: 'Sanitation',
        address: '',
        lat: '',
        lng: ''
      });
      await loadSpots();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.patch(`/qr/${id}/toggle`);
      await loadSpots();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const handleRegenerate = async (id) => {
    try {
      await api.post(`/qr/${id}/regenerate`);
      await loadSpots();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this QR location spot?')) return;
    try {
      await api.delete(`/qr/${id}`);
      await loadSpots();
    } catch (err) {
      setError(getApiError(err));
    }
  };

  const downloadQrBadge = (spot) => {
    const a = document.createElement('a');
    a.href = spot.qrCodeDataUrl;
    a.download = `CivicFix-QR-${spot.code}-${spot.label.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const copyScanUrl = (code) => {
    const url = `${window.location.origin}/report/qr/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="content-page qr-page-layout">
      <div className="page-intro-row">
        <div>
          <h2>Facility QR Code Complaint Hub</h2>
          <p>Generate, manage, and print unique QR code placards for buildings, blocks, restrooms, and public stations.</p>
        </div>
        <div className="btn-group">
          <button className="secondary-button" onClick={loadSpots} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="primary-button" onClick={() => setCreateModalOpen(true)}>
            <Plus size={16} /> New Facility QR Spot
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* QR Cards Grid */}
      <div className="qr-spots-grid">
        {loading ? (
          <div className="skeleton-stack"><div /><div /><div /></div>
        ) : spots.length === 0 ? (
          <div className="panel empty-sub-state">
            <QrCode size={40} className="text-muted" />
            <h3>No facility QR spots created yet</h3>
            <p>Generate QR codes for physical spots (e.g. "Block A 1st Floor Restroom") to let residents scan and report issues instantly with pre-filled locations.</p>
          </div>
        ) : (
          spots.map(spot => (
            <div key={spot._id} className={`panel qr-spot-card ${!spot.active ? 'is-inactive' : ''}`}>
              <div className="qr-card-header">
                <div>
                  <span className="qr-code-pill">{spot.code}</span>
                  <h3 className="qr-spot-title">{spot.label}</h3>
                </div>
                <button
                  className={`qr-toggle-btn ${spot.active ? 'active' : 'inactive'}`}
                  onClick={() => handleToggle(spot._id)}
                  title={spot.active ? 'Deactivate QR' : 'Activate QR'}
                >
                  <Power size={15} />
                </button>
              </div>

              {/* QR Image Preview */}
              <div className="qr-image-wrap">
                {spot.qrCodeDataUrl ? (
                  <img src={spot.qrCodeDataUrl} alt={`QR Code for ${spot.label}`} />
                ) : (
                  <div className="qr-placeholder"><QrCode size={48} /></div>
                )}
              </div>

              <div className="qr-meta-box">
                <div><span>Department:</span> <strong>{spot.department}</strong></div>
                <div><span>Category:</span> <strong>{spot.category}</strong></div>
                {spot.address && <div><span>Address:</span> <p>{spot.address}</p></div>}
                <div><span>Total Scans:</span> <strong>{spot.scanCount || 0} times</strong></div>
              </div>

              <div className="qr-card-actions">
                <button
                  className="secondary-button compact"
                  onClick={() => downloadQrBadge(spot)}
                  title="Download printable high-res PNG"
                >
                  <Download size={14} /> Download Badge
                </button>

                <button
                  className="secondary-button compact"
                  onClick={() => copyScanUrl(spot.code)}
                  title="Copy resident reporting link"
                >
                  {copiedCode === spot.code ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                  {copiedCode === spot.code ? 'Copied!' : 'Copy URL'}
                </button>

                <a
                  className="icon-button"
                  href={`/report/qr/${spot.code}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Test Scan Landing Page"
                >
                  <ExternalLink size={15} />
                </a>

                <button
                  className="icon-button"
                  onClick={() => handleRegenerate(spot._id)}
                  title="Regenerate QR Code"
                >
                  <RefreshCw size={15} />
                </button>

                <button
                  className="icon-button text-red"
                  onClick={() => handleDelete(spot._id)}
                  title="Delete Spot"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Generate New Facility QR Spot</h3>
            <p>Create a location placard that residents can scan to submit instant pre-filled complaints.</p>

            <form onSubmit={handleCreate}>
              <label className="field-label-sm">Location / Facility Label *</label>
              <input
                required
                type="text"
                placeholder="e.g. Block A - Ground Floor Restroom"
                value={newSpot.label}
                onChange={e => setNewSpot(prev => ({ ...prev, label: e.target.value }))}
                className="mb-2"
              />

              <label className="field-label-sm">Default Responsible Department</label>
              <select
                value={newSpot.department}
                onChange={e => setNewSpot(prev => ({ ...prev, department: e.target.value }))}
                className="form-select mb-2"
              >
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <label className="field-label-sm">Default Category</label>
              <select
                value={newSpot.category}
                onChange={e => setNewSpot(prev => ({ ...prev, category: e.target.value }))}
                className="form-select mb-2"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <label className="field-label-sm">Physical Address or Landmark Description</label>
              <input
                type="text"
                placeholder="e.g. Near West Staircase, Academic Wing"
                value={newSpot.address}
                onChange={e => setNewSpot(prev => ({ ...prev, address: e.target.value }))}
                className="mb-3"
              />

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={creating || !newSpot.label.trim()}>
                  {creating ? 'Generating QR…' : 'Generate QR Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

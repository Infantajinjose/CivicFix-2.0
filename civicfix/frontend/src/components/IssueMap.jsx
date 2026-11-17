import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, useMap, Tooltip as MapTooltip } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, UserCheck, Flame, Layers } from 'lucide-react';
import { api } from '../lib/api.js';

function CenterOnSelection({ selected }) {
  const map = useMap();
  useEffect(() => {
    if (selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng)) {
      map.setView([selected.lat, selected.lng], 15);
    }
  }, [selected?.lat, selected?.lng, map]);
  return null;
}

function SelectMapEvents({ onPick }) {
  useMapEvents({
    click(event) {
      onPick?.({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6))
      });
    }
  });
  return null;
}

const CATEGORY_COLORS = {
  Garbage: '#f59e0b',
  Water: '#0284c7',
  Roads: '#64748b',
  Streetlights: '#eab308',
  Drainage: '#0d9488',
  Sanitation: '#10b981',
  Electrical: '#f97316',
  Buildings: '#8b5cf6',
  Other: '#6b7280'
};

const PRIORITY_RING = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#94a3b8'
};

export default function IssueMap({
  issues = [],
  selectable = false,
  selected,
  onPick,
  height = 360,
  showHotspots = false,
  workers = [],
  isManager = false,
  onAssignSuccess,
  isPublic = false
}) {
  const navigate = useNavigate();
  const [assigningId, setAssigningId] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = useMemo(() => {
    return issues.filter(i => Number.isFinite(i.location?.lat) && Number.isFinite(i.location?.lng));
  }, [issues]);

  const defaultCenter = useMemo(() => {
    if (selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng)) {
      return [selected.lat, selected.lng];
    }
    if (valid.length > 0) {
      return [valid[0].location.lat, valid[0].location.lng];
    }
    return [13.0827, 80.2707]; // Default to Chennai / Demo coords
  }, [selected, valid]);

  // Quick assign worker from popup
  const handleAssign = async (issueId) => {
    if (!selectedWorker) return;
    setBusy(true);
    try {
      await api.patch(`/issues/${issueId}/assign`, { workerId: selectedWorker });
      setAssigningId(null);
      setSelectedWorker('');
      onAssignSuccess?.();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="map-frame-container" style={{ height }}>
      <MapContainer
        center={defaultCenter}
        zoom={valid.length > 0 ? 14 : 12}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {selected && <CenterOnSelection selected={selected} />}
        {selectable && <SelectMapEvents onPick={onPick} />}

        {/* Issue Markers */}
        {valid.map((issue) => {
          const fillColor = CATEGORY_COLORS[issue.category] || '#10b981';
          const strokeColor = PRIORITY_RING[issue.priority] || '#3b82f6';
          const isUrgent = issue.priority === 'urgent';
          const isResolved = issue.status === 'resolved';

          return (
            <CircleMarker
              key={issue._id}
              center={[issue.location.lat, issue.location.lng]}
              radius={isUrgent ? 11 : 9}
              pathOptions={{
                color: isResolved ? '#10b981' : strokeColor,
                weight: isUrgent ? 3 : 2,
                fillColor: isResolved ? '#34d399' : fillColor,
                fillOpacity: 0.85
              }}
            >
              <MapTooltip direction="top" offset={[0, -10]}>
                <strong>{issue.ticketNumber}</strong>: {issue.category} ({issue.priority})
              </MapTooltip>

              <Popup className="civic-map-popup">
                <div className="popup-card">
                  <div className="popup-badge-row">
                    <span className={`popup-pri-badge pri-${issue.priority}`}>{issue.priority}</span>
                    <span className="popup-cat-badge">{issue.category}</span>
                    {issue.status === 'resolved' && <span className="popup-status-resolved">Resolved</span>}
                  </div>

                  <strong className="popup-title">{issue.title}</strong>
                  <div className="popup-meta">
                    <span>{issue.ticketNumber}</span>
                    <span>{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</span>
                  </div>

                  {issue.location?.address && (
                    <div className="popup-address">📍 {issue.location.address}</div>
                  )}

                  {!isPublic && (
                    <div className="popup-actions">
                      <button
                        className="popup-btn-view"
                        onClick={() => navigate(`/issues/${issue._id}`)}
                      >
                        Open Details →
                      </button>

                      {isManager && issue.status !== 'resolved' && (
                        assigningId === issue._id ? (
                          <div className="popup-assign-row">
                            <select
                              value={selectedWorker}
                              onChange={e => setSelectedWorker(e.target.value)}
                              className="popup-select"
                            >
                              <option value="">Select worker...</option>
                              {workers.map(w => (
                                <option key={w._id} value={w._id}>{w.name} ({w.department || 'Field'})</option>
                              ))}
                            </select>
                            <button
                              className="popup-btn-save"
                              onClick={() => handleAssign(issue._id)}
                              disabled={busy || !selectedWorker}
                            >
                              Save
                            </button>
                            <button className="popup-btn-cancel" onClick={() => setAssigningId(null)}>✕</button>
                          </div>
                        ) : (
                          <button
                            className="popup-btn-assign"
                            onClick={() => setAssigningId(issue._id)}
                          >
                            <UserCheck size={13} /> {issue.assignedTo?.name ? `Reassign` : 'Assign Worker'}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Selected Pin for picker */}
        {selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng) && (
          <CircleMarker
            center={[selected.lat, selected.lng]}
            radius={10}
            pathOptions={{ color: '#0f172a', weight: 3, fillColor: '#10b981', fillOpacity: 0.95 }}
          >
            <MapTooltip permanent direction="top" offset={[0, -10]}>
              Selected Location Pin
            </MapTooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}

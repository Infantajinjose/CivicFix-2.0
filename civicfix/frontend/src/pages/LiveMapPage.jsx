import { useState, useEffect } from 'react';
import {
  Filter,
  Flame,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  Users,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal
} from 'lucide-react';
import { api, getApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import IssueMap from '../components/IssueMap.jsx';

const categories = ['all', 'Garbage', 'Water', 'Roads', 'Streetlights', 'Drainage', 'Sanitation', 'Electrical', 'Buildings', 'Other'];
const priorities = ['all', 'urgent', 'high', 'medium', 'low'];
const statuses = ['all', 'submitted', 'assigned', 'in_progress', 'resolved'];

export default function LiveMapPage() {
  const { isManager } = useAuth();
  const [issues, setIssues] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedCat, setSelectedCat] = useState('all');
  const [selectedPri, setSelectedPri] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showHotspots, setShowHotspots] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [issuesRes, usersRes] = await Promise.all([
        api.get('/issues?limit=100'),
        isManager ? api.get('/users') : Promise.resolve({ data: { data: { users: [] } } })
      ]);
      setIssues(issuesRes.data.data.issues);
      setWorkers(usersRes.data.data.users.filter(u => u.role === 'worker'));
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered issues
  const filteredIssues = issues.filter(issue => {
    if (selectedCat !== 'all' && issue.category !== selectedCat) return false;
    if (selectedPri !== 'all' && issue.priority !== selectedPri) return false;
    if (selectedStatus !== 'all' && issue.status !== selectedStatus) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchTitle = issue.title?.toLowerCase().includes(term);
      const matchTicket = issue.ticketNumber?.toLowerCase().includes(term);
      const matchAddress = issue.location?.address?.toLowerCase().includes(term);
      if (!matchTitle && !matchTicket && !matchAddress) return false;
    }
    return true;
  });

  const mappedCount = filteredIssues.filter(i => i.location?.lat && i.location?.lng).length;
  const urgentCount = filteredIssues.filter(i => i.priority === 'urgent' && i.status !== 'resolved').length;

  return (
    <div className="content-page map-page-layout">
      <div className="page-intro-row">
        <div>
          <h2>Live Geographic Intelligence Map</h2>
          <p>Real-time spatial visualization of community incidents, response locations, and hotspot clusters.</p>
        </div>
        <button className="secondary-button" onClick={loadData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh Map
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Map Control Bar & Filters */}
      <div className="panel map-control-bar">
        <div className="map-filter-group">
          <label>
            <span>Category:</span>
            <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
              {categories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Priority:</span>
            <select value={selectedPri} onChange={e => setSelectedPri(e.target.value)}>
              {priorities.map(p => (
                <option key={p} value={p}>{p === 'all' ? 'All Priorities' : p.toUpperCase()}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Status:</span>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
              {statuses.map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="map-search-wrapper">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search mapped address or title..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="map-kpi-pills">
          <span className="kpi-pill">
            <MapPin size={14} /> <strong>{mappedCount}</strong> Mapped
          </span>
          <span className="kpi-pill pill-urgent">
            <AlertTriangle size={14} /> <strong>{urgentCount}</strong> Urgent
          </span>
        </div>
      </div>

      {/* Interactive Map */}
      <div className="panel live-map-card">
        <IssueMap
          issues={filteredIssues}
          height={580}
          workers={workers}
          isManager={isManager}
          onAssignSuccess={loadData}
        />

        {/* Map Legend */}
        <div className="map-legend-row">
          <div className="legend-item">
            <span className="legend-dot dot-urgent" /> Urgent Hazard
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-high" /> High Priority
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-normal" /> Normal / Medium
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-resolved" /> Verified Resolved
          </div>
          <div className="legend-note">
            Click any pin to inspect ticket details or assign a field technician directly from the map.
          </div>
        </div>
      </div>
    </div>
  );
}

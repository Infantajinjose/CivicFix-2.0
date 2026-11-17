import { useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Crosshair,
  MapPin,
  Plus,
  UploadCloud,
  X,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Bot
} from 'lucide-react';
import { api, getApiError } from '../lib/api.js';
import IssueMap from '../components/IssueMap.jsx';

const categories = [
  ['Garbage', 'Waste collection, overflowing bins or litter'],
  ['Water', 'Leakage, supply or water quality concerns'],
  ['Roads', 'Potholes, damaged paths or unsafe surfaces'],
  ['Streetlights', 'Broken or non-working lights'],
  ['Drainage', 'Blocked drains or waterlogging'],
  ['Sanitation', 'Cleaning and hygiene issues'],
  ['Electrical', 'Wiring, power or electrical hazards'],
  ['Buildings', 'Doors, lifts, walls or facility damage'],
  ['Other', 'Any other community maintenance issue']
];

const priorities = [
  ['low', 'Low', 'Can wait'],
  ['medium', 'Medium', 'Normal'],
  ['high', 'High', 'Needs attention'],
  ['urgent', 'Urgent', 'Safety or major disruption']
];

const departments = [
  'Sanitation',
  'Water & Sewage',
  'Roads & Infrastructure',
  'Streetlights',
  'Drainage',
  'Electrical',
  'Civil Maintenance',
  'General Services'
];

export default function NewIssuePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef(null);

  // Form values (prefilled from URL if scanned via QR)
  const [values, setValues] = useState({
    title: '',
    description: '',
    category: searchParams.get('category') || 'Garbage',
    priority: searchParams.get('priority') || 'medium',
    department: searchParams.get('department') || 'General Services',
    address: searchParams.get('address') || ''
  });

  const [location, setLocation] = useState(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    return (lat && lng) ? { lat: Number(lat), lng: Number(lng) } : null;
  });

  const qrLocationId = searchParams.get('qrId') || null;

  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState(null);

  const change = e => setValues(v => ({ ...v, [e.target.name]: e.target.value }));

  const addFiles = e => {
    const incoming = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...incoming].slice(0, 5));
    e.target.value = '';
  };

  const removeFile = index => setFiles(prev => prev.filter((_, i) => i !== index));

  const useGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6))
        });
      },
      () => setError('Could not access your location. Check browser location permission.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Run AI analysis when title & description are entered
  const runAiAnalysis = async () => {
    if (!values.title.trim() && !values.description.trim()) {
      setError('Enter a title or description first to run AI analysis.');
      return;
    }
    setError('');
    setAnalyzing(true);
    try {
      const { data } = await api.post('/issues/check-ai', {
        title: values.title,
        description: values.description,
        category: values.category,
        lat: location?.lat,
        lng: location?.lng
      });
      setAiSuggestions(data.data);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply AI suggestions
  const applyAiSuggestions = () => {
    if (!aiSuggestions) return;
    setValues(v => ({
      ...v,
      category: aiSuggestions.suggestedCategory || v.category,
      priority: aiSuggestions.suggestedPriority || v.priority,
      department: aiSuggestions.suggestedDepartment || v.department
    }));
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      Object.entries(values).forEach(([key, value]) => form.append(key, value));
      if (location) {
        form.append('lat', location.lat);
        form.append('lng', location.lng);
      }
      if (qrLocationId) {
        form.append('qrLocationId', qrLocationId);
      }
      files.forEach(file => form.append('images', file));

      const { data } = await api.post('/issues', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate(`/issues/${data.data.issue._id}`);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content-page form-page">
      <div className="back-row">
        <button className="back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="form-page-heading">
        <div>
          <h2>Report a Community Issue</h2>
          <p>Provide details, location, and photos. CivicFix AI will assist in categorising and routing your complaint.</p>
        </div>
      </div>

      <form onSubmit={submit} className="report-layout">
        <div className="panel report-form-panel">
          <div className="form-section-heading">
            <div className="form-section-number">01</div>
            <div>
              <h3>What is the issue?</h3>
              <p>Give your report a clear title and description.</p>
            </div>
          </div>

          <label className="field-label">
            <span>Issue Title <b>*</b></span>
            <input
              required
              autoFocus
              maxLength={140}
              name="title"
              value={values.title}
              onChange={change}
              placeholder="e.g. Broken water pipe flooding entrance driveway"
            />
          </label>

          <label className="field-label">
            <span>Detailed Description <b>*</b></span>
            <textarea
              required
              maxLength={3000}
              rows={5}
              name="description"
              value={values.description}
              onChange={change}
              placeholder="Describe what happened, exact location details, and any safety hazards…"
            />
            <span className="field-helper">
              <span>Be specific. Avoid sharing personal or confidential information.</span>
              <span>{values.description.length}/3000</span>
            </span>
          </label>

          {/* AI Complaint Analysis Trigger & Card */}
          <div className="ai-trigger-block">
            <button
              type="button"
              className="ai-analyze-btn"
              onClick={runAiAnalysis}
              disabled={analyzing || (!values.title.trim() && !values.description.trim())}
            >
              <Sparkles size={16} />
              <span>{analyzing ? 'Analyzing with CivicFix AI…' : 'Analyze Complaint with AI'}</span>
            </button>
          </div>

          {aiSuggestions && (
            <div className="ai-suggestion-card">
              <div className="ai-card-header">
                <div className="ai-title">
                  <Bot size={18} className="text-brand" />
                  <strong>AI Smart Analysis & Suggestions</strong>
                </div>
                <button type="button" className="ai-apply-btn" onClick={applyAiSuggestions}>
                  Apply Suggestions
                </button>
              </div>

              <div className="ai-grid">
                <div>
                  <span>Category:</span>
                  <strong>{aiSuggestions.suggestedCategory}</strong>
                </div>
                <div>
                  <span>Suggested Priority:</span>
                  <strong className={`priority-text priority-${aiSuggestions.suggestedPriority}`}>
                    {aiSuggestions.suggestedPriority}
                  </strong>
                </div>
                <div>
                  <span>Department:</span>
                  <strong>{aiSuggestions.suggestedDepartment}</strong>
                </div>
                <div>
                  <span>Confidence:</span>
                  <strong>{Math.round(aiSuggestions.confidence * 100)}%</strong>
                </div>
              </div>

              {aiSuggestions.summary && (
                <div className="ai-summary-note">
                  <span>AI Summary:</span> {aiSuggestions.summary}
                </div>
              )}

              {/* Duplicate Complaint Warning */}
              {aiSuggestions.duplicateRisk !== 'none' && aiSuggestions.potentialDuplicateIssue && (
                <div className="ai-duplicate-warning">
                  <div className="duplicate-alert-header">
                    <AlertTriangle size={18} />
                    <strong>Potential Duplicate Complaint Detected!</strong>
                  </div>
                  <p>
                    A similar complaint (<strong>{aiSuggestions.potentialDuplicateIssue.ticketNumber}</strong>) was already reported
                    {aiSuggestions.distanceMeters !== null ? ` ~${aiSuggestions.distanceMeters} meters away` : ''}:
                  </p>
                  <div className="duplicate-issue-preview">
                    <span>"{aiSuggestions.potentialDuplicateIssue.title}"</span>
                    <a
                      href={`/issues/${aiSuggestions.potentialDuplicateIssue._id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View existing ticket <ExternalLink size={12} />
                    </a>
                  </div>
                  <small>If this is the same problem, you may upvote or follow the existing issue instead of creating a duplicate.</small>
                </div>
              )}
            </div>
          )}

          <fieldset className="choice-group mt-4">
            <legend>Category <b>*</b></legend>
            <div className="category-grid">
              {categories.map(([name, hint]) => (
                <label className="choice-tile" key={name}>
                  <input
                    type="radio"
                    name="category"
                    value={name}
                    checked={values.category === name}
                    onChange={change}
                  />
                  <span className="choice-body">
                    <strong>{name}</strong>
                    <small>{hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>Priority</legend>
            <div className="segmented">
              {priorities.map(([value, label, hint]) => (
                <label className="segment" key={value}>
                  <input
                    type="radio"
                    name="priority"
                    value={value}
                    checked={values.priority === value}
                    onChange={change}
                  />
                  <span className="choice-body">
                    <strong><i className={`pri-dot ${value}`} />{label}</strong>
                    <small>{hint}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field-label mt-3">
            <span>Target Department</span>
            <select name="department" value={values.department} onChange={change} className="form-select">
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </label>

          <div className="form-section-heading section-spaced">
            <div className="form-section-number">02</div>
            <div>
              <h3>Where is it located?</h3>
              <p>Pinpoint the location so field workers can locate it immediately.</p>
            </div>
          </div>

          <label className="field-label">
            <span>Location / Landmark / Block</span>
            <input
              maxLength={250}
              name="address"
              value={values.address}
              onChange={change}
              placeholder="e.g. Block B - 1st Floor corridor near Stairwell 2"
            />
          </label>

          <div className="location-action-row">
            <span>
              {location ? <><CheckCircle2 size={15} /> GPS coordinates captured</> : 'No GPS coordinates selected'}
            </span>
            <button type="button" className="secondary-button compact" onClick={useGPS}>
              <Crosshair size={15} /> Use My Current Location
            </button>
          </div>

          <IssueMap selectable selected={location} onPick={setLocation} height={260} />
          <div className="coordinates-note">
            {location ? `Selected coordinates: ${location.lat}, ${location.lng}` : 'Click anywhere on the map to place a pin.'}
          </div>

          <div className="form-section-heading section-spaced">
            <div className="form-section-number">03</div>
            <div>
              <h3>Attach Photos</h3>
              <p>High-resolution photos provide clear evidence for faster resolution.</p>
            </div>
          </div>

          <div
            className="upload-zone"
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={addFiles}
            />
            <div className="upload-icon"><UploadCloud size={22} /></div>
            <strong>Click to upload issue photographs</strong>
            <span>JPG, PNG or WEBP · up to 5 photos · max 5 MB each</span>
          </div>

          {files.length > 0 && (
            <div className="selected-files">
              {files.map((file, index) => (
                <div className="selected-file" key={`${file.name}-${index}`}>
                  <Camera size={16} />
                  <span>{file.name}</span>
                  <small>{(file.size / 1024 / 1024).toFixed(1)} MB</small>
                  <button type="button" onClick={() => removeFile(index)}><X size={15} /></button>
                </div>
              ))}
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="form-submit-row">
            <span><CheckCircle2 size={15} /> Automatically assigned an SLA deadline upon submission.</span>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit Complaint'} <Plus size={16} />
            </button>
          </div>
        </div>

        <aside className="report-aside">
          <div className="aside-info-card">
            <div className="aside-icon"><Sparkles size={19} /></div>
            <h3>Intelligent SLA Routing</h3>
            <p>Critical issues automatically notify department managers with strict resolution SLAs (e.g. Urgent: 4h, High: 24h).</p>
          </div>

          <div className="aside-info-card green-aside">
            <div className="aside-icon"><CheckCircle2 size={19} /></div>
            <h3>Resolution Lifecycle</h3>
            <ul>
              <li>Issue received & assigned to worker</li>
              <li>Worker accepts & documents site work</li>
              <li>Before & After photos uploaded</li>
              <li>Manager verifies work</li>
              <li>Resident confirms resolution & rates service</li>
            </ul>
          </div>

          <div className="privacy-note">
            CivicFix enforces tenant-level privacy. Private contact details are never exposed publicly.
          </div>
        </aside>
      </form>
    </div>
  );
}

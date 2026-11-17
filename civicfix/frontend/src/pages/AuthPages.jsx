import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
  ShieldCheck,
  HardHat,
  Users,
  Sparkles,
  Sun,
  Moon,
  Layers,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { getApiError } from '../lib/api.js';

function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-icon">
      <LockKeyhole size={17} />
      <input {...props} type={show ? 'text' : 'password'} />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setShow(v => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

function AuthFrame({ children, mode }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="auth-brand">
          <div className="brand-mark"><Activity size={20} /></div>
          <strong>CivicFix 2.0</strong>
        </div>
        <div className="auth-art-content">
          <h1>Enterprise SaaS Civic Incident Platform</h1>
          <p>Next-gen public problem resolution: AI analysis, spatial GIS intelligence, real-time Socket.IO, SLA auto-escalation, worker mobile workflows, and verified resident resolution.</p>
          
          <div className="auth-feature-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '20px 0 24px' }}>
            {['1. AI Complaint Engine', '2. Live Socket.IO Alerts', '3. Geospatial Map', '4. Worker Mobile Portal', '5. SLA Auto-Escalation', '6. Public Transparency', '7. Facility QR Codes', '8. 5-Star Resident Ratings', '9. Predictive Analytics', '10. Multi-Org Subscriptions'].map(f => (
              <span key={f} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '4px 10px', fontSize: '0.725rem', color: '#cbd5e1', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} style={{ color: '#10b981' }} /> {f}
              </span>
            ))}
          </div>

          <div className="auth-ticket" aria-hidden="true">
            <div className="ticket-top">
              <span className="ticket-id">CF-2026-1002</span>
              <span className="status-badge status-in_progress">
                <span className="status-dot" /> In Progress
              </span>
            </div>
            <strong>Drinking water pipe burst near Block B</strong>
            <p>AI classified: Urgent Priority. SLA Target: 4h. Dispatched to Water & Sewage maintenance team.</p>
            <ol className="pipeline">
              {['Submitted', 'Assigned', 'In progress', 'Completed', 'Verified'].map((label, i) => (
                <li key={label} className={`pipe-step ${i < 2 ? 'done' : ''} ${i === 2 ? 'current' : ''}`}>
                  <span className="pipe-dot" />{label}
                </li>
              ))}
            </ol>
            <div className="ticket-foot">
              <i>W</i> Water & Sewage unit &middot; GPS Geotagged &middot; SLA Active
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form-corner" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="icon-button compact"
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle dark mode"
            style={{ width: 34, height: 34 }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span>
            {mode === 'login' ? 'New organisation?' : 'Already have an account?'}
            <Link to={mode === 'login' ? '/register' : '/login'} style={{ marginLeft: 6 }}>
              {mode === 'login' ? 'Create a workspace' : 'Sign in'}
            </Link>
          </span>
        </div>

        <div className="auth-form-container">
          {children}
          <div className="auth-form-foot">
            CivicFix 2.0 &middot; Enterprise SaaS &middot; All 10 Features Active &amp; Ready
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const loginAsDemo = async (demoEmail, targetUrl = '/dashboard') => {
    setError('');
    setBusy(true);
    setEmail(demoEmail);
    setPassword('CivicFix@123');
    try {
      await login(demoEmail, 'CivicFix@123');
      navigate(targetUrl);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame mode="login">
      <div className="auth-heading">
        <h2>Sign in to CivicFix 2.0</h2>
        <p>Enterprise SaaS Operations & Civic Incident Resolution</p>
      </div>

      {/* 1-Click Quick Demo Switcher */}
      <div className="demo-login-box">
        <div className="demo-login-header">
          <Sparkles size={14} className="text-brand" />
          <span>Quick 1-Click Demo Logins:</span>
        </div>
        <div className="demo-btn-grid">
          <button
            type="button"
            className="demo-btn btn-admin"
            onClick={() => loginAsDemo('superadmin@civicfix.com', '/admin/super')}
            disabled={busy}
          >
            <ShieldCheck size={14} /> Super Admin
          </button>

          <button
            type="button"
            className="demo-btn btn-owner"
            onClick={() => loginAsDemo('owner@civicfix.demo', '/dashboard')}
            disabled={busy}
          >
            <Building2 size={14} /> Org Owner
          </button>

          <button
            type="button"
            className="demo-btn btn-manager"
            onClick={() => loginAsDemo('manager@civicfix.demo', '/dashboard')}
            disabled={busy}
          >
            <Users size={14} /> Dept Manager
          </button>

          <button
            type="button"
            className="demo-btn btn-worker"
            onClick={() => loginAsDemo('worker@civicfix.demo', '/worker')}
            disabled={busy}
          >
            <HardHat size={14} /> Field Worker
          </button>

          <button
            type="button"
            className="demo-btn btn-resident"
            onClick={() => loginAsDemo('resident@civicfix.demo', '/dashboard')}
            disabled={busy}
          >
            <UserRound size={14} /> Resident
          </button>
        </div>
      </div>

      <div className="auth-divider">
        <span>or sign in manually</span>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <label>Email address</label>
        <div className="input-icon">
          <Mail size={17} />
          <input
            required
            autoFocus
            autoComplete="username"
            type="email"
            placeholder="you@organisation.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <label>Password</label>
        <PasswordInput
          required
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {error && <div className="form-error">{error}</div>}

        <button className="primary-button auth-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in to Workspace'} <ArrowRight size={17} />
        </button>
      </form>

      <div className="auth-note">
        <CheckCircle2 size={16} /> Password for all demo accounts is <code>CivicFix@123</code>
      </div>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ organizationName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (e) => setValues(v => ({ ...v, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(values.organizationName, values.name, values.email, values.password);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame mode="register">
      <div className="auth-heading">
        <h2>Register Your Organisation</h2>
        <p>Deploy CivicFix 2.0 for your city, university, apartment complex, or campus facility.</p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <label>Organisation or Community Name</label>
        <div className="input-icon">
          <Building2 size={17} />
          <input
            required
            autoFocus
            name="organizationName"
            placeholder="e.g. Metropolis Civic Council"
            value={values.organizationName}
            onChange={change}
          />
        </div>

        <label>Your Full Name</label>
        <div className="input-icon">
          <UserRound size={17} />
          <input
            required
            name="name"
            placeholder="e.g. Dr. Rajesh Kumar"
            value={values.name}
            onChange={change}
          />
        </div>

        <label>Work Email</label>
        <div className="input-icon">
          <Mail size={17} />
          <input
            required
            name="email"
            type="email"
            placeholder="admin@organisation.gov"
            value={values.email}
            onChange={change}
          />
        </div>

        <label>Password <small>(at least 8 characters)</small></label>
        <PasswordInput
          required
          minLength={8}
          name="password"
          autoComplete="new-password"
          placeholder="Create a secure master password"
          value={values.password}
          onChange={change}
        />

        {error && <div className="form-error">{error}</div>}

        <button className="primary-button auth-submit" disabled={busy}>
          {busy ? 'Creating workspace…' : 'Create Organisation Workspace'} <ArrowRight size={17} />
        </button>
      </form>

      <div className="auth-note">
        <CheckCircle2 size={16} /> Includes 14-day Enterprise Trial with automated AI & SLA features.
      </div>
    </AuthFrame>
  );
}

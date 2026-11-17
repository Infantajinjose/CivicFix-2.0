import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Building2,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
  Users,
  MapPin,
  Clock,
  QrCode,
  Star,
  CreditCard,
  Globe,
  HardHat,
  ShieldAlert,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';

const titleByPath = [
  ['/dashboard', 'Overview'],
  ['/issues/new', 'Report an issue'],
  ['/issues', 'Issues & Complaints'],
  ['/map', 'Live Intelligence Map'],
  ['/worker', 'Field Worker Portal'],
  ['/sla', 'SLA & Escalation Hub'],
  ['/qr-locations', 'Facility QR Codes'],
  ['/qr-scan', 'QR Fast Reporting'],
  ['/feedback', 'Resolution Ratings & Feedback'],
  ['/analytics', 'Predictive Analytics & Reports'],
  ['/team', 'Response Team & Access'],
  ['/billing', 'SaaS Subscription & Plans'],
  ['/admin/super', 'Super Admin Control Center'],
  ['/public-settings', 'Transparency Portal Settings']
];

export default function AppShell() {
  const { user, tenant, login, logout, isManager, isSuperAdmin, isWorker, isResident } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef(null);
  const [switchingRole, setSwitchingRole] = useState(false);

  const pageTitle = titleByPath.find(([path]) => location.pathname.startsWith(path))?.[1] || 'Workspace';

  // Role-Aware Navigation
  const nav = [
    // Common / Dashboard
    ...(isWorker ? [
      { to: '/worker', label: 'My Field Tasks', short: 'Tasks', icon: HardHat, end: true },
      { to: '/issues', label: 'Task History', short: 'History', icon: ClipboardList, end: true }
    ] : isSuperAdmin ? [
      { to: '/admin/super', label: 'Super Admin', short: 'SuperAdmin', icon: ShieldAlert, end: true },
      { to: '/issues', label: 'Platform Issues', short: 'Issues', icon: ClipboardList, end: true }
    ] : [
      { to: '/dashboard', label: 'Overview', short: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/issues', label: isResident ? 'My Reports' : 'All Issues', short: 'Issues', icon: ClipboardList, end: true },
      { to: '/map', label: 'Live Map', short: 'Map', icon: MapPin },
      { to: '/issues/new', label: 'Report Issue', short: 'Report', icon: Plus }
    ]),

    // Manager / Owner Advanced Modules
    ...(isManager ? [
      { to: '/sla', label: 'SLA & Escalations', short: 'SLA', icon: Clock },
      { to: '/qr-locations', label: 'Facility QR Codes', short: 'QR Codes', icon: QrCode },
      { to: '/feedback', label: 'Resident Feedback', short: 'Feedback', icon: Star },
      { to: '/analytics', label: 'Analytics & Predictions', short: 'Analytics', icon: FileBarChart },
      { to: '/team', label: 'Team Members', short: 'Team', icon: Users },
      { to: '/billing', label: 'Subscription & Plans', short: 'Plans', icon: CreditCard }
    ] : []),

    // Resident Quick Tools
    ...(isResident ? [
      { to: '/qr-scan', label: 'Scan Facility QR', short: 'Scan QR', icon: QrCode }
    ] : []),

    // Public Transparency Portal Link
    ...(tenant?.slug ? [
      { to: `/portal/${tenant.slug}`, label: 'Public Transparency', short: 'Public', icon: Globe, external: true }
    ] : [])
  ];

  // Keyboard shortcuts: "/" jumps to search, "n" starts a new report.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/issues/new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleFastSwitch = async (email, dest) => {
    setSwitchingRole(true);
    try {
      await login(email, 'CivicFix@123');
      navigate(dest);
    } catch (err) {
      console.error('Fast switch failed', err);
    } finally {
      setSwitchingRole(false);
    }
  };

  const search = (e) => {
    e.preventDefault();
    const q = searchRef.current?.value.trim();
    navigate(q ? `/issues?q=${encodeURIComponent(q)}` : '/issues');
    searchRef.current?.blur();
  };

  const initial = user?.name?.slice(0, 1)?.toUpperCase() || 'U';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Activity size={20} strokeWidth={2.6} /></div>
          <div>
            <strong>CivicFix 2.0</strong>
            <span>Enterprise SaaS</span>
          </div>
        </div>

        <div className="workspace-switch">
          <div className="workspace-avatar"><Building2 size={18} /></div>
          <div className="workspace-copy">
            <strong>{tenant?.name || 'Metropolis Platform'}</strong>
            <span style={{ textTransform: 'capitalize' }}>
              {isSuperAdmin ? 'Super Admin Portal' : `${tenant?.plan || 'Starter'} Plan`}
            </span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Main">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              target={item.external ? '_blank' : undefined}
              className={({ isActive }) => `nav-link ${isActive && !item.external ? 'active' : ''}`}
              title={item.label}
            >
              <item.icon size={19} />
              <span className="nav-text">{item.label}</span>
              <span className="nav-short">{item.short}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="shortcut-card">
            <strong>Quick Access</strong>
            <div><kbd>N</kbd> New report</div>
            <div><kbd>/</kbd> Global search</div>
          </div>

          <button className="profile-button" onClick={handleLogout} title="Sign out" aria-label="Sign out">
            <div className="avatar">{initial}</div>
            <div className="profile-copy">
              <strong>{user?.name}</strong>
              <span>{user?.role}</span>
            </div>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-area" id="main">
        <header className="topbar">
          <div className="topbar-left">
            <h1>{pageTitle}</h1>
            {tenant?.plan && (
              <span className={`plan-pill plan-${tenant.plan}`}>
                {tenant.plan}
              </span>
            )}
          </div>

          <div className="topbar-right">
            {/* Quick Demo Role Switcher */}
            <div className="demo-role-switcher" title="Switch Demo Role instantly">
              <Sparkles size={14} className="text-brand" />
              <span className="demo-switch-label">Role:</span>
              <select
                value={user?.email || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'superadmin@civicfix.com') handleFastSwitch(val, '/admin/super');
                  else if (val === 'owner@civicfix.demo') handleFastSwitch(val, '/dashboard');
                  else if (val === 'manager@civicfix.demo') handleFastSwitch(val, '/dashboard');
                  else if (val === 'worker@civicfix.demo') handleFastSwitch(val, '/worker');
                  else if (val === 'resident@civicfix.demo') handleFastSwitch(val, '/dashboard');
                }}
                disabled={switchingRole}
                className="role-select"
                aria-label="Switch User Role"
              >
                <option value="owner@civicfix.demo">Org Owner (All Features)</option>
                <option value="manager@civicfix.demo">Dept Manager</option>
                <option value="worker@civicfix.demo">Field Worker</option>
                <option value="resident@civicfix.demo">Resident</option>
                <option value="superadmin@civicfix.com">Super Admin</option>
              </select>
            </div>

            <form className="topbar-search" onSubmit={search} role="search">
              <Search size={16} />
              <input ref={searchRef} type="search" placeholder="Search issues, address, tickets..." aria-label="Search issues" />
              <kbd>/</kbd>
            </form>

            {location.pathname !== '/issues/new' && !isWorker && (
              <button className="primary-button" onClick={() => navigate('/issues/new')} aria-label="New report">
                <Plus size={18} />
                <span>New report</span>
              </button>
            )}

            {/* Real-time Notification Center Bell */}
            <NotificationDropdown />

            {/* Dark Mode Toggle */}
            <button
              className="icon-button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* User Avatar */}
            <div className="topbar-avatar" title={`${user?.name} (${user?.role})`}>
              {initial}
            </div>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>

        <footer className="app-footer">
          <span>&copy; {new Date().getFullYear()} CivicFix 2.0 &middot; Smart Public Problem Resolution SaaS</span>
          <span>Role: <strong style={{ textTransform: 'capitalize' }}>{user?.role}</strong> &middot; Press <kbd>N</kbd> to report</span>
        </footer>
      </main>
    </div>
  );
}

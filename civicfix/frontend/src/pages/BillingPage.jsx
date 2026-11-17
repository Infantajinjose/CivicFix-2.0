import { useState, useEffect } from 'react';
import {
  CreditCard,
  Check,
  Zap,
  Building2,
  Users,
  ShieldCheck,
  Clock,
  Sparkles,
  Download,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { api, getApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function BillingPage() {
  const { tenant, refreshUser } = useAuth();
  const [billingData, setBillingData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadBillingInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const [currRes, invRes] = await Promise.all([
        api.get('/subscriptions/current'),
        api.get('/subscriptions/invoices')
      ]);
      setBillingData(currRes.data.data);
      setInvoices(invRes.data.data.invoices);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingInfo();
  }, []);

  const handleSandboxUpgrade = async (planId) => {
    setUpgrading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { data } = await api.post('/subscriptions/sandbox-upgrade', { planId });
      setSuccessMsg(`Successfully activated ${planId.toUpperCase()} subscription!`);
      await refreshUser();
      await loadBillingInfo();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return <div className="screen-loader"><span className="loader" /> Loading subscription records…</div>;
  }

  const { subscription, planConfig, allPlans, usage } = billingData || {};
  const currentPlanId = subscription?.plan || tenant?.plan || 'starter';

  return (
    <div className="content-page billing-page-layout">
      <div className="page-intro-row">
        <div>
          <h2>Multi-Organisation SaaS Subscription & Plans</h2>
          <p>Manage subscription tier, team capacity limits, and invoice billing history.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {successMsg && <div className="form-success">{successMsg}</div>}

      {/* Usage Meter Card */}
      <div className="panel usage-overview-card mb-4">
        <div className="usage-card-header">
          <div>
            <span className="current-plan-badge">
              Active Tier: <strong>{currentPlanId.toUpperCase()}</strong>
            </span>
            <h3>Workspace Capacity & Plan Limits</h3>
          </div>
          <span className="billing-cycle-date">
            Next renewal: {subscription?.currentPeriodEnd ? format(new Date(subscription.currentPeriodEnd), 'dd MMM yyyy') : 'Auto-renewing'}
          </span>
        </div>

        <div className="usage-meters-grid">
          <div className="meter-item">
            <div className="meter-labels">
              <span><Users size={15} /> Field Technicians Allowed</span>
              <strong>{usage?.workersUsed} / {usage?.maxWorkers} workers</strong>
            </div>
            <div className="meter-bar-track">
              <div
                className="meter-bar-fill"
                style={{ width: `${Math.min(100, (usage?.workersUsed / (usage?.maxWorkers || 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="meter-item">
            <div className="meter-labels">
              <span><Building2 size={15} /> Operational Departments</span>
              <strong>{usage?.departmentsUsed} / {usage?.maxDepartments} departments</strong>
            </div>
            <div className="meter-bar-track">
              <div
                className="meter-bar-fill"
                style={{ width: `${Math.min(100, (usage?.departmentsUsed / (usage?.maxDepartments || 1)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Plans Pricing Grid */}
      <h3 className="section-title">Available SaaS Tiers</h3>
      <div className="pricing-grid mb-4">
        {(allPlans || []).map(plan => {
          const isCurrent = currentPlanId === plan.id;
          const isPro = plan.id === 'professional';

          return (
            <div key={plan.id} className={`panel pricing-card ${isCurrent ? 'is-active-plan' : ''} ${isPro ? 'is-featured' : ''}`}>
              {isPro && <div className="featured-ribbon">Recommended</div>}
              {isCurrent && <div className="active-plan-pill">Your Current Plan</div>}

              <div className="plan-name-row">
                <h4>{plan.name}</h4>
              </div>

              <div className="plan-price-row">
                <strong>₹{plan.price.toLocaleString('en-IN')}</strong>
                <span>/ month</span>
              </div>

              <ul className="plan-features-list">
                {plan.features.map((feat, i) => (
                  <li key={i}>
                    <Check size={16} className="text-brand" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <div className="plan-card-footer">
                {isCurrent ? (
                  <button className="secondary-button full-width" disabled>
                    Currently Active
                  </button>
                ) : (
                  <button
                    className="primary-button full-width"
                    onClick={() => handleSandboxUpgrade(plan.id)}
                    disabled={upgrading}
                  >
                    {upgrading ? 'Activating…' : `Upgrade to ${plan.id}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoice & Payment History */}
      <section className="panel invoice-history-panel">
        <div className="panel-heading">
          <div>
            <h3>Billing History & Tax Invoices</h3>
            <p>Past subscription transactions and payment receipts</p>
          </div>
          <CreditCard size={18} className="panel-muted-icon" />
        </div>

        <div className="invoice-table-wrap">
          <table className="standard-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Plan Tier</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted p-4">
                    No past payment invoices logged yet.
                  </td>
                </tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv._id}>
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td className="capitalize">{inv.plan}</td>
                    <td>₹{(inv.amount / 100).toLocaleString('en-IN')}</td>
                    <td>{format(new Date(inv.invoiceDate || inv.createdAt), 'dd MMM yyyy')}</td>
                    <td>
                      <span className={`status-pill pill-${inv.status}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <span className="text-muted text-xs">{inv.receipt}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

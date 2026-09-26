import React, { useState, useEffect } from 'react';
import { fetchPlans, fetchDiscounts, fetchPremiumAuditLogs, SubscriptionPlan, DiscountOffer, AuditLog } from '../../../services/premiumService';
import { Crown, Tag, Gift, FileKey, CheckCircle2, XCircle } from 'lucide-react';

export default function PremiumAdmin() {
  const [activeSubTab, setActiveSubTab] = useState<'plans' | 'discounts' | 'grants' | 'audit'>('plans');
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [discounts, setDiscounts] = useState<DiscountOffer[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // New UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, [activeSubTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'plans') {
        const data = await fetchPlans();
        setPlans(data.plans || []);
      } else if (activeSubTab === 'discounts') {
        const data = await fetchDiscounts();
        setDiscounts(data.offers);
      } else if (activeSubTab === 'audit') {
        const data = await fetchPremiumAuditLogs();
        setLogs(data.logs);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'plans', label: 'Subscription Plans', icon: Crown },
    { id: 'discounts', label: 'Discounts & Promos', icon: Tag },
    { id: 'grants', label: 'Manual Grants', icon: Gift },
    { id: 'audit', label: 'Audit Logs', icon: FileKey }
  ];

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', position: 'relative' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'absolute', top: 20, right: 20, zIndex: 9999, padding: '12px 24px',
          borderRadius: 8, background: toastType === 'success' ? '#10b981' : '#ef4444',
          color: '#fff', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeIn 0.3s ease-in-out'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Loading Overlay */}
      {isSubmitting && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 9998, background: 'rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)'
        }}>
          <div style={{ padding: '12px 24px', background: '#1e293b', color: '#fff', borderRadius: 8, fontWeight: 600 }}>
            Processing...
          </div>
        </div>
      )}
      
      {/* Sub-navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        {tabs.map(tab => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              style={{
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: isActive ? '#fff' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary-blue, #2563eb)' : '2px solid transparent',
                color: isActive ? 'var(--primary-blue, #2563eb)' : '#64748b',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 24 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading data...</div>
        ) : (
          <>
            {/* PLANS VIEW */}
            {activeSubTab === 'plans' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Active Plans</h3>
                  <button onClick={() => setShowPlanModal(true)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>+ Create Plan</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: 12 }}>Code</th>
                      <th style={{ padding: 12 }}>Name</th>
                      <th style={{ padding: 12 }}>Price</th>
                      <th style={{ padding: 12 }}>Interval</th>
                      <th style={{ padding: 12 }}>Status</th>
                      <th style={{ padding: 12 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: 12, fontWeight: 500 }}>{p.plan_code}</td>
                        <td style={{ padding: 12 }}>{p.name}</td>
                        <td style={{ padding: 12 }}>{p.currency} {(p.price_cents / 100).toFixed(2)}</td>
                        <td style={{ padding: 12 }}>{p.billing_interval}</td>
                        <td style={{ padding: 12 }}>
                          {p.is_active ? <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14}/> Active</span> : <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={14}/> Inactive</span>}
                        </td>
                        <td style={{ padding: 12 }}>
                          <button
                            onClick={async () => {
                              setIsSubmitting(true);
                              try {
                                if (p.is_active) {
                                  await import('../../../services/premiumService').then(m => m.deactivatePlan(p.id));
                                  showToast('Plan deactivated successfully');
                                } else {
                                  await import('../../../services/premiumService').then(m => m.reactivatePlan(p.id));
                                  showToast('Plan reactivated successfully');
                                }
                                loadData();
                              } catch (err: any) {
                                showToast(`Failed to ${p.is_active ? 'deactivate' : 'reactivate'} plan: ` + err.message, 'error');
                              } finally {
                                setIsSubmitting(false);
                              }
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 4,
                              border: 'none',
                              cursor: 'pointer',
                              backgroundColor: p.is_active ? '#fee2e2' : '#d1fae5',
                              color: p.is_active ? '#ef4444' : '#10b981',
                              fontWeight: 600,
                              fontSize: 12
                            }}
                          >
                            {p.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {plans.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>No plans configured.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* DISCOUNTS VIEW */}
            {activeSubTab === 'discounts' && (
              <div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Discount Offers</h3>
                  <button onClick={() => setShowDiscountModal(true)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>+ Create Discount</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: 12 }}>Code</th>
                      <th style={{ padding: 12 }}>Type</th>
                      <th style={{ padding: 12 }}>Value</th>
                      <th style={{ padding: 12 }}>Usage</th>
                      <th style={{ padding: 12 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discounts.map(d => (
                      <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: 12, fontWeight: 500 }}>{d.code || d.name}</td>
                        <td style={{ padding: 12 }}>{d.discount_type}</td>
                        <td style={{ padding: 12 }}>{d.value}</td>
                        <td style={{ padding: 12 }}>{d.redemptions_used} / {d.max_redemptions || '∞'}</td>
                        <td style={{ padding: 12 }}>
                          {d.is_active ? <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14}/> Active</span> : <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={14}/> Inactive</span>}
                        </td>
                      </tr>
                    ))}
                    {discounts.length === 0 && <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>No discounts configured.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* GRANTS VIEW */}
            {activeSubTab === 'grants' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Manual Grants & Revocations</h3>
                <p style={{ color: '#64748b', marginBottom: 20 }}>
                  Directly modify a user's subscription access. This action overrides the payment gateway and is permanently audited.
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  {/* GRANT FORM */}
                  <div style={{ padding: 20, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}><Gift size={16}/> Grant Premium Access</h4>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setIsSubmitting(true);
                      const formData = new FormData(e.currentTarget);
                      try {
                        const res = await import('../../../services/premiumService').then(m => m.grantSubscription(
                          formData.get('userId') as string,
                          {
                            plan_id: Number(formData.get('planId')),
                            duration_days: Number(formData.get('durationDays')),
                            reason: formData.get('grantReason') as string,
                            conflict_strategy: formData.get('conflictResolution') as string
                          }
                        ));
                        (e.target as HTMLFormElement).reset();
                        showToast('Subscription granted successfully');
                      } catch (err: any) {
                        showToast('Error granting subscription: ' + err.message, 'error');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Target User ID or Email</label>
                        <input name="userId" type="text" required placeholder="e.g. 42 or user@example.com" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Subscription Plan</label>
                        <select name="planId" required style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                          <option value="">-- Select a Plan --</option>
                          {plans.map(p => <option key={p.id} value={p.id}>{p.name} ({p.plan_code})</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Duration (Days)</label>
                        <input name="durationDays" type="number" required defaultValue={30} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Conflict Resolution</label>
                        <select name="conflictResolution" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                          <option value="REJECT">Reject if active sub exists</option>
                          <option value="EXTEND">Extend existing active sub</option>
                          <option value="REPLACE">Replace existing active sub</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Reason for Grant (Audit)</label>
                        <input name="grantReason" type="text" required placeholder="e.g. Customer support - refund" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                      </div>
                      <button type="submit" style={{ marginTop: 8, background: '#10b981', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>Grant Access</button>
                    </form>
                  </div>

                  {/* REVOKE FORM */}
                  <div style={{ padding: 20, background: '#fff0f2', borderRadius: 8, border: '1px solid #ffe4e6' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#e11d48', display: 'flex', alignItems: 'center', gap: 6 }}><XCircle size={16}/> Revoke Premium Access</h4>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      setIsSubmitting(true);
                      try {
                        const res = await import('../../../services/premiumService').then(m => m.revokeSubscription(
                          formData.get('revokeUserId') as string,
                          { reason: formData.get('revokeReason') }
                        ));
                        (e.target as HTMLFormElement).reset();
                        showToast('Subscription revoked successfully');
                      } catch (err: any) {
                        showToast('Error revoking subscription: ' + err.message, 'error');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500, color: '#be123c' }}>Target User ID or Email</label>
                        <input name="revokeUserId" type="text" required placeholder="e.g. 42 or user@example.com" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #fecdd3' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, marginBottom: 4, fontWeight: 500, color: '#be123c' }}>Reason for Revocation (Audit)</label>
                        <input name="revokeReason" type="text" required placeholder="e.g. Violation of terms" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #fecdd3' }} />
                      </div>
                      <button type="submit" style={{ marginTop: 8, background: '#e11d48', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>Force Revoke Access</button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* AUDIT VIEW */}
            {activeSubTab === 'audit' && (
              <div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Subscription Audit Logs</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: 12 }}>Timestamp</th>
                      <th style={{ padding: 12 }}>Action</th>
                      <th style={{ padding: 12 }}>Admin ID</th>
                      <th style={{ padding: 12 }}>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: 12, color: '#64748b' }}>{new Date(l.created_at).toLocaleString()}</td>
                        <td style={{ padding: 12, fontWeight: 500 }}>{l.action_type}</td>
                        <td style={{ padding: 12 }}>{l.actor_admin_id}</td>
                        <td style={{ padding: 12 }}>
                          {l.target_user_id && `User: ${l.target_user_id} `}
                          {l.target_plan_id && `Plan: ${l.target_plan_id} `}
                          {l.target_offer_id && `Offer: ${l.target_offer_id} `}
                          {l.target_subscription_id && `Sub: ${l.target_subscription_id}`}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>No logs found.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* CREATE PLAN MODAL */}
      {showPlanModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Create Subscription Plan</h3>
              <button onClick={() => setShowPlanModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              const formData = new FormData(e.currentTarget);
              try {
                const res = await import('../../../services/premiumService').then(m => m.createPlan({
                  plan_code: formData.get('planCode') as string,
                  name: formData.get('name') as string,
                  price_cents: Number(formData.get('price')),
                  currency: formData.get('currency') as string,
                  billing_interval: formData.get('interval') as string,
                  display_order: Number(formData.get('order')),
                  is_active: formData.get('isActive') === 'on'
                }));
                setShowPlanModal(false);
                showToast('Plan created successfully');
                loadData();
              } catch (err: any) {
                showToast('Error creating plan: ' + err.message, 'error');
              } finally {
                setIsSubmitting(false);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Plan Code (e.g. PRO_MONTHLY)</label>
                <input name="planCode" type="text" required style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Name</label>
                <input name="name" type="text" required style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Price (Cents)</label>
                  <input name="price" type="number" required defaultValue={999} style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Currency</label>
                  <input name="currency" type="text" required defaultValue="INR" style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Interval</label>
                  <select name="interval" required style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }}>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                    <option value="LIFETIME">Lifetime</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Display Order</label>
                  <input name="order" type="number" required defaultValue={10} style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input name="isActive" type="checkbox" defaultChecked id="planActive" />
                <label htmlFor="planActive" style={{ fontSize: 13 }}>Set as Active immediately</label>
              </div>
              <button type="submit" style={{ marginTop: 16, background: '#2563eb', color: '#fff', border: 'none', padding: '10px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>Save Plan</button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DISCOUNT MODAL */}
      {showDiscountModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Create Discount Offer</h3>
              <button onClick={() => setShowDiscountModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>&times;</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              const formData = new FormData(e.currentTarget);
              try {
                const res = await import('../../../services/premiumService').then(m => m.createDiscount({
                  name: formData.get('name') as string,
                  code: formData.get('code') as string || undefined,
                  discount_type: formData.get('type') as string,
                  value: formData.get('value') as string,
                  max_redemptions: formData.get('maxUses') ? Number(formData.get('maxUses')) : undefined,
                  is_public: formData.get('isPublic') === 'on',
                  is_active: true,
                  valid_from: new Date().toISOString()
                }));
                setShowDiscountModal(false);
                showToast('Discount created successfully');
                loadData();
              } catch (err: any) {
                showToast('Error creating discount: ' + err.message, 'error');
              } finally {
                setIsSubmitting(false);
              }
            }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Offer Name</label>
                <input name="name" type="text" required placeholder="e.g. Summer Sale 2026" style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Promo Code (Optional)</label>
                <input name="code" type="text" placeholder="e.g. SUMMER20" style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Discount Type</label>
                  <select name="type" required style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }}>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED_AMOUNT">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Value</label>
                  <input name="value" type="text" required placeholder="e.g. 20" style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>Max Total Redemptions (Optional)</label>
                <input name="maxUses" type="number" placeholder="Leave empty for unlimited" style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input name="isPublic" type="checkbox" defaultChecked id="discountPublic" />
                <label htmlFor="discountPublic" style={{ fontSize: 13 }}>Make Public (users can see it)</label>
              </div>
              <button type="submit" style={{ marginTop: 16, background: '#2563eb', color: '#fff', border: 'none', padding: '10px', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}>Create Offer</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { AdminApprovalRequest } from '../../types/auth';
import { ShieldCheck, UserX, RefreshCw, Clock, Building, Mail } from 'lucide-react';

interface PendingApprovalsTabProps {
  requests: AdminApprovalRequest[];
  loading: boolean;
  processingId: number | string | null;
  onApprove: (id: number | string, name: string) => void;
  onReject: (id: number | string, name: string) => void;
  onRefresh: () => void;
}

export function PendingApprovalsTab({
  requests,
  loading,
  processingId,
  onApprove,
  onReject,
  onRefresh,
}: PendingApprovalsTabProps) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 0,
        padding: 32,
        boxShadow: '0 12px 36px -10px rgba(15, 29, 56, 0.08)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              Candidate Registration Queue
            </h2>
            {requests.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 0,
                  background: 'rgba(249, 115, 22, 0.12)',
                  color: '#F47B35',
                  border: '1px solid rgba(249, 115, 22, 0.25)',
                }}
              >
                {requests.length} Pending
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>
            Review registered administrator access requests and approve or reject applications.
          </p>
        </div>

        <button
          onClick={onRefresh}
          style={{
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 0,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-body)',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-card)';
            e.currentTarget.style.borderColor = 'var(--text-subtle)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-body)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading candidate applications...
        </div>
      ) : requests.length === 0 ? (
        <div
          style={{
            padding: '56px 24px',
            textAlign: 'center',
            background: 'var(--bg-body)',
            borderRadius: 0,
            border: '1px border-dashed var(--border-color)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>
            All Candidate Registrations Processed!
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6, maxWidth: 400, margin: '6px auto 0 auto' }}>
            There are currently no candidates waiting for Super Admin authorization review.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {requests.map((req) => (
            <div
              key={req.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-body)',
                border: '1px solid var(--border-color)',
                borderRadius: 0,
                padding: '24px 28px',
                gap: 20,
                flexWrap: 'wrap',
                position: 'relative',
                boxShadow: '0 4px 16px -4px rgba(15, 29, 56, 0.04)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.3)';
                e.currentTarget.style.boxShadow = '0 8px 24px -6px rgba(15, 29, 56, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = '0 4px 16px -4px rgba(15, 29, 56, 0.04)';
              }}
            >
              <div style={{ minWidth: 260, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                    {req.full_name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#E31B23',
                      background: 'rgba(227, 27, 35, 0.1)',
                      padding: '3px 12px',
                      borderRadius: 0,
                      fontWeight: 600,
                      border: '1px solid rgba(227, 27, 35, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Mail size={12} />
                    {req.email}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12.5, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  {req.organization_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building size={14} color="var(--text-subtle)" />
                      <span>{req.organization_name} {req.department ? `(${req.department})` : ''}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} color="var(--text-subtle)" />
                    <span>Applied {new Date(req.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => onReject(req.id, req.full_name)}
                  disabled={processingId === req.id}
                  style={{
                    padding: '9px 18px',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 0,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid rgba(227, 27, 35, 0.3)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(227, 27, 35, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <UserX size={15} />
                  <span>Reject</span>
                </button>

                <button
                  onClick={() => onApprove(req.id, req.full_name)}
                  disabled={processingId === req.id}
                  style={{
                    padding: '9px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 0,
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #3A8B53 0%, #3A8B53 100%)',
                    border: '1px solid #3A8B53',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.35)';
                  }}
                >
                  <ShieldCheck size={16} />
                  <span>{processingId === req.id ? 'Processing...' : 'Approve Admin'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

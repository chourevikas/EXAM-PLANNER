import React from 'react';
import { AdminApprovalRequest } from '../../types/auth';

interface PendingApprovalsTabProps {
  requests: AdminApprovalRequest[];
  loading: boolean;
  processingId: string | null;
  onApprove: (id: string, name: string) => void;
  onReject: (id: string, name: string) => void;
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
        borderRadius: 20,
        padding: 32,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Pending Admin Approvals
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            Review newly registered admin accounts requiring Super Admin clearance.
          </p>
        </div>
        <button onClick={onRefresh} className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading pending admin applications...
        </div>
      ) : requests.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            borderRadius: 16,
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
            All Pending Requests Cleared!
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            There are currently no admin registrations waiting for review.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {requests.map((req) => (
            <div
              key={req.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 16,
                padding: 24,
                gap: 20,
                flexWrap: 'wrap',
                position: 'relative',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
                    {req.full_name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--royal)',
                      background: 'rgba(37, 99, 235, 0.12)',
                      padding: '2px 10px',
                      borderRadius: 99,
                      fontWeight: 600,
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                    }}
                  >
                    {req.email}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Organization: <strong style={{ color: 'var(--text-main)' }}>{req.organization_name || 'Unspecified'}</strong> • Dept: <strong style={{ color: 'var(--text-main)' }}>{req.department || 'Unspecified'}</strong>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 6 }}>
                  Submitted on {new Date(req.created_at).toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => onReject(req.id, req.full_name)}
                  disabled={processingId === req.id}
                  className="btn btn-ghost"
                  style={{
                    padding: '9px 18px',
                    fontSize: 13,
                    color: '#EF4444',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={() => onApprove(req.id, req.full_name)}
                  disabled={processingId === req.id}
                  className="btn btn-primary"
                  style={{
                    padding: '9px 22px',
                    fontSize: 13,
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    borderColor: 'var(--emerald)',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  {processingId === req.id ? 'Processing...' : 'Approve Admin'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

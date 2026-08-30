import React from 'react';
import { AdminApprovalLog } from '../../types/auth';
import { RefreshCw } from 'lucide-react';

interface AuditLogsTabProps {
  logs: AdminApprovalLog[];
  loading: boolean;
  onRefresh: () => void;
}

export function AuditLogsTab({ logs, loading, onRefresh }: AuditLogsTabProps) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              Approval Audit Trail
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 0,
                background: 'rgba(227, 27, 35, 0.12)',
                color: '#E31B23',
                border: '1px solid rgba(227, 27, 35, 0.25)',
              }}
            >
              {logs.length} Entries
            </span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>
            Immutable event stream of Super Admin access approvals and rejection decisions.
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
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading audit trail...
        </div>
      ) : logs.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: 'var(--bg-body)',
            borderRadius: 0,
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            No governance decisions or audit logs recorded yet.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 0, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '16px 20px' }}>Target Candidate / Admin</th>
                <th style={{ padding: '16px 20px' }}>Action Taken</th>
                <th style={{ padding: '16px 20px' }}>Reviewed By</th>
                <th style={{ padding: '16px 20px' }}>Reason / Decision Rationale</th>
                <th style={{ padding: '16px 20px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isApproved = log.action === 'APPROVED';

                const actionBg = isApproved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(227, 27, 35, 0.12)';
                const actionColor = isApproved ? '#3A8B53' : '#ef4444';
                const actionBorder = isApproved ? 'rgba(16, 185, 129, 0.25)' : 'rgba(227, 27, 35, 0.25)';

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 14.5 }}>{log.admin_user_name}</div>
                      <div style={{ fontSize: 12.5, color: '#E31B23', fontWeight: 600, marginTop: 2 }}>{log.admin_user_email}</div>
                    </td>
                    <td style={{ padding: '18px 20px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '4px 12px',
                          borderRadius: 0,
                          color: actionColor,
                          background: actionBg,
                          border: `1px solid ${actionBorder}`,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '18px 20px', fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                      {log.reviewed_by_name || 'System Super Admin'}
                    </td>
                    <td style={{ padding: '18px 20px', fontSize: 13, color: 'var(--text-muted)', maxWidth: 300 }}>
                      {log.reason ? (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-main)' }}>"{log.reason}"</span>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)' }}>Standard approval routine</span>
                      )}
                    </td>
                    <td style={{ padding: '18px 20px', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

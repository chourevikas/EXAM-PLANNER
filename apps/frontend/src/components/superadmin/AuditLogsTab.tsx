import React from 'react';
import { AdminApprovalLog } from '../../types/auth';

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
        borderRadius: 20,
        padding: 32,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Approval Audit Trail
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            Immutable history of Super Admin approval and rejection decisions.
          </p>
        </div>
        <button onClick={onRefresh} className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>
          🔄 Refresh Logs
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading audit logs...
        </div>
      ) : logs.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            borderRadius: 16,
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            No approval or rejection log entries recorded yet.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 18px' }}>Target Admin User</th>
                <th style={{ padding: '14px 18px' }}>Action Taken</th>
                <th style={{ padding: '14px 18px' }}>Reviewed By</th>
                <th style={{ padding: '14px 18px' }}>Reason / Rationale</th>
                <th style={{ padding: '14px 18px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isApproved = log.action === 'APPROVED';
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{log.admin_user_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--royal)', fontWeight: 600 }}>{log.admin_user_email}</div>
                    </td>
                    <td style={{ padding: '16px 18px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 99,
                          color: isApproved ? 'var(--emerald)' : '#EF4444',
                          background: isApproved ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${isApproved ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '16px 18px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {log.reviewed_by_name}
                    </td>
                    <td style={{ padding: '16px 18px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {log.reason || '—'}
                    </td>
                    <td style={{ padding: '16px 18px', color: 'var(--text-muted)', fontSize: 13 }}>
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

import { RefreshCw } from 'lucide-react';
import { AdminActionLogEntry } from '../../services/adminService';

interface ActivityLogTabProps {
  logs: AdminActionLogEntry[];
  loading: boolean;
  onRefresh: () => void;
}

const LABELS: Record<string, string> = {
  STAFF_CREATED: 'Staff user created',
  STAFF_CREDENTIALS_RESENT: 'Temporary password re-sent',
  ROLE_CHANGED: 'Role changed',
  USER_SUSPENDED: 'User suspended',
  USER_REACTIVATED: 'User reactivated',
  USER_DELETED: 'User deleted',
  SUPERADMIN_LOGIN: 'Super Admin signed in',
  SUPERADMIN_LOGIN_FAILED: 'Super Admin sign-in failed',
  LOGIN_LOCKED: 'Address locked after failed sign-ins',
  MFA_ENABLED: 'Authenticator enrolled',
  MFA_RESET: 'Authenticator reset by an operator',
  MFA_RECOVERY_CODE_USED: 'Recovery code used',
  PASSWORD_CHANGED: 'Password changed',
};

const ALARMING = new Set(['SUPERADMIN_LOGIN_FAILED', 'LOGIN_LOCKED', 'USER_DELETED', 'MFA_RECOVERY_CODE_USED', 'MFA_RESET']);

function describe(details: Record<string, unknown> | null): string {
  if (!details) return '';
  return Object.entries(details)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
    .join(' · ');
}

export function ActivityLogTab({ logs, loading, onRefresh }: ActivityLogTabProps) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: 32, boxShadow: '0 12px 36px -10px rgba(15, 29, 56, 0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>Activity Log</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Who created, changed, suspended or deleted accounts, and every Super Admin sign-in.
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{ padding: '9px 18px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {logs.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          {loading ? 'Loading…' : 'No activity recorded yet.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '10px 12px' }}>When</th>
                <th style={{ padding: '10px 12px' }}>Action</th>
                <th style={{ padding: '10px 12px' }}>By</th>
                <th style={{ padding: '10px 12px' }}>Target</th>
                <th style={{ padding: '10px 12px' }}>Details</th>
                <th style={{ padding: '10px 12px' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: ALARMING.has(log.action) ? 'var(--primary-red)' : 'var(--text-main)' }}>
                    {LABELS[log.action] || log.action}
                  </td>
                  <td style={{ padding: '12px' }}>{log.actor_email || '—'}</td>
                  <td style={{ padding: '12px' }}>{log.target_email || '—'}</td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{describe(log.details)}</td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{log.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { AdminApprovalRequest, UserStatus } from '../../types/auth';
import { Search, RefreshCw, UserCheck, UserX, Building, Mail, Clock } from 'lucide-react';

interface ActiveAdminsTabProps {
  admins: AdminApprovalRequest[];
  loading: boolean;
  processingId: string | null;
  onSuspend: (id: string, name: string) => void;
  onReactivate: (id: string, name: string) => void;
  onRefresh: () => void;
}

export function ActiveAdminsTab({
  admins,
  loading,
  processingId,
  onSuspend,
  onReactivate,
  onRefresh,
}: ActiveAdminsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredAdmins = admins.filter(
    (a) =>
      a.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.organization_name && a.organization_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 28,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              Active & Approved Admins
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 0,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#3A8B53',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              {admins.length} Total
            </span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>
            Overview of approved organization leaders and content administrators.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-body)',
              border: '1px solid var(--border-color)',
              borderRadius: 0,
              padding: '8px 14px',
              width: 260,
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search name, email, org..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                color: 'var(--text-main)',
                fontFamily: 'Inter, sans-serif',
                width: '100%',
              }}
            />
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
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading active admins...
        </div>
      ) : filteredAdmins.length === 0 ? (
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
            No admin accounts found matching your search term.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 0, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '16px 20px' }}>Administrator</th>
                <th style={{ padding: '16px 20px' }}>Organization / Department</th>
                <th style={{ padding: '16px 20px' }}>Account Status</th>
                <th style={{ padding: '16px 20px' }}>Joined Date</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((admin) => {
                const isSuspended = admin.status === UserStatus.SUSPENDED;
                return (
                  <tr key={admin.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 15 }}>{admin.full_name}</div>
                      <div style={{ fontSize: 12.5, color: '#E31B23', fontWeight: 600, marginTop: 2 }}>{admin.email}</div>
                    </td>
                    <td style={{ padding: '18px 20px' }}>
                      {admin.organization_name ? (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 13.5 }}>{admin.organization_name}</div>
                          {admin.department && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{admin.department}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12.5, color: 'var(--text-subtle)' }}>Individual Admin</span>
                      )}
                    </td>
                    <td style={{ padding: '18px 20px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 12px',
                          borderRadius: 0,
                          color: isSuspended ? '#ef4444' : '#3A8B53',
                          background: isSuspended ? 'rgba(227, 27, 35, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          border: `1px solid ${isSuspended ? 'rgba(227, 27, 35, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 0, background: isSuspended ? '#ef4444' : '#3A8B53' }} />
                        {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '18px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {new Date(admin.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                      {isSuspended ? (
                        <button
                          onClick={() => onReactivate(admin.id, admin.full_name)}
                          disabled={processingId === admin.id}
                          style={{
                            padding: '7px 14px',
                            fontSize: 12.5,
                            fontWeight: 600,
                            borderRadius: 0,
                            cursor: 'pointer',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#3A8B53',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <UserCheck size={14} />
                          <span>Reactivate</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onSuspend(admin.id, admin.full_name)}
                          disabled={processingId === admin.id}
                          style={{
                            padding: '7px 14px',
                            fontSize: 12.5,
                            fontWeight: 600,
                            borderRadius: 0,
                            cursor: 'pointer',
                            background: 'rgba(227, 27, 35, 0.08)',
                            border: '1px solid rgba(227, 27, 35, 0.25)',
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <UserX size={14} />
                          <span>Suspend</span>
                        </button>
                      )}
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

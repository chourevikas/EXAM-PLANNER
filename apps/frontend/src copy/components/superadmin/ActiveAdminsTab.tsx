import React, { useState } from 'react';
import { AdminApprovalRequest, UserStatus } from '../../types/auth';

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
        borderRadius: 20,
        padding: 32,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Active & Approved Admins
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            Overview of approved organization leaders and content administrators.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name, email, or coaching..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-body)',
              color: 'var(--text-main)',
              fontSize: 13,
              outline: 'none',
              width: 260,
            }}
          />
          <button onClick={onRefresh} className="btn btn-ghost" style={{ padding: '9px 16px', fontSize: 13 }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading active admins...
        </div>
      ) : filteredAdmins.length === 0 ? (
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
            No admin users found matching your search.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 18px' }}>Admin Name</th>
                <th style={{ padding: '14px 18px' }}>Organization / Dept</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px' }}>Joined Date</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdmins.map((admin) => {
                const isSuspended = admin.status === UserStatus.SUSPENDED;
                return (
                  <tr key={admin.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{admin.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--royal)', fontWeight: 600 }}>{admin.email}</div>
                    </td>
                    <td style={{ padding: '16px 18px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{admin.organization_name || 'Individual'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{admin.department || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '16px 18px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 99,
                          color: isSuspended ? '#EF4444' : 'var(--emerald)',
                          background: isSuspended ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          border: `1px solid ${isSuspended ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                        }}
                      >
                        {admin.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 18px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {new Date(admin.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px 18px', textAlign: 'right' }}>
                      {isSuspended ? (
                        <button
                          onClick={() => onReactivate(admin.id, admin.full_name)}
                          disabled={processingId === admin.id}
                          className="btn btn-ghost"
                          style={{ padding: '6px 14px', fontSize: 12, color: 'var(--emerald)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => onSuspend(admin.id, admin.full_name)}
                          disabled={processingId === admin.id}
                          className="btn btn-ghost"
                          style={{ padding: '6px 14px', fontSize: 12, color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                        >
                          Suspend
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

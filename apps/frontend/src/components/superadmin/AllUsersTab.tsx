import React, { useState } from 'react';
import { UserDirectoryItem, UserRole, UserStatus, Role } from '../../types/auth';
import { Search, RefreshCw, Users, Shield, GraduationCap, UserCheck, ChevronDown } from 'lucide-react';

interface AllUsersTabProps {
  users: UserDirectoryItem[];
  loading: boolean;
  onRefresh: () => void;
  onRoleChange: (userId: number | string, newRole: string, userName: string) => void;
  onRoleAssignment?: (userId: number | string, roleId: number, userName: string) => void;
  assignableRoles?: Role[];
  onSuspend?: (userId: number | string, userName: string) => void;
  onReactivate?: (userId: number | string, userName: string) => void;
}

export function AllUsersTab({ users, loading, onRefresh, onRoleChange, onRoleAssignment, assignableRoles = [], onSuspend, onReactivate }: AllUsersTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.organization_name && u.organization_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.target_exam && u.target_exam.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const studentsCount = users.filter((u) => u.role === UserRole.STUDENT).length;
  const adminsCount = users.filter((u) => u.role === UserRole.ADMIN).length;
  const superAdminsCount = users.filter((u) => u.role === UserRole.SUPER_ADMIN).length;

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return { bg: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', border: 'rgba(124, 58, 237, 0.25)' };
      case UserRole.ADMIN:
        return { bg: 'rgba(249, 115, 22, 0.12)', color: '#F47B35', border: 'rgba(249, 115, 22, 0.25)' };
      default:
        return { bg: 'rgba(var(--primary-red-rgb), 0.12)', color: 'var(--primary-red)', border: 'rgba(var(--primary-red-rgb), 0.25)' };
    }
  };

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
      {/* Top Header & Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              All Platform Users & Roles
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 0,
                background: 'rgba(var(--primary-red-rgb), 0.12)',
                color: 'var(--primary-red)',
                border: '1px solid rgba(var(--primary-red-rgb), 0.25)',
              }}
            >
              {users.length} Total Users
            </span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>
            Comprehensive directory of all registered candidates, admins, and system super administrators.
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
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* Role Breakdown Badges */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div
          onClick={() => setRoleFilter('ALL')}
          style={{
            padding: '8px 16px',
            borderRadius: 0,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            background: roleFilter === 'ALL' ? 'var(--text-main)' : 'var(--bg-body)',
            color: roleFilter === 'ALL' ? 'var(--bg-card)' : 'var(--text-main)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Users size={14} />
          <span>All ({users.length})</span>
        </div>

        <div
          onClick={() => setRoleFilter(UserRole.STUDENT)}
          style={{
            padding: '8px 16px',
            borderRadius: 0,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            background: roleFilter === UserRole.STUDENT ? 'rgba(var(--primary-red-rgb), 0.2)' : 'var(--bg-body)',
            color: roleFilter === UserRole.STUDENT ? 'var(--primary-red)' : 'var(--text-main)',
            border: `1px solid ${roleFilter === UserRole.STUDENT ? 'var(--primary-red)' : 'var(--border-color)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <GraduationCap size={14} />
          <span>Students ({studentsCount})</span>
        </div>

        <div
          onClick={() => setRoleFilter(UserRole.ADMIN)}
          style={{
            padding: '8px 16px',
            borderRadius: 0,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            background: roleFilter === UserRole.ADMIN ? 'rgba(249, 115, 22, 0.2)' : 'var(--bg-body)',
            color: roleFilter === UserRole.ADMIN ? '#ea580c' : 'var(--text-main)',
            border: `1px solid ${roleFilter === UserRole.ADMIN ? '#ea580c' : 'var(--border-color)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Shield size={14} />
          <span>Admins ({adminsCount})</span>
        </div>

        <div
          onClick={() => setRoleFilter(UserRole.SUPER_ADMIN)}
          style={{
            padding: '8px 16px',
            borderRadius: 0,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            background: roleFilter === UserRole.SUPER_ADMIN ? 'rgba(124, 58, 237, 0.2)' : 'var(--bg-body)',
            color: roleFilter === UserRole.SUPER_ADMIN ? '#7c3aed' : 'var(--text-main)',
            border: `1px solid ${roleFilter === UserRole.SUPER_ADMIN ? '#7c3aed' : 'var(--border-color)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>👑 Super Admins ({superAdminsCount})</span>
        </div>
      </div>

      {/* Search Input Filter */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-body)',
            border: '1px solid var(--border-color)',
            borderRadius: 0,
            padding: '10px 16px',
            maxWidth: 400,
          }}
        >
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by name, email, exam, organization..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 13.5,
              color: 'var(--text-main)',
              fontFamily: 'Inter, sans-serif',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Table Data View */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading user directory...
        </div>
      ) : filteredUsers.length === 0 ? (
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
            No users found matching your search or role filter criteria.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 0, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '16px 20px' }}>User Details</th>
                <th style={{ padding: '16px 20px' }}>Assigned Role</th>
                <th style={{ padding: '16px 20px' }}>Account Status</th>
                <th style={{ padding: '16px 20px' }}>Profile Information</th>
                <th style={{ padding: '16px 20px' }}>Joined Date</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions & Role</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const roleStyle = getRoleBadgeStyle(u.role);
                const isSuspended = u.status === UserStatus.SUSPENDED;

                // Cooling period math (7 days = 7 * 24 * 60 * 60 * 1000 ms)
                const suspTime = u.suspended_at || u.updated_at;
                const suspDate = suspTime ? new Date(suspTime) : null;
                const msElapsed = suspDate ? Date.now() - suspDate.getTime() : 0;
                const daysElapsed = suspDate ? msElapsed / (1000 * 60 * 60 * 24) : 0;
                const isCoolingExpired = isSuspended && daysElapsed >= 7;
                const daysRemaining = Math.max(1, Math.ceil(7 - daysElapsed));

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}>
                    {/* User Details */}
                    <td style={{ padding: '18px 20px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 14.5 }}>{u.full_name}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--primary-red)', fontWeight: 600, marginTop: 2 }}>{u.email}</div>
                    </td>

                    {/* Role Badge */}
                    <td style={{ padding: '18px 20px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '4px 12px',
                          borderRadius: 0,
                          color: roleStyle.color,
                          background: roleStyle.bg,
                          border: `1px solid ${roleStyle.border}`,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {u.role === UserRole.SUPER_ADMIN ? '👑 SUPER ADMIN' : u.role}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '18px 20px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 0,
                          color: isSuspended ? '#ef4444' : u.status === UserStatus.PENDING ? '#F47B35' : '#3A8B53',
                          background: isSuspended ? 'rgba(var(--primary-red-rgb), 0.12)' : u.status === UserStatus.PENDING ? 'rgba(249, 115, 22, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          border: `1px solid ${isSuspended ? 'rgba(var(--primary-red-rgb), 0.25)' : u.status === UserStatus.PENDING ? 'rgba(249, 115, 22, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                        }}
                      >
                        {isCoolingExpired ? 'EXPIRED (7d+)' : u.status}
                      </span>
                    </td>

                    {/* Profile Information */}
                    <td style={{ padding: '18px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {u.role === UserRole.STUDENT ? (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {u.target_exam || 'UPSC CSE'} {u.target_year || '2026'}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>Aspirant Candidate</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {u.organization_name || 'System Admin'}
                          </div>
                          {u.department && <div style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{u.department}</div>}
                        </div>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td style={{ padding: '18px 20px', fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    {/* Manage Role Selector & Suspend / Reactivate Controls */}
                    <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <select
                          value={u.custom_role_id ? `role:${u.custom_role_id}` : u.role}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.startsWith('role:')) {
                              const roleId = Number(val.slice(5));
                              onRoleAssignment && onRoleAssignment(u.id, roleId, u.full_name);
                            } else {
                              onRoleChange(u.id, val, u.full_name);
                            }
                          }}
                          style={{
                            padding: '6px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 0,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-body)',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        >
                          <optgroup label="Standard Roles">
                            <option value={UserRole.STUDENT}>STUDENT</option>
                            <option value={UserRole.ADMIN}>ADMIN</option>
                            <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN</option>
                          </optgroup>
                          {assignableRoles.length > 0 && (
                            <optgroup label="Custom & Teacher Roles">
                              {assignableRoles.map((role) => (
                                <option key={role.id} value={`role:${role.id}`}>
                                  {role.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>

                        {u.role !== UserRole.SUPER_ADMIN && (
                          isSuspended ? (
                            isCoolingExpired ? (
                              <span
                                title="Cooling period of 7 days has expired. This account can no longer be reactivated; the email is available for fresh signup."
                                style={{
                                  padding: '6px 10px',
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  borderRadius: 0,
                                  border: '1px solid rgba(100, 116, 139, 0.3)',
                                  background: 'rgba(100, 116, 139, 0.1)',
                                  color: '#64748b',
                                }}
                              >
                                🔒 Cooling Expired
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onReactivate && onReactivate(u.id, u.full_name)}
                                title={`Cooling period active (${daysRemaining}d remaining). Click to reactivate.`}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  borderRadius: 0,
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  color: '#3A8B53',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                ⚡ Reactivate ({daysRemaining}d left)
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSuspend && onSuspend(u.id, u.full_name)}
                              title="Suspend user account and trigger 7-day cooling period"
                              style={{
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 700,
                                borderRadius: 0,
                                border: '1px solid rgba(var(--primary-red-rgb), 0.3)',
                                background: 'rgba(var(--primary-red-rgb), 0.12)',
                                color: '#ef4444',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              🛑 Suspend
                            </button>
                          )
                        )}
                      </div>
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

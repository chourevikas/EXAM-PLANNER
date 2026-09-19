import React, { useEffect, useState } from 'react';
import { Shield, RefreshCw, Plus, Pencil, Trash2, X, Lock } from 'lucide-react';
import { Permission, Role } from '../../types/auth';
import { fetchRoles, fetchPermissions, createRole, updateRole, deleteRole } from '../../services/rolesService';

const CUSTOM_ROLE_BASE_TYPES = ['ADMIN', 'TEACHER'];

export function RolesPermissionsTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);
  const [editorRole, setEditorRole] = useState<Role | 'new' | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesData, permsData] = await Promise.all([fetchRoles(), fetchPermissions()]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load roles & permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDelete = async (role: Role) => {
    if (!window.confirm(`Delete role "${role.name}"? Users assigned to it must be reassigned first.`)) return;
    try {
      await deleteRole(role.id);
      showToast(`Deleted role "${role.name}"`);
      load();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete role', true);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
            Roles & Permissions
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0 0' }}>
            Create custom roles (e.g. Sub Admin) based on Admin or Teacher access, and control exactly which permissions they carry.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={load}
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
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setEditorRole('new')}
            style={{
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 0,
              border: '1px solid var(--primary-red)',
              background: 'var(--primary-red)',
              color: 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Plus size={14} />
            <span>Create Role</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 0,
            fontSize: 13.5,
            fontWeight: 600,
            background: toast.isError ? 'rgba(var(--primary-red-rgb), 0.12)' : 'rgba(16, 185, 129, 0.12)',
            color: toast.isError ? 'var(--primary-red)' : '#3A8B53',
            border: `1px solid ${toast.isError ? 'rgba(var(--primary-red-rgb), 0.3)' : 'rgba(16,185,129,0.3)'}`,
          }}
        >
          {toast.text}
        </div>
      )}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 0,
            background: 'rgba(var(--primary-red-rgb), 0.1)',
            color: 'var(--primary-red)',
            border: '1px solid rgba(var(--primary-red-rgb), 0.25)',
            fontSize: 13.5,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
          Loading roles...
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 0, border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg-body)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '16px 20px' }}>Role</th>
                <th style={{ padding: '16px 20px' }}>Base Access</th>
                <th style={{ padding: '16px 20px' }}>Permissions</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Shield size={15} color="var(--primary-red)" />
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{role.name}</span>
                      {role.is_system && (
                        <span
                          title="System role — base access is fixed"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 8px',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-body)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <Lock size={10} /> SYSTEM
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{role.description}</div>
                    )}
                  </td>
                  <td style={{ padding: '18px 20px' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '4px 12px',
                        borderRadius: 0,
                        color: '#F47B35',
                        background: 'rgba(249, 115, 22, 0.12)',
                        border: '1px solid rgba(249, 115, 22, 0.25)',
                      }}
                    >
                      {role.base_role_type}
                    </span>
                  </td>
                  <td style={{ padding: '18px 20px', fontSize: 13, color: 'var(--text-muted)' }}>
                    {role.permission_keys.length === 0 ? 'None' : `${role.permission_keys.length} granted`}
                  </td>
                  <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setEditorRole(role)}
                        disabled={role.is_system && false}
                        style={{
                          padding: '7px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 0,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-body)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Pencil size={12} />
                        <span>{role.is_system ? 'View' : 'Edit'}</span>
                      </button>
                      {!role.is_system && (
                        <button
                          onClick={() => handleDelete(role)}
                          style={{
                            padding: '7px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 0,
                            border: '1px solid rgba(var(--primary-red-rgb), 0.3)',
                            background: 'rgba(var(--primary-red-rgb), 0.1)',
                            color: 'var(--primary-red)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorRole && (
        <RoleEditorModal
          role={editorRole === 'new' ? null : editorRole}
          permissions={permissions}
          onClose={() => setEditorRole(null)}
          onSaved={(msg) => {
            showToast(msg);
            setEditorRole(null);
            load();
          }}
          onError={(msg) => showToast(msg, true)}
        />
      )}
    </div>
  );
}

function RoleEditorModal({
  role,
  permissions,
  onClose,
  onSaved,
  onError,
}: {
  role: Role | null;
  permissions: Permission[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const isSystem = !!role?.is_system;
  const [name, setName] = useState(role?.name || '');
  const [baseRoleType, setBaseRoleType] = useState(role?.base_role_type || 'ADMIN');
  const [description, setDescription] = useState(role?.description || '');
  const [selectedKeys, setSelectedKeys] = useState<string[]>(role?.permission_keys || []);
  const [submitting, setSubmitting] = useState(false);

  const togglePermission = (key: string) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    if (isSystem || !name.trim()) return;
    setSubmitting(true);
    try {
      if (role) {
        await updateRole(role.id, { name: name.trim(), description: description.trim() || undefined, permission_keys: selectedKeys });
        onSaved(`Updated role "${name.trim()}"`);
      } else {
        await createRole({ name: name.trim(), base_role_type: baseRoleType, description: description.trim() || undefined, permission_keys: selectedKeys });
        onSaved(`Created role "${name.trim()}"`);
      }
    } catch (err: any) {
      onError(err.message || 'Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-modal-card" style={{ maxWidth: 480, padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            {role ? (isSystem ? 'View Role' : 'Edit Role') : 'Create Role'}
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {isSystem && (
          <div style={{ marginBottom: 14, fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={12} /> This is a system role — its name and base access cannot be changed.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Role Name {!isSystem && '*'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSystem}
              placeholder="e.g. Sub Admin"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13.5,
                borderRadius: 0,
                border: '1px solid var(--border-color)',
                background: isSystem ? 'var(--bg-body)' : '#fff',
                color: 'var(--text-main)',
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {!role && (
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Base Access *
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                {CUSTOM_ROLE_BASE_TYPES.map((type) => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input type="radio" name="base-role-type" checked={baseRoleType === type} onChange={() => setBaseRoleType(type)} />
                    {type}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 4 }}>
                Determines which dashboard and coarse routes this role lands on. Super Admin access cannot be granted via a custom role.
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSystem}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: 13.5,
                borderRadius: 0,
                border: '1px solid var(--border-color)',
                background: isSystem ? 'var(--bg-body)' : '#fff',
                color: 'var(--text-main)',
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
              Permissions
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {permissions.map((perm) => (
                <label key={perm.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, cursor: isSystem ? 'default' : 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(perm.key)}
                    disabled={isSystem}
                    onChange={() => togglePermission(perm.key)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{perm.label}</span>
                    {perm.description && (
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>{perm.description}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {!isSystem && (
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || submitting}
              style={{
                marginTop: 4,
                padding: '11px 20px',
                fontSize: 13.5,
                fontWeight: 700,
                borderRadius: 0,
                border: '1px solid var(--primary-red)',
                background: !name.trim() || submitting ? 'rgba(var(--primary-red-rgb), 0.4)' : 'var(--primary-red)',
                color: 'var(--bg-card)',
                cursor: !name.trim() || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Saving...' : role ? 'Save Changes' : 'Create Role'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Role } from '../../types/auth';
import { StaffCreatePayload } from '../../services/adminService';

interface CreateStaffModalProps {
  isOpen: boolean;
  customRoles: Role[];
  onClose: () => void;
  onCreate: (payload: StaffCreatePayload) => Promise<void>;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-main)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  height: 42,
  padding: '0 12px',
  border: '1.5px solid var(--border-color)',
  borderRadius: 'var(--radius)',
  background: '#fff',
  color: 'var(--text-main)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

export function CreateStaffModal({ isOpen, customRoles, onClose, onCreate }: CreateStaffModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'TEACHER'>('ADMIN');
  const [customRoleId, setCustomRoleId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // A sub-admin's custom role must have the same base type as the account being created.
  const matchingRoles = customRoles.filter((r) => r.base_role_type === role && !r.is_system);

  const reset = () => {
    setFullName('');
    setEmail('');
    setRole('ADMIN');
    setCustomRoleId('');
    setError('');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onCreate({
        full_name: fullName.trim(),
        email: email.trim(),
        role,
        custom_role_id: customRoleId ? Number(customRoleId) : null,
      });
      reset();
    } catch (err: any) {
      setError(err.message || 'Could not create the user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-staff-title"
      onClick={handleClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 300 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)', padding: 28 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <h2 id="create-staff-title" style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Create staff user
          </h2>
          <button type="button" onClick={handleClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
          They receive an email with a temporary password and must choose their own the first time they sign in.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="staff-name" style={labelStyle}>Full name</label>
            <input id="staff-name" required autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} style={fieldStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="staff-email" style={labelStyle}>Email</label>
            <input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="staff-role" style={labelStyle}>Role</label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as 'ADMIN' | 'TEACHER');
                setCustomRoleId('');
              }}
              style={fieldStyle}
            >
              <option value="ADMIN">Admin</option>
              <option value="TEACHER">Teacher</option>
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="staff-custom-role" style={labelStyle}>Custom role (optional)</label>
            <select id="staff-custom-role" value={customRoleId} onChange={(e) => setCustomRoleId(e.target.value)} style={fieldStyle}>
              <option value="">{role === 'ADMIN' ? 'Full admin access' : 'Standard teacher access'}</option>
              {matchingRoles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Pick a custom role to create a limited sub-admin.
            </div>
          </div>

          {error && (
            <div role="alert" style={{ padding: '10px 14px', background: 'rgba(var(--primary-red-rgb), 0.1)', border: '1px solid rgba(var(--primary-red-rgb), 0.3)', borderRadius: 'var(--radius)', marginBottom: 14, fontSize: 13, color: 'var(--primary-red)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={handleClose} disabled={saving} style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              id="staff-create-submit"
              type="submit"
              disabled={saving || !fullName.trim() || !email.trim()}
              style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary-red)', color: '#fff', cursor: saving ? 'wait' : 'pointer', opacity: saving || !fullName.trim() || !email.trim() ? 0.6 : 1 }}
            >
              {saving ? 'Creating…' : 'Create & email password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

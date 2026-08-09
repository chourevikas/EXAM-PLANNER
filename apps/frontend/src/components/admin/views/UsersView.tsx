import React, { useEffect, useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { fetchAllUsers } from '../../../services/adminService';
import { User } from '../../../types/auth';

export function UsersView() {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchAllUsers();
      setUsersList(data);
    } catch (err: any) {
      console.error('Failed to load user directory:', err);
      setErrorMsg(err.message || 'Could not load users from database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 32, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} />
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-main)', margin: 0 }}>
                User & Admin Directory
              </h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
              Live database directory of student accounts and administrative permissions.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10, color: 'var(--royal)' }}>
            <Loader2 className="animate-spin" size={24} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Loading users from database...</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                {['User Name', 'Email', 'Role', 'Status', 'Verified', 'Created At'].map((h) => (
                  <th key={h} style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                    No user accounts found in the database.
                  </td>
                </tr>
              ) : (
                usersList.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px', fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{u.full_name}</td>
                    <td style={{ padding: '14px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{u.email}</td>
                    <td style={{ padding: '14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: u.role === 'SUPER_ADMIN' ? 'rgba(124, 58, 237, 0.12)' : u.role === 'ADMIN' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(16, 185, 129, 0.12)', color: u.role === 'SUPER_ADMIN' ? '#7c3aed' : u.role === 'ADMIN' ? '#2563eb' : '#10b981', padding: '3px 10px', borderRadius: 99 }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '14px', fontSize: 13, fontWeight: 600, color: u.status === 'ACTIVE' ? '#10b981' : '#f59e0b' }}>
                      {u.status}
                    </td>
                    <td style={{ padding: '14px', fontSize: 13, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                      {u.is_verified ? 'Yes ✅' : 'No ❌'}
                    </td>
                    <td style={{ padding: '14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

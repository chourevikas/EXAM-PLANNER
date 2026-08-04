import React from 'react';
import { Users, Shield, Award, Search, UserCheck } from 'lucide-react';

export function UsersView() {
  const usersList = [
    { name: 'Aarav Sharma', email: 'aarav@gmail.com', role: 'Student', plan: 'Premium Pass', tests: 42, joined: 'Jun 2026' },
    { name: 'Priya Verma', email: 'priya@gmail.com', role: 'Student', plan: 'Free Tier', tests: 8, joined: 'Jul 2026' },
    { name: 'Neeraj Admin', email: 'neeraj@gmail.com', role: 'Content Admin', plan: 'Admin Access', tests: 0, joined: 'Jan 2026' },
  ];

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
              Manage student accounts, role permissions, and active test series enrollments.
            </p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              {['User', 'Email', 'Role', 'Subscription Plan', 'Mock Tests Attempted', 'Joined Date'].map((h) => (
                <th key={h} style={{ padding: '12px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usersList.map((u, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '14px', fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{u.name}</td>
                <td style={{ padding: '14px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{u.email}</td>
                <td style={{ padding: '14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', padding: '3px 10px', borderRadius: 99 }}>{u.role}</span>
                </td>
                <td style={{ padding: '14px', fontSize: 13, fontWeight: 600, color: '#10b981' }}>{u.plan}</td>
                <td style={{ padding: '14px', fontSize: 13, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{u.tests}</td>
                <td style={{ padding: '14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{u.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

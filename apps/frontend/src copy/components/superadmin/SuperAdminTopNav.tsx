import React from 'react';
import { Search, Bell, Shield, Moon, Sun, ChevronRight, Database } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { SuperAdminTab } from './SuperAdminTabNav';

interface SuperAdminTopNavProps {
  activeTab: SuperAdminTab;
  onNavigate: (tab: SuperAdminTab) => void;
}

const breadcrumbMap: Record<SuperAdminTab, string[]> = {
  pending: ['Super Admin', 'Admin Approvals', 'Pending Requests'],
  active: ['Super Admin', 'User Management', 'Active Admins'],
  audit: ['Super Admin', 'Governance', 'Audit Logs'],
  diagnostics: ['Super Admin', 'Infrastructure', 'System Diagnostics'],
};

export function SuperAdminTopNav({ activeTab, onNavigate }: SuperAdminTopNavProps) {
  const { theme, toggleTheme } = useTheme();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const crumbs = breadcrumbMap[activeTab] ?? ['Super Admin'];

  return (
    <header
      style={{
        height: 56,
        background: 'var(--bg-card, #fff)',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        {crumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <ChevronRight size={12} color="var(--text-muted, #94a3b8)" />}
            <span
              style={{
                fontSize: 13,
                color: i === crumbs.length - 1 ? 'var(--text-main, #0f172a)' : 'var(--text-muted, #94a3b8)',
                fontWeight: i === crumbs.length - 1 ? 600 : 400,
                fontFamily: 'var(--font-body)',
              }}
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-secondary, #f1f5f9)',
          borderRadius: 8,
          padding: '6px 12px',
          width: 240,
        }}
      >
        <Search size={14} color="var(--text-muted, #94a3b8)" />
        <input
          placeholder="Search admins, emails, logs..."
          style={{
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: 13,
            color: 'var(--text-main, #334155)',
            fontFamily: 'var(--font-body)',
            width: '100%',
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted, #cbd5e1)',
            fontFamily: 'var(--font-mono)',
            background: 'var(--border-color, #e2e8f0)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          ⌘K
        </span>
      </div>

      {/* RDS Database Status Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 99,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          fontSize: 12,
          fontWeight: 700,
          color: '#10b981',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <Database size={13} />
        <span>RDS Live</span>
      </div>

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        title="Toggle Theme"
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          border: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-card, #fff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-main)',
        }}
      >
        {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
      </button>

      {/* Bell Notification */}
      <div style={{ position: 'relative' }}>
        <button
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-card, #fff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted, #64748b)',
          }}
        >
          <Bell size={15} />
        </button>
        <span
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#ef4444',
            border: '1.5px solid #fff',
          }}
        />
      </div>

      {/* Super Admin Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f97316, #ea580c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        SA
      </div>
    </header>
  );
}

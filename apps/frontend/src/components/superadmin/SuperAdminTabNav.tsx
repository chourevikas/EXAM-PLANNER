import React from 'react';

export type SuperAdminTab = 'pending' | 'active' | 'audit' | 'diagnostics';

interface SuperAdminTabNavProps {
  activeTab: SuperAdminTab;
  onTabChange: (tab: SuperAdminTab) => void;
  pendingCount: number;
}

export function SuperAdminTabNav({ activeTab, onTabChange, pendingCount }: SuperAdminTabNavProps) {
  const tabs: { id: SuperAdminTab; label: string; icon: string; count?: number }[] = [
    { id: 'pending', label: 'Pending Approvals', icon: '⏳', count: pendingCount },
    { id: 'active', label: 'Manage Active Admins', icon: '👥' },
    { id: 'audit', label: 'Approval Audit Logs', icon: '📜' },
    { id: 'diagnostics', label: 'System Diagnostics', icon: '⚡' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        background: 'var(--bg-secondary)',
        padding: 6,
        borderRadius: 16,
        border: '1px solid var(--border-color)',
        marginBottom: 28,
        overflowX: 'auto',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              minWidth: 160,
              padding: '12px 18px',
              borderRadius: 12,
              border: 'none',
              background: isActive
                ? 'linear-gradient(135deg, var(--royal) 0%, var(--royal-hover) 100%)'
                : 'transparent',
              color: isActive ? '#ffffff' : 'var(--text-muted)',
              fontWeight: isActive ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: isActive ? '0 4px 14px rgba(37, 99, 235, 0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                style={{
                  background: isActive ? '#ffffff' : 'var(--saffron)',
                  color: isActive ? 'var(--royal)' : '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 99,
                  marginLeft: 4,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

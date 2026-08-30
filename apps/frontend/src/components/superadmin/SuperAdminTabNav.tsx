import { ShieldAlert, Users, History, UserCheck, MessageSquareQuote, KeyRound } from 'lucide-react';

export type SuperAdminTab = 'pending' | 'active' | 'audit' | 'users' | 'testimonials' | 'roles-permissions';

interface SuperAdminTabNavProps {
  activeTab: SuperAdminTab;
  onTabChange: (tab: SuperAdminTab) => void;
  pendingCount: number;
  pendingTestimonialsCount?: number;
}

export function SuperAdminTabNav({ activeTab, onTabChange, pendingCount, pendingTestimonialsCount }: SuperAdminTabNavProps) {
  const tabs: { id: SuperAdminTab; label: string; icon: any; count?: number }[] = [
    { id: 'pending', label: 'Pending Approvals', icon: ShieldAlert, count: pendingCount },
    { id: 'active', label: 'Manage Active Admins', icon: Users },
    { id: 'audit', label: 'Approval Audit Logs', icon: History },
    { id: 'users', label: 'All Users & Roles', icon: UserCheck },
    { id: 'roles-permissions', label: 'Roles & Permissions', icon: KeyRound },
    { id: 'testimonials', label: 'Testimonial Approvals', icon: MessageSquareQuote, count: pendingTestimonialsCount },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        background: 'var(--bg-card)',
        padding: 6,
        borderRadius: 0,
        border: '1px solid var(--border-color)',
        marginBottom: 28,
        overflowX: 'auto',
        boxShadow: '0 4px 20px -5px rgba(15, 29, 56, 0.05)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              minWidth: 170,
              padding: '12px 20px',
              borderRadius: 0,
              border: 'none',
              background: isActive
                ? 'linear-gradient(135deg, #0F1D38 0%, #1B3864 100%)'
                : 'transparent',
              color: isActive ? '#ffffff' : 'var(--text-muted)',
              fontWeight: isActive ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: isActive ? '0 6px 20px rgba(15, 29, 56, 0.25)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.color = 'var(--text-main)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            <Icon size={17} color={isActive ? '#F47B35' : 'var(--text-muted)'} />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                style={{
                  background: isActive ? '#F47B35' : 'rgba(249, 115, 22, 0.15)',
                  color: isActive ? '#ffffff' : '#F47B35',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 0,
                  marginLeft: 4,
                  border: isActive ? 'none' : '1px solid rgba(249, 115, 22, 0.3)',
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

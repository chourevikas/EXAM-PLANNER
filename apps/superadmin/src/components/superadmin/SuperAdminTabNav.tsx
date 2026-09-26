import { Users, History, UserCheck, MessageSquareQuote, KeyRound, ScrollText, Crown } from 'lucide-react';

export type SuperAdminTab = 'dashboard' | 'audit' | 'activity' | 'users' | 'testimonials' | 'roles-permissions' | 'premium';

interface SuperAdminTabNavProps {
  activeTab: SuperAdminTab;
  onTabChange: (tab: SuperAdminTab) => void;
  pendingTestimonialsCount?: number;
}

export function SuperAdminTabNav({ activeTab, onTabChange, pendingTestimonialsCount }: SuperAdminTabNavProps) {
  const tabs: { id: SuperAdminTab; label: string; icon: any; count?: number }[] = [
    { id: 'audit', label: 'Approval Audit Logs', icon: History },
    { id: 'users', label: 'All Users & Roles', icon: UserCheck },
    { id: 'roles-permissions', label: 'Roles & Permissions', icon: KeyRound },
    { id: 'testimonials', label: 'Testimonial Approvals', icon: MessageSquareQuote, count: pendingTestimonialsCount },
    { id: 'premium', label: 'Premium Management', icon: Crown },
    { id: 'activity', label: 'Activity Log', icon: ScrollText },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        background: 'var(--bg-card)',
        padding: 6,
        borderRadius: 'var(--radius)',
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
              borderRadius: 'var(--radius)',
              border: 'none',
              background: isActive
                ? 'linear-gradient(135deg, #0F1D38 0%, #1B3864 100%)'
                : 'transparent',
              color: isActive ? 'var(--bg-card)' : 'var(--text-muted)',
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
                  color: isActive ? 'var(--bg-card)' : '#F47B35',
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius)',
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

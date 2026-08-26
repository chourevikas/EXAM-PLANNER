import React, { useState, useEffect } from 'react';
import { Menu, ShieldAlert, Users, History } from 'lucide-react';
import { SuperAdminTab } from './SuperAdminTabNav';

interface SuperAdminSidebarProps {
  activeTab: SuperAdminTab;
  onNavigate: (tab: SuperAdminTab) => void;
  collapsed: boolean;
  onToggle: () => void;
  pendingCount: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function SuperAdminSidebar({
  activeTab,
  onNavigate,
  collapsed,
  onToggle,
  pendingCount,
  mobileOpen = false,
  onCloseMobile,
}: SuperAdminSidebarProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems: { id: SuperAdminTab; label: string; icon: any; badge?: number }[] = [
    { id: 'pending', label: 'Pending Approvals', icon: ShieldAlert, badge: pendingCount },
    { id: 'active', label: 'Active Admins', icon: Users },
    { id: 'audit', label: 'Approval Audit Logs', icon: History },
  ];

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            top: 60,
            background: 'rgba(16, 33, 61, 0.65)',
            backdropFilter: 'blur(2px)',
            zIndex: 110,
          }}
        />
      )}

      <aside
        style={{
          width: isMobile ? 260 : (collapsed ? 68 : 240),
          minWidth: isMobile ? 260 : (collapsed ? 68 : 240),
          background: 'linear-gradient(180deg, #0F1D38 0%, #14284C 40%, #1B3864 75%, #204278 100%)',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 60px)',
          position: 'fixed',
          top: 60,
          left: 0,
          bottom: 0,
          zIndex: 120,
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Section Header with Borderless Hamburger Button & MAIN NAVIGATION */}
        <div
          style={{
            padding: (collapsed && !isMobile) ? '14px 0' : '16px 16px 10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: (collapsed && !isMobile) ? 'center' : 'space-between',
          }}
        >
          {(!collapsed || isMobile) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={onToggle}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.75)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
                title="Toggle Sidebar Menu"
                aria-label="Toggle Sidebar Menu"
              >
                <Menu size={18} />
              </button>
              <span
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.45)',
                  letterSpacing: '0.08em',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Main Navigation
              </span>
            </div>
          ) : (
            <button
              onClick={onToggle}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.75)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
              title="Expand Sidebar Menu"
              aria-label="Expand Sidebar Menu"
            >
              <Menu size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 10px' }}>
          {navItems.map(({ icon: Icon, label, id, badge }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  onNavigate(id);
                  if (onCloseMobile) onCloseMobile();
                }}
                title={(collapsed && !isMobile) ? label : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: (collapsed && !isMobile) ? '10px 0' : '10px 14px',
                  justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
                  borderRadius: 6,
                  background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive && (!collapsed || isMobile) ? '3px solid #f97316' : '3px solid transparent',
                  color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  marginBottom: 4,
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                  }
                }}
              >
                <Icon size={17} color={isActive ? '#f97316' : 'rgba(255, 255, 255, 0.65)'} style={{ flexShrink: 0 }} />
                {(!collapsed || isMobile) && <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>}
                {(!collapsed || isMobile) && badge !== undefined && badge > 0 && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 99,
                      background: '#f97316',
                      color: '#ffffff',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

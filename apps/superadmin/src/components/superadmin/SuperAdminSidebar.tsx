import React, { useEffect } from 'react';
import { Menu, Users, History, UserCheck, MessageSquareQuote, KeyRound, ScrollText, X, Crown, Home } from 'lucide-react';
import { SuperAdminTab } from './SuperAdminTabNav';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface SuperAdminSidebarProps {
  activeTab: SuperAdminTab;
  onNavigate: (tab: SuperAdminTab) => void;
  collapsed: boolean;
  onToggle: () => void;
  pendingTestimonialsCount?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function SuperAdminSidebar({
  activeTab,
  onNavigate,
  collapsed,
  onToggle,
  pendingTestimonialsCount,
  mobileOpen = false,
  onCloseMobile,
}: SuperAdminSidebarProps) {
  const { isTabletOrBelow: isMobile } = useBreakpoint();

  // Escape key handler
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseMobile) {
        onCloseMobile();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && mobileOpen) {
      document.body.classList.add('scroll-lock');
    } else {
      document.body.classList.remove('scroll-lock');
    }
    return () => {
      document.body.classList.remove('scroll-lock');
    };
  }, [isMobile, mobileOpen]);

  const navItems: { id: SuperAdminTab; label: string; icon: any; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'audit', label: 'Approval Audit Logs', icon: History },
    { id: 'users', label: 'All Users & Roles', icon: UserCheck },
    { id: 'roles-permissions', label: 'Roles & Permissions', icon: KeyRound },
    { id: 'testimonials', label: 'Testimonial Approvals', icon: MessageSquareQuote, badge: pendingTestimonialsCount },
    { id: 'premium', label: 'Premium Management', icon: Crown },
    { id: 'activity', label: 'Activity Log', icon: ScrollText },
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
            background: 'rgba(23, 32, 51, 0.75)',
            backdropFilter: 'blur(2px)',
            zIndex: 110,
          }}
          aria-hidden="true"
        />
      )}

      <aside
        style={{
          width: isMobile ? 260 : (collapsed ? 68 : 240),
          minWidth: isMobile ? 260 : (collapsed ? 68 : 240),
          background: 'var(--deep-navy)',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100dvh - 60px)',
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
        role="navigation"
        aria-label="SuperAdmin Navigation"
      >
        {/* Section Header with Hamburger Button & MAIN NAVIGATION */}
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
                className="touch-target"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.75)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius)',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--bg-card)')}
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
                Super Admin
              </span>
            </div>
          ) : (
            <button
              onClick={onToggle}
              className="touch-target"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.75)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius)',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--bg-card)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
              title="Expand Sidebar Menu"
              aria-label="Expand Sidebar Menu"
            >
              <Menu size={18} />
            </button>
          )}

          {isMobile && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="touch-target"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', flex: 1, overflowY: 'auto' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  if (isMobile && onCloseMobile) {
                    onCloseMobile();
                  }
                }}
                className="touch-target"
                title={collapsed && !isMobile ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: (collapsed && !isMobile) ? '10px 0' : '10px 14px',
                  justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
                  borderRadius: 'var(--radius)',
                  background: isActive ? 'rgba(var(--primary-red-rgb), 0.15)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive && (!collapsed || isMobile) ? '3px solid var(--primary-red)' : '3px solid transparent',
                  color: isActive ? 'var(--bg-card)' : 'rgba(255, 255, 255, 0.65)',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                  width: '100%',
                  textAlign: 'left',
                  position: 'relative',
                  minHeight: 44,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = 'var(--bg-card)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                  }
                }}
              >
                <Icon size={17} color={isActive ? 'var(--primary-red)' : 'rgba(255, 255, 255, 0.65)'} style={{ flexShrink: 0 }} />

                {(!collapsed || isMobile) && (
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                )}

                {/* Notification Badge */}
                {Boolean(item.badge && item.badge > 0) && (
                  <span
                    style={{
                      backgroundColor: 'var(--primary-red)',
                      color: 'var(--bg-card)',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: (collapsed && !isMobile) ? '2px 4px' : '2px 7px',
                      borderRadius: (collapsed && !isMobile) ? 0 : 0,
                      position: (collapsed && !isMobile) ? 'absolute' : 'static',
                      top: (collapsed && !isMobile) ? 4 : 'auto',
                      right: (collapsed && !isMobile) ? 8 : 'auto',
                    }}
                  >
                    {item.badge}
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

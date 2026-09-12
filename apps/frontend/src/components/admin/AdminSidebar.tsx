import React, { useEffect } from 'react';
import {
  Menu,
  LayoutDashboard,
  BookOpen,
  Upload,
  ClipboardCheck,
  GraduationCap,
  Users,
  BarChart2,
  Award,
  X,
  Globe,
  Sliders,
  Bell,
  Palette,
} from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface SidebarProps {
  activeView: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onToggleSidebar?: () => void;
}

export function AdminSidebar({
  activeView,
  onNavigate,
  collapsed,
  mobileOpen = false,
  onCloseMobile,
  onToggleSidebar
}: SidebarProps) {
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

  const coreNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: Upload, label: 'Upload & Exam Pipeline', id: 'upload' },
    { icon: Sliders, label: 'Exam Types', id: 'exam-types' },
    { icon: ClipboardCheck, label: 'Question & Solution QA', id: 'review' },
    { icon: BookOpen, label: 'Question Bank Catalog', id: 'questions' },
    { icon: GraduationCap, label: 'Mock Tests', id: 'mock-tests' },
  ];

  const managementNavItems = [
    { icon: Users, label: 'Users', id: 'users' },
    { icon: Award, label: 'Teacher Rewards', id: 'teacher-rewards' },
    { icon: Globe, label: 'Current Affairs', id: 'current-affairs' },
    { icon: Bell, label: 'Notifications', id: 'notifications' },
    { icon: BarChart2, label: 'Reports & Analytics', id: 'analytics' },
    { icon: Palette, label: 'Theme', id: 'theme' },
  ];

  const renderNavItem = (item: { icon: any, label: string, id: string }) => {
    const isActive = activeView === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => {
          onNavigate(item.id);
          if (onCloseMobile) onCloseMobile();
        }}
        title={collapsed && !isMobile ? item.label : undefined}
        className="touch-target"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: (collapsed && !isMobile) ? '10px 0' : '10px 14px',
          justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
          borderRadius: 0,
          background: isActive ? 'rgba(var(--primary-red-rgb), 0.15)' : 'transparent',
          border: 'none',
          borderLeft: isActive && (!collapsed || isMobile) ? '3px solid var(--primary-red)' : '3px solid transparent',
          color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
          cursor: 'pointer',
          fontSize: 13.5,
          fontFamily: 'Inter, sans-serif',
          fontWeight: isActive ? 600 : 400,
          transition: 'all 0.15s ease',
          width: '100%',
          textAlign: 'left',
          whiteSpace: 'nowrap',
          minHeight: 44,
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
        <Icon size={17} color={isActive ? 'var(--primary-red)' : 'rgba(255, 255, 255, 0.65)'} style={{ flexShrink: 0 }} />
        {(!collapsed || isMobile) && <span>{item.label}</span>}
      </button>
    );
  };

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
            zIndex: 110
          }}
          aria-hidden="true"
        />
      )}

      <aside
        style={{
          width: isMobile ? 260 : (collapsed ? 68 : 240),
          minWidth: isMobile ? 260 : (collapsed ? 68 : 240),
          background: '#172033',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100dvh - 60px)',
          position: 'fixed',
          top: 60,
          left: 0,
          bottom: 0,
          zIndex: 120,
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s ease, min-width 0.2s ease',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden'
        }}
        role="navigation"
        aria-label="Admin Navigation"
      >
        {/* Section Header with Hamburger Button */}
        <div
          style={{
            padding: (collapsed && !isMobile) ? '14px 0' : '16px 16px 6px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: (collapsed && !isMobile) ? 'center' : 'space-between',
          }}
        >
          {(!collapsed || isMobile) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
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
                    borderRadius: 0,
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
                  title="Toggle Sidebar Menu"
                  aria-label="Toggle Sidebar Menu"
                >
                  <Menu size={18} />
                </button>
              )}
              <span
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.45)',
                  letterSpacing: '0.08em',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                CORE PLATFORM
              </span>
            </div>
          ) : (
            onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
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
                  borderRadius: 0,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
                title="Expand Sidebar Menu"
                aria-label="Expand Sidebar Menu"
              >
                <Menu size={18} />
              </button>
            )
          )}

          {isMobile && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="touch-target"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 10px', flex: 1, overflowY: 'auto' }}>
          {coreNavItems.map(renderNavItem)}

          {(!collapsed || isMobile) && (
            <div
              style={{
                margin: '18px 10px 6px 10px',
                fontSize: 11,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.45)',
                letterSpacing: '0.08em',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              MANAGEMENT & ANALYTICS
            </div>
          )}
          {managementNavItems.map(renderNavItem)}
        </nav>
      </aside>
    </>
  );
}

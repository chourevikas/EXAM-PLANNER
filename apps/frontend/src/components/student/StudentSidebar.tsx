import React, { useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  LayoutDashboard,
  Calendar,
  BookOpen,
  Brain,
  BarChart2,
  Trophy,
  Crown,
  X,
  Bookmark,
  Globe,
} from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface StudentSidebarProps {
  user?: any;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

export function StudentSidebar({
  user,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: StudentSidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const { isTabletOrBelow: isMobile } = useBreakpoint();

  // Close sidebar on Escape key
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: Globe, label: 'Current Affairs', to: '/current-affairs' },
    { icon: Calendar, label: 'Study Planner', to: '/study-planner' },
    { icon: BookOpen, label: 'PYQs Simulation', to: '/pyq' },
    { icon: Brain, label: 'Analyse & Practice PYQs', to: '/mocks' },
    { icon: BarChart2, label: 'Analytics', to: '/analytics' },
    { icon: Bookmark, label: 'Bookmarks', to: '/bookmarks' },
  ];

  const reportItems = [
    { icon: BarChart2, label: 'Weekly Insights', to: '/reports/weekly' },
    { icon: Trophy, label: 'Performance Rank', to: '/reports/monthly' },
  ];

  const isCollapsedDesktop = collapsed && !isMobile;

  const renderNavItem = (item: { icon: any; label: string; to: string }) => {
    const isActive = currentPath === item.to;
    const Icon = item.icon;

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onCloseMobile}
        title={isCollapsedDesktop ? item.label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: isCollapsedDesktop ? '10px 0' : '10px 14px',
          justifyContent: isCollapsedDesktop ? 'center' : 'flex-start',
          borderRadius: 0,
          textDecoration: 'none',
          fontSize: 13.5,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
          backgroundColor: isActive ? 'rgba(227, 27, 35, 0.15)' : 'transparent',
          borderLeft:
            isActive && !isCollapsedDesktop ? '3px solid #E31B23' : '3px solid transparent',
          transition: 'all 0.15s ease',
          position: 'relative',
          minHeight: 44 /* Touch target */,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = '#ffffff';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
          }
        }}
      >
        <Icon
          size={17}
          color={isActive ? '#E31B23' : 'rgba(255, 255, 255, 0.65)'}
          style={{ flexShrink: 0 }}
        />
        {!isCollapsedDesktop && <span>{item.label}</span>}
      </Link>
    );
  };

  // Build sidebar CSS class
  const sidebarClass = [
    'app-sidebar',
    isCollapsedDesktop ? 'collapsed' : '',
    isMobile && mobileOpen ? 'mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobile && mobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside
        className={sidebarClass}
        role="navigation"
        aria-label="Main navigation"
        aria-hidden={isMobile && !mobileOpen ? 'true' : undefined}
      >
        {/* Top Header Row with Borderless Hamburger Icon Button */}
        <div
          style={{
            padding: isCollapsedDesktop ? '14px 0' : '16px 16px 6px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsedDesktop ? 'center' : 'space-between',
          }}
        >
          {!isCollapsedDesktop ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={onToggleCollapse}
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
                title="Toggle Sidebar"
                aria-label="Toggle Sidebar"
              >
                <Menu size={18} />
              </button>

              <span
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.4)',
                  letterSpacing: '0.08em',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                }}
              >
                Main Navigation
              </span>
            </div>
          ) : (
            <button
              onClick={onToggleCollapse}
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
              title="Expand Sidebar"
              aria-label="Expand Sidebar"
            >
              <Menu size={18} />
            </button>
          )}

          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={onCloseMobile}
              className="touch-target"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                padding: 4,
              }}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Primary Nav Links */}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: isCollapsedDesktop ? '8px' : '0 12px',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {navItems.map(renderNavItem)}

          <div
            style={{
              margin: '16px 0 8px 0',
              padding: isCollapsedDesktop ? '0' : '0 8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: 16,
            }}
          >
            {!isCollapsedDesktop && (
              <span
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.4)',
                  letterSpacing: '0.08em',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                Performance Reports
              </span>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {reportItems.map(renderNavItem)}
            </div>
          </div>
        </nav>

        {/* Upgrade to PRO Box preserved at bottom */}
        {!isCollapsedDesktop && (
          <div style={{ padding: 12 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 0,
                background: '#111111',
                border: '1px solid #F2B623',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#F2B623',
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                <Crown size={16} /> Upgrade to PRO
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255, 255, 255, 0.7)',
                  margin: '0 0 10px 0',
                  lineHeight: 1.4,
                }}
              >
                Unlock AI insights, detailed analytics and unlimited test attempts.
              </p>
              <Link
                to="/pricing"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 0,
                  border: '1px solid #F2B623',
                  backgroundColor: 'transparent',
                  color: '#F2B623',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  minHeight: 44 /* Touch target */,
                }}
              >
                Explore PRO &rarr;
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

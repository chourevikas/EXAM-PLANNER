import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  BookOpen, 
  Brain, 
  BarChart2, 
  Sparkles, 
  Trophy, 
  X
} from 'lucide-react';

interface StudentSidebarProps {
  user: any;
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
  onCloseMobile 
}: StudentSidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: Calendar, label: 'Study Planner', to: '/study-planner' },
    { icon: BookOpen, label: 'Previous Year Qs', to: '/pyq' },
    { icon: Brain, label: 'Mock Tests', to: '/mocks' },
    { icon: BarChart2, label: 'Analytics', to: '/analytics' },
  ];

  const reportItems = [
    { icon: Sparkles, label: 'Weekly Insights', to: '/reports/weekly' },
    { icon: Trophy, label: 'Performance Rank', to: '/reports/monthly' },
  ];

  const renderNavItem = (item: { icon: any, label: string, to: string }) => {
    const isActive = currentPath === item.to;
    const Icon = item.icon;

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onCloseMobile}
        title={collapsed && !isMobile ? item.label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: (collapsed && !isMobile) ? '12px 0' : '12px 16px',
          justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
          borderRadius: 10,
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.7)',
          backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
          borderLeft: isActive && (!collapsed || isMobile) ? '3px solid #3b82f6' : '3px solid transparent',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
      >
        <Icon size={18} color={isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.7)'} />
        {(!collapsed || isMobile) && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            top: 60,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 110
          }}
        />
      )}

      {/* Clean Streamlined Sidebar Drawer Positioned Below Top Header */}
      <aside
        style={{
          width: isMobile ? 260 : (collapsed ? 68 : 240),
          minWidth: isMobile ? 260 : (collapsed ? 68 : 240),
          backgroundColor: '#0f1e3c',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 60px)',
          position: 'fixed',
          top: 60,
          left: 0,
          bottom: 0,
          zIndex: 120,
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s ease, min-width 0.25s ease',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.18)',
          overflow: 'hidden'
        }}
      >
        {/* Navigation Section Header */}
        <div
          style={{
            padding: (collapsed && !isMobile) ? '16px 0' : '20px 20px 8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: (collapsed && !isMobile) ? 'center' : 'space-between',
          }}
        >
          {(!collapsed || isMobile) ? (
            <span
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.45)',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)'
              }}
            >
              Main Navigation
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.3)', fontFamily: 'var(--font-mono)' }}>•••</span>
          )}

          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={onCloseMobile}
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
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px', flex: 1, overflowY: 'auto' }}>
          {navItems.map(renderNavItem)}

          {(!collapsed || isMobile) && (
            <div
              style={{
                margin: '20px 12px 8px 12px',
                fontSize: 11,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.45)',
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)'
              }}
            >
              Reports & Insights
            </div>
          )}
          {reportItems.map(renderNavItem)}
        </nav>
      </aside>
    </>
  );
}

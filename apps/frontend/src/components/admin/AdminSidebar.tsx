import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  Cpu,
  ClipboardCheck,
  GraduationCap,
  Users,
  BarChart2,
  Activity,
  X
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AdminSidebar({
  activeView,
  onNavigate,
  collapsed,
  mobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const coreNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: Activity, label: 'Exam Pipeline Status', id: 'pipeline-status' },
    { icon: BookOpen, label: 'Question Bank', id: 'questions' },
    { icon: Upload, label: 'Upload Question Paper', id: 'upload' },
    { icon: Cpu, label: 'AI Processing Queue', id: 'ai-queue' },
    { icon: ClipboardCheck, label: 'Question Review', id: 'review' },
    { icon: GraduationCap, label: 'Mock Tests', id: 'mock-tests' },
  ];

  const managementNavItems = [
    { icon: Users, label: 'Users', id: 'users' },
    { icon: BarChart2, label: 'Reports & Analytics', id: 'analytics' },
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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: (collapsed && !isMobile) ? '10px 0' : '10px 14px',
          justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
          borderRadius: 4,
          background: isActive ? 'rgba(59, 110, 168, 0.18)' : 'transparent',
          border: 'none',
          borderLeft: isActive && (!collapsed || isMobile) ? '3px solid #3B6EA8' : '3px solid transparent',
          color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
          cursor: 'pointer',
          fontSize: 13.5,
          fontFamily: 'Inter, sans-serif',
          fontWeight: isActive ? 600 : 400,
          transition: 'all 0.15s ease',
          width: '100%',
          textAlign: 'left',
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
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
        <Icon size={17} color={isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'} style={{ flexShrink: 0 }} />
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
            background: 'rgba(16, 33, 61, 0.65)',
            backdropFilter: 'blur(2px)',
            zIndex: 110
          }}
        />
      )}

      <aside
        style={{
          width: isMobile ? 260 : (collapsed ? 68 : 240),
          minWidth: isMobile ? 260 : (collapsed ? 68 : 240),
          backgroundColor: '#10213D',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 60px)',
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
      >
        {/* Section Header */}
        <div
          style={{
            padding: (collapsed && !isMobile) ? '16px 0' : '18px 18px 6px 18px',
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
                fontFamily: 'Inter, sans-serif'
              }}
            >
              CORE PLATFORM
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.3)' }}>•••</span>
          )}

          {isMobile && onCloseMobile && (
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
              <X size={16} />
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

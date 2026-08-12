import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  Cpu,
  ClipboardCheck,
  GraduationCap,
  BookMarked,
  Users,
  BarChart2,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Activity, label: 'Exam Pipeline Status', id: 'pipeline-status' },
  { icon: BookOpen, label: 'Question Bank', id: 'questions' },
  { icon: Upload, label: 'Upload Question Paper', id: 'upload' },
  { icon: Cpu, label: 'AI Processing Queue', id: 'ai-queue' },
  { icon: ClipboardCheck, label: 'Question Review', id: 'review' },
  { icon: GraduationCap, label: 'Mock Tests', id: 'mock-tests' },
  { icon: BookMarked, label: 'Learning Resources', id: 'resources' },
  { icon: Users, label: 'Users', id: 'users' },
  { icon: BarChart2, label: 'Reports & Analytics', id: 'analytics' },
  { icon: CreditCard, label: 'Subscriptions', id: 'subscriptions' },
];

interface SidebarProps {
  activeView: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ activeView, onNavigate, collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();

  return (
    <aside
      style={{
        width: collapsed ? 68 : 240,
        minWidth: collapsed ? 68 : 240,
        background: '#0f1e3c',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        transition: 'width 0.2s ease, min-width 0.2s ease',
        zIndex: 40,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? '20px 0' : '20px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 64,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: collapsed ? 18 : 0,
          }}
        >
          <Zap size={16} color="#fff" fill="#fff" />
        </div>
        {!collapsed && (
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 15,
                color: '#fff',
                lineHeight: 1.2,
              }}
            >
              UPSC Admin
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
              AI Platform
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        {navItems.map(({ icon: Icon, label, id }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={collapsed ? label : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '10px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? 'rgba(37,99,235,0.18)' : 'transparent',
                border: 'none',
                borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                color: isActive ? '#93c5fd' : 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
                fontSize: 13.5,
                fontFamily: 'var(--font-body)',
                fontWeight: isActive ? 500 : 400,
                transition: 'all 0.12s ease',
                borderRadius: 0,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
                }
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
        <button
          onClick={() => navigate('/signout')}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '10px 0' : '10px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            fontSize: 13.5,
            fontFamily: 'var(--font-body)',
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
          }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}
        </button>
        <button
          onClick={onToggle}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: collapsed ? '10px 0' : '10px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-body)',
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
          }}
        >
          {collapsed ? (
            <ChevronRight size={14} />
          ) : (
            <>
              <ChevronLeft size={14} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

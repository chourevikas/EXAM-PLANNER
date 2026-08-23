import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { logoutUser } from '../../services/authService';
import {
  ShieldAlert,
  Users,
  History,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Crown,
} from 'lucide-react';
import { SuperAdminTab } from './SuperAdminTabNav';

interface SuperAdminSidebarProps {
  activeTab: SuperAdminTab;
  onNavigate: (tab: SuperAdminTab) => void;
  collapsed: boolean;
  onToggle: () => void;
  pendingCount: number;
}

export function SuperAdminSidebar({
  activeTab,
  onNavigate,
  collapsed,
  onToggle,
  pendingCount,
}: SuperAdminSidebarProps) {
  const navigate = useNavigate();
  const clerk = useClerk();

  const navItems: { id: SuperAdminTab; label: string; icon: any; badge?: number }[] = [
    { id: 'pending', label: 'Pending Approvals', icon: ShieldAlert, badge: pendingCount },
    { id: 'active', label: 'Active Admins', icon: Users },
    { id: 'audit', label: 'Approval Audit Logs', icon: History },
  ];

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
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: collapsed ? 18 : 0,
          }}
        >
          <Crown size={16} color="#fff" fill="#fff" />
        </div>
        {!collapsed && (
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 15,
                color: '#fff',
                lineHeight: 1.2,
              }}
            >
              Super Admin
            </div>
            <div style={{ fontSize: 11, color: '#f97316', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              EXECUTIVE CONTROL
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        {navItems.map(({ icon: Icon, label, id, badge }) => {
          const isActive = activeTab === id;
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
                background: isActive ? 'rgba(249, 115, 22, 0.18)' : 'transparent',
                border: 'none',
                borderLeft: isActive ? '2px solid #f97316' : '2px solid transparent',
                color: isActive ? '#fdba74' : 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
                fontSize: 13.5,
                fontFamily: 'var(--font-body)',
                fontWeight: isActive ? 600 : 400,
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
              {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>}
              {!collapsed && badge !== undefined && badge > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 99,
                    background: '#f97316',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0' }}>
        <button
          onClick={async () => {
            logoutUser();
            if (clerk && clerk.signOut) {
              try {
                await clerk.signOut();
              } catch (e) {
                console.warn('Clerk signout error:', e);
              }
            }
            window.location.href = '/';
          }}
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

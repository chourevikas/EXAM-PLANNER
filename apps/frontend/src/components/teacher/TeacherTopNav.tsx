import React, { useState, useEffect, useRef } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { logoutUser } from '../../services/authService';
import { ChevronRight, User, LogOut } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface TeacherTopNavProps {
  user?: any;
  activeView: string;
  onNavigate: (id: string) => void;
  onToggleSidebar?: () => void;
}

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  review: 'Review Queue',
  points: 'My Points',
  rewards: 'My Rewards',
};

export function TeacherTopNav({ user, activeView, onNavigate }: TeacherTopNavProps) {
  const clerk = useClerk();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { isMobile, isSmallScreen } = useBreakpoint();
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentViewLabel = breadcrumbMap[activeView] || 'Dashboard';

  return (
    <header
      ref={headerRef}
      style={{
        height: 60,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 100,
        background: 'var(--deep-navy)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16 }}>
        <div
          onClick={() => onNavigate('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <img
            src="/logo.jpeg"
            alt="ExamPlanner"
            loading="lazy"
            decoding="async"
            style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
          />
          {!isSmallScreen && (
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--bg-card)', letterSpacing: '-0.01em', fontFamily: 'Inter, sans-serif' }}>
              ExamPlanner Teacher
            </span>
          )}
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 400 }}>Teacher</span>
            <ChevronRight size={13} color="rgba(255, 255, 255, 0.35)" />
            <span style={{ color: 'var(--bg-card)', fontWeight: 600 }}>{currentViewLabel}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="touch-target"
            style={{
              width: 32,
              height: 32,
              borderRadius: 0,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'var(--primary-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--bg-card)',
              padding: 0,
            }}
            title="User Menu"
            aria-label="User Menu"
          >
            {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'TC'}
          </button>

          {showProfileMenu && (
            <div
              className={isMobile ? 'popover-panel' : ''}
              style={{
                ...(isMobile ? {} : { position: 'absolute', top: 44, right: 0, width: 230 }),
                backgroundColor: 'var(--bg-card)',
                borderRadius: 0,
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
                padding: 12,
                zIndex: 140,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)' }}>
                  {user?.full_name || 'Teacher'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {user?.email || ''}
                </div>
              </div>

              <button
                onClick={() => {
                  onNavigate('dashboard');
                  setShowProfileMenu(false);
                }}
                className="touch-target"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 0,
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  transition: 'background-color 150ms ease-out',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <User size={15} color="var(--primary-red)" />
                <span>My Dashboard</span>
              </button>

              <div style={{ paddingTop: 6, borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={async () => {
                    setShowProfileMenu(false);
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
                  className="touch-target"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 0,
                    color: '#DC2626',
                    backgroundColor: '#FEF2F2',
                    fontSize: 12.5,
                    fontWeight: 600,
                    border: '1px solid #FECDCA',
                    cursor: 'pointer',
                    transition: 'background-color 150ms ease-out',
                  }}
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

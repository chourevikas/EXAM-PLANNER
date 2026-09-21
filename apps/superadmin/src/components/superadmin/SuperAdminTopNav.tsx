import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../services/authService';
import { getStoredUser } from '../../services/http';
import { Logo } from '../common/Logo';
import { Search, LogOut, User, X } from 'lucide-react';
import { SuperAdminTab } from './SuperAdminTabNav';
import { User as AppUser } from '../../types/auth';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface SuperAdminTopNavProps {
  activeTab: SuperAdminTab;
  onNavigate: (tab: SuperAdminTab) => void;
  onToggleSidebar?: () => void;
  onSignedOut: () => void;
}

export function SuperAdminTopNav({ activeTab, onNavigate, onToggleSidebar, onSignedOut }: SuperAdminTopNavProps) {
  const navigate = useNavigate();
  const user: Partial<AppUser> = getStoredUser() || {};
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const { isMobile, isSmallScreen } = useBreakpoint();

  // Close profile dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setShowProfileCard(false);
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProfileCard(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Extract initials helper
  const getInitials = (name?: string, email?: string): string => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'SA';
  };

  const userInitials = getInitials(user.full_name, user.email);

  const handleSignOut = async () => {
    await logout();
    onSignedOut();
    navigate('/login', { replace: true });
  };

  return (
    <header
      style={{
        height: 60,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        zIndex: 130,
        background: 'var(--deep-navy)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 12px' : '0 24px',
        boxSizing: 'border-box',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* 1. Left Section: Clean Brand Logo */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
        <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('users')}>
          <Logo inverted={true} />
        </div>
      </div>

      {/* 2. Center Section: Search Bar (Desktop) */}
      {!isSmallScreen && (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius)',
              padding: '7px 14px',
              width: isMobile ? 160 : 320,
            }}
          >
            <Search size={15} color="rgba(255, 255, 255, 0.45)" />
            <input
              type="text"
              placeholder="Search super admin..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--bg-card)',
                fontSize: 13,
                width: '100%',
              }}
            />
          </div>
        </div>
      )}

      {/* 3. Right Section: Profile & Actions */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', gap: 10 }} ref={cardRef}>
        {/* Mobile Search Icon */}
        {isSmallScreen && (
          <button
            type="button"
            onClick={() => setShowMobileSearch(true)}
            className="touch-target center-content"
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius)',
              padding: '2px 6px',
            }}
          >
            ⌘K
          </button>
        )}
    {/* Quick Admin Profile Button */}
    <button
      onClick={() => navigate('/change-password')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        fontSize: 12.5,
        fontWeight: 700,
        borderRadius: 'var(--radius)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        background: 'rgba(255, 255, 255, 0.1)',
        color: 'var(--bg-card)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
      }}
    >
      <User size={14} color="var(--bg-card)" />
      <span>Change password</span>
    </button>


    {/* Mobile Search Modal */}
    {isSmallScreen && showMobileSearch && (
      <div
        style={{
          position: 'absolute',
          top: 50,
          right: 0,
          width: 260,
          background: 'var(--bg-card, #ffffff)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 12px 32px rgba(15, 29, 56, 0.18)',
          padding: 16,
          zIndex: 200,
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* User Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius)',
              background: 'linear-gradient(135deg, #F47B35 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--bg-card)',
              fontSize: 15,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {userInitials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid #E2E8F0',
                fontSize: 14,
                outline: 'none',
                backgroundColor: 'var(--bg-subtle)',
                minHeight: 40,
              }}
            />
            <button
              type="button"
              onClick={() => setShowMobileSearch(false)}
              className="touch-target center-content"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 6,
              }}
              aria-label="Close search"
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { id: 'users' as SuperAdminTab, label: 'All Users & Roles' },
              { id: 'active' as SuperAdminTab, label: 'Active Admins' },
              { id: 'activity' as SuperAdminTab, label: 'Activity Log' },
              { id: 'audit' as SuperAdminTab, label: 'Approval Audit Logs' },
              { id: 'roles-permissions' as SuperAdminTab, label: 'Roles & Permissions' },
              { id: 'testimonials' as SuperAdminTab, label: 'Testimonial Approvals' },
            ]
              .filter(tab => tab.label.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    onNavigate(tab.id);
                    setShowMobileSearch(false);
                  }}
                  className="touch-target"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    border: 'none',
                    backgroundColor: 'var(--bg-subtle)',
                    color: 'var(--deep-navy)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    textAlign: 'left',
                    minHeight: 44,
                  }}
                >
                  {tab.label}
                </button>
              ))}
          </div>
        </div>
      </div>
    )}

    <div style={{ position: 'relative' }} ref={cardRef}>
      <button
        onClick={() => setShowProfileCard(!showProfileCard)}
        className="touch-target center-content"
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--primary-red)',
          border: '1.5px solid rgba(255, 255, 255, 0.25)',
          color: 'var(--bg-card)',
          fontSize: 13,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        }}
        title="Super Admin Profile"
        aria-label="Super Admin Profile"
      >
        {userInitials}
      </button>

      {showProfileCard && (
        <div
          className={isMobile ? 'popover-panel' : ''}
          style={{
            ...(isMobile ? {} : {
              position: 'absolute',
              top: 48,
              right: 0,
              width: 250,
            }),
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            border: '1px solid #E2E8F0',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
            padding: 14,
            zIndex: 140,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--deep-navy)' }}>
              {user.full_name || 'Super Administrator'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              {user.email || 'superadmin@examplanner.com'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              type="button"
              onClick={handleSignOut}
              className="touch-target"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius)',
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
    </header >
  );
}

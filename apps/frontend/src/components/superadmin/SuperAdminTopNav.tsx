import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { logoutUser } from '../../services/authService';
import { Logo } from '../common/Logo';
import { UserAvatar } from '../common/UserAvatar';
import { Search, LogOut, User } from 'lucide-react';
import { SuperAdminTab } from './SuperAdminTabNav';

interface SuperAdminTopNavProps {
  activeTab: SuperAdminTab;
  onNavigate: (tab: SuperAdminTab) => void;
  onToggleSidebar?: () => void;
}

export function SuperAdminTopNav({ activeTab, onNavigate, onToggleSidebar }: SuperAdminTopNavProps) {
  const navigate = useNavigate();
  const clerk = useClerk();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [showProfileCard, setShowProfileCard] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setShowProfileCard(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    logoutUser();
    if (clerk && clerk.signOut) {
      try {
        await clerk.signOut();
      } catch (e) {
        console.warn('Clerk signout error:', e);
      }
    }
    window.location.href = '/';
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
        background: '#172033',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        boxSizing: 'border-box',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* 1. Left Section: Clean Brand Logo */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
        <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('pending')}>
          <Logo inverted={true} />
        </div>
      </div>

      {/* 2. Center Section: Search Bar */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 0,
            padding: '7px 14px',
            width: 320,
            maxWidth: '100%',
            transition: 'all 0.2s ease',
            boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.4)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          <Search size={15} color="rgba(255, 255, 255, 0.55)" />
          <input
            placeholder="Search admins, logs, organizations..."
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 13,
              color: '#ffffff',
              fontFamily: 'Inter, sans-serif',
              width: '100%',
            }}
          />
          <span
            style={{
              fontSize: 10.5,
              color: 'rgba(255, 255, 255, 0.45)',
              fontFamily: 'monospace',
              background: 'rgba(255, 255, 255, 0.12)',
              borderRadius: 0,
              padding: '2px 6px',
            }}
          >
            ⌘K
          </span>
        </div>
      </div>

      {/* 3. Right Section: User Initial Avatar with Dropdown Card */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', position: 'relative', gap: 10 }} ref={cardRef}>
        {/* Quick Admin Profile Button */}
        <button
          onClick={() => navigate('/profile')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            borderRadius: 0,
            border: '1px solid rgba(255, 255, 255, 0.25)',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
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
          <User size={14} color="#ffffff" />
          <span>Admin Profile</span>
        </button>

        {/* User Initial Avatar Circle */}
        <button
          onClick={() => setShowProfileCard((prev) => !prev)}
          title="Super Admin Profile"
          aria-label="Super Admin Profile"
          style={{
            padding: 0,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <UserAvatar userOrImage={user} size={38} fullName={user?.full_name} />
        </button>

        {/* Floating Profile & Sign Out Dropdown Card */}
        {showProfileCard && (
          <div
            style={{
              position: 'absolute',
              top: 50,
              right: 0,
              width: 260,
              background: 'var(--bg-card, #ffffff)',
              borderRadius: 0,
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 12px 32px rgba(15, 29, 56, 0.18)',
              padding: 16,
              zIndex: 200,
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* User Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ flexShrink: 0 }}>
                <UserAvatar userOrImage={user} size={42} fullName={user?.full_name} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text-main, #172033)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.full_name || 'System Super Admin'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted, #64748b)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 2,
                  }}
                >
                  {user.email || 'superadmin@examplanner.com'}
                </div>
              </div>
            </div>

            {/* Role Badge */}
            <div style={{ marginBottom: 14 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 0,
                  background: 'rgba(249, 115, 22, 0.12)',
                  color: '#F47B35',
                  border: '1px solid rgba(249, 115, 22, 0.25)',
                  display: 'inline-block',
                }}
              >
                SUPER ADMIN
              </span>
            </div>

            <div style={{ height: 1, background: 'var(--border-color, #e2e8f0)', margin: '12px 0' }} />

            {/* Profile Page Action Button */}
            <button
              onClick={() => {
                setShowProfileCard(false);
                navigate('/profile');
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 0,
                border: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--bg-body, #f8fafc)',
                color: 'var(--text-main, #172033)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 8,
                marginBottom: 8,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-body, #f8fafc)';
              }}
            >
              <User size={15} />
              <span>Admin Profile</span>
            </button>

            {/* Sign Out Action Button */}
            <button
              onClick={handleSignOut}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 0,
                border: '1px solid rgba(227, 27, 35, 0.2)',
                background: 'rgba(227, 27, 35, 0.06)',
                color: '#ef4444',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(227, 27, 35, 0.06)';
                e.currentTarget.style.color = '#ef4444';
              }}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

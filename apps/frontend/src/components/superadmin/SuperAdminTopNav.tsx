import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { logoutUser } from '../../services/authService';
import { Logo } from '../common/Logo';
import { Search, LogOut, User, X } from 'lucide-react';
import { SuperAdminTab } from './SuperAdminTabNav';
import { useBreakpoint } from '../../hooks/useBreakpoint';

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
        padding: isMobile ? '0 12px' : '0 24px',
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
              borderRadius: 0,
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
                color: '#ffffff',
                fontSize: 13,
                width: '100%',
              }}
            />
          </div>
        </div>
      )}

      {/* 3. Right Section: Profile & Actions */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {/* Mobile Search Icon */}
        {isSmallScreen && (
          <button
            type="button"
            onClick={() => setShowMobileSearch(true)}
            className="touch-target center-content"
            style={{
              width: 36,
              height: 36,
              borderRadius: 0,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
            }}
            aria-label="Open search"
          >
            <Search size={16} />
          </button>
        )}

        {/* Mobile Search Modal */}
        {isSmallScreen && showMobileSearch && (
          <div
            className="auth-modal-overlay"
            onClick={() => setShowMobileSearch(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="auth-modal-card"
              style={{ maxWidth: 440, padding: 16 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Search size={16} color="#64748B" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search tabs, reviews, audits..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 0,
                    border: '1px solid #E2E8F0',
                    fontSize: 14,
                    outline: 'none',
                    backgroundColor: '#F8FAFC',
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
                    color: '#64748B',
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
                  { id: 'pending' as SuperAdminTab, label: 'Pending Question Approvals' },
                  { id: 'rejected' as SuperAdminTab, label: 'Rejected Questions' },
                  { id: 'audit' as SuperAdminTab, label: 'Audit Log' },
                  { id: 'analytics' as SuperAdminTab, label: 'Platform Analytics' },
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
                        borderRadius: 0,
                        border: 'none',
                        backgroundColor: '#F8FAFC',
                        color: '#172033',
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
              borderRadius: 0,
              backgroundColor: '#E31B23',
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
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
                backgroundColor: '#FFFFFF',
                borderRadius: 0,
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
                <div style={{ fontSize: 13, fontWeight: 700, color: '#172033' }}>
                  {user.full_name || 'Super Administrator'}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
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

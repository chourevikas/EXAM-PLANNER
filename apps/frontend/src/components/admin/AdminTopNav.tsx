import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { logoutUser } from '../../services/authService';
import {
  Search,
  Bell,
  ChevronRight,
  Upload,
  User,
  LogOut,
  CheckCheck,
  Activity,
  Cpu,
  ClipboardCheck,
  CreditCard,
  BarChart2,
  BookOpen,
  X
} from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { UserAvatar } from '../common/UserAvatar';

interface TopNavProps {
  user?: any;
  activeView: string;
  onNavigate: (id: string) => void;
  onToggleSidebar?: () => void;
}

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard Overview',
  'pipeline-status': 'Exam Pipeline Status',
  upload: 'Upload Question Paper',
  questions: 'Question Bank',
  'ai-queue': 'AI Processing Queue',
  review: 'Question Review',
  'mock-tests': 'Mock Tests',
  resources: 'Learning Resources',
  users: 'Users Management',
  'teacher-rewards': 'Teacher Rewards',
  analytics: 'Reports & Analytics',
  subscriptions: 'Subscriptions & Billing',
};

export function AdminTopNav({ user, activeView, onNavigate, onToggleSidebar }: TopNavProps) {
  const navigate = useNavigate();
  const clerk = useClerk();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const { isMobile, isSmallScreen } = useBreakpoint();

  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const currentViewLabel = breadcrumbMap[activeView] || 'Overview';

  const adminNotifications = [
    {
      id: 1,
      title: 'Question Extraction Complete',
      desc: '12 new questions extracted from UPSC 2023 Paper 1.',
      time: '10 mins ago',
      unread: true,
      icon: Cpu,
      color: '#3B6EA8',
      bg: 'rgba(59, 110, 168, 0.15)',
      targetView: 'ai-queue'
    },
    {
      id: 2,
      title: 'Pending Review Alert',
      desc: '8 questions awaiting verification in Question Review.',
      time: '45 mins ago',
      unread: true,
      icon: ClipboardCheck,
      color: '#B89B5E',
      bg: 'rgba(184, 155, 94, 0.15)',
      targetView: 'review'
    },
    {
      id: 3,
      title: 'Pipeline Sync Active',
      desc: 'Prelims 2026 dataset sync running smoothly.',
      time: '2 hours ago',
      unread: true,
      icon: Activity,
      color: '#3A8B53',
      bg: 'rgba(16, 185, 129, 0.15)',
      targetView: 'pipeline-status'
    }
  ];

  const quickSearchOptions = [
    { label: 'Upload Question Paper', id: 'upload', icon: Upload },
    { label: 'Question Bank Manager', id: 'questions', icon: BookOpen },
    { label: 'AI Processing Queue', id: 'ai-queue', icon: Cpu },
    { label: 'Question Review', id: 'review', icon: ClipboardCheck },
    { label: 'Platform Analytics', id: 'analytics', icon: BarChart2 },
    { label: 'Subscriptions Management', id: 'subscriptions', icon: CreditCard },
  ].filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase()));

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
        background: '#172033',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        boxSizing: 'border-box'
      }}
    >
      {/* Left: Brand Logo & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16 }}>
        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <img
            src="/logo.jpeg"
            alt="ExamPlanner"
            style={{
              width: 32,
              height: 32,
              objectFit: 'contain',
              flexShrink: 0
            }}
          />
          {!isSmallScreen && (
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: '#ffffff',
                letterSpacing: '-0.01em',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              ExamPlanner Admin
            </span>
          )}
        </div>

        {/* Breadcrumb Trail */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 400 }}>Admin</span>
            <ChevronRight size={13} color="rgba(255, 255, 255, 0.35)" />
            <span style={{ color: '#ffffff', fontWeight: 600 }}>
              {currentViewLabel}
            </span>
          </div>
        )}
      </div>

      {/* Center: Search Bar */}
      {!isSmallScreen && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 0,
            padding: '5px 10px',
            width: isMobile ? 140 : 250,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            transition: 'width 0.2s'
          }}
        >
          <Search size={14} color="rgba(255, 255, 255, 0.4)" />
          <input
            type="text"
            placeholder={isMobile ? "Search..." : "Search questions, papers..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 12,
              color: '#ffffff',
              width: '100%'
            }}
          />
          {!isMobile && (
            <span
              style={{
                fontSize: 10,
                color: 'rgba(255, 255, 255, 0.5)',
                fontFamily: 'monospace',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 0,
                padding: '1px 4px',
                fontWeight: 600
              }}
            >
              ⌘K
            </span>
          )}

          {searchQuery.trim().length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 40,
                left: 0,
                width: '100%',
                minWidth: 250,
                backgroundColor: '#10213D',
                borderRadius: 0,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                zIndex: 150,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}
            >
              {quickSearchOptions.length > 0 ? (
                quickSearchOptions.map(opt => {
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onNavigate(opt.id);
                        setSearchQuery('');
                      }}
                      className="touch-target"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 10px',
                        borderRadius: 0,
                        border: 'none',
                        background: 'transparent',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 110, 168, 0.2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <OptIcon size={14} color="#3B6EA8" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: '8px', fontSize: 12, color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center' }}>
                  No matching views found
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right: Search (mobile), Notifications & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, position: 'relative' }}>
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
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
                  placeholder="Search admin views, questions..."
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
                {quickSearchOptions.map(opt => {
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onNavigate(opt.id);
                        setSearchQuery('');
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
                        gap: 10,
                        textAlign: 'left',
                        minHeight: 44,
                      }}
                    >
                      <OptIcon size={16} color="#1E3A8A" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="touch-target"
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: 0,
              border: `1px solid ${showNotifications ? '#3B6EA8' : 'rgba(255, 255, 255, 0.12)'}`,
              backgroundColor: showNotifications ? 'rgba(59, 110, 168, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              transition: 'all 0.15s ease'
            }}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 6,
                  height: 6,
                  borderRadius: 0,
                  backgroundColor: '#ef4444'
                }}
              />
            )}
          </button>

          {showNotifications && (
            <div
              className={isMobile ? 'popover-panel' : ''}
              style={{
                ...(isMobile ? {} : {
                  position: 'absolute',
                  top: 44,
                  right: 0,
                  width: 320,
                }),
                backgroundColor: '#FFFFFF',
                borderRadius: 0,
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
                padding: 14,
                zIndex: 140,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>System Alerts</span>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 0, backgroundColor: '#F8FAFC', color: '#E31B23' }}>
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setUnreadCount(0)}
                  style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  <CheckCheck size={13} /> Clear
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                {adminNotifications.map(item => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.targetView);
                        setShowNotifications(false);
                      }}
                      style={{
                        padding: 10,
                        borderRadius: 0,
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                        transition: 'background-color 150ms ease-out',
                        minHeight: 44,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    >
                      <div style={{ padding: 6, borderRadius: 0, backgroundColor: item.bg, color: item.color, flexShrink: 0 }}>
                        <ItemIcon size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#172033', marginBottom: 2 }}>{item.title}</div>
                        <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.3 }}>{item.desc}</div>
                        <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 3 }}>{item.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="touch-target"
            style={{
              width: 32,
              height: 32,
              borderRadius: 0,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: '#E31B23',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: '#ffffff',
              padding: 0
            }}
            title="User Menu"
            aria-label="User Menu"
          >
            {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'AD'}
          </button>

          {showProfileMenu && (
            <div
              className={isMobile ? 'popover-panel' : ''}
              style={{
                ...(isMobile ? {} : {
                  position: 'absolute',
                  top: 44,
                  right: 0,
                  width: 230,
                }),
                backgroundColor: '#FFFFFF',
                borderRadius: 0,
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
                padding: 12,
                zIndex: 140,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#172033' }}>
                  {user?.full_name || 'System Administrator'}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                  {user?.email || 'admin@examplanner.com'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                    color: '#334155',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'background-color 150ms ease-out',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <User size={15} color="#E31B23" />
                  <span>Admin Overview</span>
                </button>

                <button
                  onClick={() => {
                    onNavigate('questions');
                    setShowProfileMenu(false);
                  }}
                  className="touch-target"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 0,
                    color: '#334155',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'background-color 150ms ease-out',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <BookOpen size={15} color="#E31B23" />
                  <span>Question Bank</span>
                </button>
              </div>

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

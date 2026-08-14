import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  ChevronRight,
  Shield,
  Upload,
  User,
  LogOut,
  CheckCheck,
  Activity,
  Cpu,
  ClipboardCheck,
  CreditCard,
  BarChart2,
  BookOpen
} from 'lucide-react';

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
  analytics: 'Reports & Analytics',
  subscriptions: 'Subscriptions & Billing',
};

export function AdminTopNav({ user, activeView, onNavigate, onToggleSidebar }: TopNavProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    }
    const handleResize = () => setWindowWidth(window.innerWidth);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 540;

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
      color: '#10b981',
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
        backgroundColor: '#10213D',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        boxSizing: 'border-box'
      }}
    >
      {/* Left: Hamburger Toggle, Brand Logo & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16 }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            title="Toggle Sidebar Menu"
            aria-label="Toggle Sidebar Menu"
          >
            <Menu size={16} />
          </button>
        )}

        {!isSmallMobile && <div style={{ width: 1, height: 18, backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />}

        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              background: '#3B6EA8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Shield size={16} color="#ffffff" />
          </div>
          {!isSmallMobile && (
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: '#ffffff',
                letterSpacing: '-0.01em',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              RankEdge Admin
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
      {!isSmallMobile && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 4,
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
                borderRadius: 3,
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
                borderRadius: 4,
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
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 10px',
                        borderRadius: 4,
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

      {/* Right: Notifications & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            style={{
              position: 'relative',
              width: 32,
              height: 32,
              borderRadius: 4,
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
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#ef4444'
                }}
              />
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 44,
                right: isMobile ? -60 : 0,
                width: isMobile ? 290 : 320,
                backgroundColor: '#10213D',
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                padding: 14,
                zIndex: 140,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>System Alerts</span>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, backgroundColor: 'rgba(59, 110, 168, 0.3)', color: '#ffffff' }}>
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setUnreadCount(0)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
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
                        padding: 8,
                        borderRadius: 4,
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ padding: 4, borderRadius: 3, backgroundColor: item.bg, color: item.color, flexShrink: 0 }}>
                        <ItemIcon size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 2 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)' }}>{item.desc}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.4)', marginTop: 2 }}>{item.time}</div>
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
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: '#3B6EA8',
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
          >
            {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'AD'}
          </button>

          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                width: 230,
                backgroundColor: '#10213D',
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                padding: 12,
                zIndex: 140,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>
                  {user?.full_name || 'System Administrator'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)' }}>
                  {user?.email || 'admin@rankedge.com'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button
                  onClick={() => {
                    onNavigate('dashboard');
                    setShowProfileMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 4,
                    color: 'rgba(255, 255, 255, 0.85)',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left'
                  }}
                >
                  <User size={14} color="#3B6EA8" />
                  <span>Admin Overview</span>
                </button>

                <button
                  onClick={() => {
                    onNavigate('questions');
                    setShowProfileMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 4,
                    color: 'rgba(255, 255, 255, 0.85)',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 12,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left'
                  }}
                >
                  <BookOpen size={14} color="#3B6EA8" />
                  <span>Question Bank</span>
                </button>
              </div>

              <div style={{ paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <Link
                  to="/signout"
                  onClick={() => setShowProfileMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '6px',
                    borderRadius: 4,
                    textDecoration: 'none',
                    color: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

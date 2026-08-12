import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu, 
  Search, 
  Bell, 
  ChevronRight, 
  Zap, 
  Upload, 
  User, 
  Settings, 
  LogOut, 
  CheckCheck, 
  Sparkles, 
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
      title: 'AI Processing Complete',
      desc: '12 new questions extracted from UPSC 2023 Paper 1.',
      time: '10 mins ago',
      unread: true,
      icon: Cpu,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.15)',
      targetView: 'ai-queue'
    },
    {
      id: 2,
      title: 'Pending Review Alert',
      desc: '8 questions awaiting verification in Question Review.',
      time: '45 mins ago',
      unread: true,
      icon: ClipboardCheck,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
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

  // Quick nav suggestions for admin search bar
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
        backgroundColor: '#0f1e3c',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        boxSizing: 'border-box'
      }}
    >
      {/* Left: Hamburger Toggle, Brand Logo & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16 }}>
        
        {/* Sidebar Toggle Button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
            title="Toggle Sidebar Menu"
            aria-label="Toggle Sidebar Menu"
          >
            <Menu size={18} />
          </button>
        )}

        {/* Divider */}
        {!isSmallMobile && <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />}

        {/* Brand Logo */}
        <div 
          onClick={() => onNavigate('dashboard')} 
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
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
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Zap size={17} color="#fff" fill="#fff" />
          </div>
          {!isSmallMobile && (
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 16,
                color: '#ffffff',
                letterSpacing: '-0.02em'
              }}
            >
              RankEdge Admin
            </span>
          )}
        </div>

        {/* Breadcrumb Trail */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.55)', fontWeight: 500 }}>Admin</span>
            <ChevronRight size={14} color="rgba(255, 255, 255, 0.4)" />
            <span style={{ color: '#ffffff', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
              {currentViewLabel}
            </span>
          </div>
        )}
      </div>

      {/* Center: Quick Search Bar */}
      {!isSmallMobile && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderRadius: 8,
            padding: '6px 10px',
            width: isMobile ? 150 : 260,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            transition: 'width 0.2s'
          }}
        >
          <Search size={14} color="rgba(255, 255, 255, 0.45)" />
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
              fontFamily: 'var(--font-body)',
              width: '100%'
            }}
          />
          {!isMobile && (
            <span
              style={{
                fontSize: 10,
                color: 'rgba(255, 255, 255, 0.6)',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(255, 255, 255, 0.12)',
                borderRadius: 4,
                padding: '2px 5px',
                fontWeight: 700
              }}
            >
              ⌘K
            </span>
          )}

          {/* Quick Search Suggestions Dropdown */}
          {searchQuery.trim().length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 44,
                left: 0,
                width: '100%',
                minWidth: 260,
                backgroundColor: '#0f1e3c',
                borderRadius: 10,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.5)',
                zIndex: 150,
                padding: 6,
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
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <OptIcon size={14} color="#60a5fa" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: '10px', fontSize: 12, color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center' }}>
                  No matching views found
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right: Notifications & Profile View */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, position: 'relative' }}>
        
        {/* Notifications Container */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            style={{
              position: 'relative',
              width: 34,
              height: 34,
              borderRadius: 8,
              border: `1px solid ${showNotifications ? '#3b82f6' : 'rgba(255, 255, 255, 0.12)'}`,
              backgroundColor: showNotifications ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              transition: 'all 0.2s ease'
            }}
            title="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: '#ef4444'
                }}
              />
            )}
          </button>

          {/* Floating Notifications Popover */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: isMobile ? -60 : 0,
                width: isMobile ? 300 : 340,
                backgroundColor: '#0f1e3c',
                borderRadius: 16,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.4)',
                padding: 16,
                zIndex: 140,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>System Alerts</span>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setUnreadCount(0)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <CheckCheck size={14} /> Read all
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
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
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ padding: 6, borderRadius: 8, backgroundColor: item.bg, color: item.color, flexShrink: 0 }}>
                        <ItemIcon size={15} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 2 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.4 }}>{item.desc}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.4)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{item.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  onNavigate('ai-queue');
                  setShowNotifications(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#60a5fa',
                  cursor: 'pointer',
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                View AI Queue Status →
              </button>
            </div>
          )}
        </div>

        {/* Profile Avatar & Quick Menu Container */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: `2px solid ${showProfileMenu ? '#60a5fa' : '#3b82f6'}`,
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              color: '#ffffff',
              transition: 'all 0.2s ease',
              padding: 0
            }}
            title="Admin User Profile Menu"
          >
            {user?.profile_image ? (
              <img src={user.profile_image} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'SA'
            )}
          </button>

          {/* Floating Profile Quick Menu Popover */}
          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 250,
                backgroundColor: '#0f1e3c',
                borderRadius: 16,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.4)',
                padding: 14,
                zIndex: 140,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              {/* User Identity Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                  {user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'SA'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {user?.full_name || 'System Administrator'}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {user?.email || 'admin@rankedge.com'}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginTop: 2 }}>
                    {user?.role || 'Administrator'}
                  </span>
                </div>
              </div>

              {/* Menu Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={() => {
                    onNavigate('dashboard');
                    setShowProfileMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    color: 'rgba(255, 255, 255, 0.85)',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <User size={15} color="#60a5fa" />
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
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    color: 'rgba(255, 255, 255, 0.85)',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <BookOpen size={15} color="#f59e0b" />
                  <span>Question Bank</span>
                </button>

                <button
                  onClick={() => {
                    onNavigate('analytics');
                    setShowProfileMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    color: 'rgba(255, 255, 255, 0.85)',
                    background: 'transparent',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <BarChart2 size={15} color="#10b981" />
                  <span>Reports & Analytics</span>
                </button>
              </div>

              {/* Sign Out Button */}
              <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <Link
                  to="/signout"
                  onClick={() => setShowProfileMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '8px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    color: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fontSize: 13,
                    fontWeight: 600,
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}
                >
                  <LogOut size={15} />
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


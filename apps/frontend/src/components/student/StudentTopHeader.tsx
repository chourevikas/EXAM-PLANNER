import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logoutUser } from '../../services/authService';
import {
  Search,
  Bell,
  User,
  CreditCard,
  Settings,
  LogOut,
  CheckCheck,
  Sparkles,
  Target,
  Trophy,
  Menu,
  Zap
} from 'lucide-react';

interface StudentTopHeaderProps {
  user: any;
  pageTitle: string;
  onToggleSidebar?: () => void;
}

function getUserInitials(name?: string): string {
  if (!name || typeof name !== 'string') return 'RT';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'RT';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function StudentTopHeader({ user, pageTitle, onToggleSidebar }: StudentTopHeaderProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [searchResults, setSearchResults] = useState<{ mocks: any[], pyqs: any[], topics: any[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      const q = searchQuery.toLowerCase();
      const mockResults = [
        { id: 1, title: 'UPSC Prelims Practice Test #12', type: 'Practice Test', url: '/mocks' },
        { id: 2, title: 'GS Paper I Topic Test - Polity', type: 'Sectional', url: '/mocks' }
      ].filter(m => m.title.toLowerCase().includes(q));

      const pyqResults = [
        { id: 1, title: 'UPSC CSE 2023 GS Paper I', type: 'PYQ Paper', url: '/pyq' },
        { id: 2, title: 'UPSC CSE 2022 GS Paper I', type: 'PYQ Paper', url: '/pyq' }
      ].filter(p => p.title.toLowerCase().includes(q));

      const topicResults = [
        { id: 1, title: 'Fundamental Rights & Preamble', type: 'Polity', url: '/study-planner' },
        { id: 2, title: 'Monetary Policy & RBI Guidelines', type: 'Economy', url: '/study-planner' }
      ].filter(t => t.title.toLowerCase().includes(q));

      setSearchResults({ mocks: mockResults, pyqs: pyqResults, topics: topicResults });
      setIsSearching(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 480;

  const mockNotifications = [
    { id: 1, title: 'Weekly Insight Report Ready', desc: 'Your accuracy in Polity improved by +12% this week.', time: '10m ago', unread: true },
    { id: 2, title: 'Target 2026 Milestone Reached', desc: 'You completed 500+ PYQs across 4 topics.', time: '2h ago', unread: true },
    { id: 3, title: 'New Mock Test Added', desc: 'UPSC CSAT Speed Practice Mock #04 is now live.', time: '1d ago', unread: false }
  ];

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
        background: 'linear-gradient(90deg, #0F1D38 0%, #14284C 35%, #1B3864 70%, #224578 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 20px rgba(15, 29, 56, 0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0 16px' : '0 24px',
        boxSizing: 'border-box'
      }}
    >
      {/* Left: Brand Logo & Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
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
                fontWeight: 800,
                fontSize: 16,
                color: '#ffffff',
                letterSpacing: '-0.02em'
              }}
            >
              ExamPlanner
            </span>
          )}
        </Link>

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: '#ffffff', fontWeight: 600 }}>
              {pageTitle}
            </span>
          </div>
        )}
      </div>

      {/* Center: Quick Search Bar with ⌘K Badge */}
      {!isSmallMobile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            maxWidth: 380,
            width: '100%',
            margin: '0 16px'
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 12,
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: 'rgba(255, 255, 255, 0.4)'
            }}
          >
            <Search size={15} />
          </div>

          <input
            type="text"
            placeholder="Search PYQs, mocks, polity, economy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: 36,
              paddingLeft: 36,
              paddingRight: 42,
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              color: '#ffffff',
              fontSize: 13,
              outline: 'none',
              transition: 'all 0.2s ease',
              boxSizing: 'border-box'
            }}
          />

          {!searchQuery && (
            <div
              style={{
                position: 'absolute',
                right: 10,
                fontSize: 10.5,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.4)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                pointerEvents: 'none'
              }}
            >
              ⌘K
            </div>
          )}

          {/* Search Dropdown Results */}
          {searchResults && (
            <div
              style={{
                position: 'absolute',
                top: 46,
                left: 0,
                right: 0,
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                padding: 12,
                zIndex: 200,
                maxHeight: 360,
                overflowY: 'auto'
              }}
            >
              {isSearching ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                  Searching database...
                </div>
              ) : (searchResults.mocks.length === 0 && searchResults.pyqs.length === 0 && searchResults.topics.length === 0) ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                  No matching topics or tests found for "{searchQuery}".
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {searchResults.mocks && searchResults.mocks.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Practice Tests</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {searchResults.mocks.map((mock: any) => (
                          <Link key={mock.id} to={mock.url} onClick={() => setSearchQuery('')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', backgroundColor: '#F8FAFC' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}><Trophy size={14} /></div>
                            <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{mock.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right Controls: Notification Bell, PRO Badge, User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, position: 'relative' }}>
        
        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569',
              transition: 'all 0.15s ease'
            }}
            title="Notifications"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Popover */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 320,
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                padding: 16,
                zIndex: 200
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #F1F5F9', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={() => setUnreadCount(0)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mockNotifications.map(n => (
                  <div key={n.id} style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: '#F8FAFC' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{n.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar Circle (RT) */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
            }}
          >
            {getUserInitials(user?.full_name || user?.name || user?.email)}
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 200,
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                padding: '8px 0',
                zIndex: 200
              }}
            >
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{user?.full_name || 'Student Account'}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{user?.email || 'student@examplanner.ai'}</div>
              </div>
              <Link to="/profile" onClick={() => setShowProfileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', color: '#334155', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
                <User size={15} /> Profile Settings
              </Link>
              <Link to="/pricing" onClick={() => setShowProfileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', color: '#334155', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
                <CreditCard size={15} /> Subscription Plan
              </Link>
              <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 4, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    logoutUser();
                    navigate('/');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    color: '#EF4444',
                    background: 'none',
                    border: 'none',
                    width: '100%',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

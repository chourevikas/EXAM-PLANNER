import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Bell, 
  Zap, 
  Star,
  User,
  CreditCard,
  Settings,
  LogOut,
  CheckCheck,
  Sparkles,
  Target,
  Trophy
} from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';

interface StudentTopHeaderProps {
  user: any;
  pageTitle: string;
  onToggleSidebar?: () => void;
}

export function StudentTopHeader({ user, pageTitle }: StudentTopHeaderProps) {
  const [currentUser, setCurrentUser] = useState(user);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [searchResults, setSearchResults] = useState<{mocks: any[], pyqs: any[], topics: any[]} | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    const handleProfileUpdate = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        setCurrentUser(stored);
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('user_profile_updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('user_profile_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, []);

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
        { id: 1, title: 'UPSC Prelims Full Mock #12', type: 'Mock Test', url: '/mocks' },
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
      {/* Left: Brand Logo & Page Title (Hamburger moved to sidebar) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Brand Logo */}
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
                fontFamily: 'var(--font-display)',
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
            <span style={{ color: '#ffffff', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
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
                top: 44,
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
                  {/* Mocks Section */}
                  {searchResults.mocks && searchResults.mocks.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Mock Tests</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {searchResults.mocks.map(mock => (
                          <Link key={mock.id} to={mock.url} onClick={() => setSearchQuery('')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', backgroundColor: '#F8FAFC' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}><Trophy size={14} /></div>
                            <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{mock.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PYQs Section */}
                  {searchResults.pyqs && searchResults.pyqs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Previous Year Papers</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {searchResults.pyqs.map(pyq => (
                          <Link key={pyq.id} to={pyq.url} onClick={() => setSearchQuery('')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', backgroundColor: '#F8FAFC' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}><Target size={14} /></div>
                            <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{pyq.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Topics Section */}
                  {searchResults.topics && searchResults.topics.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Study Topics</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {searchResults.topics.map(topic => (
                          <Link key={topic.id} to={topic.url} onClick={() => setSearchQuery('')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', backgroundColor: '#F8FAFC' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}><Sparkles size={14} /></div>
                            <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 500 }}>{topic.title}</span>
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

      {/* Right: Notifications, Pro Plan & Profile (LIGHT THEMED POPOVERS) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, position: 'relative' }}>
        
        {/* Notifications Bell Container */}
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
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: showNotifications ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
            }}
            onMouseLeave={(e) => {
              if (!showNotifications) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            }}
            title="Notifications"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: '#ef4444'
                }}
              />
            )}
          </button>

          {/* Light-Themed Notifications Popover */}
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: isMobile ? -60 : 0,
                width: isMobile ? 300 : 340,
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                padding: 16,
                zIndex: 200
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 12,
                  borderBottom: '1px solid #F1F5F9',
                  marginBottom: 12
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', fontFamily: 'var(--font-display)' }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => setUnreadCount(0)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563EB',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mockNotifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: n.unread ? '#EFF6FF' : '#F8FAFC',
                      border: `1px solid ${n.unread ? '#DBEAFE' : '#F1F5F9'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>{n.title}</span>
                      <span style={{ fontSize: 10.5, color: '#94A3B8' }}>{n.time}</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: '#475569', margin: 0, lineHeight: 1.4 }}>
                      {n.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pro Plan Upgrade Badge */}
        {!isSmallMobile && (
          <Link
            to="/pricing"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#f59e0b',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 700,
              transition: 'all 0.2s ease'
            }}
          >
            <Star size={13} fill="#f59e0b" color="#f59e0b" />
            <span>PRO</span>
          </Link>
        )}

        {/* Light-Themed Profile Avatar & Menu Container */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 8px 4px 4px',
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: showProfileMenu ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)';
            }}
            onMouseLeave={(e) => {
              if (!showProfileMenu) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            <UserAvatar userOrImage={currentUser} size={28} />
          </button>

          {/* Light-Themed Profile Dropdown Menu */}
          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 230,
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                padding: 8,
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}
            >
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserAvatar userOrImage={currentUser} size={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.full_name || 'Student Aspirant'}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email || 'student@examplanner.com'}</div>
                </div>
              </div>

              <Link
                to="/profile"
                onClick={() => setShowProfileMenu(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, color: '#334155', textDecoration: 'none', fontSize: 13, transition: 'background-color 0.15s ease' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <User size={15} /> Account Profile
              </Link>
              <Link
                to="/pricing"
                onClick={() => setShowProfileMenu(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, color: '#334155', textDecoration: 'none', fontSize: 13, transition: 'background-color 0.15s ease' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <CreditCard size={15} /> Subscription & Billing
              </Link>
              <Link
                to="/profile"
                onClick={() => setShowProfileMenu(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, color: '#334155', textDecoration: 'none', fontSize: 13, transition: 'background-color 0.15s ease' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Settings size={15} /> Preferences
              </Link>

              <div style={{ height: 1, backgroundColor: '#F1F5F9', margin: '4px 0' }} />

              <Link
                to="/signout"
                onClick={() => setShowProfileMenu(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, color: '#DC2626', textDecoration: 'none', fontSize: 13, transition: 'background-color 0.15s ease' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <LogOut size={15} /> Sign Out
              </Link>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

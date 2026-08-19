import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Menu, 
  Search, 
  Bell, 
  Moon, 
  Sun, 
  ChevronRight, 
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
import { useTheme } from '../../hooks/useTheme';

interface StudentTopHeaderProps {
  user: any;
  pageTitle: string;
  onToggleSidebar: () => void;
}

export function StudentTopHeader({ user, pageTitle, onToggleSidebar }: StudentTopHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [searchResults, setSearchResults] = useState<{mocks: any[], pyqs: any[], topics: any[]} | null>(null);
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
      return;
    }
    
    const delayDebounceFn = setTimeout(() => {
      setIsSearching(true);
      const token = localStorage.getItem('access_token');
      fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      .then(res => res.json())
      .then(data => {
        setSearchResults(data);
        setIsSearching(false);
      })
      .catch(err => {
        console.error("Search failed:", err);
        setIsSearching(false);
      });
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 540;

  const notifications = [
    {
      id: 1,
      title: 'Polity Accuracy Spike!',
      desc: 'Your accuracy in Polity jumped by +12% this week.',
      time: '10 mins ago',
      unread: true,
      icon: Sparkles,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.15)'
    },
    {
      id: 2,
      title: 'Daily Target Reminder',
      desc: 'Complete 20 Economy questions before 8:00 PM.',
      time: '1 hour ago',
      unread: true,
      icon: Target,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)'
    },
    {
      id: 3,
      title: '14-Day Streak Milestone!',
      desc: 'Congratulations! You unlocked Level 4 Achiever.',
      time: '1 day ago',
      unread: true,
      icon: Trophy,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.15)'
    }
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
        
        {/* Hamburger Sidebar Toggle Button */}
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

        {/* Divider */}
        {!isSmallMobile && <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255, 255, 255, 0.12)' }} />}

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

        {/* Breadcrumb Trail */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.55)', fontWeight: 500 }}>Student</span>
            <ChevronRight size={14} color="rgba(255, 255, 255, 0.4)" />
            <span style={{ color: '#ffffff', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
              {pageTitle}
            </span>
          </div>
        )}

      </div>

      {/* Center: Quick Search Bar with ⌘K Badge (Hidden on small mobile) */}
      {!isSmallMobile && (
        <div
          style={{
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
            placeholder={isMobile ? "Search..." : "Search PYQs, Mocks..."}
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
          
          {/* Search Dropdown / Command Palette */}
          {searchQuery.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 50,
              left: isMobile ? 12 : '50%',
              transform: isMobile ? 'none' : 'translateX(-50%)',
              width: isMobile ? 'calc(100% - 24px)' : 500,
              backgroundColor: '#0f1e3c',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              zIndex: 150,
              maxHeight: 400,
              overflowY: 'auto',
              padding: 12
            }}>
              {isSearching ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Searching...</div>
              ) : searchResults ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Mocks Section */}
                  {searchResults.mocks && searchResults.mocks.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Mock Tests</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {searchResults.mocks.map(mock => (
                          <Link key={mock.id} to={mock.url} onClick={() => setSearchQuery('')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}><CheckCheck size={14} /></div>
                            <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{mock.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PYQs Section */}
                  {searchResults.pyqs && searchResults.pyqs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Previous Year Papers</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {searchResults.pyqs.map(pyq => (
                          <Link key={pyq.id} to={pyq.url} onClick={() => setSearchQuery('')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}><Target size={14} /></div>
                            <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{pyq.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Topics Section */}
                  {searchResults.topics && searchResults.topics.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Study Topics</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {searchResults.topics.map(topic => (
                          <Link key={topic.id} to={topic.url} onClick={() => setSearchQuery('')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}><Sparkles size={14} /></div>
                            <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{topic.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Right: Notifications, Pro Plan & Profile */}
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
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Notifications</span>
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
                {notifications.map(item => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start'
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

              <Link
                to="/reports/weekly"
                onClick={() => setShowNotifications(false)}
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#60a5fa',
                  textDecoration: 'none',
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                View Weekly Insights Report →
              </Link>
            </div>
          )}
        </div>

        {/* Pro Plan / Upgrade Button */}
        {user?.subscription_tier === 'PREMIUM' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: isMobile ? '4px 8px' : '4px 12px',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              borderRadius: 20,
              border: '1px solid rgba(59, 130, 246, 0.4)'
            }}
          >
            <Star size={12} fill="#60a5fa" color="#60a5fa" />
            {!isMobile && <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>Pro Plan</span>}
          </div>
        ) : (
          <Link
            to="/pricing"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: isMobile ? '6px 10px' : '6px 14px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Zap size={14} />
            {!isSmallMobile && <span>Upgrade</span>}
          </Link>
        )}

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
              fontSize: 16,
              transition: 'all 0.2s ease',
              padding: 0
            }}
            title="User Profile Menu"
          >
            {user?.profile_image || '👨‍🎓'}
          </button>

          {/* Floating Profile Quick Menu Popover */}
          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                top: 48,
                right: 0,
                width: 240,
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                  {user?.profile_image || '👨‍🎓'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {user?.full_name || 'Aspirant'}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {user?.email || 'aspirant@examplanner.com'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Link
                  to="/profile"
                  onClick={() => setShowProfileMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    color: 'rgba(255, 255, 255, 0.85)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                >
                  <User size={15} color="#60a5fa" />
                  <span>My Profile</span>
                </Link>

                <Link
                  to="/pricing"
                  onClick={() => setShowProfileMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    color: 'rgba(255, 255, 255, 0.85)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                >
                  <CreditCard size={15} color="#f59e0b" />
                  <span>Billing & Subscription</span>
                </Link>

                <Link
                  to="/profile"
                  onClick={() => setShowProfileMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    color: 'rgba(255, 255, 255, 0.85)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                >
                  <Settings size={15} color="#10b981" />
                  <span>Account Settings</span>
                </Link>
              </div>

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

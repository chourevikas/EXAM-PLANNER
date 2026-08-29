import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
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
import { UserAvatar } from '../common/UserAvatar';

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
  const [currentUser, setCurrentUser] = useState(user);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [searchResults, setSearchResults] = useState<{ mocks: any[], pyqs: any[], topics: any[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const clerk = useClerk();
  const { user: clerkUser } = useUser();

  const avatarUser = {
    ...currentUser,
    imageUrl: clerkUser?.imageUrl || currentUser?.imageUrl || currentUser?.avatar_url,
    profile_image: clerkUser?.imageUrl || currentUser?.profile_image,
    full_name: currentUser?.full_name || clerkUser?.fullName || currentUser?.name || 'Student'
  };

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/notifications', { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

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
        setSearchResults(null);
      }
    }
    const handleResize = () => setWindowWidth(window.innerWidth);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const token = (await clerk.session?.getToken()) || localStorage.getItem('access_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setSearchResults({
            mocks: data.mocks || [],
            pyqs: data.pyqs || [],
            topics: data.topics || []
          });
        } else {
          throw new Error('Fallback search');
        }
      } catch (err) {
        const q = searchQuery.toLowerCase();
        const mockResults = [
          { id: 'm1', title: 'UPSC Prelims Practice Test #12', type: 'Practice Test', url: '/mocks' },
          { id: 'm2', title: 'GS Paper I Topic Test - Polity', type: 'Sectional', url: '/mocks' }
        ].filter(m => m.title.toLowerCase().includes(q));

        const pyqResults = [
          { id: 'p1', title: 'UPSC CSE 2023 GS Paper I', type: 'PYQ Paper', url: '/pyq' },
          { id: 'p2', title: 'UPSC CSE 2022 GS Paper I', type: 'PYQ Paper', url: '/pyq' }
        ].filter(p => p.title.toLowerCase().includes(q));

        const topicResults = [
          { id: 't1', title: 'Fundamental Rights & Preamble', type: 'Polity', url: '/study-planner' },
          { id: 't2', title: 'Monetary Policy & RBI Guidelines', type: 'Economy', url: '/study-planner' }
        ].filter(t => t.title.toLowerCase().includes(q));

        setSearchResults({ mocks: mockResults, pyqs: pyqResults, topics: topicResults });
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 480;

  const handleMarkAllRead = async () => {
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/v1/notifications/mark-all-read', { method: 'POST', headers });
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (noti: any) => {
    if (!noti.is_read) {
      setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      try {
        const token = localStorage.getItem('access_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        await fetch(`/api/v1/notifications/${noti.id}/read`, { method: 'POST', headers });
      } catch (e) {
        console.error(e);
      }
    }
    setShowNotifications(false);
    if (noti.action_url) {
      navigate(noti.action_url);
    }
  };

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
        boxShadow: '0 4px 20px rgba(17, 17, 17, 0.25)',
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
              borderRadius: 0,
              background: '#E31B23',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(227, 27, 35, 0.4)'
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
            ref={searchInputRef}
            type="text"
            placeholder="Search PYQs, mocks, polity, economy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: 36,
              paddingLeft: 36,
              paddingRight: 42,
              borderRadius: 0,
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
                borderRadius: 0,
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
                borderRadius: 0,
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
                          <Link key={mock.id} to={mock.url} onClick={() => { setSearchQuery(''); setSearchResults(null); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 0, textDecoration: 'none', backgroundColor: '#F8FAFC' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 0, backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E31B23' }}><Trophy size={14} /></div>
                            <span style={{ fontSize: 13, color: '#172033', fontWeight: 500 }}>{mock.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.pyqs && searchResults.pyqs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Previous Year Papers</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {searchResults.pyqs.map((pyq: any) => (
                          <Link key={pyq.id} to={pyq.url} onClick={() => { setSearchQuery(''); setSearchResults(null); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 0, textDecoration: 'none', backgroundColor: '#F8FAFC' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 0, backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F2B623' }}><Target size={14} /></div>
                            <span style={{ fontSize: 13, color: '#172033', fontWeight: 500 }}>{pyq.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.topics && searchResults.topics.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 8 }}>Syllabus & Topics</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {searchResults.topics.map((topic: any) => (
                          <Link key={topic.id} to={topic.url} onClick={() => { setSearchQuery(''); setSearchResults(null); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 0, textDecoration: 'none', backgroundColor: '#F8FAFC' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 0, backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}><Sparkles size={14} /></div>
                            <span style={{ fontSize: 13, color: '#172033', fontWeight: 500 }}>{topic.title}</span>
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
              borderRadius: 0,
              border: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#FFFFFF',
              transition: 'all 0.15s ease'
            }}
            title="Notifications"
          >
            <Bell size={19} color="#FFFFFF" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 14,
                  height: 14,
                  borderRadius: 0,
                  backgroundColor: '#E31B23',
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
                borderRadius: 0,
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 32px rgba(17, 17, 17, 0.12)',
                padding: 16,
                zIndex: 200
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #F1F5F9', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', color: '#E31B23', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n: any) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 0,
                        backgroundColor: n.is_read ? '#FFFFFF' : '#F8FAFC',
                        borderLeft: n.is_read ? '3px solid transparent' : '3px solid #E31B23',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{n.title}</span>
                        {!n.is_read && (
                          <span style={{ width: 6, height: 6, borderRadius: 0, backgroundColor: '#E31B23' }} />
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{n.message}</div>
                    </div>
                  ))
                )}
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
              padding: 0,
              borderRadius: 0,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(227, 27, 35, 0.3)',
              backgroundColor: 'transparent'
            }}
          >
            <UserAvatar userOrImage={avatarUser} size={36} fullName={avatarUser.full_name} />
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
                borderRadius: 0,
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                padding: '8px 0',
                zIndex: 200
              }}
            >
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#172033' }}>{user?.full_name || 'Student Account'}</div>
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

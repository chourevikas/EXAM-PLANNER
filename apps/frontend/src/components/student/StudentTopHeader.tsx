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
  Check,
  BookOpen,
  Target,
  Trophy,
  Menu,
  Zap,
  X
} from 'lucide-react';
import { UserAvatar } from '../common/UserAvatar';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { guardedFetch } from '../../utils/apiGuard';

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
  const [isClearingNotifications, setIsClearingNotifications] = useState(false);
  const [removingNotifIds, setRemovingNotifIds] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<{ mocks: any[], pyqs: any[], topics: any[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const clerk = useClerk();
  const { user: clerkUser } = useUser();
  const { isMobile, isXs, isTabletOrBelow } = useBreakpoint();

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

      const res = await guardedFetch('/api/v1/notifications', { headers });
      if (res.ok) {
        const data = await res.json();
        const rawList: any[] = data.notifications || [];

        // Filter out read notifications so only unread appear in dropdown
        const activeNotifications = rawList.filter((n: any) => !n.is_read);

        setNotifications(activeNotifications);
        setUnreadCount(typeof data.unread_count === 'number' ? data.unread_count : activeNotifications.length);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Background interval polling (every 30s) to discover new notifications and update bell badge
    const intervalId = setInterval(fetchNotifications, 30000);

    // Refresh when user refocuses the tab
    const handleFocus = () => fetchNotifications();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
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
        setSearchExpanded(false);
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isMobile) {
          setSearchExpanded(true);
          setTimeout(() => searchInputRef.current?.focus(), 100);
        } else {
          searchInputRef.current?.focus();
        }
      }
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setShowProfileMenu(false);
        setSearchExpanded(false);
        setSearchResults(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile]);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('access_token');
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
          throw new Error(`Search failed (${res.status})`);
        }
      } catch (err) {
        // Show nothing rather than made-up matches when search is unavailable
        console.warn('Search failed:', err);
        setSearchResults({ mocks: [], pyqs: [], topics: [] });
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleMarkAsRead = async (noti: any, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const notifIdStr = String(noti.id);
    if (removingNotifIds.has(notifIdStr)) return;

    // 1. Mark as removing to trigger slide-out/fade-out animation on this item
    setRemovingNotifIds(prev => new Set(prev).add(notifIdStr));

    // 2. Decrement unread count immediately
    setUnreadCount(prev => Math.max(0, prev - 1));

    // 3. Fire API request to persist read state in DB
    try {
      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      guardedFetch(`/api/v1/notifications/${encodeURIComponent(notifIdStr)}/read`, { method: 'POST', headers }).catch(console.error);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }

    // 4. Wait for smooth animation to finish before removing from list
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => String(n.id) !== notifIdStr));
      setRemovingNotifIds(prev => {
        const next = new Set(prev);
        next.delete(notifIdStr);
        return next;
      });
    }, 380);
  };

  const handleClearAll = async () => {
    if (notifications.length === 0 || isClearingNotifications) return;

    // 1. Trigger sliding out animation on all visible items
    setIsClearingNotifications(true);

    // 2. Clear unread badge immediately
    setUnreadCount(0);

    // 3. Send API request to persist read/clear status in database
    try {
      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      guardedFetch('/api/v1/notifications/clear-all', { method: 'POST', headers }).catch(console.error);
    } catch (e) {
      console.error('Failed clearing notifications:', e);
    }

    // 4. Wait for the staggered slide-out animation to finish before clearing
    const animDuration = Math.min(650, 360 + notifications.length * 40);
    setTimeout(() => {
      setNotifications([]);
      setIsClearingNotifications(false);
      setRemovingNotifIds(new Set());
    }, animDuration);
  };

  const handleNotificationClick = async (noti: any) => {
    const notifIdStr = String(noti.id);

    setUnreadCount(prev => Math.max(0, prev - 1));
    setNotifications(prev => prev.filter(n => String(n.id) !== notifIdStr));

    try {
      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      guardedFetch(`/api/v1/notifications/${encodeURIComponent(notifIdStr)}/read`, { method: 'POST', headers }).catch(console.error);
    } catch (e) {
      console.error(e);
    }

    setShowNotifications(false);
    if (noti.action_url) {
      navigate(noti.action_url);
    }
  };

  // Show search bar inline on desktop/tablet landscape, or as an icon-only on mobile
  const showInlineSearch = !isMobile;

  return (
    <header
      ref={headerRef}
      className="app-top-header"
    >
      {/* Left: Hamburger menu (mobile), Brand Logo & Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="touch-target"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--bg-card)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              borderRadius: 'var(--radius)',
              marginRight: -4,
            }}
            title="Toggle Navigation Menu"
            aria-label="Toggle navigation menu"
          >
            <Menu size={22} />
          </button>
        )}

        <a
          href="https://examplanner.in"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            textDecoration: 'none',
            flexShrink: 0
          }}
        >
          <img
            src="/logo.jpeg"
            alt="ExamPlanner"
            style={{
              width: 28,
              height: 28,
              objectFit: 'contain',
              borderRadius: 4,
            }}
          />
          {!isMobile && (
            <div style={{ lineHeight: 1.15, display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--bg-card)', fontFamily: 'Inter, sans-serif' }}>Exam</span>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--primary-red)', fontFamily: 'Inter, sans-serif' }}>Planner</span>
            </div>
          )}
        </a>

        {!isTabletOrBelow && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'var(--bg-card)', fontWeight: 600 }}>
              {pageTitle}
            </span>
          </div>
        )}
      </div>

      {/* Right Controls: Notification Bell, User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, position: 'relative', flexShrink: 0 }}>


        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="touch-target"
            style={{
              position: 'relative',
              borderRadius: 'var(--radius)',
              border: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--bg-card)',
              transition: 'all 0.15s ease',
              padding: 8,
            }}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={19} color="var(--bg-card)" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 14,
                  height: 14,
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--primary-red)',
                  color: 'var(--bg-card)',
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
              className={isMobile ? 'popover-panel' : ''}
              style={{
                ...(isMobile ? {} : {
                  position: 'absolute',
                  top: 48,
                  right: 0,
                  width: 320,
                }),
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 32px rgba(17, 17, 17, 0.12)',
                padding: 16,
                zIndex: 200
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #F1F5F9', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>Notifications</span>
                  {notifications.length > 0 && !isClearingNotifications && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', backgroundColor: 'var(--primary-red-bg)', color: 'var(--primary-red)', borderRadius: 10 }}>
                      {notifications.length}
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={isClearingNotifications}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isClearingNotifications ? 'var(--text-disabled)' : 'var(--primary-red)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isClearingNotifications ? 'default' : 'pointer',
                      minHeight: 32,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 4px',
                      transition: 'opacity 0.15s ease'
                    }}
                    title="Clear all notifications"
                  >
                    <CheckCheck size={14} />
                    Clear All
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', overflowX: 'hidden' }}>
                {notifications.length === 0 ? (
                  <div className="notif-checked-up-state" style={{ padding: '24px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#059669',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
                    }}>
                      <CheckCheck size={22} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>
                        You are all checked up!
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 220, margin: '0 auto', lineHeight: 1.4 }}>
                        No new notifications right now. You're completely up to date.
                      </span>
                    </div>
                  </div>
                ) : (
                  notifications.map((n: any, idx: number) => {
                    const notifIdStr = String(n.id);
                    const isRemoving = removingNotifIds.has(notifIdStr);
                    return (
                      <div
                        key={n.id}
                        onClick={() => !isClearingNotifications && !isRemoving && handleNotificationClick(n)}
                        className={isClearingNotifications || isRemoving ? 'notif-item-sliding-out' : ''}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 6,
                          backgroundColor: 'var(--bg-subtle)',
                          borderLeft: '3px solid var(--primary-red)',
                          borderTop: '1px solid #F1F5F9',
                          borderRight: '1px solid #F1F5F9',
                          borderBottom: '1px solid #F1F5F9',
                          cursor: (isClearingNotifications || isRemoving) ? 'default' : 'pointer',
                          transition: 'background 0.15s ease',
                          minHeight: 44,
                          animationDelay: isClearingNotifications ? `${idx * 40}ms` : undefined,
                          position: 'relative',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111111', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ flex: 1, paddingRight: 4 }}>{n.title}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(n, e)}
                              disabled={isRemoving || isClearingNotifications}
                              style={{
                                background: 'rgba(0, 0, 0, 0.04)',
                                border: '1px solid #E2E8F0',
                                color: 'var(--text-secondary)',
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '2px 6px',
                                borderRadius: 4,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--primary-red)';
                                e.currentTarget.style.backgroundColor = 'var(--primary-red-bg)';
                                e.currentTarget.style.borderColor = 'var(--primary-red-border)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-secondary)';
                                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                              }}
                              title="Mark as read"
                            >
                              <Check size={11} />
                              <span>Mark as read</span>
                            </button>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--primary-red)' }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>{n.message}</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* View all announcements footer link */}
              <div style={{ paddingTop: 10, marginTop: 6, borderTop: '1px solid #F1F5F9' }}>
                <button
                  onClick={() => { setShowNotifications(false); navigate('/notifications'); }}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    color: 'var(--primary-red)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', padding: '6px 0', textAlign: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  View all announcements →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar Circle */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="touch-target"
            style={{
              padding: 0,
              borderRadius: 'var(--radius)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(var(--primary-red-rgb), 0.3)',
              backgroundColor: 'transparent'
            }}
            aria-label="User menu"
          >
            <UserAvatar userOrImage={avatarUser} size={36} fullName={avatarUser.full_name} />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div
              className={isMobile ? 'popover-panel' : ''}
              style={{
                ...(isMobile ? {} : {
                  position: 'absolute',
                  top: 48,
                  right: 0,
                  width: 200,
                }),
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                padding: '8px 0',
                zIndex: 200
              }}
            >
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--deep-navy)' }}>{user?.full_name || 'Student Account'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.email || 'student@examplanner.ai'}</div>
              </div>
              <Link to="/profile" onClick={() => setShowProfileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, fontWeight: 500, minHeight: 44 }}>
                <User size={15} /> Profile Settings
              </Link>
              <Link to="/billing" onClick={() => setShowProfileMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, fontWeight: 500, minHeight: 44 }}>
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
                    color: 'var(--primary-red)',
                    background: 'none',
                    border: 'none',
                    width: '100%',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'left',
                    minHeight: 44,
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

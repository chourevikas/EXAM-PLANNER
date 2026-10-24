import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { logoutUser } from '../../services/authService';
import {
  Bell,
  ChevronRight,
  LogOut,
  CheckCheck,
  Activity,
  Cpu,
  ClipboardCheck,
  Menu,
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
  upload: 'Upload Question Paper',
  questions: 'Question Bank',
  'ai-queue': 'AI Processing Queue',
  review: 'Question Review',
  'mock-tests': 'Mock Tests',
  testimonials: 'Testimonial Approvals',
  'reported-questions': 'Reported Questions',
  resources: 'Learning Resources',
  users: 'Users Management',
  'teacher-rewards': 'Teacher Rewards',
  analytics: 'Reports & Analytics',
  milestones: 'Milestones',
  translations: 'Translations',
  subscriptions: 'Subscriptions & Billing',
};

interface AdminNotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  icon?: any;
  color?: string;
  bg?: string;
  targetView: string;
}

const DEFAULT_ADMIN_NOTIFICATIONS: AdminNotificationItem[] = [
  {
    id: 'alert_extract_complete',
    title: 'Question Extraction Complete',
    desc: '12 new questions extracted from UPSC 2023 Paper 1.',
    time: '10 mins ago',
    icon: Cpu,
    color: '#3B6EA8',
    bg: 'rgba(59, 110, 168, 0.15)',
    targetView: 'ai-queue',
  },
  {
    id: 'alert_pending_review',
    title: 'Pending Review Alert',
    desc: '8 questions awaiting verification in Question Review.',
    time: '45 mins ago',
    icon: ClipboardCheck,
    color: '#B89B5E',
    bg: 'rgba(184, 155, 94, 0.15)',
    targetView: 'review',
  },
  {
    id: 'alert_pipeline_sync',
    title: 'Pipeline Sync Active',
    desc: 'Prelims 2026 dataset sync running smoothly.',
    time: '2 hours ago',
    icon: Activity,
    color: '#3A8B53',
    bg: 'rgba(16, 185, 129, 0.15)',
    targetView: 'upload',
  },
];

export function AdminTopNav({ user, activeView, onNavigate, onToggleSidebar }: TopNavProps) {
  const navigate = useNavigate();
  const clerk = useClerk();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [isClearingNotifications, setIsClearingNotifications] = useState(false);
  const [removingNotifIds, setRemovingNotifIds] = useState<Set<string>>(new Set());
  const { isMobile, isSmallScreen, isTabletOrBelow } = useBreakpoint();

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

  const loadNotifications = async () => {
    let clearedIds = new Set<string>();
    try {
      clearedIds = new Set<string>(JSON.parse(localStorage.getItem('admin_cleared_alert_ids') || '[]'));
    } catch (e) {
      console.error(e);
    }

    let alertList: AdminNotificationItem[] = DEFAULT_ADMIN_NOTIFICATIONS.filter((a) => !clearedIds.has(a.id));

    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const res = await fetch('/api/v1/notifications?limit=10', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const unreadFeed = data.unread_feed || [];
          const liveAlerts: AdminNotificationItem[] = unreadFeed
            .filter((item: any) => !clearedIds.has(String(item.id)))
            .map((item: any) => ({
              id: String(item.id),
              title: item.title,
              desc: item.message,
              time: item.created_at
                ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Just now',
              icon: Bell,
              color: 'var(--primary-red)',
              bg: 'rgba(227, 27, 35, 0.12)',
              targetView: item.action_url ? 'notifications' : 'dashboard',
            }));

          const existingIds = new Set(alertList.map((a) => a.id));
          liveAlerts.forEach((la) => {
            if (!existingIds.has(la.id)) {
              alertList.unshift(la);
              existingIds.add(la.id);
            }
          });
        }
      }
    } catch (err) {
      // Offline fallback
    }

    setNotifications(alertList);
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClearAll = async () => {
    if (notifications.length === 0 || isClearingNotifications) return;

    setIsClearingNotifications(true);

    try {
      const storedCleared = JSON.parse(localStorage.getItem('admin_cleared_alert_ids') || '[]');
      const clearedSet = new Set<string>(storedCleared);
      notifications.forEach((n) => clearedSet.add(String(n.id)));
      localStorage.setItem('admin_cleared_alert_ids', JSON.stringify(Array.from(clearedSet)));
    } catch (e) {
      console.error('Error saving cleared alerts to localStorage:', e);
    }

    try {
      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      fetch('/api/v1/notifications/clear-all', { method: 'POST', headers }).catch(() => {});
    } catch (e) {
      console.error(e);
    }

    const animDuration = Math.min(500, 320 + notifications.length * 40);
    setTimeout(() => {
      setNotifications([]);
      setIsClearingNotifications(false);
      setRemovingNotifIds(new Set());
    }, animDuration);
  };

  const handleNotificationClick = (item: AdminNotificationItem) => {
    const notifIdStr = String(item.id);
    if (removingNotifIds.has(notifIdStr) || isClearingNotifications) return;

    setRemovingNotifIds((prev) => new Set(prev).add(notifIdStr));

    try {
      const storedCleared = JSON.parse(localStorage.getItem('admin_cleared_alert_ids') || '[]');
      const clearedSet = new Set<string>(storedCleared);
      clearedSet.add(notifIdStr);
      localStorage.setItem('admin_cleared_alert_ids', JSON.stringify(Array.from(clearedSet)));
    } catch (e) {
      console.error('Error saving cleared alert to localStorage:', e);
    }

    try {
      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      fetch(`/api/v1/notifications/${encodeURIComponent(notifIdStr)}/read`, { method: 'POST', headers }).catch(() => {});
    } catch (e) {
      console.error(e);
    }

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => String(n.id) !== notifIdStr));
      setRemovingNotifIds((prev) => {
        const next = new Set(prev);
        next.delete(notifIdStr);
        return next;
      });
      if (item.targetView) {
        onNavigate(item.targetView);
      }
      setShowNotifications(false);
    }, 380);
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
        background: 'var(--deep-navy)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        boxSizing: 'border-box'
      }}
    >
      {/* Left: Hamburger Button, Brand Logo & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
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
              marginRight: isMobile ? -4 : -6,
            }}
            title="Toggle Navigation Menu"
            aria-label="Toggle navigation menu"
          >
            <Menu size={22} />
          </button>
        )}

        {/* Brand Logo */}
        <div
          onClick={() => onNavigate('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <img
            src="/logo.jpeg"
            alt="ExamPlanner"
            loading="lazy"
            decoding="async"
            style={{
              width: 30,
              height: 30,
              objectFit: 'contain',
              flexShrink: 0,
              borderRadius: 4,
            }}
          />
          {!isSmallScreen && (
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: 'var(--bg-card)',
                letterSpacing: '-0.01em',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              ExamPlanner Admin
            </span>
          )}
        </div>

        {/* Breadcrumb Trail */}
        {!isTabletOrBelow && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 400 }}>Admin</span>
            <ChevronRight size={13} color="rgba(255, 255, 255, 0.35)" />
            <span style={{ color: 'var(--bg-card)', fontWeight: 600 }}>
              {currentViewLabel}
            </span>
          </div>
        )}
      </div>

      {/* Right: Notifications & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, position: 'relative' }}>
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
              borderRadius: 'var(--radius)',
              border: `1px solid ${showNotifications ? '#3B6EA8' : 'rgba(255, 255, 255, 0.12)'}`,
              backgroundColor: showNotifications ? 'rgba(59, 110, 168, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--bg-card)',
              transition: 'all 0.15s ease'
            }}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {notifications.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 6,
                  height: 6,
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--primary-red)'
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
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)' }}>System Alerts</span>
                  {notifications.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--radius)', backgroundColor: 'var(--bg-subtle)', color: 'var(--primary-red)' }}>
                      {notifications.length} New
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={isClearingNotifications}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isClearingNotifications ? 'var(--text-disabled)' : 'var(--text-muted)',
                      fontSize: 11,
                      cursor: isClearingNotifications ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      transition: 'color 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isClearingNotifications) e.currentTarget.style.color = 'var(--primary-red)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isClearingNotifications) e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                    title="Clear all system alerts"
                  >
                    <CheckCheck size={13} /> Clear
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', overflowX: 'hidden' }}>
                {notifications.length === 0 ? (
                  <div
                    className="notif-checked-up-state"
                    style={{
                      padding: '24px 12px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#059669',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
                      }}
                    >
                      <CheckCheck size={20} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--deep-navy)' }}>
                        You are all checked up!
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 220, margin: '0 auto', lineHeight: 1.4 }}>
                        No new system alerts right now. You're completely up to date.
                      </span>
                    </div>
                  </div>
                ) : (
                  notifications.map((item, idx) => {
                    const ItemIcon = item.icon || Bell;
                    const notifIdStr = String(item.id);
                    const isRemoving = removingNotifIds.has(notifIdStr);
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isClearingNotifications && !isRemoving && handleNotificationClick(item)}
                        className={isClearingNotifications || isRemoving ? 'notif-item-sliding-out' : ''}
                        style={{
                          padding: 10,
                          borderRadius: 'var(--radius)',
                          backgroundColor: 'var(--bg-subtle)',
                          border: '1px solid #E2E8F0',
                          borderLeft: '3px solid var(--primary-red)',
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          cursor: (isClearingNotifications || isRemoving) ? 'default' : 'pointer',
                          transition: 'background-color 150ms ease-out',
                          minHeight: 44,
                          animationDelay: isClearingNotifications ? `${idx * 40}ms` : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (!isClearingNotifications && !isRemoving) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isClearingNotifications && !isRemoving) e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                        }}
                      >
                        <div style={{ padding: 6, borderRadius: 'var(--radius)', backgroundColor: item.bg || 'rgba(59, 110, 168, 0.15)', color: item.color || '#3B6EA8', flexShrink: 0 }}>
                          <ItemIcon size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--deep-navy)', marginBottom: 2 }}>{item.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{item.desc}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-disabled)', marginTop: 3 }}>{item.time}</div>
                        </div>
                      </div>
                    );
                  })
                )}
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
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'var(--primary-red)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--bg-card)',
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
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
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
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--deep-navy)' }}>
                  {user?.full_name || 'System Administrator'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {user?.email || 'admin@examplanner.com'}
                </div>
              </div>

              <div style={{ paddingTop: 4 }}>
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
                    borderRadius: 'var(--radius)',
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

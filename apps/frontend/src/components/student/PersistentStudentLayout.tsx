import React, { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { StudentSidebar } from './StudentSidebar';
import { StudentTopHeader } from './StudentTopHeader';
import { fetchCurrentUser } from '../../services/authService';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Spinner } from '../common/Spinner';

export interface StudentLayoutContextValue {
  isPersistentShell: boolean;
  pageTitle: string;
  setPageTitle: (title: string) => void;
  user: any;
}

export const StudentLayoutContext = createContext<StudentLayoutContextValue | null>(null);

export function useStudentLayout() {
  return useContext(StudentLayoutContext);
}

function StudentContentFallback() {
  return (
    <div
      style={{
        width: '100%',
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      <Spinner size={36} />
      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
        Loading section...
      </div>
    </div>
  );
}

// Renewal reminder: shown when a paid subscription has 7 days or fewer left (or has just lapsed).
function SubscriptionExpiryNotice({ user }: { user: any }) {
  const days = user?.subscription_days_remaining;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('sub_notice_dismissed') === String(days);
    } catch {
      return false;
    }
  });

  if (days === null || days === undefined || days > 7 || dismissed) return null;

  const expired = days <= 0;
  const message = expired
    ? 'Your Premium subscription has ended. Renew to keep unlimited practice and analytics.'
    : `Your Premium subscription ends in ${days} day${days === 1 ? '' : 's'}. Renew to avoid losing access.`;

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 14px',
        marginBottom: 16,
        borderRadius: 'var(--radius)',
        backgroundColor: expired ? '#fef2f2' : '#fffbeb',
        border: `1px solid ${expired ? '#fecaca' : '#fde68a'}`,
        color: expired ? '#b91c1c' : '#92400e',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span>{message}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <a href="/pricing" style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 700 }}>
          Renew
        </a>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            try {
              sessionStorage.setItem('sub_notice_dismissed', String(days));
            } catch {
              /* storage unavailable — dismiss for this render only */
            }
            setDismissed(true);
          }}
          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>
      </span>
    </div>
  );
}

export function PersistentStudentLayout() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });
  const [pageTitle, setPageTitle] = useState('Dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { isTabletOrBelow } = useBreakpoint();
  const location = useLocation();

  // Close mobile sidebar whenever route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Fetch current user details once per persistent session
  useEffect(() => {
    fetchCurrentUser()
      .then((data) => {
        if (data) {
          setUser((prev: any) => {
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            const merged = {
              ...prev,
              ...data,
              profile_image: data?.profile_image || prev?.profile_image || stored?.profile_image,
            };
            localStorage.setItem('user', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch((err) => {
        console.error('Failed to fetch user data in layout shell:', err);
      });
  }, []);

  // Close mobile drawer when transitioning to desktop
  useEffect(() => {
    if (!isTabletOrBelow) {
      setMobileOpen(false);
    }
  }, [isTabletOrBelow]);

  const handleToggleSidebar = () => {
    if (isTabletOrBelow) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  const contentAreaClass = `student-content-area${collapsed ? ' sidebar-collapsed' : ''}`;

  return (
    <StudentLayoutContext.Provider
      value={{
        isPersistentShell: true,
        pageTitle,
        setPageTitle,
        user,
      }}
    >
      <div className="student-layout-root">
        {/* Full-width Top Header (stays permanently mounted) */}
        <StudentTopHeader
          user={user}
          pageTitle={pageTitle}
          onToggleSidebar={handleToggleSidebar}
        />

        {/* Main Container below Top Header */}
        <div className="student-main-container">
          {/* Sidebar Navigation (stays permanently mounted) */}
          <StudentSidebar
            user={user}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onToggleCollapse={handleToggleSidebar}
            onCloseMobile={() => setMobileOpen(false)}
          />

          {/* Main Content Area: Only swaps the child route */}
          <div className={contentAreaClass}>
            <main className="student-content-main">
              <SubscriptionExpiryNotice user={user} />
              <React.Suspense fallback={<StudentContentFallback />}>
                <Outlet />
              </React.Suspense>
            </main>
          </div>
        </div>
      </div>
    </StudentLayoutContext.Provider>
  );
}

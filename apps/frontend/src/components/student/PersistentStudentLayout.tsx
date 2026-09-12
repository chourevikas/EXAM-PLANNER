import React, { useState, useEffect, createContext, useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { StudentSidebar } from './StudentSidebar';
import { StudentTopHeader } from './StudentTopHeader';
import { fetchCurrentUser, syncGuestSessionsOnAuth } from '../../services/authService';
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

  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { getToken } = useAuth();
  const { isTabletOrBelow } = useBreakpoint();
  const location = useLocation();

  // Close mobile sidebar whenever route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Sync Clerk OAuth session once on mount/auth ready
  useEffect(() => {
    if (isClerkLoaded && clerkUser) {
      getToken()
        .then(async (token) => {
          if (token) {
            localStorage.setItem('access_token', token);
            await syncGuestSessionsOnAuth(token);
            sessionStorage.removeItem('pending_guest_sync');
            sessionStorage.removeItem('latest_synced_attempt_id');
          }
        })
        .catch((err) => console.error('Failed to sync Clerk token:', err));

      const email = clerkUser.primaryEmailAddress?.emailAddress;
      const name = clerkUser.fullName || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      const phone = clerkUser.primaryPhoneNumber?.phoneNumber || clerkUser.phoneNumbers?.[0]?.phoneNumber;

      setUser((prev: any) => {
        const updated = {
          ...prev,
          email: email || prev?.email || '',
          full_name: name || prev?.full_name || 'Aspirant',
          phone: phone || prev?.phone || '',
          avatar_url: clerkUser.imageUrl || prev?.avatar_url || prev?.profile_image || '',
          clerk_id: clerkUser.id,
        };
        localStorage.setItem('user', JSON.stringify(updated));
        return updated;
      });
    }
  }, [clerkUser, isClerkLoaded, getToken]);

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

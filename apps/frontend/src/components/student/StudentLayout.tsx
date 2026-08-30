import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { StudentSidebar } from './StudentSidebar';
import { StudentTopHeader } from './StudentTopHeader';
import { fetchCurrentUser, syncGuestSessionsOnAuth } from '../../services/authService';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface StudentLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
}

export function StudentLayout({ children, pageTitle }: StudentLayoutProps) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { isMobile, isTabletOrBelow } = useBreakpoint();

  useEffect(() => {
    if (isClerkLoaded && clerkUser) {
      getToken().then(async (token) => {
        if (token) {
          localStorage.setItem('access_token', token);

          // Auto-sync guest exam attempts silently for Clerk OAuth user
          await syncGuestSessionsOnAuth(token);
          sessionStorage.removeItem('pending_guest_sync');
          sessionStorage.removeItem('latest_synced_attempt_id');
        }
      }).catch(err => console.error("Failed to sync Clerk token:", err));

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
  }, [clerkUser, isClerkLoaded, getToken, navigate]);

  useEffect(() => {
    document.title = `${pageTitle} - ExamPlanner`;
    fetchCurrentUser().then(data => {
      setUser((prev: any) => {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const merged = {
          ...prev,
          ...data,
          profile_image: data?.profile_image || prev?.profile_image || stored?.profile_image
        };
        localStorage.setItem('user', JSON.stringify(merged));
        return merged;
      });
    }).catch(err => {
      console.error("Failed to fetch user data:", err);
    });
  }, [pageTitle]);

  // Close mobile sidebar when transitioning to desktop
  useEffect(() => {
    if (!isTabletOrBelow) {
      setMobileOpen(false);
    }
  }, [isTabletOrBelow]);

  const handleToggleSidebar = () => {
    if (isTabletOrBelow) {
      setMobileOpen(!mobileOpen);
    } else {
      setCollapsed(!collapsed);
    }
  };

  // Determine CSS class for content area margin
  const contentAreaClass = `student-content-area${collapsed ? ' sidebar-collapsed' : ''}`;

  return (
    <div className="student-layout-root">
      
      {/* Full-width Top Header (fixed at top 0, left 0, right 0) */}
      <StudentTopHeader 
        user={user} 
        pageTitle={pageTitle} 
        onToggleSidebar={handleToggleSidebar} 
      />

      {/* Main Container below Top Header */}
      <div className="student-main-container">
        
        {/* Sidebar Navigation (fixed top: 60px, below header) */}
        <StudentSidebar 
          user={user} 
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapse={handleToggleSidebar}
          onCloseMobile={() => setMobileOpen(false)}
        />

        {/* Main Content Area */}
        <div className={contentAreaClass}>
          {/* Page Content Viewport */}
          <main className="student-content-main">
            {children}
          </main>
        </div>

      </div>
    </div>
  );
}

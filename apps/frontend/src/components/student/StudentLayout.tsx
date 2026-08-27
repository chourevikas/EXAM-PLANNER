import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { StudentSidebar } from './StudentSidebar';
import { StudentTopHeader } from './StudentTopHeader';
import { fetchCurrentUser, syncGuestSessionsOnAuth } from '../../services/authService';

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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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

    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageTitle]);

  const handleToggleSidebar = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setCollapsed(!collapsed);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#0F172A', overflowX: 'hidden' }}>
      
      {/* Full-width Top Header (fixed at top 0, left 0, right 0) */}
      <StudentTopHeader 
        user={user} 
        pageTitle={pageTitle} 
        onToggleSidebar={handleToggleSidebar} 
      />

      {/* Main Container below Top Header */}
      <div style={{ display: 'flex', flex: 1, marginTop: '60px' }}>
        
        {/* Sidebar Navigation (fixed top: 60px, below header) */}
        <StudentSidebar 
          user={user} 
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggleCollapse={handleToggleSidebar}
          onCloseMobile={() => setMobileOpen(false)}
        />

        {/* Main Content Area */}
        <div 
          style={{ 
            flex: 1, 
            marginLeft: isMobile ? 0 : (collapsed ? '68px' : '240px'), 
            display: 'flex', 
            flexDirection: 'column', 
            minWidth: 0,
            transition: 'margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            width: '100%'
          }}
        >
          {/* Page Content Viewport */}
          <main style={{ 
            padding: isMobile ? '16px' : '28px 36px', 
            maxWidth: '1360px', 
            margin: '0 auto', 
            width: '100%', 
            boxSizing: 'border-box' 
          }}>
            {children}
          </main>
        </div>

      </div>
    </div>
  );
}

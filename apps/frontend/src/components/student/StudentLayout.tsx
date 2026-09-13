import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudentSidebar } from './StudentSidebar';
import { StudentTopHeader } from './StudentTopHeader';
import { fetchCurrentUser } from '../../services/authService';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { StudentLayoutContext } from './PersistentStudentLayout';

interface StudentLayoutProps {
  children: React.ReactNode;
  pageTitle: string;
}

export function StudentLayout({ children, pageTitle }: StudentLayoutProps) {
  const persistentContext = useContext(StudentLayoutContext);

  // If nested inside PersistentStudentLayout, synchronize title and render children directly
  useEffect(() => {
    if (persistentContext && pageTitle) {
      persistentContext.setPageTitle(pageTitle);
      document.title = `${pageTitle} - ExamPlanner`;
    }
  }, [persistentContext, pageTitle]);

  if (persistentContext) {
    return <>{children}</>;
  }

  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { isMobile, isTabletOrBelow } = useBreakpoint();

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

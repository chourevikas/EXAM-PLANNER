import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  ClipboardCheck,
  GraduationCap,
  Users,
  BarChart2,
  Award,
  X,
  MessageSquareQuote,
  Flag,
  Globe,
  Sliders,
  Bell,
  Palette,
} from 'lucide-react';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { canAccessView } from '../../constants/adminAccess';

interface SidebarProps {
  activeView: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  /** Granted admin sections; null/undefined = unrestricted. */
  permissions?: string[] | null;
  /** Number of questions with open student reports (badge on the Reported Questions item). */
  reportedCount?: number;
}

export function AdminSidebar({
  activeView,
  onNavigate,
  collapsed,
  mobileOpen = false,
  onCloseMobile,
  permissions,
  reportedCount = 0,
}: SidebarProps) {
  const { isTabletOrBelow: isMobile } = useBreakpoint();

  // Escape key handler
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseMobile) {
        onCloseMobile();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && mobileOpen) {
      document.body.classList.add('scroll-lock');
    } else {
      document.body.classList.remove('scroll-lock');
    }
    return () => {
      document.body.classList.remove('scroll-lock');
    };
  }, [isMobile, mobileOpen]);

  const coreNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: Upload, label: 'Upload & Exam Pipeline', id: 'upload' },
    { icon: Sliders, label: 'Exam Types', id: 'exam-types' },
    { icon: ClipboardCheck, label: 'Question & Solution QA', id: 'review' },
    { icon: BookOpen, label: 'Question Bank Catalog', id: 'questions' },
    { icon: Flag, label: 'Reported Questions', id: 'reported-questions' },
    // Mock Tests section removed from UI while keeping code intact
  ];

  const managementNavItems = [
    { icon: Users, label: 'Users', id: 'users' },
    { icon: Award, label: 'Teacher Rewards', id: 'teacher-rewards' },
    { icon: Globe, label: 'Current Affairs', id: 'current-affairs' },
    { icon: Bell, label: 'Notifications', id: 'notifications' },
    { icon: MessageSquareQuote, label: 'Testimonial Approvals', id: 'testimonials' },
    { icon: BarChart2, label: 'Reports & Analytics', id: 'analytics' },
    { icon: Palette, label: 'Theme', id: 'theme' },
  ];

const prefetchedAdmin = new Set<string>();
function prefetchAdminView(viewId: string) {
  if (prefetchedAdmin.has(viewId)) return;
  prefetchedAdmin.add(viewId);
  switch (viewId) {
    case 'dashboard':
      import('./AdminOverviewView');
      break;
    case 'upload':
    case 'ai-queue':
      import('./UploadReviewView');
      break;
    case 'exam-types':
      import('./views/ExamTypesManager');
      break;
    case 'review':
      import('./views/QuestionReviewView');
      break;
    case 'questions':
      import('./QuestionBankManager');
      break;
    case 'users':
      import('./views/UsersView');
      break;
    case 'teacher-rewards':
      import('./views/TeacherRewardsView');
      break;
    case 'current-affairs':
      import('./views/CurrentAffairsManager');
      break;
    case 'notifications':
      import('./views/NotificationsView');
      break;
    case 'analytics':
      import('./views/AnalyticsView');
      break;
    case 'reported-questions':
      import('./views/ReportedQuestionsView');
      break;
    case 'testimonials':
      import('./views/TestimonialsView');
      break;
    case 'theme':
      import('./views/ThemeSettingsView');
      break;
  }
}

  const renderNavItem = (item: { icon: any, label: string, id: string }) => {
    const isActive = activeView === item.id;
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        onClick={() => {
          onNavigate(item.id);
          if (onCloseMobile) onCloseMobile();
        }}
        onTouchStart={() => prefetchAdminView(item.id)}
        onMouseEnter={(e) => {
          prefetchAdminView(item.id);
          if (!isActive) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'var(--bg-card)';
          }
        }}
        title={collapsed && !isMobile ? item.label : undefined}
        className="touch-target"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: (collapsed && !isMobile) ? '10px 0' : '10px 14px',
          justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
          borderRadius: 'var(--radius)',
          background: isActive ? 'rgba(var(--primary-red-rgb), 0.15)' : 'transparent',
          border: 'none',
          borderLeft: isActive && (!collapsed || isMobile) ? '3px solid var(--primary-red)' : '3px solid transparent',
          color: isActive ? 'var(--bg-card)' : 'rgba(255, 255, 255, 0.65)',
          cursor: 'pointer',
          fontSize: 13.5,
          fontFamily: 'Inter, sans-serif',
          fontWeight: isActive ? 600 : 400,
          transition: 'all 0.15s ease',
          width: '100%',
          textAlign: 'left',
          whiteSpace: 'nowrap',
          minHeight: 44,
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
          }
        }}
      >
        <Icon size={17} color={isActive ? 'var(--primary-red)' : 'rgba(255, 255, 255, 0.65)'} style={{ flexShrink: 0 }} />
        {(!collapsed || isMobile) && <span>{item.label}</span>}
        {item.id === 'reported-questions' && reportedCount > 0 && (!collapsed || isMobile) && (
          <span
            aria-label={`${reportedCount} open reports`}
            style={{
              marginLeft: 'auto',
              minWidth: 20,
              padding: '1px 7px',
              borderRadius: 'var(--radius)',
              background: 'var(--primary-red)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {reportedCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            top: 60,
            background: 'rgba(23, 32, 51, 0.75)',
            backdropFilter: 'blur(2px)',
            zIndex: 110
          }}
          aria-hidden="true"
        />
      )}

      <aside
        style={{
          width: isMobile ? 260 : (collapsed ? 68 : 240),
          minWidth: isMobile ? 260 : (collapsed ? 68 : 240),
          background: 'var(--deep-navy)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 60,
          left: 0,
          // Bleed 120px below the viewport (and pad it back) so iOS Safari's collapsing toolbar can
          // never expose page background under the sidebar.
          bottom: -120,
          paddingBottom: 120,
          boxSizing: 'border-box',
          zIndex: 120,
          // Own compositing layer: keeps the fixed sidebar from scrolling with the page on iOS.
          transform: isMobile ? (mobileOpen ? 'translate3d(0, 0, 0)' : 'translate3d(-100%, 0, 0)') : 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s ease, min-width 0.2s ease',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden'
        }}
        role="navigation"
        aria-label="Admin Navigation"
      >
        {/* The top-nav hamburger toggles this sidebar; the drawer only needs a close button. */}
        {isMobile && onCloseMobile && (
          <div style={{ padding: '12px 12px 0 12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onCloseMobile}
              className="touch-target"
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Navigation Items List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 10px', flex: 1, overflowY: 'auto' }}>
          {coreNavItems.filter((i) => canAccessView(permissions, i.id)).map(renderNavItem)}

          {(!collapsed || isMobile) && (
            <div
              style={{
                margin: '18px 10px 6px 10px',
                fontSize: 11,
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.45)',
                letterSpacing: '0.08em',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              MANAGEMENT & ANALYTICS
            </div>
          )}
          {managementNavItems.filter((i) => canAccessView(permissions, i.id)).map(renderNavItem)}
        </nav>
      </aside>
    </>
  );
}

import React, { useState, useEffect, lazy, Suspense, startTransition } from 'react';
import { AdminSidebar } from '../components/admin/AdminSidebar';
import { AdminTopNav } from '../components/admin/AdminTopNav';
import { fetchCurrentUser } from '../services/authService';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Spinner } from '../components/common/Spinner';
import { canAccessView, canOpenView } from '../constants/adminAccess';
import { fetchReportedSummary } from '../services/questionReportService';
import { fetchFeedbackSummary } from '../services/feedbackService';

/* Lazy-loaded View Components for instant initial load & smooth switching */
const AdminOverviewView = lazy(() => import('../components/admin/AdminOverviewView').then(m => ({ default: m.AdminOverviewView })));
const QuestionBankManager = lazy(() => import('../components/admin/QuestionBankManager').then(m => ({ default: m.QuestionBankManager })));
const UploadReviewView = lazy(() => import('../components/admin/UploadReviewView').then(m => ({ default: m.UploadReviewView })));
const QuestionReviewView = lazy(() => import('../components/admin/views/QuestionReviewView').then(m => ({ default: m.QuestionReviewView })));
const MockTestsView = lazy(() => import('../components/admin/views/MockTestsView').then(m => ({ default: m.MockTestsView })));
const UsersView = lazy(() => import('../components/admin/views/UsersView').then(m => ({ default: m.UsersView })));
const AnalyticsView = lazy(() => import('../components/admin/views/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const TeacherRewardsView = lazy(() => import('../components/admin/views/TeacherRewardsView').then(m => ({ default: m.TeacherRewardsView })));
const CurrentAffairsManager = lazy(() => import('../components/admin/views/CurrentAffairsManager').then(m => ({ default: m.CurrentAffairsManager })));
const ExamTypesManager = lazy(() => import('../components/admin/views/ExamTypesManager').then(m => ({ default: m.ExamTypesManager })));
const NotificationsView = lazy(() => import('../components/admin/views/NotificationsView').then(m => ({ default: m.NotificationsView })));
const MilestonesView = lazy(() => import('../components/admin/views/MilestonesView').then(m => ({ default: m.MilestonesView })));
const TranslationsView = lazy(() => import('../components/admin/views/TranslationsView').then(m => ({ default: m.TranslationsView })));
const FeedbackView = lazy(() => import('../components/admin/views/FeedbackView').then(m => ({ default: m.FeedbackView })));
const ReportedQuestionsView = lazy(() => import('../components/admin/views/ReportedQuestionsView').then(m => ({ default: m.ReportedQuestionsView })));
const TestimonialsView = lazy(() => import('../components/admin/views/TestimonialsView').then(m => ({ default: m.TestimonialsView })));
const ExamSyllabusPanel = lazy(() => import('../components/admin/syllabus/ExamSyllabusPanel').then(m => ({ default: m.ExamSyllabusPanel })));
const ThemeSettingsView = lazy(() => import('../components/admin/views/ThemeSettingsView').then(m => ({ default: m.ThemeSettingsView })));

function NoAccessView({ onHome }: { onHome: () => void }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--deep-navy)', margin: '0 0 8px' }}>No access to this section</h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 20px' }}>
        Your role does not include this part of the admin panel. Ask a super admin if you need it.
      </p>
      <button
        type="button"
        onClick={onHome}
        style={{ padding: '9px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontWeight: 600, cursor: 'pointer' }}
      >
        Back to dashboard
      </button>
    </div>
  );
}

function AdminViewSkeleton() {
  return (
    <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px', gap: 12 }}>
      <Spinner size={32} />
      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Loading admin module...</div>
    </div>
  );
}

export function AdminPage() {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedExamForReview, setSelectedExamForReview] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isMobile, isTabletOrBelow } = useBreakpoint();

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    document.title = "Admin Dashboard - ExamPlanner";
    fetchCurrentUser().then(data => {
      setUser(data);
    }).catch(err => {
      console.error("Failed to fetch user data:", err);
    });
  }, []);

  // Close mobile drawer when transitioning to desktop/wide screen
  useEffect(() => {
    if (!isTabletOrBelow) {
      setMobileOpen(false);
    }
  }, [isTabletOrBelow]);

  const handleToggleSidebar = () => {
    if (isTabletOrBelow) {
      setMobileOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const permissions: string[] | null | undefined = user?.admin_permissions;

  // Open-report count for the sidebar badge (only when this admin can see the section).
  const [reportedCount, setReportedCount] = useState(0);
  const refreshReportedCount = () => {
    if (!canAccessView(permissions, 'reported-questions')) return;
    fetchReportedSummary()
      .then((s) => setReportedCount(s.open_questions))
      .catch(() => {});
  };
  const [feedbackCount, setFeedbackCount] = useState(0);
  const refreshFeedbackCount = () => {
    if (!canAccessView(permissions, 'feedback')) return;
    fetchFeedbackSummary()
      .then((s) => setFeedbackCount(s.open))
      .catch(() => {});
  };
  useEffect(() => {
    refreshReportedCount();
    refreshFeedbackCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, JSON.stringify(permissions)]);

  const handleNavigate = (view: string, extraData?: any) => {
    if (!canOpenView(permissions, view)) return;
    startTransition(() => {
      setActiveView(view);
      if (extraData !== undefined) {
        setSelectedExamForReview(extraData);
      } else if (view !== 'review') {
        setSelectedExamForReview(null);
      }
    });
    if (isTabletOrBelow) setMobileOpen(false);
  };

  const renderView = () => {
    if (!canOpenView(permissions, activeView)) return <NoAccessView onHome={() => handleNavigate('dashboard')} />;
    switch (activeView) {
      case 'dashboard':
        return <AdminOverviewView onNavigate={handleNavigate} permissions={permissions} />;
      case 'ai-queue':
        return <UploadReviewView initialTab="PIPELINE_ONLY" onNavigate={handleNavigate} />;
      case 'upload':
        return (
          <UploadReviewView
            // Only explicit shortcuts (e.g. the dashboard's "Upload New Paper" quick action)
            // should auto-open the upload dialog; plain navigation (sidebar, search) lands
            // on the pipeline table instead.
            initialTab={selectedExamForReview === 'UPLOAD_ONLY' ? 'UPLOAD_ONLY' : 'PIPELINE_ONLY'}
            onNavigate={handleNavigate}
          />
        );
      case 'questions':
        return <QuestionBankManager onNavigate={handleNavigate} />;
      case 'exam-types':
        return <ExamTypesManager onOpenSyllabus={(examType) => handleNavigate('exam-syllabus', examType)} />;
      case 'exam-syllabus':
        // The exam type comes from Exam Types → Syllabus; without one, go back to the list
        return selectedExamForReview?.id ? (
          <ExamSyllabusPanel
            key={selectedExamForReview.id}
            examType={{ id: Number(selectedExamForReview.id), type: selectedExamForReview.type, name: selectedExamForReview.name }}
            onClose={() => handleNavigate('exam-types')}
          />
        ) : (
          <ExamTypesManager onOpenSyllabus={(examType) => handleNavigate('exam-syllabus', examType)} />
        );
      case 'review':
        return <QuestionReviewView initialExam={selectedExamForReview} onNavigate={handleNavigate} />;
      case 'mock-tests':
        return <MockTestsView />;
      case 'users':
        return <UsersView />;
      case 'teacher-rewards':
        return <TeacherRewardsView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'current-affairs':
        return <CurrentAffairsManager />;
      case 'milestones':
        return <MilestonesView />;
      case 'translations':
        return <TranslationsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'testimonials':
        return <TestimonialsView />;
      case 'reported-questions':
        return <ReportedQuestionsView onNavigate={handleNavigate} onChanged={refreshReportedCount} />;
      case 'feedback':
        return <FeedbackView onChanged={refreshFeedbackCount} />;
      case 'theme':
        return <ThemeSettingsView />;
      default:
        return <AdminOverviewView onNavigate={handleNavigate} permissions={permissions} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F7F7F5', fontFamily: 'Inter, sans-serif', color: 'var(--deep-navy)', overflowX: 'clip' }}>
      
      {/* Full-width Top Header (fixed at top: 0) */}
      <AdminTopNav 
        user={user}
        activeView={activeView}
        onNavigate={handleNavigate}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* Main Container below Top Header */}
      <div style={{ display: 'flex', flex: 1, marginTop: '60px' }}>
        
        {/* Sidebar Navigation (fixed top: 60px) */}
        <AdminSidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          permissions={permissions}
          reportedCount={reportedCount}
          feedbackCount={feedbackCount}
        />

        {/* Main Content Area */}
        <div 
          style={{ 
            flex: 1, 
            marginLeft: isTabletOrBelow ? 0 : (sidebarCollapsed ? '68px' : '240px'), 
            display: 'flex', 
            flexDirection: 'column', 
            minWidth: 0,
            transition: 'margin-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            width: '100%'
          }}
        >
          {/* Page Content Viewport */}
          <main style={{ 
            flex: 1, 
            overflowY: 'auto', 
            background: '#F7F7F5', 
            padding: isMobile ? '12px 10px' : isTabletOrBelow ? '14px 14px' : '14px 16px', 
            boxSizing: 'border-box' 
          }}>
            <Suspense fallback={<AdminViewSkeleton />}>
              {renderView()}
            </Suspense>
          </main>
        </div>

      </div>
    </div>
  );
}

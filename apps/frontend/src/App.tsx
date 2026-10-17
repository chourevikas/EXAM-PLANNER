import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/clerk-react';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { UserRole } from './types/auth';

const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const StudyPlannerPage = lazy(() =>
  import('./pages/StudyPlannerPage').then((m) => ({ default: m.StudyPlannerPage })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const WeeklyInsightsPage = lazy(() =>
  import('./pages/WeeklyInsightsPage').then((m) => ({ default: m.WeeklyInsightsPage })),
);
const MonthlyReportPage = lazy(() =>
  import('./pages/MonthlyReportPage').then((m) => ({ default: m.MonthlyReportPage })),
);
const LeaderboardPage = lazy(() =>
  import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const GuestExamPage = lazy(() =>
  import('./pages/GuestExamPage').then((m) => ({ default: m.GuestExamPage })),
);
const StudentPracticeExamPage = lazy(() =>
  import('./pages/StudentPracticeExamPage').then((m) => ({ default: m.StudentPracticeExamPage })),
);
const ExamEnginePage = lazy(() =>
  import('./pages/ExamEnginePage').then((m) => ({ default: m.ExamEnginePage })),
);
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const ChangePasswordPage = lazy(() =>
  import('./pages/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage })),
);
const TeacherPage = lazy(() =>
  import('./pages/TeacherPage').then((m) => ({ default: m.TeacherPage })),
);
const PYQSelectionPage = lazy(() =>
  import('./pages/PYQSelectionPage').then((m) => ({ default: m.PYQSelectionPage })),
);
const MockSelectionPage = lazy(() =>
  import('./pages/MockSelectionPage').then((m) => ({ default: m.MockSelectionPage })),
);
const PricingPage = lazy(() =>
  import('./pages/PricingPage').then((m) => ({ default: m.PricingPage })),
);
const VerifyEmailPage = lazy(() =>
  import('./pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
);
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const BookmarksPage = lazy(() =>
  import('./pages/BookmarksPage').then((m) => ({ default: m.BookmarksPage })),
);
const CurrentAffairsPage = lazy(() =>
  import('./pages/CurrentAffairsPage').then((m) => ({ default: m.CurrentAffairsPage })),
);
const CurrentAffairsDetailPage = lazy(() =>
  import('./pages/CurrentAffairsDetailPage').then((m) => ({ default: m.CurrentAffairsDetailPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const ChallengesPage = lazy(() =>
  import('./pages/ChallengesPage').then((m) => ({ default: m.ChallengesPage })),
);
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const ChallengeDetailPage = lazy(() =>
  import('./pages/ChallengeDetailPage').then((m) => ({ default: m.ChallengeDetailPage })),
);
const ChallengeAttemptPage = lazy(() =>
  import('./pages/ChallengeAttemptPage').then((m) => ({ default: m.ChallengeAttemptPage })),
);
const PublicChallengePage = lazy(() =>
  import('./pages/PublicChallengePage').then((m) => ({ default: m.PublicChallengePage })),
);

import { GlobalThemeToggle } from './components/common/GlobalThemeToggle';
import { Spinner } from './components/common/Spinner';
import { ThemeProvider } from './contexts/ThemeContext';
import { PersistentStudentLayout } from './components/student/PersistentStudentLayout';
import { ClerkExchangeBridge } from './components/common/ClerkExchangeBridge';
import { MarketingRedirect } from './components/common/MarketingRedirect';


function LoadingFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8FAFC',
      }}
    >
      <Spinner size={40} />
    </div>
  );
}

import { useEffect } from 'react';

/** Unknown paths: signed-in users go to their dashboard, guests to the marketing homepage. */
function UnknownRoute() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return <LoadingFallback />;
  const hasCustomToken = !!localStorage.getItem('access_token');
  return isSignedIn || hasCustomToken ? <Navigate to="/dashboard" replace /> : <MarketingRedirect to="/" />;
}
/**
 * Public PYQ links (homepage featured PYQs, search, exam pages) land on /guest-exam.
 * Signed-in users get the real practice session instead, with the same filters.
 */
function GuestExamRoute() {
  const { isSignedIn, isLoaded } = useAuth();
  const { search } = useLocation();
  const hasCustomToken = !!localStorage.getItem('access_token');
  if (hasCustomToken || (isLoaded && isSignedIn)) {
    return <Navigate to={`/practice-exam${search}`} replace />;
  }
  if (!isLoaded) return <LoadingFallback />;
  return <GuestExamPage />;
}
import { hydrateSession } from './services/authService';

export default function App() {
  useEffect(() => {
    hydrateSession();
  }, []);

  return (
    <BrowserRouter>
      <ThemeProvider>
      <ClerkExchangeBridge />
      <GlobalThemeToggle />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public marketing pages are served by the Astro site (apps/marketing) */}
          {['/', '/about', '/contact', '/pricing', '/exams/*', '/current-affairs/*', '/privacy', '/terms', '/refund-policy'].map(
            (path) => <Route key={path} path={path} element={<MarketingRedirect />} />,
          )}
          <Route path="/signin" element={<AuthPage initialMode="login" />} />
          <Route path="/login" element={<AuthPage initialMode="login" />} />
          <Route path="/signup" element={<AuthPage initialMode="signup" />} />
          <Route path="/register" element={<AuthPage initialMode="signup" />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/guest-exam" element={<GuestExamRoute />} />
          <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />

          {/* Student Practice Exam - Protected Route */}
          <Route
            path="/practice-exam"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <StudentPracticeExamPage />
              </ProtectedRoute>
            }
          />

          {/* Exam Engine - Protected Route */}
          <Route
            path="/exam/:examId"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <ExamEnginePage />
              </ProtectedRoute>
            }
          />
          <Route path="/challenge/:token" element={<PublicChallengePage />} />

          {/* First-login onboarding (students only) */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* Persistent Student Portal Shell — Stays mounted on all student routes */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <PersistentStudentLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/learn/current-affairs" element={<CurrentAffairsPage />} />
            <Route path="/learn/current-affairs/:id" element={<CurrentAffairsDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/notifications/:id" element={<NotificationsPage />} />
            <Route path="/challenges" element={<ChallengesPage />} />
            {/* Creating a challenge is now a modal on /challenges; keep old links working */}
            <Route path="/challenges/new" element={<Navigate to="/challenges" replace />} />
            <Route path="/challenges/attempt/:idOrToken" element={<ChallengeAttemptPage />} />
            <Route path="/challenges/:id" element={<ChallengeDetailPage />} />
            <Route path="/study-planner" element={<StudyPlannerPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/reports/weekly" element={<WeeklyInsightsPage />} />
            <Route path="/reports/monthly" element={<MonthlyReportPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/pyq" element={<PYQSelectionPage />} />
            <Route path="/mocks" element={<MockSelectionPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/billing" element={<PricingPage />} />
          </Route>
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRoles={[UserRole.TEACHER]}>
                <TeacherPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<UnknownRoute />} />
        </Routes>
      </Suspense>
      </ThemeProvider>
    </BrowserRouter>
  );
}

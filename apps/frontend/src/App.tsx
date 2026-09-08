import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { UserRole } from './types/auth';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
const SignInPage = lazy(() =>
  import('./pages/SignInPage').then((m) => ({ default: m.SignInPage })),
);
const SignUpPage = lazy(() =>
  import('./pages/SignUpPage').then((m) => ({ default: m.SignUpPage })),
);
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
const SuperAdminPage = lazy(() =>
  import('./pages/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage })),
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
const ExamsPage = lazy(() => import('./pages/ExamsPage').then((m) => ({ default: m.ExamsPage })));
const AboutUsPage = lazy(() =>
  import('./pages/AboutUsPage').then((m) => ({ default: m.AboutUsPage })),
);
const ContactUsPage = lazy(() =>
  import('./pages/ContactUsPage').then((m) => ({ default: m.ContactUsPage })),
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

import { GlobalThemeToggle } from './components/common/GlobalThemeToggle';
import { Spinner } from './components/common/Spinner';


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

export default function App() {
  return (
    <BrowserRouter>
      <GlobalThemeToggle />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<LandingPage initialAuthMode="login" />} />
          <Route path="/login" element={<LandingPage initialAuthMode="login" />} />
          <Route path="/signup" element={<LandingPage initialAuthMode="signup" />} />
          <Route path="/register" element={<LandingPage initialAuthMode="signup" />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/guest-exam" element={<GuestExamPage />} />
          <Route path="/exams" element={<ExamsPage />} />
          <Route path="/about" element={<AboutUsPage />} />
          <Route path="/contact" element={<ContactUsPage />} />

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
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/current-affairs"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <CurrentAffairsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/current-affairs/:id"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <CurrentAffairsDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications/:id"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/study-planner"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <StudyPlannerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/weekly"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <WeeklyInsightsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/monthly"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <MonthlyReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pyq"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <PYQSelectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mocks"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <MockSelectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookmarks"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <BookmarksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pricing"
            element={
              <ProtectedRoute
                allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}
              >
                <PricingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/superadmin"
            element={
              <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                <SuperAdminPage />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

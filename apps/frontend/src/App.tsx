import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { UserRole } from './types/auth';

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const SignInPage = lazy(() =>
  import('./pages/SignInPage').then((m) => ({ default: m.SignInPage }))
);
const SignUpPage = lazy(() =>
  import('./pages/SignUpPage').then((m) => ({ default: m.SignUpPage }))
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const StudyPlannerPage = lazy(() =>
  import('./pages/StudyPlannerPage').then((m) => ({ default: m.StudyPlannerPage }))
);
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
);
const WeeklyInsightsPage = lazy(() =>
  import('./pages/WeeklyInsightsPage').then((m) => ({ default: m.WeeklyInsightsPage }))
);
const MonthlyReportPage = lazy(() =>
  import('./pages/MonthlyReportPage').then((m) => ({ default: m.MonthlyReportPage }))
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const GuestExamPage = lazy(() =>
  import('./pages/GuestExamPage').then((m) => ({ default: m.GuestExamPage }))
);
const StudentPracticeExamPage = lazy(() =>
  import('./pages/StudentPracticeExamPage').then((m) => ({ default: m.StudentPracticeExamPage }))
);
const ExamEnginePage = lazy(() =>
  import('./pages/ExamEnginePage').then((m) => ({ default: m.ExamEnginePage }))
);
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((m) => ({ default: m.AdminPage }))
);
const SuperAdminPage = lazy(() =>
  import('./pages/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage }))
);
const PYQSelectionPage = lazy(() =>
  import('./pages/PYQSelectionPage').then((m) => ({ default: m.PYQSelectionPage }))
);
const MockSelectionPage = lazy(() =>
  import('./pages/MockSelectionPage').then((m) => ({ default: m.MockSelectionPage }))
);
const PricingPage = lazy(() =>
  import('./pages/PricingPage').then((m) => ({ default: m.PricingPage }))
);
const VerifyEmailPage = lazy(() =>
  import('./pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage }))
);
const BookmarksPage = lazy(() =>
  import('./pages/BookmarksPage').then((m) => ({ default: m.BookmarksPage }))
);

import { GlobalThemeToggle } from './components/common/GlobalThemeToggle';

function LoadingFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FAFAF7',
        fontFamily: 'system-ui, sans-serif',
        color: '#2563EB',
        fontSize: '18px',
        fontWeight: 600,
      }}
    >
      Loading ExamPlanner...
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
          <Route path="/guest-exam" element={<GuestExamPage />} />

          {/* Student Practice Exam - Protected Route */}
          <Route
            path="/practice-exam"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <StudentPracticeExamPage />
              </ProtectedRoute>
            }
          />

          {/* Exam Engine - Protected Route */}
          <Route
            path="/exam/:examId"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <ExamEnginePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/study-planner"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <StudyPlannerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/weekly"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <WeeklyInsightsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/monthly"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <MonthlyReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pyq"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <PYQSelectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mocks"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <MockSelectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookmarks"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
                <BookmarksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pricing"
            element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

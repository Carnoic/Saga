import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { UserRole } from '@saga/shared';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SubGoalsPage from './pages/SubGoalsPage';
import CalendarPage from './pages/CalendarPage';
import CertificatesPage from './pages/CertificatesPage';
import AssessmentsPage from './pages/AssessmentsPage';
import SupervisionPage from './pages/SupervisionPage';
import CoursesPage from './pages/CoursesPage';
import StudyDirectorPage from './pages/StudyDirectorPage';
import TraineeDetailPage from './pages/TraineeDetailPage';
import ExportPage from './pages/ExportPage';
import SettingsPage from './pages/SettingsPage';

// Protected route wrapper
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="delmal" element={<SubGoalsPage />} />
        <Route path="kalender" element={<CalendarPage />} />
        <Route path="intyg" element={<CertificatesPage />} />
        <Route path="bedomningar" element={<AssessmentsPage />} />
        <Route path="handledarsamtal" element={<SupervisionPage />} />
        <Route path="kurser" element={<CoursesPage />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="installningar" element={<SettingsPage />} />

        {/* Study director routes */}
        <Route
          path="studierektor"
          element={
            <ProtectedRoute allowedRoles={[UserRole.STUDIEREKTOR, UserRole.ADMIN]}>
              <StudyDirectorPage />
            </ProtectedRoute>
          }
        />

        {/* Trainee detail (for supervisors/study directors) */}
        <Route
          path="trainee/:traineeId"
          element={
            <ProtectedRoute allowedRoles={[UserRole.HANDLEDARE, UserRole.STUDIEREKTOR, UserRole.ADMIN]}>
              <TraineeDetailPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

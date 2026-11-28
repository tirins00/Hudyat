import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './authContext.js';
import { getRoleHomePath } from '../services/AuthService.js';
import { ROLES } from '../types/models.js';
import ActiveDrillWatcher from '../components/ActiveDrillWatcher.jsx';
import AdminHomeView from '../components/admin/AdminHomeView.jsx';
import CoordinatorHomeView from '../components/coordinator/CoordinatorHomeView.jsx';
import StudentHomeView from '../components/student/StudentHomeView.jsx';
import TeacherHomeView from '../components/teacher/TeacherHomeView.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import ExpectedListPage from '../pages/ExpectedListPage.jsx';
import RosterImportPage from '../pages/RosterImportPage.jsx';
import RouteScreen from '../pages/RouteScreen.jsx';
import QrSheet from '../pages/QrSheet.jsx';
import CampusSetupPage from '../pages/CampusSetupPage.jsx';
import ReportPage from '../pages/ReportPage.jsx';
import HeadcountBoard from '../pages/HeadcountBoard.jsx';
import CheckInScreen from '../pages/CheckInScreen.jsx';
import AssistedCheckInPage from '../pages/AssistedCheckInPage.jsx';
import SosPage from '../pages/SosPage.jsx';
import DrillDashboard from '../pages/DrillDashboard.jsx';
import AlertScreen from '../pages/AlertScreen.jsx';
import StepScreen from '../pages/StepScreen.jsx';

function RoleGuard({ allowedRole, allowedRoles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <p className="text-base font-medium text-slate-800" role="status">
          Loading session…
        </p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const permitted = allowedRoles
    ? allowedRoles.includes(user.role)
    : user.role === allowedRole;

  if (!permitted) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <p className="text-base font-medium text-slate-800" role="status">
          Loading session…
        </p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getRoleHomePath(user.role)} replace />;
}

function RoleRouter() {
  return (
    <ActiveDrillWatcher>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Student routes */}
        <Route
          path="/student/check-in"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <CheckInScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/student/assisted-check-in"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <AssistedCheckInPage />
            </RoleGuard>
          }
        />
        <Route
          path="/student/sos"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <SosPage />
            </RoleGuard>
          }
        />
        <Route
          path="/student/alert"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <AlertScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/student/step"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <StepScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/student/steps"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <StepScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/student/route"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <RouteScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/student/*"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <StudentHomeView />
            </RoleGuard>
          }
        />

        {/* Teacher routes */}
        <Route
          path="/teacher/assisted-check-in"
          element={
            <RoleGuard allowedRole={ROLES.TEACHER}>
              <AssistedCheckInPage />
            </RoleGuard>
          }
        />
        <Route
          path="/teacher/headcount"
          element={
            <RoleGuard allowedRole={ROLES.TEACHER}>
              <HeadcountBoard />
            </RoleGuard>
          }
        />
        <Route
          path="/teacher/route"
          element={
            <RoleGuard allowedRole={ROLES.TEACHER}>
              <RouteScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/teacher/*"
          element={
            <RoleGuard allowedRole={ROLES.TEACHER}>
              <TeacherHomeView />
            </RoleGuard>
          }
        />

        {/* Coordinator routes */}
        <Route
          path="/coordinator/drills"
          element={
            <RoleGuard allowedRoles={[ROLES.COORDINATOR, ROLES.ADMIN]}>
              <DrillDashboard />
            </RoleGuard>
          }
        />
        <Route
          path="/coordinator/headcount"
          element={
            <RoleGuard allowedRole={ROLES.COORDINATOR}>
              <HeadcountBoard />
            </RoleGuard>
          }
        />
        <Route
          path="/coordinator/expected-list"
          element={
            <RoleGuard allowedRole={ROLES.COORDINATOR}>
              <ExpectedListPage />
            </RoleGuard>
          }
        />
        <Route
          path="/coordinator/route"
          element={
            <RoleGuard allowedRole={ROLES.COORDINATOR}>
              <RouteScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/coordinator/campus-setup"
          element={
            <RoleGuard allowedRole={ROLES.COORDINATOR}>
              <CampusSetupPage />
            </RoleGuard>
          }
        />
        <Route
          path="/coordinator/qr-sheet"
          element={
            <RoleGuard allowedRole={ROLES.COORDINATOR}>
              <QrSheet />
            </RoleGuard>
          }
        />
        <Route
          path="/coordinator/roster-import"
          element={
            <RoleGuard allowedRole={ROLES.COORDINATOR}>
              <RosterImportPage />
            </RoleGuard>
          }
        />
        <Route
          path="/coordinator/reports"
          element={
            <RoleGuard allowedRole={ROLES.COORDINATOR}>
              <ReportPage />
            </RoleGuard>
          }
        />
        <Route
          path="/coordinator/*"
          element={
            <RoleGuard allowedRole={ROLES.COORDINATOR}>
              <CoordinatorHomeView />
            </RoleGuard>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin/route"
          element={
            <RoleGuard allowedRole={ROLES.ADMIN}>
              <RouteScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/qr-sheet"
          element={
            <RoleGuard allowedRole={ROLES.ADMIN}>
              <QrSheet />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/roster-import"
          element={
            <RoleGuard allowedRole={ROLES.ADMIN}>
              <RosterImportPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RoleGuard allowedRole={ROLES.ADMIN}>
              <ReportPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/campus-setup"
          element={
            <RoleGuard allowedRole={ROLES.ADMIN}>
              <CampusSetupPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RoleGuard allowedRole={ROLES.ADMIN}>
              <AdminHomeView />
            </RoleGuard>
          }
        />

        {/* Top-level route aliases for Dev 3 modules */}
        <Route
          path="/headcount"
          element={
            <RoleGuard
              allowedRoles={[ROLES.COORDINATOR, ROLES.TEACHER, ROLES.ADMIN]}
            >
              <HeadcountBoard />
            </RoleGuard>
          }
        />
        <Route
          path="/expected-list"
          element={
            <RoleGuard allowedRole={ROLES.COORDINATOR}>
              <ExpectedListPage />
            </RoleGuard>
          }
        />
        <Route
          path="/check-in"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <CheckInScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/assisted-check-in"
          element={
            <RoleGuard
              allowedRoles={[
                ROLES.TEACHER,
                ROLES.STUDENT,
                ROLES.COORDINATOR,
                ROLES.ADMIN,
              ]}
            >
              <AssistedCheckInPage />
            </RoleGuard>
          }
        />
        <Route
          path="/sos"
          element={
            <RoleGuard allowedRole={ROLES.STUDENT}>
              <SosPage />
            </RoleGuard>
          }
        />
        <Route
          path="/alert"
          element={
            <RoleGuard
              allowedRoles={[
                ROLES.STUDENT,
                ROLES.TEACHER,
                ROLES.COORDINATOR,
                ROLES.ADMIN,
              ]}
            >
              <AlertScreen />
            </RoleGuard>
          }
        />
        <Route
          path="/steps"
          element={
            <RoleGuard
              allowedRoles={[
                ROLES.STUDENT,
                ROLES.TEACHER,
                ROLES.COORDINATOR,
                ROLES.ADMIN,
              ]}
            >
              <StepScreen />
            </RoleGuard>
          }
        />

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </ActiveDrillWatcher>
  );
}

export default RoleRouter;

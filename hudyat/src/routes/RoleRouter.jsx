import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './authContext.js';
import { getRoleHomePath } from '../services/AuthService.js';
import { ROLES } from '../types/models.js';
import AppShell from '../components/AppShell.jsx';
import ActiveDrillWatcher from '../components/ActiveDrillWatcher.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import ExpectedListPage from '../pages/ExpectedListPage.jsx';
import RosterImportPage from '../pages/RosterImportPage.jsx';
import RouteScreen from '../pages/RouteScreen.jsx';
import QrSheet from '../pages/QrSheet.jsx';
import CampusSetupPage from '../pages/CampusSetupPage.jsx';
import ReportPage from '../pages/ReportPage.jsx';
import HeadcountBoard from '../pages/HeadcountBoard.tsx';
import CheckInScreen from '../pages/CheckInScreen.tsx';
import AssistedCheckInPage from '../pages/AssistedCheckInPage.tsx';
import SosPage from '../pages/SosPage.tsx';
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

function StudentHomePage() {
  return (
    <AppShell
      title="My Drill Plan"
      subtitle="Confirm your safety status and assembly check-in, follow your evacuation route, help a classmate, or send an SOS."
    >
      <section className="rounded-xl border-2 border-slate-900 bg-white p-6 space-y-5">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">Quick Drill Actions</h2>
          <p className="mt-1 text-sm font-medium text-slate-700">
            When an earthquake drill starts, you will be automatically alerted and guided to the Emergency Alert screen.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Link
            to="/student/step"
            className="hudyat-btn hudyat-btn-primary"
          >
            Confirm Safety &amp; Assembly Check-In
          </Link>
          <Link
            to="/student/route"
            className="hudyat-btn hudyat-btn-secondary"
          >
            View Evacuation Route
          </Link>
          <Link
            to="/student/assisted-check-in"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Check In a Classmate
          </Link>
          <Link
            to="/student/alert"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Emergency Alert Screen
          </Link>
          <Link
            to="/student/sos"
            className="hudyat-btn hudyat-btn-danger"
          >
            Send SOS
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function TeacherHomePage() {
  return (
    <AppShell
      title="My Sections"
      subtitle="View evacuation routes, mark students present, verify peer check-ins, and monitor live section headcount."
    >
      <section className="rounded-xl border-2 border-slate-900 bg-white p-6 space-y-5">
        <h2 className="text-lg font-extrabold text-slate-950">Teacher Drill Tools</h2>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Link
            to="/teacher/headcount"
            className="hudyat-btn hudyat-btn-primary"
          >
            Open Headcount Board
          </Link>
          <Link
            to="/teacher/assisted-check-in"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Open Assisted Check-In
          </Link>
          <Link
            to="/teacher/route"
            className="hudyat-btn hudyat-btn-secondary"
          >
            View Evacuation Route
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function CoordinatorHomePage() {
  return (
    <AppShell
      title="Drill Dashboard"
      subtitle="Start or advance campus drills, monitor the live headcount board, preview expected attendance, and manage campus routes and rosters."
    >
      <section className="rounded-xl border-2 border-slate-900 bg-white p-6 space-y-5">
        <h2 className="text-lg font-extrabold text-slate-950">Coordinator Operations</h2>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Link
            to="/coordinator/drills"
            className="hudyat-btn hudyat-btn-primary"
          >
            Manage Drills (Start / Advance / End)
          </Link>
          <Link
            to="/coordinator/headcount"
            className="hudyat-btn hudyat-btn-primary"
          >
            Open Headcount Board
          </Link>
          <Link
            to="/coordinator/expected-list"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Open Expected List
          </Link>
          <Link
            to="/assisted-check-in"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Open Assisted Check-In
          </Link>
          <Link
            to="/coordinator/route"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Evacuation Route
          </Link>
          <Link
            to="/coordinator/campus-setup"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Campus Setup
          </Link>
          <Link
            to="/coordinator/qr-sheet"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Assembly QR Sheets
          </Link>
          <Link
            to="/coordinator/roster-import"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Open Roster Import
          </Link>
          <Link
            to="/coordinator/reports"
            className="hudyat-btn hudyat-btn-secondary"
          >
            Drill Reports
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function RoleRouter() {
  return (
    <>
      <ActiveDrillWatcher />
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
              <StudentHomePage />
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
              <TeacherHomePage />
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
              <CoordinatorHomePage />
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
              <CampusSetupPage />
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
    </>
  );
}

export default RoleRouter;

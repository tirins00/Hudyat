import RosterImportPage from '../pages/RosterImportPage.jsx';
import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './authContext.js';
import { getRoleHomePath } from '../services/AuthService.js';
import { ROLES } from '../types/models.js';
import LoginPage from '../pages/LoginPage.jsx';
import ExpectedListPage from '../pages/ExpectedListPage.jsx';
import HeadcountBoard from '../pages/HeadcountBoard.tsx';
import CheckInScreen from '../pages/CheckInScreen.tsx';
import AssistedCheckInPage from '../pages/AssistedCheckInPage.tsx';
import SosPage from '../pages/SosPage.tsx';

const ROLE_LABELS = Object.freeze({
  [ROLES.STUDENT]: 'Student',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.COORDINATOR]: 'Coordinator',
  [ROLES.ADMIN]: 'Admin',
});

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

function RolePlaceholderHome({ title, description, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  const displayName = user?.displayName || user?.email || 'Campus User';
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'User';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-white border-b-2 border-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-widest uppercase text-slate-700">
              HUDYAT
            </p>
            <h1 className="text-2xl font-extrabold text-slate-950">{title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-950">{displayName}</p>
              <span className="inline-block mt-0.5 rounded-full bg-slate-900 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                {roleLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="min-h-12 min-w-12 rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-800 disabled:opacity-60"
            >
              {isLoggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <section className="rounded-xl border-2 border-slate-300 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="mt-2 text-base text-slate-700">{description}</p>
          {children && <div className="mt-5">{children}</div>}
        </section>
      </main>
    </div>
  );
}

function StudentHomePage() {
  return (
    <RolePlaceholderHome
      title="My Drill Plan"
      description="Access assembly QR check-in, peer assisted check-in, and emergency SOS during a drill."
    >
      <div className="flex flex-wrap gap-3">
        <Link
          to="/student/check-in"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800"
        >
          Open QR Check-In
        </Link>
        <Link
          to="/student/assisted-check-in"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-slate-950 bg-white px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-800"
        >
          Check In a Classmate
        </Link>
        <Link
          to="/student/sos"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-red-950 bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-400"
        >
          Send SOS
        </Link>
      </div>
    </RolePlaceholderHome>
  );
}

function TeacherHomePage() {
  return (
    <RolePlaceholderHome
      title="My Sections"
      description="Mark students present, verify peer check-ins, and monitor live section headcount."
    >
      <div className="flex flex-wrap gap-3">
        <Link
          to="/teacher/assisted-check-in"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800"
        >
          Open Assisted Check-In
        </Link>
        <Link
          to="/teacher/headcount"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-slate-950 bg-white px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-800"
        >
          Open Headcount Board
        </Link>
      </div>
    </RolePlaceholderHome>
  );
}

function CoordinatorHomePage() {
  return (
    <RolePlaceholderHome
      title="Drill Dashboard"
      description="Monitor the live headcount board, preview expected attendance, and respond to SOS alerts."
    >
      <div className="flex flex-wrap gap-3">
        <Link
          to="/coordinator/headcount"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800"
        >
          Open Headcount Board
        </Link>
        <Link
          to="/coordinator/expected-list"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-slate-950 bg-white px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-800"
        >
          Open Expected List
        </Link>
        <Link
          to="/assisted-check-in"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-slate-950 bg-white px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-800"
        >
          Open Assisted Check-In
        </Link>
      </div>
    </RolePlaceholderHome>
  );
}

function AdminHomePage() {
  return (
    <RolePlaceholderHome
      title="Campus Setup"
      description="Campus buildings, floor plans, indoor navigation graph, policies, schedules, and user administration will appear here."
    >
      <Link
        to="/admin/roster-import"
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800"
      >
        Open Roster Import
      </Link>
    </RolePlaceholderHome>
  );
}

function RoleRouter() {
  return (
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
        path="/teacher/*"
        element={
          <RoleGuard allowedRole={ROLES.TEACHER}>
            <TeacherHomePage />
          </RoleGuard>
        }
      />

      {/* Coordinator routes */}
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
        path="/coordinator/roster-import"
        element={
          <RoleGuard allowedRole={ROLES.COORDINATOR}>
            <RosterImportPage />
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
        path="/admin/roster-import"
        element={
          <RoleGuard allowedRole={ROLES.ADMIN}>
            <RosterImportPage />
          </RoleGuard>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RoleGuard allowedRole={ROLES.ADMIN}>
            <AdminHomePage />
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

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export default RoleRouter;

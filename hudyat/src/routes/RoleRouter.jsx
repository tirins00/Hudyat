import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './authContext.js';
import { getRoleHomePath } from '../services/AuthService.js';
import { ROLES } from '../types/models.js';
import LoginPage from '../pages/LoginPage.jsx';
import ExpectedListPage from '../pages/ExpectedListPage.jsx';
import RosterImportPage from '../pages/RosterImportPage.jsx';

const ROLE_LABELS = Object.freeze({
  [ROLES.STUDENT]: 'Student',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.COORDINATOR]: 'Coordinator',
  [ROLES.ADMIN]: 'Admin',
});

function RoleGuard({ allowedRole, children }) {
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

  if (user.role !== allowedRole) {
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
      description="Your evacuation route, assembly zone, check-in QR, and active drill alerts will appear here."
    />
  );
}

function TeacherHomePage() {
  return (
    <RolePlaceholderHome
      title="My Sections"
      description="Your class rosters, section drill accountability, and student check-in controls will appear here."
    />
  );
}

function CoordinatorHomePage() {
  return (
    <RolePlaceholderHome
      title="Drill Dashboard"
      description="Live drill launch controls, phase transitions, blocked exits, check-in progress, and SOS alerts will appear here."
    >
      <div className="flex flex-wrap gap-3">
        <Link
          to="/coordinator/expected-list"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800"
        >
          Open Expected List
        </Link>
        <Link
          to="/coordinator/roster-import"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-slate-950 bg-white px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-4 focus:ring-blue-800"
        >
          Open Roster Import
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
      <Route
        path="/student/*"
        element={
          <RoleGuard allowedRole={ROLES.STUDENT}>
            <StudentHomePage />
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
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export default RoleRouter;

import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../routes/authContext.js';
import { ROLES } from '../types/models.js';

const ROLE_LABELS = Object.freeze({
  [ROLES.STUDENT]: 'Student',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.COORDINATOR]: 'Coordinator',
  [ROLES.ADMIN]: 'Admin',
});

const COORDINATOR_NAV_ITEMS = Object.freeze([
  { label: 'Drill Dashboard', to: '/coordinator', end: true },
  { label: 'Headcount Board', to: '/coordinator/headcount' },
  { label: 'Expected List', to: '/coordinator/expected-list' },
  { label: 'Evacuation Route', to: '/coordinator/route' },
  { label: 'Campus Setup', to: '/coordinator/campus-setup' },
  { label: 'Assembly QR Sheets', to: '/coordinator/qr-sheet' },
  { label: 'Roster Import', to: '/coordinator/roster-import' },
  { label: 'Reports', to: '/coordinator/reports' },
]);

const ADMIN_NAV_ITEMS = Object.freeze([
  { label: 'Campus Setup', to: '/admin', end: true },
  { label: 'Evacuation Route', to: '/admin/route' },
  { label: 'Assembly QR Sheets', to: '/admin/qr-sheet' },
  { label: 'Roster Import', to: '/admin/roster-import' },
  { label: 'Reports', to: '/admin/reports' },
]);

const STUDENT_NAV_ITEMS = Object.freeze([
  { label: 'My Drill Plan', to: '/student', end: true },
  { label: 'Evacuation Route', to: '/student/route' },
]);

const TEACHER_NAV_ITEMS = Object.freeze([
  { label: 'My Sections', to: '/teacher', end: true },
  { label: 'Evacuation Route', to: '/teacher/route' },
]);

function getNavItemsForRole(role) {
  switch (role) {
    case ROLES.ADMIN:
      return ADMIN_NAV_ITEMS;
    case ROLES.COORDINATOR:
      return COORDINATOR_NAV_ITEMS;
    case ROLES.TEACHER:
      return TEACHER_NAV_ITEMS;
    case ROLES.STUDENT:
    default:
      return STUDENT_NAV_ITEMS;
  }
}

/**
 * Shared high-contrast layout shell for Hudyat pages.
 * Renders a left sidebar for Coordinator/Admin roles and a top bar for
 * Student/Teacher roles. Navigation chrome is automatically hidden when printing.
 */
function AppShell({ title, subtitle, actions, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const role = user?.role || ROLES.STUDENT;
  const roleLabel = ROLE_LABELS[role] || role;
  const displayName = user?.displayName || user?.email || roleLabel;
  const navItems = getNavItemsForRole(role);
  const useSidebar = role === ROLES.COORDINATOR || role === ROLES.ADMIN;

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (!useSidebar) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-950 flex flex-col">
        <header className="bg-white border-b-2 border-slate-900 print:hidden">
          <div className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-lg font-extrabold tracking-widest text-slate-950">
                  HUDYAT
                </p>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  {roleLabel}
                </p>
              </div>
              <nav
                aria-label={`${roleLabel} navigation`}
                className="flex flex-wrap items-center gap-2"
              >
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'inline-flex min-h-12 items-center rounded-lg px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800',
                        isActive
                          ? 'bg-slate-950 text-white'
                          : 'border-2 border-slate-300 bg-white text-slate-950 hover:bg-slate-200',
                      ].join(' ')
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-950">{displayName}</p>
                <span className="inline-block rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
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

        <main className="flex-1 mx-auto max-w-5xl w-full p-4 sm:p-8 print:p-0 print:max-w-none">
          {(title || subtitle || actions) && (
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4 print:mb-4">
              <div>
                {title && (
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {subtitle}
                  </p>
                )}
              </div>
              {actions && (
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  {actions}
                </div>
              )}
            </header>
          )}
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 flex flex-col md:flex-row print:block print:bg-white">
      <aside
        aria-label={`${roleLabel} navigation`}
        className="w-full md:w-64 shrink-0 bg-white border-b-2 md:border-b-0 md:border-r-2 border-slate-900 flex flex-col justify-between print:hidden"
      >
        <div>
          <div className="px-5 py-5 border-b-2 border-slate-200">
            <p className="text-xl font-extrabold tracking-widest text-slate-950">
              HUDYAT
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-slate-700">
              {roleLabel}
            </p>
          </div>

          <nav className="p-3 space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex min-h-12 items-center rounded-lg px-4 py-2.5 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800',
                    isActive
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-900 hover:bg-slate-200',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t-2 border-slate-200 space-y-3">
          <div>
            <p className="text-sm font-bold text-slate-950 truncate">
              {displayName}
            </p>
            <span className="inline-block mt-1 rounded-full bg-slate-900 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              {roleLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full min-h-12 min-w-12 rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-800 disabled:opacity-60"
          >
            {isLoggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto print:p-0 print:max-w-none">
        {(title || subtitle || actions) && (
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4 print:mb-4">
            <div>
              {title && (
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                {actions}
              </div>
            )}
          </header>
        )}
        {children}
      </main>
    </div>
  );
}

export default AppShell;

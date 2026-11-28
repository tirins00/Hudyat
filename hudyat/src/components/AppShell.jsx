import { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../routes/authContext.js';
import { getRoleHomePath } from '../services/AuthService.js';
import { ROLES } from '../types/models.js';

const ROLE_LABELS = Object.freeze({
  [ROLES.STUDENT]: 'Student',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.COORDINATOR]: 'Coordinator',
  [ROLES.ADMIN]: 'Admin',
});

/**
 * Unified sticky navbar and centered responsive layout shell shared by all
 * authenticated Student, Teacher, Coordinator, and Admin pages.
 * Navigation chrome is automatically hidden when printing.
 */
function AppShell({
  title,
  subtitle,
  actions,
  maxWidth = 'max-w-5xl',
  children,
}) {
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user ?? null;
  const logout = authCtx?.logout ?? null;

  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const role = user?.role || ROLES.STUDENT;
  const roleLabel = ROLE_LABELS[role] || role;
  const homePath = user ? getRoleHomePath(role) : '/';
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isOnRoleHome = normalizedPath === homePath;
  const userEmail = user?.email || user?.displayName || null;

  async function handleLogout() {
    if (!logout) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 flex flex-col print:block print:bg-white">
      <header className="sticky top-0 z-40 border-b-2 border-slate-900 bg-white print:hidden">
        <div
          className={`mx-auto flex ${maxWidth} flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={homePath}
              className="inline-flex min-h-12 items-center rounded-lg px-2 text-lg font-extrabold tracking-widest text-slate-950 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-800"
            >
              HUDYAT
            </Link>
            {title && (
              <>
                <span aria-hidden="true" className="text-slate-400 font-bold">
                  /
                </span>
                <span className="truncate text-sm sm:text-base font-extrabold text-slate-800">
                  {title}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {user && (
              <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                {userEmail && (
                  <span className="max-w-[180px] truncate text-xs font-bold text-slate-800">
                    {userEmail}
                  </span>
                )}
                <span className="inline-block rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-white">
                  {roleLabel}
                </span>
              </div>
            )}

            {!isOnRoleHome && (
              <Link
                to={homePath}
                className="hudyat-btn hudyat-btn-secondary w-auto px-4"
              >
                Home
              </Link>
            )}

            {user && logout && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="hudyat-btn hudyat-btn-ghost w-auto px-4"
              >
                {isLoggingOut ? 'Logging out…' : 'Log out'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main
        className={`mx-auto flex-1 w-full ${maxWidth} px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0`}
      >
        {(title || subtitle || actions) && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 print:mb-4">
            <div className="min-w-0">
              {title && (
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {subtitle}
                </p>
              )}
              {user && (
                <div className="mt-2 flex md:hidden flex-wrap items-center gap-2">
                  {userEmail && (
                    <span className="text-xs font-bold text-slate-700 truncate">
                      {userEmail}
                    </span>
                  )}
                  <span className="inline-block rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-white">
                    {roleLabel}
                  </span>
                </div>
              )}
            </div>
            {actions && (
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 print:hidden">
                {actions}
              </div>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

export default AppShell;

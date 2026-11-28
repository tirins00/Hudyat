import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../routes/authContext.js';
import { getRoleHomePath } from '../services/AuthService.js';
import { ROLES } from '../types/models.js';
import { ActiveDrillBannerContext } from './layout/ActiveDrillContext.js';
import { ROLE_LABELS } from './layout/NavConfig.js';
import MobileBottomNav from './layout/MobileBottomNav.jsx';
import SidebarNav from './layout/SidebarNav.jsx';

/**
 * Unified responsive layout shell shared by all authenticated Student, Teacher,
 * Coordinator, and Admin pages.
 * - Desktop (`lg:` and up): Fixed left `SidebarNav` (`w-64`, dark slate).
 * - Mobile (`< lg` / Capacitor Android): Sticky top header + fixed `MobileBottomNav`.
 * - Active drill alert banner stacks cleanly below the sticky mobile header.
 */
function AppShell({
  title,
  subtitle,
  actions,
  maxWidth = 'max-w-5xl',
  children,
}) {
  const authCtx = useContext(AuthContext);
  const activeDrillBanner = useContext(ActiveDrillBannerContext);
  const user = authCtx?.user ?? null;
  const logout = authCtx?.logout ?? null;

  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const role = user?.role || ROLES.STUDENT;
  const roleBadge = ROLE_LABELS[role] || String(role).toUpperCase();
  const homePath = user ? getRoleHomePath(role) : '/';
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
    <div className="min-h-screen bg-slate-100 text-slate-950 print:block print:bg-white">
      <SidebarNav
        role={role}
        homePath={homePath}
        userEmail={userEmail}
        canLogout={Boolean(user && logout)}
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
      />

      <div className="flex min-h-screen flex-col lg:pl-64 print:pl-0">
        {/* Mobile Sticky Top Header (< lg) */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm lg:hidden print:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              to={homePath}
              className="inline-flex min-h-12 items-center gap-2 rounded-lg pr-1 text-base font-extrabold tracking-widest text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-xs font-black text-white">
                H
              </span>
              <span>HUDYAT</span>
            </Link>

            {title && (
              <>
                <span aria-hidden="true" className="text-slate-300 font-bold">
                  /
                </span>
                <span className="truncate text-sm font-bold text-slate-800">
                  {title}
                </span>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {user && (
              <span className="hidden sm:inline-flex items-center rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                {roleBadge}
              </span>
            )}
            {user && logout && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="hudyat-btn hudyat-btn-ghost hudyat-btn-sm"
              >
                {isLoggingOut ? 'Logging out…' : 'Log out'}
              </button>
            )}
          </div>
        </header>

        {/* Active Drill Persistent Banner — stacks cleanly below sticky mobile header */}
        {activeDrillBanner && (
          <div
            role="status"
            aria-live="assertive"
            className={`sticky top-16 lg:top-0 z-30 border-b text-white shadow-sm print:hidden ${
              activeDrillBanner.isEvacuate
                ? 'border-red-900 bg-red-700'
                : 'border-amber-900 bg-amber-800'
            }`}
          >
            <div
              className={`mx-auto flex ${maxWidth} flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6`}
            >
              <div className="flex items-center gap-2.5 text-sm font-extrabold">
                <span
                  aria-hidden="true"
                  className="hudyat-alert-pulse inline-block h-3 w-3 shrink-0 rounded-full bg-white"
                />
                <span>ACTIVE DRILL: {activeDrillBanner.phaseLabel}</span>
              </div>

              <Link
                to="/student/alert"
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-white/80 bg-slate-950 px-4 py-2 text-xs sm:text-sm font-extrabold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                ACTIVE DRILL — Return to Alert
              </Link>
            </div>
          </div>
        )}

        {/* Main Content Area (pb-24 clears mobile bottom tab bar) */}
        <main
          className={`mx-auto flex-1 w-full ${maxWidth} px-4 pt-6 pb-24 sm:px-6 sm:pt-8 lg:pb-10 print:max-w-none print:p-0`}
        >
          {(title || subtitle || actions) && (
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:mb-4">
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

      <MobileBottomNav role={role} />
    </div>
  );
}

export default AppShell;

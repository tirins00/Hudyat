import { Link, useLocation } from 'react-router-dom';
import {
  ROLE_LABELS,
  getRoleNavItems,
  isNavItemActive,
} from './NavConfig.js';
import NavIcon from './NavIcon.jsx';

/**
 * Desktop left navigation sidebar (`lg:` and up).
 * Fixed width `w-64` dark slate (`#0F172A`) with brand header, role badge,
 * 1-click navigation links, and pinned user footer.
 */
export default function SidebarNav({
  role,
  homePath,
  userEmail,
  canLogout,
  isLoggingOut,
  onLogout,
}) {
  const { pathname } = useLocation();
  const navItems = getRoleNavItems(role);
  const roleBadge = ROLE_LABELS[role] || String(role || 'USER').toUpperCase();

  return (
    <aside
      aria-label="Primary navigation"
      className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-64 bg-[#0F172A] text-white border-r border-slate-800 print:hidden"
    >
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-slate-800">
        <Link
          to={homePath}
          className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black tracking-tight text-slate-950">
            H
          </span>
          <div>
            <span className="block text-lg font-extrabold tracking-widest leading-none text-white">
              HUDYAT
            </span>
            <span className="mt-1 block text-[11px] font-semibold tracking-wide text-slate-300">
              CIT-University Drill System
            </span>
          </div>
        </Link>

        <div className="mt-3.5">
          <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-slate-100">
            {roleBadge}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav
        aria-label="Role navigation"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
      >
        {navItems.map((item) => {
          const active = isNavItemActive(item, pathname);
          const isDanger = item.tone === 'danger';

          const linkClasses = active
            ? isDanger
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-white text-slate-950 shadow-xs'
            : isDanger
              ? 'text-red-200 hover:bg-red-950/80 hover:text-white'
              : 'text-slate-200 hover:bg-slate-800 hover:text-white';

          return (
            <Link
              key={item.id}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${linkClasses}`}
            >
              <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pinned User Footer */}
      <div className="border-t border-slate-800 p-4 space-y-3 bg-slate-950/50">
        {userEmail && (
          <div className="px-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Signed in as
            </p>
            <p
              title={userEmail}
              className="mt-0.5 truncate text-xs font-semibold text-slate-100"
            >
              {userEmail}
            </p>
          </div>
        )}

        {canLogout && (
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 cursor-pointer"
          >
            <NavIcon name="logout" className="h-4 w-4 shrink-0" />
            <span>{isLoggingOut ? 'Logging out…' : 'Log out'}</span>
          </button>
        )}
      </div>
    </aside>
  );
}

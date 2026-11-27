import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useHudyatSession } from '../routes/useHudyatSession';
import type { Role } from '../types/models';

export type NavActivePath =
  | '/headcount'
  | '/expected-list'
  | '/check-in'
  | '/assisted-check-in'
  | '/sos';

export interface SidebarNavProps {
  activePath: NavActivePath;
}

interface NavEntry {
  key: NavActivePath | string;
  label: string;
  to?: string;
}

const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  teacher: 'Teacher',
  coordinator: 'Coordinator',
  admin: 'Admin',
};

function getNavItemsForRole(role: Role | null): NavEntry[] {
  if (role === 'student') {
    return [
      { key: 'student-home', label: 'My Drill Plan', to: '/student' },
      { key: '/check-in', label: 'QR Check-In', to: '/student/check-in' },
      {
        key: '/assisted-check-in',
        label: 'Check In a Classmate',
        to: '/student/assisted-check-in',
      },
      { key: '/sos', label: 'SOS', to: '/student/sos' },
    ];
  }

  if (role === 'teacher') {
    return [
      { key: 'teacher-home', label: 'My Sections', to: '/teacher' },
      {
        key: '/assisted-check-in',
        label: 'Assisted Check-In',
        to: '/teacher/assisted-check-in',
      },
      { key: '/headcount', label: 'Headcount Board', to: '/teacher/headcount' },
    ];
  }

  if (role === 'coordinator') {
    return [
      { key: 'coordinator-home', label: 'Drill Dashboard', to: '/coordinator' },
      {
        key: '/headcount',
        label: 'Headcount Board',
        to: '/coordinator/headcount',
      },
      {
        key: '/expected-list',
        label: 'Expected List',
        to: '/coordinator/expected-list',
      },
      {
        key: '/assisted-check-in',
        label: 'Assisted Check-In',
        to: '/assisted-check-in',
      },
      { key: 'campus-setup', label: 'Campus Setup' },
      { key: 'roster-import', label: 'Roster Import' },
      { key: 'reports', label: 'Reports' },
    ];
  }

  if (role === 'admin') {
    return [
      { key: 'admin-home', label: 'Campus Setup', to: '/admin' },
      { key: '/headcount', label: 'Headcount Board', to: '/headcount' },
      {
        key: '/assisted-check-in',
        label: 'Assisted Check-In',
        to: '/assisted-check-in',
      },
    ];
  }

  // Fallback when rendered outside an authenticated session (e.g. demo preview)
  return [
    { key: 'drill-dashboard', label: 'Drill Dashboard' },
    { key: '/headcount', label: 'Headcount Board', to: '/headcount' },
    { key: '/expected-list', label: 'Expected List', to: '/coordinator/expected-list' },
    { key: '/check-in', label: 'QR Check-In', to: '/check-in' },
    {
      key: '/assisted-check-in',
      label: 'Assisted Check-In',
      to: '/assisted-check-in',
    },
    { key: '/sos', label: 'SOS', to: '/sos' },
    { key: 'campus-setup', label: 'Campus Setup' },
    { key: 'roster-import', label: 'Roster Import' },
    { key: 'reports', label: 'Reports' },
  ];
}

export function SidebarNav({ activePath }: SidebarNavProps) {
  const { authUser, logout } = useHudyatSession(false);
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navItems = getNavItemsForRole(authUser?.role ?? null);
  const displayName = authUser?.displayName || authUser?.email || null;
  const roleLabel = authUser?.role ? ROLE_LABELS[authUser.role] : null;

  const handleLogout = async () => {
    if (!logout) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside
      aria-label="Primary navigation"
      className="w-full md:w-64 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-300 p-4 flex flex-col justify-between gap-4"
    >
      <div className="flex flex-col gap-2">
        <div className="px-3 py-2 border-b border-slate-200 mb-2">
          <p className="text-2xl font-extrabold tracking-tight text-slate-950">
            HUDYAT
          </p>
          <p className="text-xs font-medium text-slate-700">
            {roleLabel ? `${roleLabel} Portal` : 'Campus Earthquake Drill System'}
          </p>
        </div>

        <nav className="flex flex-row md:flex-col gap-1.5 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = item.key === activePath;
            if (item.to) {
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    isActive
                      ? 'min-h-[48px] px-4 py-2.5 rounded-lg flex items-center font-bold text-slate-950 bg-slate-200 border border-slate-400 whitespace-nowrap'
                      : 'min-h-[48px] px-4 py-2.5 rounded-lg flex items-center font-semibold text-slate-900 hover:bg-slate-100 border border-transparent whitespace-nowrap'
                  }
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                disabled
                className="min-h-[48px] px-4 py-2.5 rounded-lg text-left font-medium text-slate-700 bg-transparent opacity-60 cursor-not-allowed whitespace-nowrap"
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {authUser && (
        <div className="pt-3 border-t border-slate-200 space-y-2.5">
          <div className="px-1">
            <p className="text-sm font-bold text-slate-950 truncate">
              {displayName}
            </p>
            {roleLabel && (
              <span className="inline-block mt-1 rounded-full bg-slate-900 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                {roleLabel}
              </span>
            )}
          </div>
          {logout && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="w-full min-h-[48px] px-4 py-2 rounded-lg border-2 border-slate-900 bg-white text-slate-950 text-sm font-bold hover:bg-slate-900 hover:text-white disabled:opacity-60 cursor-pointer"
            >
              {isLoggingOut ? 'Logging out…' : 'Log out'}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

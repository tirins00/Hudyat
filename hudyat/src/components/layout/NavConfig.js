import { ROLES } from '../../types/models.js';

export const ROLE_LABELS = Object.freeze({
  [ROLES.STUDENT]: 'STUDENT',
  [ROLES.TEACHER]: 'TEACHER',
  [ROLES.COORDINATOR]: 'COORDINATOR',
  [ROLES.ADMIN]: 'ADMIN',
});

export const ROLE_DISPLAY_NAMES = Object.freeze({
  [ROLES.STUDENT]: 'Student',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.COORDINATOR]: 'Coordinator',
  [ROLES.ADMIN]: 'Admin',
});

/**
 * Role navigation configuration mapping Student, Teacher, Coordinator, and Admin
 * destinations strictly to existing routes in `src/routes/RoleRouter.jsx`.
 * `mobile: true` selects the up-to-5 primary 1-click bottom tabs on `< lg`.
 */
export const ROLE_NAV_CONFIG = Object.freeze({
  [ROLES.STUDENT]: [
    {
      id: 'student-home',
      label: 'Home',
      shortLabel: 'Home',
      to: '/student',
      icon: 'home',
      exact: true,
      mobile: true,
    },
    {
      id: 'student-alert',
      label: 'Emergency Alert',
      shortLabel: 'Alert',
      to: '/student/alert',
      matchPaths: ['/student/alert', '/alert'],
      icon: 'alert',
      mobile: true,
    },
    {
      id: 'student-route',
      label: 'Evacuation Route',
      shortLabel: 'Route',
      to: '/student/route',
      icon: 'route',
      mobile: true,
    },
    {
      id: 'student-step',
      label: 'Safety Check-In',
      shortLabel: 'Check-In',
      to: '/student/step',
      matchPaths: ['/student/step', '/student/steps', '/student/check-in', '/check-in'],
      icon: 'checkin',
      mobile: true,
    },
    {
      id: 'student-sos',
      label: 'Send SOS',
      shortLabel: 'SOS',
      to: '/student/sos',
      matchPaths: ['/student/sos', '/sos'],
      icon: 'sos',
      tone: 'danger',
      mobile: true,
    },
    {
      id: 'student-assisted',
      label: 'Check In a Classmate',
      shortLabel: 'Classmate',
      to: '/student/assisted-check-in',
      matchPaths: ['/student/assisted-check-in', '/assisted-check-in'],
      icon: 'users',
      mobile: false,
    },
  ],

  [ROLES.TEACHER]: [
    {
      id: 'teacher-home',
      label: 'My Sections',
      shortLabel: 'Home',
      to: '/teacher',
      icon: 'home',
      exact: true,
      mobile: true,
    },
    {
      id: 'teacher-headcount',
      label: 'Headcount Board',
      shortLabel: 'Headcount',
      to: '/teacher/headcount',
      matchPaths: ['/teacher/headcount', '/headcount'],
      icon: 'clipboard',
      mobile: true,
    },
    {
      id: 'teacher-assisted',
      label: 'Assisted Check-In',
      shortLabel: 'Assisted',
      to: '/teacher/assisted-check-in',
      matchPaths: ['/teacher/assisted-check-in', '/assisted-check-in'],
      icon: 'users',
      mobile: true,
    },
    {
      id: 'teacher-route',
      label: 'Evacuation Route',
      shortLabel: 'Route',
      to: '/teacher/route',
      icon: 'route',
      mobile: true,
    },
    {
      id: 'teacher-alert',
      label: 'Emergency Alert',
      shortLabel: 'Alert',
      to: '/alert',
      matchPaths: ['/alert'],
      icon: 'alert',
      mobile: true,
    },
  ],

  [ROLES.COORDINATOR]: [
    {
      id: 'coordinator-home',
      label: 'Operations Home',
      shortLabel: 'Home',
      to: '/coordinator',
      icon: 'home',
      exact: true,
      mobile: true,
    },
    {
      id: 'coordinator-drills',
      label: 'Drill Dashboard',
      shortLabel: 'Drills',
      to: '/coordinator/drills',
      icon: 'drills',
      mobile: true,
    },
    {
      id: 'coordinator-headcount',
      label: 'Headcount Board',
      shortLabel: 'Headcount',
      to: '/coordinator/headcount',
      matchPaths: ['/coordinator/headcount', '/headcount'],
      icon: 'clipboard',
      mobile: true,
    },
    {
      id: 'coordinator-expected',
      label: 'Expected List',
      shortLabel: 'Expected',
      to: '/coordinator/expected-list',
      matchPaths: ['/coordinator/expected-list', '/expected-list'],
      icon: 'list',
      mobile: true,
    },
    {
      id: 'coordinator-roster',
      label: 'Roster Import',
      shortLabel: 'Roster',
      to: '/coordinator/roster-import',
      icon: 'upload',
      mobile: true,
    },
    {
      id: 'coordinator-reports',
      label: 'Drill Reports',
      shortLabel: 'Reports',
      to: '/coordinator/reports',
      icon: 'chart',
      mobile: false,
    },
    {
      id: 'coordinator-assisted',
      label: 'Assisted Check-In',
      shortLabel: 'Assisted',
      to: '/assisted-check-in',
      icon: 'users',
      mobile: false,
    },
    {
      id: 'coordinator-route',
      label: 'Evacuation Route',
      shortLabel: 'Route',
      to: '/coordinator/route',
      icon: 'route',
      mobile: false,
    },
    {
      id: 'coordinator-campus',
      label: 'Campus Setup',
      shortLabel: 'Campus',
      to: '/coordinator/campus-setup',
      icon: 'building',
      mobile: false,
    },
    {
      id: 'coordinator-qr',
      label: 'Assembly QR Sheets',
      shortLabel: 'QR Sheets',
      to: '/coordinator/qr-sheet',
      icon: 'qr',
      mobile: false,
    },
    {
      id: 'coordinator-alert',
      label: 'Alert View',
      shortLabel: 'Alert',
      to: '/alert',
      icon: 'alert',
      mobile: false,
    },
  ],

  [ROLES.ADMIN]: [
    {
      id: 'admin-home',
      label: 'Admin Home',
      shortLabel: 'Home',
      to: '/admin',
      icon: 'home',
      exact: true,
      mobile: true,
    },
    {
      id: 'admin-campus',
      label: 'Campus Setup',
      shortLabel: 'Campus',
      to: '/admin/campus-setup',
      icon: 'building',
      mobile: true,
    },
    {
      id: 'admin-qr',
      label: 'QR Sheets',
      shortLabel: 'QR Sheets',
      to: '/admin/qr-sheet',
      icon: 'qr',
      mobile: true,
    },
    {
      id: 'admin-roster',
      label: 'Roster Import',
      shortLabel: 'Roster',
      to: '/admin/roster-import',
      icon: 'upload',
      mobile: true,
    },
    {
      id: 'admin-drills',
      label: 'Drill Dashboard',
      shortLabel: 'Drills',
      to: '/coordinator/drills',
      icon: 'drills',
      mobile: true,
    },
    {
      id: 'admin-reports',
      label: 'Drill Reports',
      shortLabel: 'Reports',
      to: '/admin/reports',
      icon: 'chart',
      mobile: false,
    },
    {
      id: 'admin-headcount',
      label: 'Headcount Board',
      shortLabel: 'Headcount',
      to: '/headcount',
      icon: 'clipboard',
      mobile: false,
    },
    {
      id: 'admin-route',
      label: 'Evacuation Route',
      shortLabel: 'Route',
      to: '/admin/route',
      icon: 'route',
      mobile: false,
    },
  ],
});

export function normalizePathname(pathname) {
  if (!pathname) return '/';
  const cleaned = String(pathname).replace(/\/+$/, '');
  return cleaned || '/';
}

export function getRoleNavItems(role) {
  return ROLE_NAV_CONFIG[role] || ROLE_NAV_CONFIG[ROLES.STUDENT];
}

export function getMobileNavItems(role) {
  return getRoleNavItems(role).filter((item) => item.mobile);
}

export function isNavItemActive(item, pathname) {
  const current = normalizePathname(pathname);
  const candidates =
    Array.isArray(item.matchPaths) && item.matchPaths.length > 0
      ? item.matchPaths
      : [item.to];

  return candidates.some((candidate) => {
    const target = normalizePathname(candidate);
    if (item.exact) {
      return current === target;
    }
    return current === target || current.startsWith(`${target}/`);
  });
}

import { Link, useLocation } from 'react-router-dom';
import { getMobileNavItems, isNavItemActive } from './NavConfig.js';
import NavIcon from './NavIcon.jsx';

/**
 * Fixed mobile / Capacitor Android bottom tab bar (`< lg`).
 * Applies safe-area bottom inset padding and >= 48x48px touch targets.
 */
export default function MobileBottomNav({ role }) {
  const { pathname } = useLocation();
  const items = getMobileNavItems(role);

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm shadow-[0_-2px_12px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <div
        className="mx-auto grid min-h-16 max-w-xl"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
          const active = isNavItemActive(item, pathname);
          const isDanger = item.tone === 'danger';

          const stateClasses = active
            ? isDanger
              ? 'text-red-700 font-extrabold'
              : 'text-[#0F172A] font-extrabold'
            : isDanger
              ? 'text-red-700 hover:bg-red-50 font-semibold'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 font-semibold';

          const barColor = isDanger ? 'bg-red-600' : 'bg-[#0F172A]';

          return (
            <Link
              key={item.id}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-16 min-w-12 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-800 ${stateClasses}`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className={`absolute top-0 inset-x-3 h-1 rounded-b-full ${barColor}`}
                />
              )}
              <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
              <span className="truncate max-w-full">
                {item.shortLabel || item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

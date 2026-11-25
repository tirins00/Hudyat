import { Link } from 'react-router-dom';

export interface SidebarNavProps {
  activePath:
    | '/headcount'
    | '/expected-list'
    | '/check-in'
    | '/assisted-check-in'
    | '/sos';
}

const NAV_ITEMS: ReadonlyArray<{
  label: string;
  to?: SidebarNavProps['activePath'];
}> = [
  { label: 'Drill Dashboard' },
  { label: 'Headcount Board', to: '/headcount' },
  { label: 'Expected List', to: '/expected-list' },
  { label: 'QR Check-In', to: '/check-in' },
  { label: 'Assisted Check-In', to: '/assisted-check-in' },
  { label: 'SOS', to: '/sos' },
  { label: 'Campus Setup' },
  { label: 'Roster Import' },
  { label: 'Reports' },
];

export function SidebarNav({ activePath }: SidebarNavProps) {
  return (
    <aside
      aria-label="Primary navigation"
      className="w-full md:w-64 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-300 p-4 flex flex-col gap-2"
    >
      <div className="px-3 py-2 border-b border-slate-200 mb-2">
        <p className="text-2xl font-extrabold tracking-tight text-slate-950">
          HUDYAT
        </p>
        <p className="text-xs font-medium text-slate-700">
          Campus Earthquake Drill System
        </p>
      </div>

      <nav className="flex flex-row md:flex-col gap-1.5 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.to === activePath;
          if (item.to) {
            return (
              <Link
                key={item.label}
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
              key={item.label}
              type="button"
              disabled
              className="min-h-[48px] px-4 py-2.5 rounded-lg text-left font-medium text-slate-700 bg-transparent opacity-60 cursor-not-allowed whitespace-nowrap"
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

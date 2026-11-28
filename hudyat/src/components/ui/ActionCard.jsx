import { Link } from 'react-router-dom';

const TONE_STYLES = Object.freeze({
  default: {
    card: 'border-slate-200/90 bg-white hover:border-slate-400 hover:bg-slate-50/70 text-slate-950',
    icon: 'bg-slate-100 text-slate-900',
    description: 'text-slate-700',
    arrow: 'text-slate-600 group-hover:translate-x-0.5',
  },
  primary: {
    card: 'border-slate-900 bg-[#0F172A] hover:bg-[#1E293B] text-white',
    icon: 'bg-slate-800 text-white',
    description: 'text-slate-200',
    arrow: 'text-slate-200 group-hover:translate-x-0.5',
  },
  danger: {
    card: 'border-red-300 bg-red-50 hover:border-red-500 hover:bg-red-100/80 text-red-950',
    icon: 'bg-red-600 text-white',
    description: 'text-red-900',
    arrow: 'text-red-800 group-hover:translate-x-0.5',
  },
});

/**
 * High-contrast clickable action tile for role dashboards and quick-action grids.
 * Supports React Router `<Link>` (`to`) or interactive `<button>` (`onClick`).
 */
export default function ActionCard({
  to,
  onClick,
  title,
  description,
  icon,
  badge,
  tone = 'default',
  className = '',
}) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.default;
  const baseClasses = [
    'group flex min-h-24 w-full items-start justify-between gap-4 rounded-2xl border p-5 text-left shadow-sm transition-all duration-150 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 cursor-pointer',
    styles.card,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className="flex min-w-0 items-start gap-3.5">
        {icon && (
          <span
            aria-hidden="true"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-extrabold leading-snug">
              {title}
            </span>
            {badge}
          </div>
          {description && (
            <p className={`mt-1 text-sm font-medium leading-relaxed ${styles.description}`}>
              {description}
            </p>
          )}
        </div>
      </div>

      <span
        aria-hidden="true"
        className={`mt-1 shrink-0 transition-transform duration-150 ${styles.arrow}`}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClasses}>
      {content}
    </button>
  );
}

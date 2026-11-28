const STAT_TONES = Object.freeze({
  default: {
    container: 'border-slate-200/90 bg-white',
    label: 'text-slate-700',
    value: 'text-slate-950',
    helper: 'text-slate-600',
  },
  success: {
    container: 'border-emerald-300 bg-emerald-50/90',
    label: 'text-emerald-900',
    value: 'text-emerald-950',
    helper: 'text-emerald-900',
  },
  warning: {
    container: 'border-amber-300 bg-amber-50/90',
    label: 'text-amber-900',
    value: 'text-amber-950',
    helper: 'text-amber-900',
  },
  danger: {
    container: 'border-red-300 bg-red-50/90',
    label: 'text-red-900',
    value: 'text-red-950',
    helper: 'text-red-900',
  },
});

/**
 * Standardized KPI / metric card primitive wrapping `.hudyat-stat-card`.
 */
export default function StatCard({
  label,
  value,
  helper,
  tone = 'default',
  className = '',
}) {
  const styles = STAT_TONES[tone] || STAT_TONES.default;

  return (
    <div
      className={`hudyat-stat-card min-h-[92px] ${styles.container} ${className}`.trim()}
    >
      <span
        className={`text-xs font-extrabold uppercase tracking-wider ${styles.label}`}
      >
        {label}
      </span>
      <span
        className={`mt-1 text-2xl sm:text-3xl font-extrabold tabular-nums ${styles.value}`}
      >
        {value}
      </span>
      {helper && (
        <span className={`mt-1 text-xs font-semibold ${styles.helper}`}>
          {helper}
        </span>
      )}
    </div>
  );
}

const STATUS_CLASSES = Object.freeze({
  dch: 'hudyat-badge-dch',
  evacuate: 'hudyat-badge-evacuate',
  ended: 'hudyat-badge-ended',
  safe: 'hudyat-badge-safe',
  idle: 'hudyat-badge-idle',
  pending: 'hudyat-badge-dch',
  warning: 'hudyat-badge-dch',
  danger: 'hudyat-badge-evacuate',
  active: 'hudyat-badge-evacuate',
  acknowledged: 'hudyat-badge-dch',
  resolved: 'hudyat-badge-safe',
});

const PULSE_DOT_CLASSES = Object.freeze({
  dch: 'bg-amber-700',
  evacuate: 'bg-red-700',
  active: 'bg-red-700',
  danger: 'bg-red-700',
  ended: 'bg-emerald-700',
  safe: 'bg-emerald-700',
  idle: 'bg-slate-600',
});

/**
 * Semantic status pill primitive wrapping `.hudyat-badge`.
 * Optional pulse dot uses `.hudyat-alert-pulse` (1.2s cycle, strictly < 3 Hz).
 */
export default function StatusBadge({
  status = 'idle',
  pulse = false,
  className = '',
  children,
}) {
  const normalized = String(status || 'idle').toLowerCase();
  const statusClass = STATUS_CLASSES[normalized] || STATUS_CLASSES.idle;
  const dotClass = PULSE_DOT_CLASSES[normalized] || PULSE_DOT_CLASSES.idle;

  return (
    <span className={`hudyat-badge ${statusClass} ${className}`.trim()}>
      {pulse && (
        <span
          aria-hidden="true"
          className={`hudyat-alert-pulse inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
        />
      )}
      <span>{children}</span>
    </span>
  );
}

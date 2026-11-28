const TONE_CLASSES = Object.freeze({
  default: 'border-slate-200/90 bg-white',
  danger: 'border-red-300 bg-red-50/90',
  warning: 'border-amber-300 bg-amber-50/90',
  success: 'border-emerald-300 bg-emerald-50/90',
  info: 'border-blue-300 bg-blue-50/90',
});

const PADDING_CLASSES = Object.freeze({
  default: 'p-5 sm:p-6',
  compact: 'p-4',
  none: 'p-0',
});

/**
 * Standardized Hudyat surface card primitive wrapping `.hudyat-card`.
 */
export default function Card({
  as = 'section',
  tone = 'default',
  padding = 'default',
  title,
  subtitle,
  headerAction,
  className = '',
  children,
  ...rest
}) {
  const Component = as;
  const toneClass = TONE_CLASSES[tone] || TONE_CLASSES.default;
  const paddingClass = PADDING_CLASSES[padding] || PADDING_CLASSES.default;
  const classes = ['hudyat-card', toneClass, paddingClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classes} {...rest}>
      {(title || subtitle || headerAction) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-lg font-extrabold tracking-tight text-slate-950">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm font-medium text-slate-700">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      {children}
    </Component>
  );
}

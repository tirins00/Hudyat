const TONE_CLASSES = Object.freeze({
  info: 'border-blue-300 bg-blue-50 text-blue-950',
  warning: 'border-amber-300 bg-amber-50 text-amber-950',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-950',
});

/**
 * Standardized `role="status"` informational, warning, or success banner primitive.
 */
export default function StatusBanner({
  tone = 'info',
  message,
  className = '',
  children,
}) {
  const content = children ?? message;
  if (!content) {
    return null;
  }

  const toneClass = TONE_CLASSES[tone] || TONE_CLASSES.info;
  return (
    <div
      role="status"
      className={`rounded-2xl border px-4 py-3 text-sm font-bold ${toneClass} ${className}`.trim()}
    >
      {content}
    </div>
  );
}

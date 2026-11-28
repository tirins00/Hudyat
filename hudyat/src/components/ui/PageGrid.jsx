const COLS_CLASSES = Object.freeze({
  2: 'grid-cols-1 md:grid-cols-2',
  '2lg': 'grid-cols-1 lg:grid-cols-2',
  12: 'grid-cols-1 lg:grid-cols-12 items-start',
});

/**
 * Responsive multi-column grid wrapper for composing side-by-side page sections.
 */
export default function PageGrid({ cols = 2, className = '', children }) {
  const colsClass = COLS_CLASSES[cols] || COLS_CLASSES[2];
  return (
    <div className={`grid gap-5 ${colsClass} ${className}`.trim()}>
      {children}
    </div>
  );
}

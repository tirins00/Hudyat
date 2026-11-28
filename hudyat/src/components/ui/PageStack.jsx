const GAP_CLASSES = Object.freeze({
  sm: 'space-y-4',
  md: 'space-y-5',
  lg: 'space-y-6',
});

/**
 * Vertical spacing stack for composing page sections cleanly without raw `<div>` wrappers.
 */
export default function PageStack({ gap = 'md', className = '', children }) {
  const gapClass = GAP_CLASSES[gap] || GAP_CLASSES.md;
  return <div className={`${gapClass} ${className}`.trim()}>{children}</div>;
}

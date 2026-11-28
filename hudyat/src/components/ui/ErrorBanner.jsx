/**
 * Standardized `role="alert"` error banner primitive.
 */
export default function ErrorBanner({
  message,
  title,
  className = '',
  children,
}) {
  const content = children ?? message;
  if (!content && !title) {
    return null;
  }

  return (
    <div
      role="alert"
      className={`rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-950 ${className}`.trim()}
    >
      {title && <p className="font-extrabold mb-0.5">{title}</p>}
      {content}
    </div>
  );
}

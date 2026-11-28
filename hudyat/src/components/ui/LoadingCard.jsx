import Card from './Card.jsx';

/**
 * Standardized `role="status"` loading state card (or full-screen centered loader).
 */
export default function LoadingCard({
  message = 'Loading…',
  fullScreen = false,
  className = '',
}) {
  if (fullScreen) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <p className="text-base font-medium text-slate-800" role="status">
          {message}
        </p>
      </main>
    );
  }

  return (
    <Card role="status" className={`text-center py-8 ${className}`.trim()}>
      <p className="text-base font-bold text-slate-800">{message}</p>
    </Card>
  );
}

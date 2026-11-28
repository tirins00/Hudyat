import Button from './Button.jsx';
import Card from './Card.jsx';

/**
 * Standardized empty / no-data state card with title, description, and optional action.
 */
export default function EmptyStateCard({
  title,
  description,
  tone = 'default',
  actionLabel,
  onAction,
  actionVariant = 'primary',
  action,
  className = '',
}) {
  return (
    <Card
      tone={tone}
      className={`text-center py-8 space-y-3 ${className}`.trim()}
    >
      {title && (
        <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
      )}
      {description && (
        <p className="text-sm font-medium text-slate-700 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action ? (
        <div className="pt-1 flex justify-center">{action}</div>
      ) : actionLabel && onAction ? (
        <div className="pt-1 flex justify-center">
          <Button variant={actionVariant} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

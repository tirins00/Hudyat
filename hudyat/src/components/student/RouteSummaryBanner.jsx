import { formatDuration } from '../../services/ReportService.js';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Displays the computed evacuation route status banner (reachable or unreachable alert).
 */
export default function RouteSummaryBanner({ route }) {
  if (!route) return null;

  if (!route.reachable) {
    return (
      <Card role="alert" tone="danger" padding="compact" className="space-y-1.5">
        <h2 className="text-lg font-extrabold text-red-950">
          No Safe Evacuation Route Found
        </h2>
        <p className="text-sm font-bold text-red-900">{route.reason}</p>
        <p className="text-sm font-medium text-red-950">
          Stay away from glass and hazards, never use elevators, and notify a
          coordinator via SOS immediately.
        </p>
      </Card>
    );
  }

  return (
    <Card aria-label="Route summary" tone="success" padding="compact">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-900">
            SAFE EVACUATION ROUTE READY
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-emerald-950">
            Destination: {route.targetNode?.label || route.targetNodeId}
          </h2>
          <p className="mt-1 text-sm font-bold text-emerald-900">
            {route.steps.length} waypoints · Distance weight:{' '}
            {route.totalWeight} · Est. time:{' '}
            {formatDuration(route.estimatedSeconds)}
            {route.floorsTraversed.length > 0
              ? ` · Floors: ${route.floorsTraversed.join(' → ')}`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge status="safe">No Elevators Used</StatusBadge>
          {route.usesStairs && (
            <StatusBadge status="warning">Uses Stairs</StatusBadge>
          )}
        </div>
      </div>
    </Card>
  );
}

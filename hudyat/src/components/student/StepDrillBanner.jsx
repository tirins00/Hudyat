import { DRILL_PHASES } from '../../types/models.js';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Compact active drill context banner displayed at the top of StepScreen.
 */
export default function StepDrillBanner({ drill, expectedCampusId, phase }) {
  if (!drill) return null;

  const isLive =
    phase === DRILL_PHASES.DCH || phase === DRILL_PHASES.EVACUATE;

  return (
    <Card padding="compact">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
            Active Drill • Campus: {expectedCampusId}
          </p>
          <p className="text-base font-extrabold text-slate-950">
            {drill.title}
          </p>
        </div>
        <StatusBadge status={phase || 'idle'} pulse={isLive}>
          Phase: {phase?.toUpperCase()}
        </StatusBadge>
      </div>
    </Card>
  );
}

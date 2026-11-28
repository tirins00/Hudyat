import { DRILL_PHASES } from '../../types/models.js';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Active drill summary banner card for DrillDashboard.
 */
export default function ActiveDrillStatusCard({
  drill,
  phaseLabel,
  isLive,
  countedResponsesCount,
  expectedCount,
  requiresQrVerification,
}) {
  if (!drill) return null;

  const tone =
    drill.phase === DRILL_PHASES.EVACUATE
      ? 'danger'
      : drill.phase === DRILL_PHASES.DCH
        ? 'warning'
        : 'success';

  return (
    <Card tone={tone} padding="compact">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              CIT-University ({drill.campusId})
            </span>
            <StatusBadge status={drill.phase} pulse={isLive}>
              {phaseLabel}
            </StatusBadge>
          </div>
          <h2 className="mt-1 text-lg font-extrabold text-slate-950">
            {drill.title}
          </h2>
          <p className="text-sm font-semibold text-slate-700">
            Scenario: {drill.scenario} • DCH: {drill.dchDurationSec}s
          </p>
        </div>

        <StatusBadge status="safe">
          {countedResponsesCount}/{expectedCount}{' '}
          {requiresQrVerification ? 'Verified Evacuations' : 'Responded'}
        </StatusBadge>
      </div>
    </Card>
  );
}

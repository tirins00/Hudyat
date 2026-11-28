import { useEffect, useState } from 'react';
import { useAuth } from '../../routes/authContext.js';
import {
  findLatestDrillForCampus,
  isActiveDrillPhase,
} from '../../services/AlertCoordinator.js';
import { DrillService } from '../../services/DrillService.js';
import { DRILL_PHASES } from '../../types/models.js';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

const PHASE_COPY = Object.freeze({
  [DRILL_PHASES.DCH]: {
    badgeStatus: 'dch',
    label: 'Active: Drop, Cover & Hold',
    tone: 'warning',
  },
  [DRILL_PHASES.EVACUATE]: {
    badgeStatus: 'evacuate',
    label: 'Active: Evacuate Now',
    tone: 'danger',
  },
  [DRILL_PHASES.ENDED]: {
    badgeStatus: 'ended',
    label: 'All Clear — Standby',
    tone: 'success',
  },
});

const CAMPUS_DISPLAY_NAMES = Object.freeze({
  'cit-u': 'CIT-University',
  'citu-main': 'CIT-University',
});

/**
 * Compact top status header card shared by Student, Teacher, Coordinator,
 * and Admin home views showing campus identity and live drill status pill.
 */
export default function CampusStatusHeader({
  action,
  helperText,
  drillService = DrillService,
}) {
  const { user } = useAuth();
  const campusId = user?.campusId || 'cit-u';
  const campusName = CAMPUS_DISPLAY_NAMES[campusId] || campusId;
  const [latestDrill, setLatestDrill] = useState(null);

  useEffect(() => {
    return drillService.subscribeToDrills((list) => {
      setLatestDrill(findLatestDrillForCampus(list, campusId));
    });
  }, [drillService, campusId]);

  const phase = latestDrill?.phase || null;
  const isLive = isActiveDrillPhase(phase);
  const statusMeta = phase ? PHASE_COPY[phase] : null;

  return (
    <Card
      as="section"
      aria-label="Campus drill status"
      tone={isLive ? statusMeta?.tone || 'default' : 'default'}
      padding="compact"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
              Campus
            </span>
            <span className="text-sm font-extrabold text-slate-950">
              {campusName}
            </span>
            <StatusBadge
              status={statusMeta ? statusMeta.badgeStatus : 'idle'}
              pulse={isLive}
            >
              {statusMeta ? statusMeta.label : 'Standby — No Active Drill'}
            </StatusBadge>
          </div>

          <p className="text-sm font-medium text-slate-700">
            {latestDrill && isLive
              ? `Live drill in progress: ${latestDrill.title}`
              : helperText ||
                'All campus drill tools are ready. Live alerts and phase updates sync automatically.'}
          </p>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </Card>
  );
}

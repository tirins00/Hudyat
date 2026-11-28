import { DRILL_PHASES } from '../../types/models.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StartDrillForm from './StartDrillForm.jsx';

/**
 * Drill selector, coordinator phase controls (Advance / End), and collapsible StartDrillForm.
 */
export default function DrillControlBar({
  drills,
  activeDrill,
  phaseLabels,
  onSelectDrill,
  isCoordinator,
  showCreate,
  onToggleCreate,
  nextPhase,
  busy,
  onAdvancePhase,
  onEndDrill,
  formProps,
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <label className="block flex-1 min-w-0">
          <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
            Active / Selected Drill
          </span>
          <select
            value={activeDrill?.id || ''}
            onChange={(e) => onSelectDrill(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-950 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          >
            {drills.length === 0 && <option value="">No drills found</option>}
            {drills.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({phaseLabels[d.phase] || d.phase})
              </option>
            ))}
          </select>
        </label>

        {isCoordinator && (
          <Button
            variant={showCreate ? 'secondary' : 'primary'}
            onClick={onToggleCreate}
          >
            {showCreate ? 'Cancel' : '+ Start New Drill'}
          </Button>
        )}
      </div>

      {showCreate && isCoordinator && <StartDrillForm {...formProps} busy={busy} />}

      {isCoordinator && activeDrill && activeDrill.phase !== DRILL_PHASES.ENDED && (
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-3 border-t border-slate-200">
          {nextPhase && (
            <Button variant="primary" disabled={busy} onClick={onAdvancePhase}>
              Advance to {phaseLabels[nextPhase]}
            </Button>
          )}
          <Button variant="secondary" disabled={busy} onClick={onEndDrill}>
            End Drill
          </Button>
        </div>
      )}
    </Card>
  );
}

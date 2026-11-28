import { DRILL_SCENARIOS } from '../../types/models.js';
import Button from '../ui/Button.jsx';

/**
 * Form for launching a new campus earthquake drill (starts in Drop, Cover & Hold).
 */
export default function StartDrillForm({
  title,
  onTitleChange,
  campusId,
  onCampusIdChange,
  dchDurationSec,
  onDchDurationChange,
  scenario,
  onScenarioChange,
  busy,
  onSubmit,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4"
    >
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
        Launch New Drill (Starts in Drop, Cover &amp; Hold)
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="block md:col-span-2">
          <span className="block text-xs font-bold text-slate-800 mb-1">
            Title
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="CIT-U Campus Earthquake Drill"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-950 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            required
          />
        </label>

        <label className="block">
          <span className="block text-xs font-bold text-slate-800 mb-1">
            Campus ID
          </span>
          <input
            type="text"
            value={campusId}
            onChange={(e) => onCampusIdChange(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-950 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-bold text-slate-800 mb-1">
            DCH Duration (sec)
          </span>
          <input
            type="number"
            min={10}
            max={300}
            value={dchDurationSec}
            onChange={(e) => onDchDurationChange(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-950 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800">
          <span>Scenario:</span>
          <select
            value={scenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 focus:border-slate-900 focus:outline-none"
          >
            <option value={DRILL_SCENARIOS.NORMAL}>Normal</option>
            <option value={DRILL_SCENARIOS.BLOCKED_EXIT}>Blocked Exit</option>
          </select>
        </label>

        <Button type="submit" variant="danger" disabled={busy}>
          Start Drill Now
        </Button>
      </div>
    </form>
  );
}

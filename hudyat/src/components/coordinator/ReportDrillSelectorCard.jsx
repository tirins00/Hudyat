import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Drill selector bar for ReportPage (select Firestore drill, refresh, or preview sample).
 */
export default function ReportDrillSelectorCard({
  drills,
  selectedValue,
  isDemoMode,
  loadingDrills,
  onSelectChange,
  onRefreshDrills,
  onPreviewSample,
}) {
  return (
    <Card
      aria-label="Drill report selector"
      padding="compact"
      className="flex flex-col sm:flex-row sm:items-end gap-3 print:hidden"
    >
      <div className="flex-1">
        <label
          htmlFor="report-drill-select"
          className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5"
        >
          Select Drill
        </label>
        <select
          id="report-drill-select"
          value={selectedValue}
          onChange={(e) => onSelectChange(e.target.value)}
          className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-950 focus:border-slate-900 focus:outline-none"
        >
          {drills.length === 0 && (
            <option value="">No recorded Firestore drills yet</option>
          )}
          {drills.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title || d.id} ({String(d.phase || 'ended').toUpperCase()})
            </option>
          ))}
          <option value="__DEMO__">
            Sample Preview: CIT-U NGE Earthquake Drill
          </option>
        </select>
      </div>

      <Button
        variant="secondary"
        onClick={onRefreshDrills}
        disabled={loadingDrills}
      >
        {loadingDrills ? 'Refreshing…' : 'Refresh Drills'}
      </Button>

      {!isDemoMode && (
        <Button variant="primary" onClick={onPreviewSample}>
          Preview Sample Report
        </Button>
      )}
    </Card>
  );
}

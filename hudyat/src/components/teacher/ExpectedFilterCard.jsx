import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Date and time filter bar for previewing expected attendance.
 */
export default function ExpectedFilterCard({
  selectedDate,
  onDateChange,
  selectedTime,
  onTimeChange,
  isLoading,
  canRefresh,
  onRefresh,
}) {
  return (
    <Card aria-label="Date and time filters" padding="compact" className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <label
            htmlFor="expected-date"
            className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Date
          </label>
          <input
            id="expected-date"
            type="date"
            value={selectedDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-950 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="expected-time"
            className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Time
          </label>
          <input
            id="expected-time"
            type="time"
            value={selectedTime}
            onChange={(event) => onTimeChange(event.target.value)}
            className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-950 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        <Button
          variant="primary"
          onClick={onRefresh}
          disabled={isLoading || !canRefresh}
          className="sm:min-w-32"
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
    </Card>
  );
}

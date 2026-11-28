import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Phase 1 (Drop, Cover & Hold) 1-tap safety confirmation card.
 * No QR scanning required during DCH.
 */
export default function DchConfirmationCard({
  note,
  onNoteChange,
  submitting,
  saved,
  onConfirm,
}) {
  return (
    <Card tone="warning" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge status="dch" pulse>
          Phase 1 — Drop, Cover &amp; Hold On
        </StatusBadge>
        {saved && <StatusBadge status="safe">Confirmed</StatusBadge>}
      </div>

      <div>
        <h2 className="text-xl font-extrabold text-slate-950">
          1-Tap Safety Confirmation
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-800">
          Stay under a sturdy desk or table and hold on. No QR scan is needed
          during Phase 1 — tap once below when you are safely taking cover.
        </p>
      </div>

      <label className="block">
        <span className="block text-xs font-bold text-slate-800 mb-1.5">
          Optional Note
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="e.g., Taking cover in Room NGE-301"
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-950 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        />
      </label>

      <Button
        variant="primary"
        fullWidth
        disabled={submitting}
        onClick={onConfirm}
        className="min-h-14 text-base"
      >
        {submitting
          ? 'Confirming…'
          : saved
            ? 'Drop, Cover & Hold Confirmed (Tap to Update)'
            : 'Confirm Drop, Cover & Hold'}
      </Button>
    </Card>
  );
}

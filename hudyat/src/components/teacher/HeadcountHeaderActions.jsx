import Button from '../ui/Button.jsx';

/**
 * Header actions bar for HeadcountBoard (optional live Drill ID input + Demo/Live toggle).
 */
export default function HeadcountHeaderActions({
  useDemoMode,
  drillIdValue,
  onDrillIdChange,
  onToggleMode,
}) {
  return (
    <>
      {!useDemoMode && (
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span>Drill ID:</span>
          <input
            type="text"
            value={drillIdValue}
            onChange={(e) => onDrillIdChange(e.target.value)}
            className="min-h-12 px-3 rounded-xl border border-slate-300 bg-white text-slate-950 font-mono text-sm focus:border-slate-900 focus:outline-none"
            placeholder="active-drill"
          />
        </label>
      )}

      <Button variant="primary" onClick={onToggleMode}>
        {useDemoMode
          ? 'Mode: Demo (Switch to Live)'
          : 'Mode: Live Firestore (Switch to Demo)'}
      </Button>
    </>
  );
}

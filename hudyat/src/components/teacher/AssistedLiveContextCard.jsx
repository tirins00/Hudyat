import Card from '../ui/Card.jsx';

/**
 * Live Firestore context inputs for AssistedCheckInPage.
 */
export default function AssistedLiveContextCard({
  campusIdValue,
  onCampusIdChange,
  drillIdValue,
  onDrillIdChange,
  actorUidValue,
  onActorUidChange,
}) {
  return (
    <Card
      aria-label="Live Firestore context"
      padding="compact"
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
    >
      <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
        <span>Campus ID</span>
        <input
          type="text"
          value={campusIdValue}
          onChange={(e) => onCampusIdChange(e.target.value)}
          className="min-h-12 px-3 rounded-xl border border-slate-300 text-sm font-mono text-slate-950"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
        <span>Drill ID</span>
        <input
          type="text"
          value={drillIdValue}
          onChange={(e) => onDrillIdChange(e.target.value)}
          placeholder="active-drill"
          className="min-h-12 px-3 rounded-xl border border-slate-300 text-sm font-mono text-slate-950"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-slate-800">
        <span>Actor UID</span>
        <input
          type="text"
          value={actorUidValue}
          onChange={(e) => onActorUidChange(e.target.value)}
          className="min-h-12 px-3 rounded-xl border border-slate-300 text-sm font-mono text-slate-950"
        />
      </label>
    </Card>
  );
}

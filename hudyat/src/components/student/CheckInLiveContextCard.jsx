import Card from '../ui/Card.jsx';

/**
 * Live Firestore override context inputs for CheckInScreen.
 */
export default function CheckInLiveContextCard({
  campusIdValue,
  onCampusIdChange,
  drillIdValue,
  onDrillIdChange,
  studentUidValue,
  onStudentUidChange,
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
        <span>Student UID</span>
        <input
          type="text"
          value={studentUidValue}
          onChange={(e) => onStudentUidChange(e.target.value)}
          className="min-h-12 px-3 rounded-xl border border-slate-300 text-sm font-mono text-slate-950"
        />
      </label>
    </Card>
  );
}

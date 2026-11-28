import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Displays the ordered earthquake drill lifecycle phases with completion state.
 */
export default function DrillPhaseTracker({
  phaseOrder,
  currentIdx,
  phaseLabels,
}) {
  return (
    <Card title="Drill Lifecycle Phases">
      <ol className="space-y-2.5">
        {phaseOrder.map((phase, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <li
              key={phase}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${
                isCurrent
                  ? 'border-slate-900 bg-slate-50'
                  : isDone
                    ? 'border-emerald-300 bg-emerald-50/70'
                    : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${
                    isDone
                      ? 'bg-emerald-700'
                      : isCurrent
                        ? 'bg-[#0F172A]'
                        : 'bg-slate-400'
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-950 truncate">
                    {phaseLabels[phase] || phase}
                  </div>
                  <div className="text-xs font-medium text-slate-600">
                    {isDone
                      ? 'Completed'
                      : isCurrent
                        ? 'Current Phase'
                        : 'Pending'}
                  </div>
                </div>
              </div>

              <StatusBadge
                status={isDone ? 'safe' : isCurrent ? phase : 'idle'}
                pulse={isCurrent && phase !== 'ended'}
              >
                {isDone ? 'Done' : isCurrent ? 'Active' : 'Pending'}
              </StatusBadge>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

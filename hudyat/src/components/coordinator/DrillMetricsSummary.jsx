import Card from '../ui/Card.jsx';
import StatCard from '../ui/StatCard.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Displays expected vs verified response metrics and the live participant check-in feed.
 */
export default function DrillMetricsSummary({
  expectedCount,
  countedResponses,
  requiresQrVerification,
}) {
  const rate =
    expectedCount > 0
      ? Math.round((countedResponses.length / expectedCount) * 100)
      : 0;

  return (
    <Card title="Expected Entries & Responses" className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Expected" value={expectedCount} />
        <StatCard
          label={requiresQrVerification ? 'Verified' : 'Responses'}
          value={countedResponses.length}
          tone="success"
        />
        <StatCard label="Rate" value={`${rate}%`} />
      </div>

      {countedResponses.length === 0 ? (
        <p className="text-sm font-medium text-slate-600">
          {requiresQrVerification
            ? 'No QR-verified assembly arrivals recorded yet.'
            : 'No step responses recorded yet.'}
        </p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {countedResponses.map((r, i) => (
            <li
              key={r.uid || r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-slate-950 truncate">
                    {r.displayName || r.uid}
                  </div>
                  <div className="text-xs font-medium text-slate-700 truncate">
                    {r.status}
                    {r.nodeId || r.currentNodeId
                      ? ` • Node: ${r.nodeId || r.currentNodeId}`
                      : ''}
                  </div>
                </div>
              </div>
              {requiresQrVerification && (
                <StatusBadge status="safe">QR Verified</StatusBadge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

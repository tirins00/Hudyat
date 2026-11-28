import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Missing students table with deadline status banner and Alert Nearest trigger.
 */
export default function HeadcountMissingTable({
  isDeadlinePassed,
  deadlineMs,
  missingRows,
  onAlertNearest,
}) {
  return (
    <Card
      aria-label="Missing students list"
      padding="none"
      className="overflow-hidden"
    >
      {!isDeadlinePassed ? (
        <div className="p-5 bg-slate-50 text-slate-900 text-sm font-semibold">
          {deadlineMs !== null
            ? `Assembly deadline has not passed yet (${new Date(deadlineMs).toLocaleTimeString()}). Unaccounted students will be flagged as Missing once the deadline passes.`
            : 'Assembly deadline is not set yet. Missing list activates once the drill advances to Evacuate and sets a deadline.'}
        </div>
      ) : missingRows.length === 0 ? (
        <div className="p-5 bg-emerald-50 text-emerald-950 text-sm font-bold">
          Headcount complete — all expected students are accounted for.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th
                  scope="col"
                  className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
                >
                  Missing student
                </th>
                <th
                  scope="col"
                  className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
                >
                  Expected room
                </th>
                <th
                  scope="col"
                  className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
                >
                  Last zone
                </th>
                <th
                  scope="col"
                  className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
                >
                  Alerted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900">
              {missingRows.map((row) => (
                <tr key={row.studentUid} className="hover:bg-red-50/40">
                  <td className="py-3.5 px-4 text-sm font-bold text-slate-950">
                    <span>{row.studentName}</span>
                    {row.pendingPeerCheckIn && (
                      <StatusBadge status="pending" className="ml-2">
                        Pending peer verification
                      </StatusBadge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-sm font-semibold">
                    {row.expectedRoomLabel}
                  </td>
                  <td className="py-3.5 px-4 text-sm font-semibold">
                    {row.lastZoneLabel}
                  </td>
                  <td className="py-3.5 px-4 text-sm font-bold text-slate-950">
                    {row.alertedName !== '—' ? (
                      <span>{row.alertedName}</span>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void onAlertNearest(row)}
                      >
                        Alert Nearest
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Group accountability breakdown table for HeadcountBoard.
 */
export default function HeadcountGroupTable({ groupCounts }) {
  return (
    <Card
      aria-label="Headcount by group"
      padding="none"
      className="overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
              <th
                scope="col"
                className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
              >
                Group
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
              >
                Expected
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
              >
                Accounted
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 text-xs font-extrabold uppercase tracking-wider"
              >
                Missing
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {groupCounts.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-6 px-4 text-center text-sm font-medium text-slate-700"
                >
                  No expected entries recorded for this drill yet.
                </td>
              </tr>
            ) : (
              groupCounts.map((group) => (
                <tr key={group.key} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4 text-sm font-bold text-slate-950">
                    <span>{group.displayLabel}</span>
                    {group.pending > 0 && (
                      <StatusBadge status="pending" className="ml-2">
                        {group.pending} pending peer
                      </StatusBadge>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-sm font-semibold tabular-nums">
                    {group.expected}
                  </td>
                  <td className="py-3.5 px-4 text-sm font-semibold tabular-nums text-emerald-900">
                    {group.accounted}
                  </td>
                  <td
                    className={
                      group.missing > 0
                        ? 'py-3.5 px-4 text-sm font-extrabold tabular-nums text-red-700'
                        : 'py-3.5 px-4 text-sm font-semibold tabular-nums text-slate-700'
                    }
                  >
                    {group.missing}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

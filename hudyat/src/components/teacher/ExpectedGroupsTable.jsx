import Card from '../ui/Card.jsx';
import StatCard from '../ui/StatCard.jsx';

/**
 * Displays expected attendance summary metrics and grouped section/room counts.
 */
export default function ExpectedGroupsTable({
  groupedRows,
  totalExpected,
  hasSchedules,
}) {
  const scheduledSections = groupedRows.filter((row) => row.sectionId !== '').length;

  return (
    <section className="space-y-4">
      {!hasSchedules && (
        <div
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"
        >
          No class schedules have been imported yet. All active students are
          currently grouped under &ldquo;Not in class&rdquo;.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Total Expected Students" value={totalExpected} />
        <StatCard
          label="Active Sections Scheduled"
          value={scheduledSections}
          helper={
            groupedRows.length > scheduledSections
              ? 'Includes students currently not in class'
              : 'All expected students assigned to rooms'
          }
        />
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th
                  scope="col"
                  className="px-4 py-3.5 text-xs font-extrabold uppercase tracking-wider text-slate-700"
                >
                  Group
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-xs font-extrabold uppercase tracking-wider text-slate-700"
                >
                  Room
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-right text-xs font-extrabold uppercase tracking-wider text-slate-700"
                >
                  Expected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {groupedRows.map((row) => (
                <tr
                  key={`${row.sectionId || 'not-in-class'}::${row.room}`}
                  className={
                    row.sectionId === ''
                      ? 'bg-slate-50/70 font-semibold'
                      : 'bg-white hover:bg-slate-50/60'
                  }
                >
                  <td className="px-4 py-3.5 text-sm font-bold text-slate-950">
                    {row.group}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-slate-700">
                    {row.room}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-extrabold text-slate-950 tabular-nums">
                    {row.expectedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-sm font-extrabold text-slate-800 px-1">
        Total expected: {totalExpected}
      </p>
    </section>
  );
}

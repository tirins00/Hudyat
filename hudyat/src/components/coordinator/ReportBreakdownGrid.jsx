import Card from '../ui/Card.jsx';

/**
 * Side-by-side Check-In Method Breakdown and Assembly Area Utilization cards.
 */
export default function ReportBreakdownGrid({
  methodBreakdown,
  assemblyBreakdown,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Check-In Method Breakdown" className="space-y-3">
        {methodBreakdown.map((item) => (
          <div key={item.method} className="space-y-1">
            <div className="flex justify-between text-sm font-bold text-slate-950">
              <span>{item.label}</span>
              <span className="tabular-nums">
                {item.count} ({item.percent}%)
              </span>
            </div>
            <div className="h-3.5 w-full overflow-hidden rounded-full border border-slate-300 bg-slate-100">
              <div
                className="h-full bg-[#0F172A] transition-all"
                style={{ width: `${Math.min(100, item.percent)}%` }}
              />
            </div>
          </div>
        ))}
      </Card>

      <Card title="Assembly Area Utilization">
        {assemblyBreakdown.length === 0 ? (
          <p className="text-sm font-medium text-slate-700">
            No check-ins recorded yet.
          </p>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-700">
                  Assembly Zone
                </th>
                <th className="px-3 py-2 text-right text-xs font-extrabold uppercase text-slate-700">
                  Check-Ins
                </th>
                <th className="px-3 py-2 text-right text-xs font-extrabold uppercase text-slate-700">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {assemblyBreakdown.map((asm) => (
                <tr key={asm.assemblyNodeId}>
                  <td className="px-3 py-2.5 font-bold text-slate-950">
                    {asm.label}
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold tabular-nums">
                    {asm.count}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                    {asm.sharePercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

import Card from '../ui/Card.jsx';

/**
 * Section accountability breakdown table for ReportPage.
 */
export default function ReportSectionTable({ sectionBreakdown }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
        <h3 className="text-base font-extrabold text-slate-950">
          Section Accountability Breakdown
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              <th className="px-4 py-3 text-xs font-extrabold uppercase text-slate-700">
                Section
              </th>
              <th className="px-4 py-3 text-xs font-extrabold uppercase text-slate-700">
                Room
              </th>
              <th className="px-4 py-3 text-right text-xs font-extrabold uppercase text-slate-700">
                Expected
              </th>
              <th className="px-4 py-3 text-right text-xs font-extrabold uppercase text-slate-700">
                Checked In
              </th>
              <th className="px-4 py-3 text-right text-xs font-extrabold uppercase text-slate-700">
                Missing
              </th>
              <th className="px-4 py-3 text-right text-xs font-extrabold uppercase text-slate-700">
                Rate
              </th>
              <th className="px-4 py-3 text-right text-xs font-extrabold uppercase text-slate-700">
                QR / Tchr / Peer
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sectionBreakdown.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center font-medium text-slate-700"
                >
                  No expected section entries recorded for this drill.
                </td>
              </tr>
            ) : (
              sectionBreakdown.map((sec) => (
                <tr key={sec.sectionId || sec.sectionName}>
                  <td className="px-4 py-3 font-extrabold text-slate-950">
                    {sec.sectionName}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {sec.roomLabel}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {sec.expected}
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold text-emerald-800 tabular-nums">
                    {sec.checkedIn}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-extrabold tabular-nums ${
                      sec.unaccounted > 0 ? 'text-red-700' : 'text-slate-700'
                    }`}
                  >
                    {sec.unaccounted}
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold tabular-nums">
                    {sec.rate}%
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-700 tabular-nums">
                    {sec.qrCount} / {sec.teacherCount} / {sec.peerCount}
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

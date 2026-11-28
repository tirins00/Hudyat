import { formatDuration } from '../../services/ReportService.js';
import { SOS_STATUSES } from '../../types/models.js';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Unaccounted students table and SOS incident log side-by-side cards for ReportPage.
 */
export default function ReportIncidentsGrid({
  unaccountedStudents,
  sosIncidents,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-extrabold text-slate-950">
            Unaccounted Students ({unaccountedStudents.length})
          </h3>
        </div>
        {unaccountedStudents.length === 0 ? (
          <p className="p-5 text-sm font-bold text-emerald-950 bg-emerald-50">
            All expected students were accounted for in this drill.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-4 py-2.5 text-xs font-extrabold uppercase text-slate-700">
                    Student
                  </th>
                  <th className="px-4 py-2.5 text-xs font-extrabold uppercase text-slate-700">
                    Section
                  </th>
                  <th className="px-4 py-2.5 text-xs font-extrabold uppercase text-slate-700">
                    Room
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {unaccountedStudents.map((stu) => (
                  <tr key={stu.studentUid} className="bg-red-50/40">
                    <td className="px-4 py-2.5 font-extrabold text-red-950">
                      {stu.displayName}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">
                      {stu.sectionName}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      {stu.roomLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-base font-extrabold text-slate-950">
            SOS Incident Log ({sosIncidents.length})
          </h3>
        </div>
        {sosIncidents.length === 0 ? (
          <p className="p-5 text-sm font-medium text-slate-700">
            No SOS incidents were reported during this drill.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {sosIncidents.map((sos) => (
              <li
                key={sos.id || `${sos.uid}-${sos.nodeId}`}
                className="p-4 space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-slate-950">
                    {sos.nodeLabel}
                    {sos.floor !== null ? ` · Floor ${sos.floor}` : ''}
                  </p>
                  <StatusBadge
                    status={
                      sos.status === SOS_STATUSES.RESOLVED
                        ? 'resolved'
                        : sos.status === SOS_STATUSES.ACKNOWLEDGED
                          ? 'acknowledged'
                          : 'active'
                    }
                  >
                    {sos.status}
                  </StatusBadge>
                </div>
                {sos.message && (
                  <p className="text-sm font-medium text-slate-800">
                    {sos.message}
                  </p>
                )}
                <p className="text-xs font-bold text-slate-600">
                  User: {sos.uid} · Response:{' '}
                  {formatDuration(sos.responseTimeSec)} · Resolution:{' '}
                  {formatDuration(sos.resolutionTimeSec)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

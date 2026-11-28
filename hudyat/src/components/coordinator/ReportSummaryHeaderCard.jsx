import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

function formatDateTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

/**
 * Drill report header summary card (title, timestamps, blocked nodes, compliance pills).
 */
export default function ReportSummaryHeaderCard({ report }) {
  return (
    <Card padding="compact">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
            DRILL REPORT · ID {report.drill.id}
          </p>
          <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-950">
            {report.drill.title}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Started: {formatDateTime(report.drill.startedAtMs)} · Evacuate:{' '}
            {formatDateTime(report.drill.evacuateAtMs)} · Ended:{' '}
            {formatDateTime(report.drill.endedAtMs)}
          </p>
          {report.drill.blockedNodeIds.length > 0 && (
            <p className="mt-1 text-sm font-bold text-red-700">
              Blocked Nodes/Exits: {report.drill.blockedNodeIds.join(', ')}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge status={report.drill.phase || 'idle'}>
            Phase: {report.drill.phase}
          </StatusBadge>
          <StatusBadge status="idle">
            Scenario: {report.drill.scenario.replace('_', ' ')}
          </StatusBadge>
          <StatusBadge
            status={report.safetyCompliance.passed ? 'safe' : 'danger'}
          >
            {report.safetyCompliance.passed
              ? 'Alert Safety Compliant (<3 Hz)'
              : 'Alert Compliance Issue'}
          </StatusBadge>
        </div>
      </div>
    </Card>
  );
}

import { formatDuration } from '../../services/ReportService.js';
import StatCard from '../ui/StatCard.jsx';

/**
 * Six headline KPI cards for post-drill analytics on ReportPage.
 */
export default function ReportKpiGrid({ kpis }) {
  return (
    <section
      aria-label="Key drill metrics"
      className="grid grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <StatCard
        label="Accountability Rate"
        value={`${kpis.accountedRate}%`}
        tone="success"
        helper={`${kpis.checkedInCount} of ${kpis.expectedCount} expected checked in`}
      />

      <StatCard
        label="Unaccounted Students"
        value={kpis.unaccountedCount}
        tone={kpis.unaccountedCount > 0 ? 'danger' : 'success'}
        helper={
          kpis.unplannedCheckInsCount > 0
            ? `+${kpis.unplannedCheckInsCount} unplanned walk-in(s)`
            : 'Zero unplanned walk-ins'
        }
      />

      <StatCard
        label="Avg Check-In Time"
        value={formatDuration(kpis.avgCheckInTimeSec)}
        helper={`Median: ${formatDuration(kpis.medianCheckInTimeSec)} · Fast: ${formatDuration(kpis.fastestCheckInSec)}`}
      />

      <StatCard
        label="Total Drill Duration"
        value={formatDuration(kpis.drillDurationSec)}
        helper={`DCH: ${formatDuration(kpis.dchDurationSec)} · Evac: ${formatDuration(kpis.evacuationDurationSec)}`}
      />

      <StatCard
        label="SOS Incidents"
        value={`${kpis.sosResolved} / ${kpis.sosTotal}`}
        helper={`Resolved · ${kpis.sosActive} active · ${kpis.sosAcknowledged} acknowledged`}
      />

      <StatCard
        label="Broadcast Alerts"
        value={kpis.alertsCount}
        helper={`${kpis.responsesCount} participant status responses`}
      />
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../routes/authContext.js';
import { SOS_STATUSES } from '../types/models.js';
import {
  SAMPLE_DEMO_DRILL_INPUT,
  computeDrillReport,
  fetchCampusDrills,
  fetchDrillReport,
  formatCheckInsCsv,
  formatDrillSummaryCsv,
  formatDuration,
} from '../services/ReportService.js';
import AppShell from '../components/AppShell.jsx';

function downloadCsvFile(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function formatDateTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

function ReportPage() {
  const { user } = useAuth();
  const campusId = user?.campusId || 'cit-u';

  const [refreshToken, setRefreshToken] = useState(0);
  const [drillsFetch, setDrillsFetch] = useState({
    campusId: '',
    token: -1,
    drills: [],
    error: '',
  });
  const [selectedDrillId, setSelectedDrillId] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [reportFetch, setReportFetch] = useState({
    drillId: '',
    campusId: '',
    report: null,
    error: '',
  });

  useEffect(() => {
    let cancelled = false;

    fetchCampusDrills(campusId)
      .then((list) => {
        if (cancelled) return;
        setDrillsFetch({
          campusId,
          token: refreshToken,
          drills: list,
          error: '',
        });
        if (list.length > 0) {
          setIsDemoMode(false);
          setSelectedDrillId((curr) =>
            curr && list.some((d) => d.id === curr) ? curr : list[0].id,
          );
        } else {
          setSelectedDrillId('');
        }
      })
      .catch((error) => {
        console.error('Failed to load drills for reports:', error);
        if (!cancelled) {
          setDrillsFetch({
            campusId,
            token: refreshToken,
            drills: [],
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load drills from Firestore.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campusId, refreshToken]);

  useEffect(() => {
    if (isDemoMode || !selectedDrillId) {
      return undefined;
    }

    let cancelled = false;

    fetchDrillReport(selectedDrillId, campusId)
      .then((computed) => {
        if (!cancelled) {
          setReportFetch({
            drillId: selectedDrillId,
            campusId,
            report: computed,
            error: '',
          });
        }
      })
      .catch((error) => {
        console.error('Failed to load drill report:', error);
        if (!cancelled) {
          setReportFetch({
            drillId: selectedDrillId,
            campusId,
            report: null,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load drill report details.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDrillId, campusId, isDemoMode]);

  const demoReport = useMemo(
    () => (isDemoMode ? computeDrillReport(SAMPLE_DEMO_DRILL_INPUT) : null),
    [isDemoMode],
  );

  const loadingDrills =
    drillsFetch.campusId !== campusId || drillsFetch.token !== refreshToken;
  const drills = !loadingDrills ? drillsFetch.drills : [];
  const loadingReport =
    !isDemoMode &&
    Boolean(selectedDrillId) &&
    (reportFetch.drillId !== selectedDrillId ||
      reportFetch.campusId !== campusId);
  const report = isDemoMode
    ? demoReport
    : !loadingReport && selectedDrillId
      ? reportFetch.report
      : null;
  const errorMsg =
    (!loadingDrills ? drillsFetch.error : '') ||
    (!isDemoMode && !loadingReport ? reportFetch.error : '');

  function handleRefreshDrills() {
    setRefreshToken((t) => t + 1);
  }

  function handleExportSummaryCsv() {
    if (!report) return;
    const slug = (report.drill.id || 'drill').replace(/[^a-z0-9-_]/gi, '-');
    downloadCsvFile(
      `hudyat-summary-${slug}.csv`,
      formatDrillSummaryCsv(report),
    );
  }

  function handleExportCheckInsCsv() {
    if (!report) return;
    const slug = (report.drill.id || 'drill').replace(/[^a-z0-9-_]/gi, '-');
    downloadCsvFile(
      `hudyat-accountability-${slug}.csv`,
      formatCheckInsCsv(report),
    );
  }

  return (
    <AppShell
      title="Drill Reports & Accountability"
      subtitle="Post-drill analytics, section headcount compliance, evacuation timing, SOS response logs, and CSV/PDF export."
      actions={
        report && (
          <>
            <button
              type="button"
              onClick={handleExportSummaryCsv}
              className="min-h-12 rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-800"
            >
              Export Summary CSV
            </button>
            <button
              type="button"
              onClick={handleExportCheckInsCsv}
              className="min-h-12 rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-800"
            >
              Export Student List CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-12 rounded-lg bg-slate-950 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800"
            >
              Print / Save PDF
            </button>
          </>
        )
      }
    >
      {/* Drill Selector Bar */}
      <section
        aria-label="Drill report selector"
        className="mb-6 rounded-xl border-2 border-slate-900 bg-white p-4 flex flex-col sm:flex-row sm:items-end gap-3 print:hidden"
      >
        <div className="flex-1">
          <label
            htmlFor="report-drill-select"
            className="block text-sm font-bold text-slate-900 mb-1.5"
          >
            Select Drill
          </label>
          <select
            id="report-drill-select"
            value={isDemoMode ? '__DEMO__' : selectedDrillId}
            onChange={(e) => {
              if (e.target.value === '__DEMO__') {
                setIsDemoMode(true);
              } else {
                setIsDemoMode(false);
                setSelectedDrillId(e.target.value);
              }
            }}
            className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-sm font-bold text-slate-950 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
          >
            {drills.length === 0 && (
              <option value="">No recorded Firestore drills yet</option>
            )}
            {drills.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title || d.id} ({String(d.phase || 'ended').toUpperCase()})
              </option>
            ))}
            <option value="__DEMO__">
              Sample Preview: CIT-U NGE Earthquake Drill
            </option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleRefreshDrills}
          disabled={loadingDrills}
          className="min-h-12 rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-950 hover:text-white"
        >
          {loadingDrills ? 'Refreshing…' : 'Refresh Drills'}
        </button>

        {!isDemoMode && (
          <button
            type="button"
            onClick={() => setIsDemoMode(true)}
            className="min-h-12 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
          >
            Preview Sample Report
          </button>
        )}
      </section>

      {isDemoMode && (
        <div
          role="status"
          className="mb-6 rounded-lg border-2 border-amber-800 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 print:hidden"
        >
          Viewing a realistic CIT-U sample drill report for demonstration and
          CSV/PDF export testing.
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="mb-6 rounded-lg border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
        >
          {errorMsg}
        </div>
      )}

      {loadingDrills || loadingReport ? (
        <section
          role="status"
          className="rounded-xl border-2 border-slate-300 bg-white p-8 text-center"
        >
          <p className="text-base font-bold text-slate-800">
            Computing drill analytics report…
          </p>
        </section>
      ) : !report ? (
        <section className="rounded-xl border-2 border-slate-400 bg-white p-8 text-center space-y-3">
          <h2 className="text-lg font-extrabold text-slate-950">
            No drills recorded for campus {campusId} yet
          </h2>
          <p className="text-sm font-medium text-slate-700 max-w-md mx-auto">
            Once a coordinator launches and completes a drill, full headcount,
            evacuation timing, and SOS analytics will appear here automatically.
          </p>
          <button
            type="button"
            onClick={() => setIsDemoMode(true)}
            className="min-h-12 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            Load Sample CIT-U Drill Report
          </button>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Drill Header Summary */}
          <section className="rounded-xl border-2 border-slate-900 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-700">
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
                  <p className="mt-1 text-sm font-bold text-red-900">
                    Blocked Nodes/Exits: {report.drill.blockedNodeIds.join(', ')}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-extrabold uppercase text-white">
                  Phase: {report.drill.phase}
                </span>
                <span className="rounded-full border-2 border-slate-900 bg-slate-100 px-3 py-1 text-xs font-extrabold uppercase text-slate-950">
                  Scenario: {report.drill.scenario.replace('_', ' ')}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase text-white ${
                    report.safetyCompliance.passed
                      ? 'bg-emerald-800'
                      : 'bg-red-800'
                  }`}
                >
                  {report.safetyCompliance.passed
                    ? 'Alert Safety Compliant (<3 Hz)'
                    : 'Alert Compliance Issue'}
                </span>
              </div>
            </div>
          </section>

          {/* Headline KPI Cards */}
          <section
            aria-label="Key drill metrics"
            className="grid grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div className="rounded-xl border-2 border-slate-900 bg-white p-4">
              <p className="text-xs font-extrabold uppercase text-slate-700">
                Accountability Rate
              </p>
              <p className="mt-1 text-3xl font-extrabold text-emerald-900 tabular-nums">
                {report.kpis.accountedRate}%
              </p>
              <p className="mt-1 text-xs font-bold text-slate-700">
                {report.kpis.checkedInCount} of {report.kpis.expectedCount}{' '}
                expected checked in
              </p>
            </div>

            <div
              className={`rounded-xl border-2 p-4 ${
                report.kpis.unaccountedCount > 0
                  ? 'border-red-900 bg-red-50'
                  : 'border-emerald-900 bg-emerald-50'
              }`}
            >
              <p className="text-xs font-extrabold uppercase text-slate-800">
                Unaccounted Students
              </p>
              <p
                className={`mt-1 text-3xl font-extrabold tabular-nums ${
                  report.kpis.unaccountedCount > 0
                    ? 'text-red-950'
                    : 'text-emerald-950'
                }`}
              >
                {report.kpis.unaccountedCount}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {report.kpis.unplannedCheckInsCount > 0
                  ? `+${report.kpis.unplannedCheckInsCount} unplanned walk-in(s)`
                  : 'Zero unplanned walk-ins'}
              </p>
            </div>

            <div className="rounded-xl border-2 border-slate-900 bg-white p-4">
              <p className="text-xs font-extrabold uppercase text-slate-700">
                Avg Check-In Time
              </p>
              <p className="mt-1 text-3xl font-extrabold text-slate-950 tabular-nums">
                {formatDuration(report.kpis.avgCheckInTimeSec)}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-700">
                Median: {formatDuration(report.kpis.medianCheckInTimeSec)} · Fast:{' '}
                {formatDuration(report.kpis.fastestCheckInSec)}
              </p>
            </div>

            <div className="rounded-xl border-2 border-slate-900 bg-white p-4">
              <p className="text-xs font-extrabold uppercase text-slate-700">
                Total Drill Duration
              </p>
              <p className="mt-1 text-3xl font-extrabold text-slate-950 tabular-nums">
                {formatDuration(report.kpis.drillDurationSec)}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-700">
                DCH: {formatDuration(report.kpis.dchDurationSec)} · Evac:{' '}
                {formatDuration(report.kpis.evacuationDurationSec)}
              </p>
            </div>

            <div className="rounded-xl border-2 border-slate-900 bg-white p-4">
              <p className="text-xs font-extrabold uppercase text-slate-700">
                SOS Incidents
              </p>
              <p className="mt-1 text-3xl font-extrabold text-slate-950 tabular-nums">
                {report.kpis.sosResolved} / {report.kpis.sosTotal}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-700">
                Resolved · {report.kpis.sosActive} active ·{' '}
                {report.kpis.sosAcknowledged} acknowledged
              </p>
            </div>

            <div className="rounded-xl border-2 border-slate-900 bg-white p-4">
              <p className="text-xs font-extrabold uppercase text-slate-700">
                Broadcast Alerts
              </p>
              <p className="mt-1 text-3xl font-extrabold text-slate-950 tabular-nums">
                {report.kpis.alertsCount}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-700">
                {report.kpis.responsesCount} participant status responses
              </p>
            </div>
          </section>

          {/* Check-In Methods & Assembly Areas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4">
              <h3 className="text-lg font-extrabold text-slate-950">
                Check-In Method Breakdown
              </h3>
              <div className="space-y-3">
                {report.methodBreakdown.map((item) => (
                  <div key={item.method} className="space-y-1">
                    <div className="flex justify-between text-sm font-bold text-slate-950">
                      <span>{item.label}</span>
                      <span className="tabular-nums">
                        {item.count} ({item.percent}%)
                      </span>
                    </div>
                    <div className="h-4 w-full overflow-hidden rounded-full border border-slate-400 bg-slate-100">
                      <div
                        className="h-full bg-slate-950 transition-all"
                        style={{ width: `${Math.min(100, item.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4">
              <h3 className="text-lg font-extrabold text-slate-950">
                Assembly Area Utilization
              </h3>
              {report.assemblyBreakdown.length === 0 ? (
                <p className="text-sm font-medium text-slate-700">
                  No check-ins recorded yet.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-900 bg-slate-100">
                      <th className="px-3 py-2 font-extrabold">Assembly Zone</th>
                      <th className="px-3 py-2 text-right font-extrabold">
                        Check-Ins
                      </th>
                      <th className="px-3 py-2 text-right font-extrabold">
                        Share
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {report.assemblyBreakdown.map((asm) => (
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
            </section>
          </div>

          {/* Section Accountability Breakdown */}
          <section className="rounded-xl border-2 border-slate-900 bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b-2 border-slate-900 bg-slate-100">
              <h3 className="text-base font-extrabold text-slate-950">
                Section Accountability Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-50">
                    <th className="px-4 py-3 font-extrabold">Section</th>
                    <th className="px-4 py-3 font-extrabold">Room</th>
                    <th className="px-4 py-3 text-right font-extrabold">
                      Expected
                    </th>
                    <th className="px-4 py-3 text-right font-extrabold">
                      Checked In
                    </th>
                    <th className="px-4 py-3 text-right font-extrabold">
                      Missing
                    </th>
                    <th className="px-4 py-3 text-right font-extrabold">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-right font-extrabold">
                      QR / Tchr / Peer
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {report.sectionBreakdown.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center font-medium text-slate-700"
                      >
                        No expected section entries recorded for this drill.
                      </td>
                    </tr>
                  ) : (
                    report.sectionBreakdown.map((sec) => (
                      <tr key={sec.sectionId || sec.sectionName}>
                        <td className="px-4 py-3 font-extrabold text-slate-950">
                          {sec.sectionName}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {sec.roomLabel}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">
                          {sec.expected}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-emerald-900 tabular-nums">
                          {sec.checkedIn}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-extrabold tabular-nums ${
                            sec.unaccounted > 0
                              ? 'text-red-900'
                              : 'text-slate-700'
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
          </section>

          {/* Unaccounted Students & SOS Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-xl border-2 border-slate-900 bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b-2 border-slate-900 bg-slate-100">
                <h3 className="text-base font-extrabold text-slate-950">
                  Unaccounted Students ({report.unaccountedStudents.length})
                </h3>
              </div>
              {report.unaccountedStudents.length === 0 ? (
                <p className="p-5 text-sm font-bold text-emerald-950 bg-emerald-50">
                  All expected students were accounted for in this drill.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-50">
                        <th className="px-4 py-2.5 font-extrabold">Student</th>
                        <th className="px-4 py-2.5 font-extrabold">Section</th>
                        <th className="px-4 py-2.5 font-extrabold">Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.unaccountedStudents.map((stu) => (
                        <tr key={stu.studentUid} className="bg-red-50/40">
                          <td className="px-4 py-2.5 font-extrabold text-red-950">
                            {stu.displayName}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">
                            {stu.sectionName}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-800">
                            {stu.roomLabel}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border-2 border-slate-900 bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b-2 border-slate-900 bg-slate-100">
                <h3 className="text-base font-extrabold text-slate-950">
                  SOS Incident Log ({report.sosIncidents.length})
                </h3>
              </div>
              {report.sosIncidents.length === 0 ? (
                <p className="p-5 text-sm font-medium text-slate-700">
                  No SOS incidents were reported during this drill.
                </p>
              ) : (
                <ul className="divide-y divide-slate-300">
                  {report.sosIncidents.map((sos) => (
                    <li key={sos.id || `${sos.uid}-${sos.nodeId}`} className="p-4 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-extrabold text-slate-950">
                          {sos.nodeLabel}
                          {sos.floor !== null ? ` · Floor ${sos.floor}` : ''}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase text-white ${
                            sos.status === SOS_STATUSES.RESOLVED
                              ? 'bg-emerald-800'
                              : sos.status === SOS_STATUSES.ACKNOWLEDGED
                                ? 'bg-amber-800'
                                : 'bg-red-800'
                          }`}
                        >
                          {sos.status}
                        </span>
                      </div>
                      {sos.message && (
                        <p className="text-sm font-medium text-slate-800">
                          {sos.message}
                        </p>
                      )}
                      <p className="text-xs font-bold text-slate-700">
                        User: {sos.uid} · Response:{' '}
                        {formatDuration(sos.responseTimeSec)} · Resolution:{' '}
                        {formatDuration(sos.resolutionTimeSec)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default ReportPage;

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import ReportBreakdownGrid from '../components/coordinator/ReportBreakdownGrid.jsx';
import ReportDrillSelectorCard from '../components/coordinator/ReportDrillSelectorCard.jsx';
import ReportHeaderActions from '../components/coordinator/ReportHeaderActions.jsx';
import ReportIncidentsGrid from '../components/coordinator/ReportIncidentsGrid.jsx';
import ReportKpiGrid from '../components/coordinator/ReportKpiGrid.jsx';
import ReportSectionTable from '../components/coordinator/ReportSectionTable.jsx';
import ReportSummaryHeaderCard from '../components/coordinator/ReportSummaryHeaderCard.jsx';
import EmptyStateCard from '../components/ui/EmptyStateCard.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import LoadingCard from '../components/ui/LoadingCard.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import StatusBanner from '../components/ui/StatusBanner.jsx';
import { useAuth } from '../routes/authContext.js';
import {
  SAMPLE_DEMO_DRILL_INPUT,
  computeDrillReport,
  fetchCampusDrills,
  fetchDrillReport,
  formatCheckInsCsv,
  formatDrillSummaryCsv,
} from '../services/ReportService.js';

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
          <ReportHeaderActions
            onExportSummaryCsv={handleExportSummaryCsv}
            onExportCheckInsCsv={handleExportCheckInsCsv}
            onPrint={() => window.print()}
          />
        )
      }
    >
      <PageStack gap="lg">
        <ReportDrillSelectorCard
          drills={drills}
          selectedValue={isDemoMode ? '__DEMO__' : selectedDrillId}
          isDemoMode={isDemoMode}
          loadingDrills={loadingDrills}
          onSelectChange={(val) => {
            if (val === '__DEMO__') {
              setIsDemoMode(true);
            } else {
              setIsDemoMode(false);
              setSelectedDrillId(val);
            }
          }}
          onRefreshDrills={() => setRefreshToken((t) => t + 1)}
          onPreviewSample={() => setIsDemoMode(true)}
        />

        {isDemoMode && (
          <StatusBanner
            tone="warning"
            className="print:hidden"
            message="Viewing a realistic CIT-U sample drill report for demonstration and CSV/PDF export testing."
          />
        )}

        <ErrorBanner message={errorMsg} />

        {loadingDrills || loadingReport ? (
          <LoadingCard message="Computing drill analytics report…" />
        ) : !report ? (
          <EmptyStateCard
            title={`No drills recorded for campus ${campusId} yet`}
            description="Once a coordinator launches and completes a drill, full headcount, evacuation timing, and SOS analytics will appear here automatically."
            actionLabel="Load Sample CIT-U Drill Report"
            onAction={() => setIsDemoMode(true)}
          />
        ) : (
          <PageStack gap="lg">
            <ReportSummaryHeaderCard report={report} />
            <ReportKpiGrid kpis={report.kpis} />
            <ReportBreakdownGrid
              methodBreakdown={report.methodBreakdown}
              assemblyBreakdown={report.assemblyBreakdown}
            />
            <ReportSectionTable sectionBreakdown={report.sectionBreakdown} />
            <ReportIncidentsGrid
              unaccountedStudents={report.unaccountedStudents}
              sosIncidents={report.sosIncidents}
            />
          </PageStack>
        )}
      </PageStack>
    </AppShell>
  );
}

export default ReportPage;

import { useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import ImportTypeTabs from '../components/coordinator/ImportTypeTabs.jsx';
import RosterCsvPanel from '../components/coordinator/RosterCsvPanel.jsx';
import ScheduleCsvPanel from '../components/coordinator/ScheduleCsvPanel.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import { useAuth } from '../routes/authContext.js';
import {
  SAMPLE_ROSTER_CSV,
  SAMPLE_SCHEDULE_CSV,
  importRosterToFirestore,
  importSchedulesToFirestore,
  parseRosterCsv,
  parseScheduleCsv,
} from '../services/RosterImporter.js';

const TABS = Object.freeze({
  ROSTER: 'roster',
  SCHEDULES: 'schedules',
});

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

function RosterImportPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS.ROSTER);

  const [rosterFileName, setRosterFileName] = useState('');
  const [rosterRows, setRosterRows] = useState([]);
  const [rosterErrors, setRosterErrors] = useState([]);
  const [isImportingRoster, setIsImportingRoster] = useState(false);
  const [rosterStatus, setRosterStatus] = useState('');
  const [rosterImportError, setRosterImportError] = useState('');

  const [scheduleFileName, setScheduleFileName] = useState('');
  const [scheduleRows, setScheduleRows] = useState([]);
  const [scheduleErrors, setScheduleErrors] = useState([]);
  const [isImportingSchedules, setIsImportingSchedules] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [scheduleImportError, setScheduleImportError] = useState('');

  const campusId = user?.campusId || '';

  async function handleRosterFileChange(event) {
    const file = event.target.files?.[0];
    setRosterStatus('');
    setRosterImportError('');

    if (!file) {
      setRosterFileName('');
      setRosterRows([]);
      setRosterErrors([]);
      return;
    }

    setRosterFileName(file.name);
    const text = await file.text();
    const result = parseRosterCsv(text);
    setRosterRows(result.rows);
    setRosterErrors(result.errors);
  }

  async function handleScheduleFileChange(event) {
    const file = event.target.files?.[0];
    setScheduleStatus('');
    setScheduleImportError('');

    if (!file) {
      setScheduleFileName('');
      setScheduleRows([]);
      setScheduleErrors([]);
      return;
    }

    setScheduleFileName(file.name);
    const text = await file.text();
    const result = parseScheduleCsv(text);
    setScheduleRows(result.rows);
    setScheduleErrors(result.errors);
  }

  async function handleImportRoster() {
    if (!campusId || rosterRows.length === 0 || rosterErrors.length > 0) {
      return;
    }

    setIsImportingRoster(true);
    setRosterStatus('');
    setRosterImportError('');

    try {
      const summary = await importRosterToFirestore({
        campusId,
        rows: rosterRows,
      });
      setRosterStatus(
        `Imported ${summary.sectionsCount} sections, ${summary.studentsCount} students, ${summary.enrollmentsCount} enrollments.`,
      );
    } catch (error) {
      console.error('Roster import failed:', error);
      setRosterImportError(
        error instanceof Error
          ? error.message
          : 'Failed to import roster data to Firestore.',
      );
    } finally {
      setIsImportingRoster(false);
    }
  }

  async function handleImportSchedules() {
    if (!campusId || scheduleRows.length === 0 || scheduleErrors.length > 0) {
      return;
    }

    setIsImportingSchedules(true);
    setScheduleStatus('');
    setScheduleImportError('');

    try {
      const summary = await importSchedulesToFirestore({
        campusId,
        rows: scheduleRows,
      });
      setScheduleStatus(
        `Imported ${summary.sectionsCount} sections, ${summary.slotsCount} schedule slots.`,
      );
    } catch (error) {
      console.error('Schedule import failed:', error);
      setScheduleImportError(
        error instanceof Error
          ? error.message
          : 'Failed to import class schedules to Firestore.',
      );
    } finally {
      setIsImportingSchedules(false);
    }
  }

  const canImportRoster =
    Boolean(campusId) &&
    rosterRows.length > 0 &&
    rosterErrors.length === 0 &&
    !isImportingRoster;

  const canImportSchedules =
    Boolean(campusId) &&
    scheduleRows.length > 0 &&
    scheduleErrors.length === 0 &&
    !isImportingSchedules;

  return (
    <AppShell
      title="Roster & Schedule Import"
      subtitle="Upload validated CSV files to populate sections, student enrollments, and class schedules."
    >
      <PageStack gap="lg">
        {!campusId && (
          <ErrorBanner message="No campus is assigned to your account. Contact your administrator before importing CSV files." />
        )}

        <ImportTypeTabs
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          tabs={TABS}
        />

        {activeTab === TABS.ROSTER && (
          <RosterCsvPanel
            fileName={rosterFileName}
            rows={rosterRows}
            errors={rosterErrors}
            status={rosterStatus}
            importError={rosterImportError}
            isImporting={isImportingRoster}
            canImport={canImportRoster}
            onDownloadSample={() =>
              downloadCsvFile('hudyat-sample-roster.csv', SAMPLE_ROSTER_CSV)
            }
            onFileChange={handleRosterFileChange}
            onImport={handleImportRoster}
          />
        )}

        {activeTab === TABS.SCHEDULES && (
          <ScheduleCsvPanel
            fileName={scheduleFileName}
            rows={scheduleRows}
            errors={scheduleErrors}
            status={scheduleStatus}
            importError={scheduleImportError}
            isImporting={isImportingSchedules}
            canImport={canImportSchedules}
            onDownloadSample={() =>
              downloadCsvFile(
                'hudyat-sample-schedules.csv',
                SAMPLE_SCHEDULE_CSV,
              )
            }
            onFileChange={handleScheduleFileChange}
            onImport={handleImportSchedules}
          />
        )}
      </PageStack>
    </AppShell>
  );
}

export default RosterImportPage;

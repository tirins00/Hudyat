import { useState } from 'react';
import AppShell from '../components/AppShell.jsx';
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

  // Roster CSV state
  const [rosterFileName, setRosterFileName] = useState('');
  const [rosterRows, setRosterRows] = useState([]);
  const [rosterErrors, setRosterErrors] = useState([]);
  const [isImportingRoster, setIsImportingRoster] = useState(false);
  const [rosterStatus, setRosterStatus] = useState('');
  const [rosterImportError, setRosterImportError] = useState('');

  // Schedule CSV state
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

        {!campusId && (
          <div
            role="alert"
            className="mb-6 rounded-lg border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
          >
            No campus is assigned to your account. Contact your administrator
            before importing CSV files.
          </div>
        )}

        {/* Import Type Tabs */}
        <div
          role="tablist"
          aria-label="CSV import types"
          className="mb-6 flex flex-wrap gap-3"
        >
          <button
            type="button"
            role="tab"
            id="tab-roster"
            aria-selected={activeTab === TABS.ROSTER}
            aria-controls="panel-roster"
            onClick={() => setActiveTab(TABS.ROSTER)}
            className={[
              'min-h-12 rounded-lg border-2 px-5 py-2.5 text-sm font-extrabold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800',
              activeTab === TABS.ROSTER
                ? 'border-slate-950 bg-slate-950 text-white'
                : 'border-slate-700 bg-white text-slate-950 hover:bg-slate-200',
            ].join(' ')}
          >
            1. Roster &amp; Enrollments CSV
          </button>

          <button
            type="button"
            role="tab"
            id="tab-schedules"
            aria-selected={activeTab === TABS.SCHEDULES}
            aria-controls="panel-schedules"
            onClick={() => setActiveTab(TABS.SCHEDULES)}
            className={[
              'min-h-12 rounded-lg border-2 px-5 py-2.5 text-sm font-extrabold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800',
              activeTab === TABS.SCHEDULES
                ? 'border-slate-950 bg-slate-950 text-white'
                : 'border-slate-700 bg-white text-slate-950 hover:bg-slate-200',
            ].join(' ')}
          >
            2. Class Schedules CSV
          </button>
        </div>

        {/* Panel 1: Roster & Enrollments CSV */}
        {activeTab === TABS.ROSTER && (
          <section
            id="panel-roster"
            role="tabpanel"
            aria-labelledby="tab-roster"
            className="rounded-xl border-2 border-slate-900 bg-white p-5 sm:p-6 space-y-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">
                  1. Roster &amp; Enrollments CSV
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  Required columns:{' '}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-950">
                    studentNo, name, email, sectionName
                  </code>
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  downloadCsvFile('hudyat-sample-roster.csv', SAMPLE_ROSTER_CSV)
                }
                className="min-h-12 min-w-12 rounded-lg border-2 border-slate-950 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-800"
              >
                Download Sample CSV
              </button>
            </div>

            <div>
              <label
                htmlFor="roster-csv-upload"
                className="block text-sm font-bold text-slate-900 mb-2"
              >
                Select Roster CSV file
              </label>
              <input
                id="roster-csv-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={handleRosterFileChange}
                className="block w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-medium text-slate-950 file:mr-4 file:min-h-10 file:rounded-md file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-slate-800 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
              />
            </div>

            {rosterStatus && (
              <div
                role="status"
                className="rounded-lg border-2 border-emerald-800 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950"
              >
                {rosterStatus}
              </div>
            )}

            {rosterImportError && (
              <div
                role="alert"
                className="rounded-lg border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
              >
                {rosterImportError}
              </div>
            )}

            {rosterFileName && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-950">
                  <span>File: {rosterFileName}</span>
                  <span>Valid rows: {rosterRows.length}</span>
                  <span
                    className={
                      rosterErrors.length > 0
                        ? 'text-red-900'
                        : 'text-emerald-900'
                    }
                  >
                    Errors: {rosterErrors.length}
                  </span>
                </div>

                {rosterErrors.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-lg border-2 border-red-800 bg-red-50 p-4"
                  >
                    <h3 className="text-sm font-extrabold text-red-950">
                      Fix the following CSV errors before importing:
                    </h3>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-sm font-medium text-red-950">
                      {rosterErrors.map((err, idx) => (
                        <li key={`${err.rowNumber}-${idx}`}>
                          <strong>Row {err.rowNumber}:</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {rosterRows.length > 0 && (
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800 mb-2">
                      Preview (first {Math.min(5, rosterRows.length)} of{' '}
                      {rosterRows.length} valid rows)
                    </h3>
                    <div className="overflow-x-auto rounded-lg border-2 border-slate-900">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b-2 border-slate-900 bg-slate-100">
                            <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-950">
                              Student No
                            </th>
                            <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-950">
                              Name
                            </th>
                            <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-950">
                              Email
                            </th>
                            <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-950">
                              Section
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 text-sm">
                          {rosterRows.slice(0, 5).map((row, idx) => (
                            <tr key={`${row.studentNo}-${row.sectionName}-${idx}`}>
                              <td className="px-3 py-2.5 font-bold text-slate-950">
                                {row.studentNo}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-slate-900">
                                {row.name}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-slate-800">
                                {row.email}
                              </td>
                              <td className="px-3 py-2.5 font-bold text-slate-950">
                                {row.sectionName}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleImportRoster}
                disabled={!canImportRoster}
                className="min-h-12 min-w-48 rounded-lg bg-slate-950 px-6 py-3 text-base font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {isImportingRoster
                  ? 'Importing to Firestore…'
                  : 'Import to Firestore'}
              </button>
            </div>
          </section>
        )}

        {/* Panel 2: Class Schedules CSV */}
        {activeTab === TABS.SCHEDULES && (
          <section
            id="panel-schedules"
            role="tabpanel"
            aria-labelledby="tab-schedules"
            className="rounded-xl border-2 border-slate-900 bg-white p-5 sm:p-6 space-y-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">
                  2. Class Schedules CSV
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  Required columns:{' '}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-950">
                    sectionName, day, start, end, roomId
                  </code>{' '}
                  (days: MON–SAT, 24-hour HH:MM)
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  downloadCsvFile(
                    'hudyat-sample-schedules.csv',
                    SAMPLE_SCHEDULE_CSV,
                  )
                }
                className="min-h-12 min-w-12 rounded-lg border-2 border-slate-950 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-800"
              >
                Download Sample CSV
              </button>
            </div>

            <div>
              <label
                htmlFor="schedule-csv-upload"
                className="block text-sm font-bold text-slate-900 mb-2"
              >
                Select Class Schedules CSV file
              </label>
              <input
                id="schedule-csv-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={handleScheduleFileChange}
                className="block w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-medium text-slate-950 file:mr-4 file:min-h-10 file:rounded-md file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-slate-800 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
              />
            </div>

            {scheduleStatus && (
              <div
                role="status"
                className="rounded-lg border-2 border-emerald-800 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950"
              >
                {scheduleStatus}
              </div>
            )}

            {scheduleImportError && (
              <div
                role="alert"
                className="rounded-lg border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
              >
                {scheduleImportError}
              </div>
            )}

            {scheduleFileName && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-950">
                  <span>File: {scheduleFileName}</span>
                  <span>Valid rows: {scheduleRows.length}</span>
                  <span
                    className={
                      scheduleErrors.length > 0
                        ? 'text-red-900'
                        : 'text-emerald-900'
                    }
                  >
                    Errors: {scheduleErrors.length}
                  </span>
                </div>

                {scheduleErrors.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-lg border-2 border-red-800 bg-red-50 p-4"
                  >
                    <h3 className="text-sm font-extrabold text-red-950">
                      Fix the following CSV errors before importing:
                    </h3>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-sm font-medium text-red-950">
                      {scheduleErrors.map((err, idx) => (
                        <li key={`${err.rowNumber}-${idx}`}>
                          <strong>Row {err.rowNumber}:</strong> {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {scheduleRows.length > 0 && (
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-800 mb-2">
                      Preview (first {Math.min(5, scheduleRows.length)} of{' '}
                      {scheduleRows.length} valid rows)
                    </h3>
                    <div className="overflow-x-auto rounded-lg border-2 border-slate-900">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b-2 border-slate-900 bg-slate-100">
                            <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-950">
                              Section
                            </th>
                            <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-950">
                              Day
                            </th>
                            <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-950">
                              Start
                            </th>
                            <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-950">
                              End
                            </th>
                            <th className="px-3 py-2.5 text-xs font-extrabold uppercase text-slate-950">
                              Room ID
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 text-sm">
                          {scheduleRows.slice(0, 5).map((row, idx) => (
                            <tr
                              key={`${row.sectionName}-${row.day}-${row.start}-${idx}`}
                            >
                              <td className="px-3 py-2.5 font-bold text-slate-950">
                                {row.sectionName}
                              </td>
                              <td className="px-3 py-2.5 font-bold text-slate-900">
                                {row.day}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-slate-800 tabular-nums">
                                {row.start}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-slate-800 tabular-nums">
                                {row.end}
                              </td>
                              <td className="px-3 py-2.5 font-bold text-slate-950">
                                {row.roomId}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleImportSchedules}
                disabled={!canImportSchedules}
                className="hudyat-btn hudyat-btn-primary"
              >
                {isImportingSchedules
                  ? 'Importing to Firestore…'
                  : 'Import to Firestore'}
              </button>
            </div>
          </section>
        )}
    </AppShell>
  );
}

export default RosterImportPage;

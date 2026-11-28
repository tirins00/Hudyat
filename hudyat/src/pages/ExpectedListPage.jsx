import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../routes/authContext.js';
import {
  fetchScheduleInputs,
  groupExpectedEntries,
  resolveExpectedList,
} from '../services/ScheduleResolver.js';

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildLocalDateTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return new Date();
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function ExpectedListPage() {
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(() =>
    formatLocalDate(new Date()),
  );
  const [selectedTime, setSelectedTime] = useState(() =>
    formatLocalTime(new Date()),
  );

  const campusId = user?.campusId || '';
  const [refreshToken, setRefreshToken] = useState(0);
  const [fetchState, setFetchState] = useState({
    campusId: '',
    token: -1,
    data: null,
    error: '',
  });

  useEffect(() => {
    if (!campusId) {
      return undefined;
    }

    let cancelled = false;

    fetchScheduleInputs(campusId)
      .then((inputs) => {
        if (!cancelled) {
          setFetchState({
            campusId,
            token: refreshToken,
            data: inputs,
            error: '',
          });
        }
      })
      .catch((error) => {
        console.error('Failed to load expected list inputs:', error);
        if (!cancelled) {
          setFetchState({
            campusId,
            token: refreshToken,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load roster and schedule data. Please try again.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campusId, refreshToken]);

  const isLoading =
    Boolean(campusId) &&
    (fetchState.campusId !== campusId || fetchState.token !== refreshToken);
  const scheduleData =
    campusId && !isLoading ? fetchState.data : null;
  const errorMessage = !campusId
    ? 'No campus is assigned to your account. Contact your administrator.'
    : isLoading
      ? ''
      : fetchState.error;

  function handleRefresh() {
    setRefreshToken((current) => current + 1);
  }

  const resolvedEntries = useMemo(() => {
    if (!scheduleData) {
      return [];
    }

    return resolveExpectedList({
      students: scheduleData.students,
      sections: scheduleData.sections,
      enrollments: scheduleData.enrollments,
      scheduleSlots: scheduleData.scheduleSlots,
      dateTime: buildLocalDateTime(selectedDate, selectedTime),
    });
  }, [scheduleData, selectedDate, selectedTime]);

  const groupedRows = useMemo(() => {
    if (!scheduleData) {
      return [];
    }
    return groupExpectedEntries(resolvedEntries, scheduleData.roomLabelsById);
  }, [resolvedEntries, scheduleData]);

  const totalExpected = resolvedEntries.length;
  const hasRoster = Boolean(scheduleData && scheduleData.students.length > 0);
  const hasSchedules = Boolean(
    scheduleData && scheduleData.scheduleSlots.length > 0,
  );

  return (
    <AppShell
      title="Expected List"
      subtitle="Preview expected student attendance by section and room for any date and time."
    >

        {/* Controls */}
        <section
          aria-label="Date and time filters"
          className="mb-6 rounded-xl border-2 border-slate-900 bg-white p-4 sm:p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <label
                htmlFor="expected-date"
                className="block text-sm font-bold text-slate-900 mb-1.5"
              >
                Date
              </label>
              <input
                id="expected-date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-base font-medium text-slate-950 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
              />
            </div>

            <div className="flex-1">
              <label
                htmlFor="expected-time"
                className="block text-sm font-bold text-slate-900 mb-1.5"
              >
                Time
              </label>
              <input
                id="expected-time"
                type="time"
                value={selectedTime}
                onChange={(event) => setSelectedTime(event.target.value)}
                className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-base font-medium text-slate-950 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
              />
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading || !campusId}
              className="min-h-12 min-w-32 rounded-lg bg-slate-950 px-6 py-2.5 text-base font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {isLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </section>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 rounded-lg border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
          >
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <section
            role="status"
            className="rounded-xl border-2 border-slate-300 bg-white p-8 text-center"
          >
            <p className="text-base font-bold text-slate-800">
              Loading roster and schedule data…
            </p>
          </section>
        ) : !errorMessage && !hasRoster ? (
          <section className="rounded-xl border-2 border-slate-400 bg-white p-8 text-center">
            <h2 className="text-lg font-extrabold text-slate-950">
              No roster or schedules imported yet
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-700 max-w-md mx-auto">
              Import student rosters, sections, enrollments, and class schedule
              slots first to preview expected attendance for a drill.
            </p>
          </section>
        ) : !errorMessage ? (
          <section className="space-y-4">
            {!hasSchedules && (
              <div
                role="status"
                className="rounded-lg border-2 border-amber-800 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"
              >
                No class schedules have been imported yet. All active students
                are currently grouped under &ldquo;Not in class&rdquo;.
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border-2 border-slate-900 bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100">
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-slate-950"
                    >
                      Group
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-sm font-extrabold uppercase tracking-wide text-slate-950"
                    >
                      Room
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-right text-sm font-extrabold uppercase tracking-wide text-slate-950"
                    >
                      Expected
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {groupedRows.map((row) => (
                    <tr
                      key={`${row.sectionId || 'not-in-class'}::${row.room}`}
                      className={
                        row.sectionId === ''
                          ? 'bg-slate-50 font-semibold'
                          : 'bg-white'
                      }
                    >
                      <td className="px-4 py-3.5 text-base font-bold text-slate-950">
                        {row.group}
                      </td>
                      <td className="px-4 py-3.5 text-base font-medium text-slate-800">
                        {row.room}
                      </td>
                      <td className="px-4 py-3.5 text-right text-base font-extrabold text-slate-950 tabular-nums">
                        {row.expectedCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-base font-extrabold text-slate-950 px-1">
              Total expected: {totalExpected}
            </p>
          </section>
        ) : null}
    </AppShell>
  );
}

export default ExpectedListPage;

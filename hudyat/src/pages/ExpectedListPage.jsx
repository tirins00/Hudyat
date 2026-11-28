import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import ExpectedFilterCard from '../components/teacher/ExpectedFilterCard.jsx';
import ExpectedGroupsTable from '../components/teacher/ExpectedGroupsTable.jsx';
import EmptyStateCard from '../components/ui/EmptyStateCard.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import LoadingCard from '../components/ui/LoadingCard.jsx';
import PageStack from '../components/ui/PageStack.jsx';
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
  const scheduleData = campusId && !isLoading ? fetchState.data : null;
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
      <PageStack gap="lg">
        <ExpectedFilterCard
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          selectedTime={selectedTime}
          onTimeChange={setSelectedTime}
          isLoading={isLoading}
          canRefresh={Boolean(campusId)}
          onRefresh={handleRefresh}
        />

        <ErrorBanner message={errorMessage} />

        {isLoading ? (
          <LoadingCard message="Loading roster and schedule data…" />
        ) : !errorMessage && !hasRoster ? (
          <EmptyStateCard
            title="No roster or schedules imported yet"
            description="Import student rosters, sections, enrollments, and class schedule slots first to preview expected attendance for a drill."
          />
        ) : !errorMessage ? (
          <ExpectedGroupsTable
            groupedRows={groupedRows}
            totalExpected={totalExpected}
            hasSchedules={hasSchedules}
          />
        ) : null}
      </PageStack>
    </AppShell>
  );
}

export default ExpectedListPage;

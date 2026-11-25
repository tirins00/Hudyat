import { useEffect, useMemo, useState } from 'react';
import { Timestamp, collection, onSnapshot, query } from 'firebase/firestore';
import { SidebarNav } from '../components/SidebarNav';
import {
  getHeadcountFirestore,
  isFirebaseConfigured,
} from '../firebase/headcountClient';
import {
  expectedList,
  groupExpectedEntries,
} from '../services/ScheduleResolver';
import type {
  DayOfWeek,
  Enrollment,
  MapNode,
  ScheduleSlot,
  Section,
  User,
} from '../types/models';

interface ExpectedDemoDataset {
  users: User[];
  sections: Section[];
  enrollments: Enrollment[];
  scheduleSlots: ScheduleSlot[];
  mapNodes: MapNode[];
}

const WEEKDAYS_MON_TO_SAT: readonly DayOfWeek[] = [
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
];

function createDemoExpectedData(): ExpectedDemoDataset {
  const createdAt = Timestamp.fromMillis(1_700_000_000_000);

  const sections: Section[] = [
    {
      id: 'sec-it332-g1',
      campusId: 'citu-main',
      code: 'IT332-G1',
      name: 'Capstone & Research 1 - G1',
      teacherUid: 'teacher-2',
    },
    {
      id: 'sec-it332-g2',
      campusId: 'citu-main',
      code: 'IT332-G2',
      name: 'Capstone & Research 1 - G2',
      teacherUid: 'teacher-1',
    },
    {
      id: 'sec-cs210-a',
      campusId: 'citu-main',
      code: 'CS210-A',
      name: 'Algorithms & Complexity - A',
      teacherUid: 'teacher-1',
    },
  ];

  const mapNodes: MapNode[] = [
    {
      id: 'eng-401',
      campusId: 'citu-main',
      buildingId: 'eng',
      floor: 4,
      label: 'ENG 401',
      type: 'room',
      x: 100,
      y: 100,
    },
    {
      id: 'eng-402',
      campusId: 'citu-main',
      buildingId: 'eng',
      floor: 4,
      label: 'ENG 402',
      type: 'room',
      x: 180,
      y: 100,
    },
    {
      id: 'main-201',
      campusId: 'citu-main',
      buildingId: 'main',
      floor: 2,
      label: 'MAIN 201',
      type: 'room',
      x: 240,
      y: 140,
    },
  ];

  const users: User[] = [];
  const enrollments: Enrollment[] = [];

  // 22 students enrolled in IT332-G1
  for (let i = 1; i <= 22; i++) {
    const uid = `demo-g1-${i}`;
    users.push({
      uid,
      email: `${uid}@cit.edu`,
      displayName: `G1 Student ${i}`,
      role: 'student',
      campusId: 'citu-main',
      active: true,
      studentNumber: `2023-10${String(i).padStart(2, '0')}`,
      createdAt,
    });
    enrollments.push({
      id: `enr-${uid}`,
      campusId: 'citu-main',
      sectionId: 'sec-it332-g1',
      studentUid: uid,
    });
  }

  // 20 students enrolled in IT332-G2
  for (let i = 1; i <= 20; i++) {
    const uid = `demo-g2-${i}`;
    users.push({
      uid,
      email: `${uid}@cit.edu`,
      displayName: `G2 Student ${i}`,
      role: 'student',
      campusId: 'citu-main',
      active: true,
      studentNumber: `2023-20${String(i).padStart(2, '0')}`,
      createdAt,
    });
    enrollments.push({
      id: `enr-${uid}`,
      campusId: 'citu-main',
      sectionId: 'sec-it332-g2',
      studentUid: uid,
    });
  }

  // 18 students enrolled only in afternoon CS210-A (so at 10:15 they are "Not in class")
  for (let i = 1; i <= 18; i++) {
    const uid = `demo-cs-${i}`;
    users.push({
      uid,
      email: `${uid}@cit.edu`,
      displayName: `CS Student ${i}`,
      role: 'student',
      campusId: 'citu-main',
      active: true,
      studentNumber: `2023-30${String(i).padStart(2, '0')}`,
      createdAt,
    });
    enrollments.push({
      id: `enr-${uid}`,
      campusId: 'citu-main',
      sectionId: 'sec-cs210-a',
      studentUid: uid,
    });
  }

  // Schedules across MON–SAT (no classes on Sunday)
  const scheduleSlots: ScheduleSlot[] = [];
  for (const day of WEEKDAYS_MON_TO_SAT) {
    scheduleSlots.push(
      {
        id: `slot-g1-${day}`,
        campusId: 'citu-main',
        sectionId: 'sec-it332-g1',
        roomNodeId: 'eng-401',
        buildingId: 'eng',
        floor: 4,
        dayOfWeek: day,
        startTime: '09:30',
        endTime: '11:30',
      },
      {
        id: `slot-g2-${day}`,
        campusId: 'citu-main',
        sectionId: 'sec-it332-g2',
        roomNodeId: 'eng-402',
        buildingId: 'eng',
        floor: 4,
        dayOfWeek: day,
        startTime: '10:00',
        endTime: '12:00',
      },
      {
        id: `slot-cs-${day}`,
        campusId: 'citu-main',
        sectionId: 'sec-cs210-a',
        roomNodeId: 'main-201',
        buildingId: 'main',
        floor: 2,
        dayOfWeek: day,
        startTime: '13:30',
        endTime: '15:00',
      },
    );
  }

  return { users, sections, enrollments, scheduleSlots, mapNodes };
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(mm)
  ) {
    return new Date();
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function ExpectedListPage() {
  const firebaseReady = isFirebaseConfigured();
  const [useDemoMode, setUseDemoMode] = useState<boolean>(!firebaseReady);

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatDateInput(new Date()),
  );
  const [selectedTime, setSelectedTime] = useState<string>(() =>
    formatTimeInput(new Date()),
  );
  const [refreshCount, setRefreshCount] = useState<number>(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() =>
    new Date().toLocaleTimeString(),
  );

  // Live Firestore data
  const [liveUsers, setLiveUsers] = useState<User[]>([]);
  const [liveSections, setLiveSections] = useState<Section[]>([]);
  const [liveEnrollments, setLiveEnrollments] = useState<Enrollment[]>([]);
  const [liveSlots, setLiveSlots] = useState<ScheduleSlot[]>([]);
  const [liveNodes, setLiveNodes] = useState<MapNode[]>([]);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const demoData = useMemo(() => createDemoExpectedData(), []);

  useEffect(() => {
    if (useDemoMode) return;
    const db = getHeadcountFirestore();
    if (!db) return;

    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'users')),
        (snap) => {
          setFirestoreError(null);
          setLiveUsers(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<User, 'uid'>),
              uid: d.id,
            })),
          );
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'sections')),
        (snap) => {
          setLiveSections(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<Section, 'id'>),
              id: d.id,
            })),
          );
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'enrollments')),
        (snap) => {
          setLiveEnrollments(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<Enrollment, 'id'>),
              id: d.id,
            })),
          );
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'scheduleSlots')),
        (snap) => {
          setLiveSlots(
            snap.docs.map((d) => ({
              ...(d.data() as Omit<ScheduleSlot, 'id'>),
              id: d.id,
            })),
          );
        },
        (err) => setFirestoreError(err.message),
      ),
    );

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [useDemoMode, refreshCount]);

  // Subscribe to mapNodes once campusId is known from users or sections.
  const inferredCampusId = useMemo(() => {
    const sourceSection = liveSections[0];
    if (sourceSection?.campusId) return sourceSection.campusId;
    const sourceUser = liveUsers[0];
    return sourceUser?.campusId ?? null;
  }, [liveSections, liveUsers]);

  useEffect(() => {
    if (useDemoMode || !inferredCampusId) return;
    const db = getHeadcountFirestore();
    if (!db) return;

    const unsub = onSnapshot(
      query(collection(db, 'campuses', inferredCampusId, 'mapNodes')),
      (snap) => {
        setLiveNodes(
          snap.docs.map((d) => ({
            ...(d.data() as Omit<MapNode, 'id'>),
            id: d.id,
          })),
        );
      },
    );
    return () => unsub();
  }, [useDemoMode, inferredCampusId]);

  const targetDateTime = useMemo(
    () => parseLocalDateTime(selectedDate, selectedTime),
    [selectedDate, selectedTime],
  );

  const activeData = useMemo(
    () =>
      useDemoMode
        ? demoData
        : {
            users: liveUsers,
            sections: liveSections,
            enrollments: liveEnrollments,
            scheduleSlots: liveSlots,
            mapNodes: liveNodes,
          },
    [
      useDemoMode,
      demoData,
      liveUsers,
      liveSections,
      liveEnrollments,
      liveSlots,
      liveNodes,
    ],
  );

  const entries = useMemo(() => {
    void refreshCount;
    return expectedList(
      targetDateTime,
      activeData.users,
      activeData.enrollments,
      activeData.sections,
      activeData.scheduleSlots,
    );
  }, [targetDateTime, activeData, refreshCount]);

  const groups = useMemo(
    () =>
      groupExpectedEntries(entries, activeData.sections, activeData.mapNodes),
    [entries, activeData.sections, activeData.mapNodes],
  );

  const isSunday = targetDateTime.getDay() === 0;

  const handleRefresh = () => {
    setRefreshCount((c) => c + 1);
    setLastRefreshedAt(new Date().toLocaleTimeString());
  };

  const applyPreset = (dateStr: string, timeStr: string) => {
    setSelectedDate(dateStr);
    setSelectedTime(timeStr);
    setRefreshCount((c) => c + 1);
    setLastRefreshedAt(new Date().toLocaleTimeString());
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col md:flex-row font-sans">
      <SidebarNav activePath="/expected-list" />

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">
              Expected List
            </h1>
            <p className="text-sm font-medium text-slate-700 mt-1">
              Preview expected students by section and room for a drill time •
              Updated {lastRefreshedAt}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFirestoreError(null);
              setUseDemoMode((v) => !v);
            }}
            className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg border-2 border-slate-800 bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-400 cursor-pointer self-start lg:self-auto"
          >
            {useDemoMode
              ? 'Mode: Demo (Switch to Live)'
              : 'Mode: Live Firestore (Switch to Demo)'}
          </button>
        </header>

        {/* Demo Mode / Live Status Banner */}
        {useDemoMode ? (
          <section
            aria-label="Demo schedule presets"
            className="bg-amber-50 border-2 border-amber-700 rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm font-bold text-amber-950">
                {firebaseReady
                  ? 'Demo Mode active — previewing sample CIT-U roster & schedules.'
                  : 'Firebase .env keys not configured — previewing sample CIT-U roster & schedules in Demo Mode.'}
              </p>
              <span className="text-xs font-semibold text-amber-900">
                Schedules cover MON–SAT
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('2026-12-03', '10:15')}
                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-white border-2 border-amber-800 text-amber-950 font-semibold text-sm hover:bg-amber-100 cursor-pointer"
              >
                Weekday Morning (Thu 10:15)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2026-12-03', '14:00')}
                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-white border-2 border-slate-800 text-slate-950 font-semibold text-sm hover:bg-slate-100 cursor-pointer"
              >
                Weekday Afternoon (Thu 14:00)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2026-12-03', '19:00')}
                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-white border-2 border-slate-800 text-slate-950 font-semibold text-sm hover:bg-slate-100 cursor-pointer"
              >
                Off-Hours (Thu 19:00)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2026-12-06', '10:15')}
                className="min-h-[48px] min-w-[48px] px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 cursor-pointer"
              >
                Sunday (No Classes)
              </button>
            </div>
          </section>
        ) : (
          (!firebaseReady || firestoreError) && (
            <div
              role="alert"
              className="bg-red-50 border-2 border-red-700 text-red-950 rounded-xl p-4 text-sm font-semibold"
            >
              {firestoreError ??
                'Firebase .env keys are not configured. Switch to Demo Mode to preview.'}
            </div>
          )
        )}

        {/* Date, Time & Refresh Controls (matches SDD Figure 16 wireframe) */}
        <section
          aria-label="Drill time selection"
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <label className="bg-white border-2 border-slate-400 rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-h-[56px]">
            <span className="text-sm font-bold text-slate-900">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="min-h-[48px] px-2 text-sm font-bold text-slate-950 bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-700 rounded"
            />
          </label>

          <label className="bg-white border-2 border-slate-400 rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-h-[56px]">
            <span className="text-sm font-bold text-slate-900">Time:</span>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="min-h-[48px] px-2 text-sm font-bold text-slate-950 bg-transparent focus:outline-none focus:ring-2 focus:ring-slate-700 rounded"
            />
          </label>

          <button
            type="button"
            onClick={handleRefresh}
            className="min-h-[56px] min-w-[48px] px-6 py-3 rounded-xl bg-white border-2 border-slate-900 text-slate-950 font-bold text-sm hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-400 cursor-pointer"
          >
            Refresh
          </button>
        </section>

        {isSunday && (
          <div className="bg-slate-200 border-2 border-slate-600 text-slate-950 rounded-xl px-4 py-3 text-sm font-bold">
            Selected date is a Sunday — no scheduled classes meet on Sundays, so
            all active students are placed in &ldquo;Not in class&rdquo;.
          </div>
        )}

        {/* Expected List Table (matches SDD Figure 16 wireframe) */}
        <section
          aria-label="Expected list by group"
          className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-950">
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Group
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Room
                  </th>
                  <th scope="col" className="py-3.5 px-4 text-sm font-bold">
                    Expected
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {groups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-6 px-4 text-center text-sm font-medium text-slate-700"
                    >
                      No active students found in roster.
                    </td>
                  </tr>
                ) : (
                  groups.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 text-sm font-bold text-slate-950">
                        {row.group}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-semibold text-slate-900">
                        {row.roomLabel}
                      </td>
                      <td className="py-3.5 px-4 text-sm font-extrabold tabular-nums text-slate-950">
                        {row.expected}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer Total (matches SDD Figure 16 wireframe) */}
        <footer className="text-base font-extrabold text-slate-950 px-1">
          Total expected: {entries.length}
        </footer>
      </main>
    </div>
  );
}

export default ExpectedListPage;

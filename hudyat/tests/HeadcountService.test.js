import { Timestamp } from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HeadcountService,
  NOT_IN_CLASS_GROUP,
} from '../src/services/HeadcountService.js';
import { MissingMonitor } from '../src/services/MissingMonitor.js';

const t0 = Timestamp.fromMillis(1_700_000_000_000);
const deadline = Timestamp.fromMillis(1_700_000_300_000); // t0 + 5 min
const beforeDeadline = new Date(1_700_000_200_000);
const afterDeadline = new Date(1_700_000_350_000);

const baseDrill = {
  id: 'drill-1',
  campusId: 'citu-main',
  title: 'NSED Pilot Drill',
  phase: 'evacuate',
  scenario: 'normal',
  blockedNodeIds: [],
  blockedEdgeIds: [],
  createdBy: 'coord-1',
  startedAt: t0,
  evacuateAt: t0,
  deadlineAt: deadline,
  dchDurationSec: 60,
};

const users = [
  {
    uid: 'coord-1',
    email: 'coord@cit.edu',
    displayName: 'DRRM Officer',
    role: 'coordinator',
    campusId: 'citu-main',
    createdAt: t0,
  },
  {
    uid: 'teacher-1',
    email: 'reyes@cit.edu',
    displayName: 'Ms. Reyes',
    role: 'teacher',
    campusId: 'citu-main',
    createdAt: t0,
  },
  {
    uid: 'teacher-2',
    email: 'santos@cit.edu',
    displayName: 'Mr. Santos',
    role: 'teacher',
    campusId: 'citu-main',
    createdAt: t0,
  },
  {
    uid: 's1',
    email: 's1@cit.edu',
    displayName: 'Ana Cruz',
    role: 'student',
    campusId: 'citu-main',
    createdAt: t0,
  },
  {
    uid: 's2',
    email: 's2@cit.edu',
    displayName: 'Ben Lim',
    role: 'student',
    campusId: 'citu-main',
    createdAt: t0,
  },
  {
    uid: 's3',
    email: 's3@cit.edu',
    displayName: 'Cy Tan',
    role: 'student',
    campusId: 'citu-main',
    createdAt: t0,
  },
  {
    uid: 's4',
    email: 's4@cit.edu',
    displayName: 'Di Uy',
    role: 'student',
    campusId: 'citu-main',
    createdAt: t0,
  },
  {
    uid: 's5',
    email: 's5@cit.edu',
    displayName: 'Eva Go',
    role: 'student',
    campusId: 'citu-main',
    createdAt: t0,
  },
];

const sections = [
  {
    id: 'sec-g1',
    campusId: 'citu-main',
    code: 'IT332-G1',
    name: 'Capstone G1',
    teacherUid: 'teacher-1',
  },
];

const mapNodes = [
  {
    id: 'eng-401',
    campusId: 'citu-main',
    buildingId: 'eng',
    floor: 4,
    label: 'ENG 401',
    type: 'room',
    x: 0,
    y: 0,
  },
  {
    id: 'stair-a',
    campusId: 'citu-main',
    buildingId: 'eng',
    floor: 2,
    label: 'Stairway A',
    type: 'stair',
    x: 10,
    y: 10,
  },
  {
    id: 'canteen',
    campusId: 'citu-main',
    buildingId: 'main',
    floor: 1,
    label: 'Canteen',
    type: 'common',
    x: 20,
    y: 20,
  },
];

const expectedEntries = [
  {
    id: 's1',
    drillId: 'drill-1',
    studentUid: 's1',
    displayName: 'Ana Cruz',
    sectionId: 'sec-g1',
    teacherUid: 'teacher-1',
    roomNodeId: 'eng-401',
    buildingId: 'eng',
    floor: 4,
  },
  {
    id: 's2',
    drillId: 'drill-1',
    studentUid: 's2',
    displayName: 'Ben Lim',
    sectionId: 'sec-g1',
    teacherUid: 'teacher-1',
    roomNodeId: 'eng-401',
    buildingId: 'eng',
    floor: 4,
  },
  {
    id: 's3',
    drillId: 'drill-1',
    studentUid: 's3',
    displayName: 'Cy Tan',
    sectionId: 'sec-g1',
    teacherUid: 'teacher-1',
    roomNodeId: 'eng-401',
    buildingId: 'eng',
    floor: 4,
  },
  {
    id: 's4',
    drillId: 'drill-1',
    studentUid: 's4',
    displayName: 'Di Uy',
    group: NOT_IN_CLASS_GROUP,
    sectionId: '',
    teacherUid: '',
    roomNodeId: '',
    buildingId: '',
    floor: 1,
  },
  {
    id: 's5',
    drillId: 'drill-1',
    studentUid: 's5',
    displayName: 'Eva Go',
    group: NOT_IN_CLASS_GROUP,
    sectionId: '',
    teacherUid: '',
    roomNodeId: '',
    buildingId: '',
    floor: 1,
  },
];

describe('HeadcountService', () => {
  it('distinguishes verified check-ins (QR, teacher, verified peer) from unverified pending peer check-ins', () => {
    const checkIns = [
      {
        studentUid: 's1',
        drillId: 'drill-1',
        method: 'qr',
        assemblyNodeId: 'assembly-b',
        checkedInBy: 's1',
        checkedInAt: Timestamp.fromMillis(1_700_000_100_000),
      },
      {
        studentUid: 's2',
        drillId: 'drill-1',
        method: 'teacher',
        assemblyNodeId: 'assembly-b',
        checkedInBy: 'teacher-1',
        checkedInAt: Timestamp.fromMillis(1_700_000_110_000),
      },
      {
        studentUid: 's3',
        drillId: 'drill-1',
        method: 'peer',
        assemblyNodeId: 'assembly-b',
        checkedInBy: 's1',
        verifiedBy: null,
        checkedInAt: Timestamp.fromMillis(1_700_000_120_000),
      },
      {
        studentUid: 's4',
        drillId: 'drill-1',
        method: 'peer',
        assemblyNodeId: 'assembly-b',
        checkedInBy: 's1',
        verifiedBy: 'teacher-1',
        checkedInAt: Timestamp.fromMillis(1_700_000_130_000),
      },
    ];

    const service = new HeadcountService({
      drill: baseDrill,
      expectedEntries,
      checkIns,
      users,
      sections,
      mapNodes,
    });

    const groups = service.counts();
    expect(groups).toEqual([
      {
        key: 'sec-g1',
        group: 'IT332-G1',
        sectionId: 'sec-g1',
        roomNodeId: 'eng-401',
        roomLabel: 'ENG 401',
        displayLabel: 'IT332-G1 (ENG 401)',
        expected: 3,
        accounted: 2,
        pending: 1,
        missing: 1,
        late: 0,
      },
      {
        key: 'not-in-class',
        group: NOT_IN_CLASS_GROUP,
        sectionId: null,
        roomNodeId: null,
        roomLabel: '—',
        displayLabel: NOT_IN_CLASS_GROUP,
        expected: 2,
        accounted: 1,
        pending: 0,
        missing: 1,
        late: 0,
      },
    ]);

    expect(service.totals()).toEqual({
      expected: 5,
      accounted: 3,
      pending: 1,
      missing: 2,
      late: 0,
    });
  });

  it('returns empty missing list before deadlineAt and populates missing rows after deadlineAt', () => {
    const checkIns = [
      {
        studentUid: 's1',
        drillId: 'drill-1',
        method: 'qr',
        assemblyNodeId: 'assembly-b',
        checkedInBy: 's1',
        checkedInAt: Timestamp.fromMillis(1_700_000_100_000),
      },
      {
        studentUid: 's3',
        drillId: 'drill-1',
        method: 'peer',
        assemblyNodeId: 'assembly-b',
        checkedInBy: 's1',
        verifiedBy: null,
        checkedInAt: Timestamp.fromMillis(1_700_000_120_000),
      },
    ];

    const responses = [
      {
        id: 'r-s2',
        drillId: 'drill-1',
        uid: 's2',
        phase: 'evacuate',
        status: 'evacuating',
        currentNodeId: 'stair-a',
        updatedAt: t0,
      },
      {
        id: 'r-s5',
        drillId: 'drill-1',
        uid: 's5',
        phase: 'evacuate',
        status: 'evacuating',
        currentNodeId: 'canteen',
        updatedAt: t0,
      },
    ];

    const service = new HeadcountService({
      drill: baseDrill,
      expectedEntries,
      checkIns,
      responses,
      users,
      sections,
      mapNodes,
    });

    expect(service.missing(beforeDeadline)).toEqual([]);

    const rows = service.missing(afterDeadline);
    expect(rows.map((r) => r.studentUid)).toEqual(['s2', 's3', 's4', 's5']);
    expect(rows[0]).toMatchObject({
      studentUid: 's2',
      studentName: 'Ben Lim',
      expectedRoomLabel: 'ENG 401',
      lastZoneLabel: 'Stairway A',
      pendingPeerCheckIn: false,
    });
    expect(rows[1]).toMatchObject({
      studentUid: 's3',
      studentName: 'Cy Tan',
      pendingPeerCheckIn: true,
    });
    expect(rows[3]).toMatchObject({
      studentUid: 's5',
      studentName: 'Eva Go',
      group: NOT_IN_CLASS_GROUP,
      expectedRoomLabel: '—',
      lastZoneLabel: 'Canteen',
    });
  });

  it('moves a student from Missing to Accounted with a late flag when a late check-in arrives', () => {
    const lateCheckIn = {
      studentUid: 's2',
      drillId: 'drill-1',
      method: 'qr',
      assemblyNodeId: 'assembly-b',
      checkedInBy: 's2',
      checkedInAt: Timestamp.fromMillis(1_700_000_340_000),
    };

    const service = new HeadcountService({
      drill: baseDrill,
      expectedEntries: expectedEntries.slice(0, 2),
      checkIns: [
        {
          studentUid: 's1',
          drillId: 'drill-1',
          method: 'qr',
          assemblyNodeId: 'assembly-b',
          checkedInBy: 's1',
          checkedInAt: Timestamp.fromMillis(1_700_000_100_000),
        },
        lateCheckIn,
      ],
      users,
      sections,
      mapNodes,
    });

    expect(service.totals()).toEqual({
      expected: 2,
      accounted: 2,
      pending: 0,
      missing: 0,
      late: 1,
    });
    expect(service.missing(afterDeadline)).toEqual([]);
  });

  it('alerts nearest teacher via RouteService.distance, falling back to section teacher or coordinator', async () => {
    const writtenAlerts = [];
    const mockRouteService = {
      distance: (a, b) => {
        if (a === 'zone-t2' && b === 'stair-a') return 15;
        if (a === 'zone-t1' && b === 'stair-a') return 45;
        return Infinity;
      },
    };

    const responses = [
      {
        id: 'r-t1',
        drillId: 'drill-1',
        uid: 'teacher-1',
        phase: 'evacuate',
        status: 'arrived',
        currentNodeId: 'zone-t1',
        updatedAt: t0,
      },
      {
        id: 'r-t2',
        drillId: 'drill-1',
        uid: 'teacher-2',
        phase: 'evacuate',
        status: 'arrived',
        currentNodeId: 'zone-t2',
        updatedAt: t0,
      },
      {
        id: 'r-s2',
        drillId: 'drill-1',
        uid: 's2',
        phase: 'evacuate',
        status: 'evacuating',
        currentNodeId: 'stair-a',
        updatedAt: t0,
      },
    ];

    const service = new HeadcountService({
      drill: baseDrill,
      expectedEntries: [expectedEntries[1], expectedEntries[2], expectedEntries[4]],
      checkIns: [],
      responses,
      users,
      sections,
      mapNodes,
      routeService: mockRouteService,
      onWriteAlert: (alert) => {
        writtenAlerts.push(alert);
      },
    });

    const missing = service.missing(afterDeadline);
    for (const row of missing) {
      await service.alertNearest(row);
    }

    expect(writtenAlerts).toHaveLength(3);
    expect(writtenAlerts[0].studentUid).toBe('s2');
    expect(writtenAlerts[0].teacherUid).toBe('teacher-2');
    expect(writtenAlerts[1].studentUid).toBe('s3');
    expect(writtenAlerts[1].teacherUid).toBe('teacher-1');
    expect(writtenAlerts[2].studentUid).toBe('s5');
    expect(writtenAlerts[2].teacherUid).toBe('coord-1');
    expect(writtenAlerts[0].visualCue).toBe(true);
    expect(writtenAlerts[0].hapticCue).toBe(true);
  });
});

describe('MissingMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks every 5 seconds and triggers alertNearest without duplicate alerts', async () => {
    const writtenAlerts = [];

    const service = new HeadcountService({
      drill: baseDrill,
      expectedEntries: [expectedEntries[1]],
      checkIns: [],
      users,
      sections,
      mapNodes,
      onWriteAlert: (alert) => {
        writtenAlerts.push(alert);
      },
    });

    const monitor = new MissingMonitor({
      service,
      intervalMs: 5000,
    });

    await monitor.checkNow(beforeDeadline);
    expect(writtenAlerts).toHaveLength(0);

    vi.setSystemTime(afterDeadline);
    monitor.start();
    await vi.advanceTimersByTimeAsync(15000);

    expect(writtenAlerts).toHaveLength(1);
    expect(writtenAlerts[0].studentUid).toBe('s2');

    monitor.stop();
  });
});

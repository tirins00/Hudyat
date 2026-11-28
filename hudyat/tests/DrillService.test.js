import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockWriteBatch,
  mockDoc,
  mockCollection,
  mockQuery,
  mockWhere,
  mockGetDocs,
  mockGetDoc,
} = vi.hoisted(() => ({
  mockWriteBatch: vi.fn(),
  mockDoc: vi.fn((...args) => ({ path: args.slice(1).join('/') })),
  mockCollection: vi.fn((...args) => ({ path: args.slice(1).join('/') })),
  mockQuery: vi.fn((...args) => ({ queryArgs: args })),
  mockWhere: vi.fn((...args) => ({ whereArgs: args })),
  mockGetDocs: vi.fn(),
  mockGetDoc: vi.fn(),
}));

vi.mock('../src/firebase/config.js', () => ({ db: {} }));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    writeBatch: (...args) => mockWriteBatch(...args),
    doc: (...args) => mockDoc(...args),
    collection: (...args) => mockCollection(...args),
    query: (...args) => mockQuery(...args),
    where: (...args) => mockWhere(...args),
    getDocs: (...args) => mockGetDocs(...args),
    getDoc: (...args) => mockGetDoc(...args),
  };
});

import {
  ACTIVE_DRILL_ERROR_MESSAGE,
  DEFAULT_ASSEMBLY_DEADLINE_SEC,
  EXPECTED_ENTRIES_BATCH_SIZE,
  createDrillService,
  createFirestoreDrillStore,
  createInMemoryDrillStore,
} from '../src/services/DrillService.js';
import { NOT_IN_CLASS_GROUP } from '../src/services/ScheduleResolver.js';
import { DRILL_PHASES, RESPONSE_STATUSES } from '../src/types/models.js';

describe('DrillService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manages drill lifecycle: start -> advance -> end', async () => {
    const service = createDrillService(createInMemoryDrillStore({ drills: [] }));

    const started = await service.startDrill({
      id: 'drill-test-01',
      title: 'Test Drill',
      campusId: 'cit-u',
    });
    expect(started.phase).toBe(DRILL_PHASES.DCH);

    const evacuated = await service.advanceDrillPhase('drill-test-01');
    expect(evacuated.phase).toBe(DRILL_PHASES.EVACUATE);

    const ended = await service.endDrill('drill-test-01');
    expect(ended.phase).toBe(DRILL_PHASES.ENDED);

    await expect(service.advanceDrillPhase('drill-test-01')).rejects.toThrow(/already ended/);
  });

  it('rejects starting a duplicate active drill for the same campus while dch or evacuate is active', async () => {
    const service = createDrillService(createInMemoryDrillStore({ drills: [] }));

    await service.startDrill({
      id: 'drill-active-01',
      title: 'Morning Drill',
      campusId: 'cit-u',
    });

    // Reject duplicate while active drill is in 'dch'
    await expect(
      service.startDrill({
        id: 'drill-dup-dch',
        title: 'Duplicate During DCH',
        campusId: 'cit-u',
      }),
    ).rejects.toThrow(ACTIVE_DRILL_ERROR_MESSAGE);

    // Advance to 'evacuate' and confirm duplicate is still rejected
    await service.advanceToEvacuate('drill-active-01');
    await expect(
      service.startDrill({
        id: 'drill-dup-evac',
        title: 'Duplicate During Evacuate',
        campusId: 'cit-u',
      }),
    ).rejects.toThrow('An active drill is already in progress for this campus.');

    // Different campus can start independently
    const otherCampus = await service.startDrill({
      id: 'drill-other-campus',
      title: 'Other Campus Drill',
      campusId: 'other-campus',
    });
    expect(otherCampus.phase).toBe(DRILL_PHASES.DCH);

    // Once ended, a new drill can start on the original campus
    await service.endDrill('drill-active-01');
    const nextDrill = await service.startDrill({
      id: 'drill-next-02',
      title: 'Afternoon Drill',
      campusId: 'cit-u',
    });
    expect(nextDrill.phase).toBe(DRILL_PHASES.DCH);
  });

  it('freezes resolved expectedEntries on startDrill and handles empty rosters gracefully', async () => {
    // Thursday 10:30 AM local time
    const drillStartTime = new Date(2026, 11, 3, 10, 30, 0);

    const store = createInMemoryDrillStore({
      drills: [],
      users: [
        {
          uid: 'stu-in-class',
          displayName: 'Ana Cruz',
          role: 'student',
          active: true,
          campusId: 'cit-u',
        },
        {
          uid: 'stu-free',
          displayName: 'Ben Lim',
          role: 'student',
          active: true,
          campusId: 'cit-u',
        },
        {
          uid: 'stu-inactive',
          displayName: 'Inactive Student',
          role: 'student',
          active: false,
          campusId: 'cit-u',
        },
        {
          uid: 'teacher-01',
          displayName: 'Ms. Reyes',
          role: 'teacher',
          active: true,
          campusId: 'cit-u',
        },
      ],
      sections: [
        {
          id: 'sec-it342',
          campusId: 'cit-u',
          code: 'IT342-A',
          name: 'IT 342 Section A',
          teacherUid: 'teacher-01',
        },
      ],
      enrollments: [
        {
          id: 'enr-1',
          campusId: 'cit-u',
          sectionId: 'sec-it342',
          studentUid: 'stu-in-class',
        },
      ],
      scheduleSlots: [
        {
          id: 'slot-thu-1',
          campusId: 'cit-u',
          sectionId: 'sec-it342',
          roomNodeId: 'NGE-301',
          buildingId: 'NGE',
          floor: 3,
          dayOfWeek: 'THU',
          startTime: '10:00',
          endTime: '11:30',
        },
      ],
    });

    const service = createDrillService(store);
    const created = await service.startDrill({
      id: 'drill-freeze-01',
      title: 'Frozen Roster Drill',
      campusId: 'cit-u',
      startedAt: drillStartTime,
    });

    const frozen = await service.getExpectedEntries(created.id);
    expect(frozen).toHaveLength(2);

    const inClass = frozen.find((e) => e.studentUid === 'stu-in-class');
    const notInClass = frozen.find((e) => e.studentUid === 'stu-free');

    expect(inClass).toEqual({
      id: 'stu-in-class',
      drillId: 'drill-freeze-01',
      studentUid: 'stu-in-class',
      displayName: 'Ana Cruz',
      group: 'IT342-A',
      sectionId: 'sec-it342',
      sectionCode: 'IT342-A',
      teacherUid: 'teacher-01',
      roomNodeId: 'NGE-301',
      expectedRoomId: 'NGE-301',
      buildingId: 'NGE',
      floor: 3,
    });

    expect(notInClass).toEqual({
      id: 'stu-free',
      drillId: 'drill-freeze-01',
      studentUid: 'stu-free',
      displayName: 'Ben Lim',
      group: NOT_IN_CLASS_GROUP,
      sectionId: '',
      teacherUid: '',
      roomNodeId: '',
      expectedRoomId: null,
      buildingId: '',
      floor: 0,
    });

    // Empty campus roster should start cleanly with 0 expected entries
    const emptyService = createDrillService(createInMemoryDrillStore({ drills: [] }));
    const emptyDrill = await emptyService.startDrill({
      id: 'drill-empty-01',
      title: 'Empty Roster Drill',
      campusId: 'cit-u',
    });
    expect(await emptyService.getExpectedEntries(emptyDrill.id)).toEqual([]);
  });

  it('writes frozen expectedEntries in chunked writeBatch calls (max 400 per batch)', async () => {
    const batches = [];
    mockWriteBatch.mockImplementation(() => {
      const ops = [];
      const batchObj = {
        set: vi.fn((ref, data) => ops.push({ ref, data })),
        commit: vi.fn(async () => undefined),
        ops,
      };
      batches.push(batchObj);
      return batchObj;
    });

    const firestoreStore = createFirestoreDrillStore({});
    const entries = Array.from({ length: 900 }, (_, i) => ({
      id: `stu-${i}`,
      drillId: 'drill-batch-01',
      studentUid: `stu-${i}`,
      displayName: `Student ${i}`,
      group: NOT_IN_CLASS_GROUP,
      sectionId: '',
      teacherUid: '',
      roomNodeId: '',
      expectedRoomId: null,
      buildingId: '',
      floor: 0,
    }));

    const writtenCount = await firestoreStore.saveExpectedEntries(
      'drill-batch-01',
      entries,
    );

    expect(writtenCount).toBe(900);
    expect(EXPECTED_ENTRIES_BATCH_SIZE).toBe(400);
    expect(batches).toHaveLength(3);
    expect(batches.map((b) => b.ops.length)).toEqual([400, 400, 100]);
    expect(batches.every((b) => b.commit.mock.calls.length === 1)).toBe(true);
  });

  it('sets deadlineAt alongside evacuateStartedAt in advanceToEvacuate using campus policy or 300s default', async () => {
    // Case 1: default 5-minute (300s) deadline when no policy is configured
    const defaultService = createDrillService(createInMemoryDrillStore({ drills: [] }));
    await defaultService.startDrill({
      id: 'drill-deadline-default',
      title: 'Default Deadline Drill',
      campusId: 'cit-u',
    });

    const beforeDefault = Date.now();
    const evacuatedDefault = await defaultService.advanceToEvacuate(
      'drill-deadline-default',
    );
    const afterDefault = Date.now();

    expect(evacuatedDefault.phase).toBe(DRILL_PHASES.EVACUATE);
    expect(evacuatedDefault.evacuateStartedAt).toBeDefined();
    expect(evacuatedDefault.deadlineAt).toBeDefined();

    const defaultEvacMs = evacuatedDefault.evacuateStartedAt.toMillis();
    const defaultDeadlineMs = evacuatedDefault.deadlineAt.toMillis();
    expect(defaultEvacMs).toBeGreaterThanOrEqual(beforeDefault);
    expect(defaultEvacMs).toBeLessThanOrEqual(afterDefault);
    expect(defaultDeadlineMs - defaultEvacMs).toBe(
      DEFAULT_ASSEMBLY_DEADLINE_SEC * 1000,
    );

    // Case 2: custom campus policy assemblyDeadlineSec (e.g. 420 seconds = 7 minutes)
    const customService = createDrillService(
      createInMemoryDrillStore({
        drills: [],
        policies: {
          'cit-u': {
            id: 'default',
            campusId: 'cit-u',
            assemblyDeadlineSec: 420,
          },
        },
      }),
    );

    await customService.startDrill({
      id: 'drill-deadline-custom',
      title: 'Custom Deadline Drill',
      campusId: 'cit-u',
    });

    const evacuatedCustom = await customService.advanceToEvacuate(
      'drill-deadline-custom',
    );
    expect(evacuatedCustom.phase).toBe(DRILL_PHASES.EVACUATE);
    expect(evacuatedCustom.assemblyDeadlineSec).toBe(420);
    expect(
      evacuatedCustom.deadlineAt.toMillis() -
        evacuatedCustom.evacuateStartedAt.toMillis(),
    ).toBe(420 * 1000);
  });

  it('records and retrieves step responses', async () => {
    const service = createDrillService(createInMemoryDrillStore());
    const saved = await service.submitStepResponse('drill-citu-eq-01', 'stu-01', {
      displayName: 'Maria Santos',
      phase: DRILL_PHASES.EVACUATE,
      status: RESPONSE_STATUSES.EVACUATING,
      currentNodeId: 'NGE-301',
      completedSteps: ['dch'],
      source: 'qr',
    });

    expect(saved.uid).toBe('stu-01');
    expect(saved.currentNodeId).toBe('NGE-301');

    const fetched = await service.getUserResponse('drill-citu-eq-01', 'stu-01');
    expect(fetched.status).toBe(RESPONSE_STATUSES.EVACUATING);

    const verified = await service.submitStepResponse('drill-citu-eq-01', 'stu-02', {
      displayName: 'Juan Dela Cruz',
      phase: DRILL_PHASES.EVACUATE,
      status: RESPONSE_STATUSES.ARRIVED,
      nodeId: 'ASM-QUAD-01',
      qrCode: 'HUDYAT|cit-u|assembly|ASM-QUAD-01',
      verifiedQr: true,
      completedSteps: ['dch', 'stairs', 'assembly'],
      source: 'manual_code',
      method: 'manual_code',
    });
    expect(verified.nodeId).toBe('ASM-QUAD-01');
    expect(verified.currentNodeId).toBe('ASM-QUAD-01');
    expect(verified.qrCode).toBe('HUDYAT|cit-u|assembly|ASM-QUAD-01');
    expect(verified.verifiedQr).toBe(true);
    expect(verified.method).toBe('manual_code');
  });
});

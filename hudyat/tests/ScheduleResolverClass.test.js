import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  NOT_IN_CLASS_GROUP,
  ScheduleResolver,
  expectedList,
  groupExpectedEntries,
  slotCovers,
} from '../src/services/ScheduleResolver.js';

const createdAt = Timestamp.fromMillis(1_700_000_000_000);

const makeStudent = (uid, active = true) => ({
  uid,
  email: `${uid}@cit.edu`,
  displayName: `Student ${uid}`,
  role: 'student',
  campusId: 'citu-main',
  active,
  studentNumber: `2023-${uid}`,
  createdAt,
});

const sections = [
  {
    id: 'sec-1',
    campusId: 'citu-main',
    code: 'IT332-G1',
    name: 'Capstone G1',
    teacherUid: 't-1',
  },
  {
    id: 'sec-2',
    campusId: 'citu-main',
    code: 'IT332-G2',
    name: 'Capstone G2',
    teacherUid: 't-2',
  },
  {
    id: 'sec-3',
    campusId: 'citu-main',
    code: 'CS210-A',
    name: 'Algorithms A',
    teacherUid: 't-1',
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
    id: 'eng-402',
    campusId: 'citu-main',
    buildingId: 'eng',
    floor: 4,
    label: 'ENG 402',
    type: 'room',
    x: 10,
    y: 0,
  },
  {
    id: 'main-201',
    campusId: 'citu-main',
    buildingId: 'main',
    floor: 2,
    label: 'MAIN 201',
    type: 'room',
    x: 20,
    y: 0,
  },
];

const slots = [
  {
    id: 'slot-1',
    campusId: 'citu-main',
    sectionId: 'sec-1',
    roomNodeId: 'eng-401',
    buildingId: 'eng',
    floor: 4,
    dayOfWeek: 'THU',
    startTime: '10:15',
    endTime: '11:45',
  },
  {
    id: 'slot-2',
    campusId: 'citu-main',
    sectionId: 'sec-2',
    roomNodeId: 'eng-402',
    buildingId: 'eng',
    floor: 4,
    dayOfWeek: 'THU',
    startTime: '10:30',
    endTime: '12:00',
  },
  {
    id: 'slot-3',
    campusId: 'citu-main',
    sectionId: 'sec-3',
    roomNodeId: 'main-201',
    buildingId: 'main',
    floor: 2,
    dayOfWeek: 'THU',
    startTime: '11:45',
    endTime: '13:15',
  },
];

describe('ScheduleResolver (class & slotCovers)', () => {
  it('enforces start <= t < end boundary checks in slotCovers', () => {
    const slot = slots[0];
    expect(slotCovers(slot, new Date(2026, 11, 3, 10, 14, 59))).toBe(false);
    expect(slotCovers(slot, new Date(2026, 11, 3, 10, 15, 0))).toBe(true);
    expect(slotCovers(slot, new Date(2026, 11, 3, 11, 44, 59))).toBe(true);
    expect(slotCovers(slot, new Date(2026, 11, 3, 11, 45, 0))).toBe(false);
    expect(slotCovers(slot, new Date(2026, 11, 4, 10, 30, 0))).toBe(false);
    expect(slotCovers(slot, new Date(2026, 11, 6, 10, 30, 0))).toBe(false);
  });

  it('places active students with no class at time t in "Not in class" with no room', () => {
    const users = [makeStudent('s1'), makeStudent('s2'), makeStudent('s3')];
    const enrollments = [
      { id: 'e1', campusId: 'citu-main', sectionId: 'sec-1', studentUid: 's1' },
      { id: 'e2', campusId: 'citu-main', sectionId: 'sec-3', studentUid: 's2' },
    ];

    const result = expectedList(
      new Date(2026, 11, 3, 10, 15, 0),
      users,
      enrollments,
      sections,
      slots,
    );

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      studentUid: 's1',
      group: 'IT332-G1',
      sectionId: 'sec-1',
      roomNodeId: 'eng-401',
    });
    expect(result[1]).toMatchObject({
      studentUid: 's2',
      group: NOT_IN_CLASS_GROUP,
      sectionId: '',
      roomNodeId: '',
      expectedRoomId: null,
    });
    expect(result[2]).toMatchObject({
      studentUid: 's3',
      group: NOT_IN_CLASS_GROUP,
      sectionId: '',
      roomNodeId: '',
      expectedRoomId: null,
    });

    const summary = groupExpectedEntries(result, sections, mapNodes);
    expect(summary).toEqual([
      {
        key: 'sec-1',
        group: 'IT332-G1',
        sectionId: 'sec-1',
        roomNodeId: 'eng-401',
        roomLabel: 'ENG 401',
        expected: 1,
      },
      {
        key: 'not-in-class',
        group: NOT_IN_CLASS_GROUP,
        sectionId: null,
        roomNodeId: null,
        roomLabel: '—',
        expected: 2,
      },
    ]);
  });

  it('places all active students in "Not in class" on Sunday or when no schedules match', () => {
    const users = [makeStudent('s1'), makeStudent('s2')];
    const enrollments = [
      { id: 'e1', campusId: 'citu-main', sectionId: 'sec-1', studentUid: 's1' },
      { id: 'e2', campusId: 'citu-main', sectionId: 'sec-2', studentUid: 's2' },
    ];

    const sundayResult = expectedList(
      new Date(2026, 11, 6, 10, 30, 0),
      users,
      enrollments,
      sections,
      slots,
    );

    expect(sundayResult).toHaveLength(2);
    expect(
      sundayResult.every(
        (entry) =>
          entry.group === NOT_IN_CLASS_GROUP &&
          entry.sectionId === '' &&
          entry.roomNodeId === '',
      ),
    ).toBe(true);
  });

  it('ignores the later slot when a student has overlapping classes and ensures no duplicate students', () => {
    const users = [makeStudent('s1')];
    const enrollments = [
      { id: 'e1', campusId: 'citu-main', sectionId: 'sec-2', studentUid: 's1' },
      { id: 'e2', campusId: 'citu-main', sectionId: 'sec-1', studentUid: 's1' },
    ];

    const resolver = new ScheduleResolver({
      users,
      enrollments,
      sections,
      scheduleSlots: slots,
    });

    const result = resolver.expectedList(new Date(2026, 11, 3, 10, 45, 0));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      studentUid: 's1',
      group: 'IT332-G1',
      sectionId: 'sec-1',
      roomNodeId: 'eng-401',
    });

    const atTransition = resolver.expectedList(
      new Date(2026, 11, 3, 11, 45, 0),
    );
    expect(atTransition).toHaveLength(1);
    expect(atTransition[0]).toMatchObject({
      studentUid: 's1',
      group: 'IT332-G2',
      sectionId: 'sec-2',
      roomNodeId: 'eng-402',
    });
  });

  it('excludes inactive students and non-student roles', () => {
    const users = [
      makeStudent('s1', true),
      makeStudent('s2-inactive', false),
      {
        uid: 't-1',
        email: 'teacher@cit.edu',
        displayName: 'Ms. Reyes',
        role: 'teacher',
        campusId: 'citu-main',
        active: true,
        createdAt,
      },
      {
        uid: 'coord-1',
        email: 'coord@cit.edu',
        displayName: 'DRRM Coordinator',
        role: 'coordinator',
        campusId: 'citu-main',
        active: true,
        createdAt,
      },
    ];
    const enrollments = [
      { id: 'e1', campusId: 'citu-main', sectionId: 'sec-1', studentUid: 's1' },
      {
        id: 'e2',
        campusId: 'citu-main',
        sectionId: 'sec-1',
        studentUid: 's2-inactive',
      },
    ];

    const result = expectedList(
      new Date(2026, 11, 3, 10, 30, 0),
      users,
      enrollments,
      sections,
      slots,
    );

    expect(result).toHaveLength(1);
    expect(result[0].studentUid).toBe('s1');
  });
});

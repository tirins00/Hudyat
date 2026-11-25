import { describe, expect, it } from 'vitest';
import {
  NOT_IN_CLASS_GROUP,
  groupExpectedEntries,
  resolveExpectedList,
} from '../src/services/ScheduleResolver.js';

describe('ScheduleResolver', () => {
  const baseSections = [
    { id: 'sec-it342', code: 'IT342-A', name: 'IT 342 - Section A' },
    { id: 'sec-cs301', code: 'CS301-B', name: 'CS 301 - Section B' },
  ];

  const baseStudents = [
    { uid: 'stu-1', role: 'student', active: true, displayName: 'Ana Cruz' },
    { uid: 'stu-2', role: 'student', active: true, displayName: 'Ben Reyes' },
  ];

  const baseEnrollments = [
    { id: 'enr-1', sectionId: 'sec-it342', studentUid: 'stu-1' },
    { id: 'enr-2', sectionId: 'sec-cs301', studentUid: 'stu-2' },
  ];

  const baseSlots = [
    {
      id: 'slot-1',
      sectionId: 'sec-it342',
      roomNodeId: 'room-gle-301',
      dayOfWeek: 'MON',
      startTime: '09:00',
      endTime: '10:30',
    },
    {
      id: 'slot-2',
      sectionId: 'sec-cs301',
      roomNodeId: 'room-nge-204',
      dayOfWeek: 'TUE',
      startTime: '13:00',
      endTime: '14:30',
    },
  ];

  it('assigns a student in class during a covering slot to that section group and room', () => {
    const entries = resolveExpectedList({
      students: baseStudents,
      sections: baseSections,
      enrollments: baseEnrollments,
      scheduleSlots: baseSlots,
      dateTime: { day: 'MON', time: '09:45' },
    });

    expect(entries).toEqual([
      {
        studentUid: 'stu-1',
        group: 'IT 342 - Section A',
        sectionId: 'sec-it342',
        expectedRoomId: 'room-gle-301',
      },
      {
        studentUid: 'stu-2',
        group: NOT_IN_CLASS_GROUP,
        sectionId: '',
        expectedRoomId: '',
      },
    ]);
  });

  it('treats exact start time as in class and exact end time as not in class', () => {
    const atStart = resolveExpectedList({
      students: [baseStudents[0]],
      sections: baseSections,
      enrollments: [baseEnrollments[0]],
      scheduleSlots: [baseSlots[0]],
      dateTime: { day: 'MON', time: '09:00' },
    });

    expect(atStart).toEqual([
      {
        studentUid: 'stu-1',
        group: 'IT 342 - Section A',
        sectionId: 'sec-it342',
        expectedRoomId: 'room-gle-301',
      },
    ]);

    const atEnd = resolveExpectedList({
      students: [baseStudents[0]],
      sections: baseSections,
      enrollments: [baseEnrollments[0]],
      scheduleSlots: [baseSlots[0]],
      dateTime: { day: 'MON', time: '10:30' },
    });

    expect(atEnd).toEqual([
      {
        studentUid: 'stu-1',
        group: NOT_IN_CLASS_GROUP,
        sectionId: '',
        expectedRoomId: '',
      },
    ]);
  });

  it('places a student with no covering class at that time into Not in class', () => {
    // Wednesday 11:00 has no slots
    const entries = resolveExpectedList({
      students: baseStudents,
      sections: baseSections,
      enrollments: baseEnrollments,
      scheduleSlots: baseSlots,
      dateTime: new Date(2026, 10, 25, 11, 0), // Wed Nov 25, 2026 11:00
    });

    expect(entries).toEqual([
      {
        studentUid: 'stu-1',
        group: NOT_IN_CLASS_GROUP,
        sectionId: '',
        expectedRoomId: '',
      },
      {
        studentUid: 'stu-2',
        group: NOT_IN_CLASS_GROUP,
        sectionId: '',
        expectedRoomId: '',
      },
    ]);
  });

  it('places all students into Not in class on Sunday', () => {
    const sundayDate = new Date(2026, 10, 29, 9, 30); // Sun Nov 29, 2026 09:30
    expect(sundayDate.getDay()).toBe(0);

    const slotsWithSundayAttempt = [
      ...baseSlots,
      {
        id: 'slot-sun',
        sectionId: 'sec-it342',
        roomNodeId: 'room-gle-301',
        dayOfWeek: 'SUN',
        startTime: '09:00',
        endTime: '11:00',
      },
    ];

    const fromDate = resolveExpectedList({
      students: baseStudents,
      sections: baseSections,
      enrollments: baseEnrollments,
      scheduleSlots: slotsWithSundayAttempt,
      dateTime: sundayDate,
    });

    const fromObject = resolveExpectedList({
      students: baseStudents,
      sections: baseSections,
      enrollments: baseEnrollments,
      scheduleSlots: slotsWithSundayAttempt,
      dateTime: { day: 'SUN', time: '09:30' },
    });

    for (const result of [fromDate, fromObject]) {
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.group === NOT_IN_CLASS_GROUP)).toBe(true);
      expect(result.every((e) => e.sectionId === '' && e.expectedRoomId === '')).toBe(true);
    }
  });

  it('picks the earlier start slot on overlapping classes and breaks ties by sectionId', () => {
    const student = { uid: 'stu-overlap', role: 'student', active: true };
    const sections = [
      { id: 'sec-b', name: 'Section B' },
      { id: 'sec-a', name: 'Section A' },
      { id: 'sec-early', name: 'Early Section' },
    ];
    const enrollments = [
      { id: 'e1', sectionId: 'sec-b', studentUid: 'stu-overlap' },
      { id: 'e2', sectionId: 'sec-a', studentUid: 'stu-overlap' },
      { id: 'e3', sectionId: 'sec-early', studentUid: 'stu-overlap' },
    ];

    // Earlier start (08:30) beats 09:00
    const overlappingSlots = [
      {
        id: 's1',
        sectionId: 'sec-b',
        roomNodeId: 'room-b',
        dayOfWeek: 'MON',
        startTime: '09:00',
        endTime: '10:30',
      },
      {
        id: 's2',
        sectionId: 'sec-early',
        roomNodeId: 'room-early',
        dayOfWeek: 'MON',
        startTime: '08:30',
        endTime: '10:00',
      },
    ];

    const earliestResult = resolveExpectedList({
      students: [student],
      sections,
      enrollments,
      scheduleSlots: overlappingSlots,
      dateTime: { day: 'MON', time: '09:15' },
    });

    expect(earliestResult).toHaveLength(1);
    expect(earliestResult[0]).toEqual({
      studentUid: 'stu-overlap',
      group: 'Early Section',
      sectionId: 'sec-early',
      expectedRoomId: 'room-early',
    });

    // Equal start times (09:00) tie-break by sectionId ('sec-a' < 'sec-b')
    const tiedSlots = [
      {
        id: 's1',
        sectionId: 'sec-b',
        roomNodeId: 'room-b',
        dayOfWeek: 'MON',
        startTime: '09:00',
        endTime: '10:30',
      },
      {
        id: 's2',
        sectionId: 'sec-a',
        roomNodeId: 'room-a',
        dayOfWeek: 'MON',
        startTime: '09:00',
        endTime: '10:00',
      },
    ];

    const tieResult = resolveExpectedList({
      students: [student],
      sections,
      enrollments,
      scheduleSlots: tiedSlots,
      dateTime: { day: 'MON', time: '09:15' },
    });

    expect(tieResult).toHaveLength(1);
    expect(tieResult[0]).toEqual({
      studentUid: 'stu-overlap',
      group: 'Section A',
      sectionId: 'sec-a',
      expectedRoomId: 'room-a',
    });
  });

  it('excludes inactive students and non-student users', () => {
    const users = [
      { uid: 'stu-active', role: 'student', active: true },
      { uid: 'stu-default-active', role: 'student' },
      { uid: 'stu-inactive', role: 'student', active: false },
      { uid: 'teacher-1', role: 'teacher', active: true },
      { uid: 'coord-1', role: 'coordinator', active: true },
    ];

    const entries = resolveExpectedList({
      students: users,
      sections: baseSections,
      enrollments: [
        { id: 'e1', sectionId: 'sec-it342', studentUid: 'stu-active' },
        { id: 'e2', sectionId: 'sec-it342', studentUid: 'stu-inactive' },
      ],
      scheduleSlots: baseSlots,
      dateTime: { day: 'MON', time: '09:30' },
    });

    expect(entries.map((entry) => entry.studentUid)).toEqual([
      'stu-active',
      'stu-default-active',
    ]);
  });

  it('groups expected entries by section and keeps Not in class as the final row', () => {
    const entries = resolveExpectedList({
      students: [
        { uid: 'stu-1', role: 'student', active: true },
        { uid: 'stu-2', role: 'student', active: true },
        { uid: 'stu-3', role: 'student', active: true },
      ],
      sections: [
        { id: 'sec-z', name: 'Zeta Class' },
        { id: 'sec-a', name: 'Alpha Class' },
      ],
      enrollments: [
        { id: 'e1', sectionId: 'sec-z', studentUid: 'stu-1' },
        { id: 'e2', sectionId: 'sec-a', studentUid: 'stu-2' },
      ],
      scheduleSlots: [
        {
          id: 's1',
          sectionId: 'sec-z',
          roomNodeId: 'node-1',
          dayOfWeek: 'MON',
          startTime: '09:00',
          endTime: '10:00',
        },
        {
          id: 's2',
          sectionId: 'sec-a',
          roomNodeId: 'node-2',
          dayOfWeek: 'MON',
          startTime: '09:00',
          endTime: '10:00',
        },
      ],
      dateTime: { day: 'MON', time: '09:30' },
    });

    const rows = groupExpectedEntries(entries, {
      'node-1': 'GLE 301',
      'node-2': 'NGE 204',
    });

    expect(rows).toEqual([
      {
        group: 'Alpha Class',
        sectionId: 'sec-a',
        room: 'NGE 204',
        expectedCount: 1,
        studentUids: ['stu-2'],
      },
      {
        group: 'Zeta Class',
        sectionId: 'sec-z',
        room: 'GLE 301',
        expectedCount: 1,
        studentUids: ['stu-1'],
      },
      {
        group: NOT_IN_CLASS_GROUP,
        sectionId: '',
        room: '—',
        expectedCount: 1,
        studentUids: ['stu-3'],
      },
    ]);
  });

  it('resolves 3,000 students in under 3,000 ms', () => {
    const sectionCount = 100;
    const studentCount = 3000;

    const sections = Array.from({ length: sectionCount }, (_, i) => ({
      id: `sec-${String(i).padStart(3, '0')}`,
      code: `SEC-${i}`,
      name: `Section ${i}`,
    }));

    const scheduleSlots = sections.map((sec, i) => ({
      id: `slot-${i}`,
      sectionId: sec.id,
      roomNodeId: `room-${i % 40}`,
      dayOfWeek: i % 2 === 0 ? 'MON' : 'TUE',
      startTime: '09:00',
      endTime: '10:30',
    }));

    const students = Array.from({ length: studentCount }, (_, i) => ({
      uid: `stu-${i}`,
      role: 'student',
      active: true,
    }));

    // Give every student 5 enrollments (15,000 total enrollments)
    const enrollments = [];
    for (let i = 0; i < studentCount; i += 1) {
      for (let j = 0; j < 5; j += 1) {
        const secIdx = (i + j * 17) % sectionCount;
        enrollments.push({
          id: `enr-${i}-${j}`,
          sectionId: sections[secIdx].id,
          studentUid: students[i].uid,
        });
      }
    }

    const startedAt = performance.now();
    const entries = resolveExpectedList({
      students,
      sections,
      enrollments,
      scheduleSlots,
      dateTime: { day: 'MON', time: '09:30' },
    });
    const elapsedMs = performance.now() - startedAt;

    expect(entries).toHaveLength(studentCount);
    expect(elapsedMs).toBeLessThan(3000);
  });
});

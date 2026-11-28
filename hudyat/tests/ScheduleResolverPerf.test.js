import { describe, expect, it } from 'vitest';
import {
  NOT_IN_CLASS_GROUP,
  ScheduleResolver,
} from '../src/services/ScheduleResolver.js';

describe('ScheduleResolver performance benchmark (REQ-304 / NFR-P4)', () => {
  it('assigns all 3,000 students across 100 sections, 3,000 enrollments, and 300 schedule slots to exactly one group in under 3,000 ms', () => {
    const STUDENT_COUNT = 3000;
    const SECTION_COUNT = 100;
    const SLOTS_PER_SECTION = 3; // 100 * 3 = 300 schedule slots
    const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const sections = Array.from({ length: SECTION_COUNT }, (_, i) => ({
      id: `sec-${String(i).padStart(3, '0')}`,
      campusId: 'cit-u',
      code: `SEC-${String(i).padStart(3, '0')}`,
      name: `Section ${i}`,
      teacherUid: `teacher-${i % 25}`,
    }));

    const scheduleSlots = [];
    for (let s = 0; s < SECTION_COUNT; s += 1) {
      for (let k = 0; k < SLOTS_PER_SECTION; k += 1) {
        const dayOfWeek = DAYS[(s + k * 2) % DAYS.length];
        const startHour = 8 + ((s + k) % 8); // 08:00 through 15:00
        const startTime = `${String(startHour).padStart(2, '0')}:00`;
        const endTime = `${String(startHour + 1).padStart(2, '0')}:30`;
        scheduleSlots.push({
          id: `slot-${s}-${k}`,
          campusId: 'cit-u',
          sectionId: sections[s].id,
          roomNodeId: `NGE-${100 + ((s * 3 + k) % 40)}`,
          buildingId: 'NGE',
          floor: ((s + k) % 4) + 1,
          dayOfWeek,
          startTime,
          endTime,
        });
      }
    }

    const students = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
      uid: `stu-${String(i).padStart(4, '0')}`,
      displayName: `Student ${i}`,
      role: 'student',
      active: true,
      campusId: 'cit-u',
    }));

    const enrollments = Array.from({ length: STUDENT_COUNT }, (_, i) => ({
      id: `enr-${String(i).padStart(4, '0')}`,
      campusId: 'cit-u',
      sectionId: sections[i % SECTION_COUNT].id,
      studentUid: students[i].uid,
    }));

    expect(students).toHaveLength(3000);
    expect(sections).toHaveLength(100);
    expect(enrollments).toHaveLength(3000);
    expect(scheduleSlots).toHaveLength(300);

    const resolver = new ScheduleResolver({
      users: students,
      enrollments,
      sections,
      scheduleSlots,
    });

    // Monday 10:15 AM
    const drillTime = new Date(2026, 10, 30, 10, 15, 0);

    const t0 = performance.now();
    const entries = resolver.expectedList(drillTime, 'drill-perf-3000');
    const elapsedMs = performance.now() - t0;

    console.info(
      `[REQ-304 / NFR-P4] ScheduleResolver resolved ${entries.length} students in ${elapsedMs.toFixed(2)} ms`,
    );

    expect(entries).toHaveLength(STUDENT_COUNT);

    const validGroups = new Set([
      NOT_IN_CLASS_GROUP,
      ...sections.map((s) => s.code),
    ]);
    const assignedStudents = new Set();
    let inClassCount = 0;
    let notInClassCount = 0;

    for (const entry of entries) {
      expect(assignedStudents.has(entry.studentUid)).toBe(false);
      assignedStudents.add(entry.studentUid);
      expect(typeof entry.group).toBe('string');
      expect(entry.group.length).toBeGreaterThan(0);
      expect(validGroups.has(entry.group)).toBe(true);
      if (entry.group === NOT_IN_CLASS_GROUP) {
        notInClassCount += 1;
      } else {
        inClassCount += 1;
      }
    }

    expect(assignedStudents.size).toBe(STUDENT_COUNT);
    expect(inClassCount).toBeGreaterThan(0);
    expect(notInClassCount).toBeGreaterThan(0);
    expect(inClassCount + notInClassCount).toBe(STUDENT_COUNT);
    expect(elapsedMs).toBeLessThan(3000);
  });
});

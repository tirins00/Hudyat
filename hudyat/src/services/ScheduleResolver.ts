import type {
  DayOfWeek,
  Enrollment,
  ExpectedEntry,
  MapNode,
  ScheduleSlot,
  Section,
  User,
} from '../types/models';

export const NOT_IN_CLASS_GROUP = 'Not in class';

const JS_DAY_TO_DAY_OF_WEEK: ReadonlyArray<DayOfWeek | null> = [
  null, // 0: Sunday (no scheduled classes)
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
];

export interface ExpectedGroupSummary {
  key: string;
  group: string;
  sectionId: string | null;
  roomNodeId: string | null;
  roomLabel: string;
  expected: number;
}

/**
 * Parses a 24-hour `HH:mm` time string into seconds since midnight.
 */
export function parseTimeToSeconds(time: string): number {
  const parts = time.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid 24-hour time string: "${time}"`);
  }
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid 24-hour time string: "${time}"`);
  }
  return hours * 3600 + minutes * 60;
}

/**
 * Returns the `DayOfWeek` (`MON`–`SAT`) for a Date, or `null` on Sunday.
 */
export function getDayOfWeek(t: Date): DayOfWeek | null {
  return JS_DAY_TO_DAY_OF_WEEK[t.getDay()] ?? null;
}

/**
 * Helper corresponding to `ScheduleSlot.covers(t)` in the SDD class diagram.
 * Returns `true` when `slot` meets on `t`'s day (MON–SAT) and `start <= t < end`.
 */
export function slotCovers(slot: ScheduleSlot, t: Date): boolean {
  const day = getDayOfWeek(t);
  if (!day || slot.dayOfWeek !== day) {
    return false;
  }
  const currentSec =
    t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds();
  const startSec = parseTimeToSeconds(slot.startTime);
  const endSec = parseTimeToSeconds(slot.endTime);
  return startSec <= currentSec && currentSec < endSec;
}

function compareSlotsByStart(a: ScheduleSlot, b: ScheduleSlot): number {
  const startDiff =
    parseTimeToSeconds(a.startTime) - parseTimeToSeconds(b.startTime);
  if (startDiff !== 0) return startDiff;
  const endDiff =
    parseTimeToSeconds(a.endTime) - parseTimeToSeconds(b.endTime);
  if (endDiff !== 0) return endDiff;
  return a.id.localeCompare(b.id);
}

/**
 * Builds the schedule-aware expected list for a drill time `t` (UC-2.2).
 *
 * - Only active students (`role === 'student'` and `active !== false`) are included.
 * - Each active student appears in exactly one group.
 * - A student is placed in section S if S has a slot on that day with `start <= t < end`.
 * - If a student has overlapping classes at `t`, the later slot is ignored (earliest start wins).
 * - If no slot covers `t` (including Sunday / off-hours), the student is placed in `"Not in class"` with no room.
 */
export function expectedList(
  t: Date,
  students: readonly User[],
  enrollments: readonly Enrollment[],
  sections: readonly Section[],
  scheduleSlots: readonly ScheduleSlot[],
  drillId = 'preview',
): ExpectedEntry[] {
  const sectionsById = new Map<string, Section>();
  for (const section of sections) {
    sectionsById.set(section.id, section);
  }

  const enrollmentsByStudent = new Map<string, string[]>();
  for (const enrollment of enrollments) {
    let list = enrollmentsByStudent.get(enrollment.studentUid);
    if (!list) {
      list = [];
      enrollmentsByStudent.set(enrollment.studentUid, list);
    }
    list.push(enrollment.sectionId);
  }

  // Pre-filter schedule slots covering `t` and keep the earliest slot per section.
  const coveringSlotBySection = new Map<string, ScheduleSlot>();
  for (const slot of scheduleSlots) {
    if (!slotCovers(slot, t)) continue;
    const existing = coveringSlotBySection.get(slot.sectionId);
    if (!existing || compareSlotsByStart(slot, existing) < 0) {
      coveringSlotBySection.set(slot.sectionId, slot);
    }
  }

  const seenStudentUids = new Set<string>();
  const entries: ExpectedEntry[] = [];

  for (const user of students) {
    if (user.role !== 'student' || user.active === false) {
      continue;
    }
    if (seenStudentUids.has(user.uid)) {
      continue;
    }
    seenStudentUids.add(user.uid);

    const studentSectionIds = enrollmentsByStudent.get(user.uid) ?? [];
    let chosenSlot: ScheduleSlot | null = null;

    for (const sectionId of studentSectionIds) {
      const slot = coveringSlotBySection.get(sectionId);
      if (!slot) continue;
      if (!chosenSlot || compareSlotsByStart(slot, chosenSlot) < 0) {
        chosenSlot = slot;
      }
    }

    if (!chosenSlot) {
      entries.push({
        id: user.uid,
        drillId,
        studentUid: user.uid,
        displayName: user.displayName,
        group: NOT_IN_CLASS_GROUP,
        sectionId: '',
        teacherUid: '',
        roomNodeId: '',
        expectedRoomId: null,
        buildingId: '',
        floor: 0,
      });
    } else {
      const section = sectionsById.get(chosenSlot.sectionId);
      const sectionCode = section?.code ?? chosenSlot.sectionId;
      entries.push({
        id: user.uid,
        drillId,
        studentUid: user.uid,
        displayName: user.displayName,
        group: sectionCode,
        sectionId: chosenSlot.sectionId,
        sectionCode,
        teacherUid: section?.teacherUid ?? '',
        roomNodeId: chosenSlot.roomNodeId,
        expectedRoomId: chosenSlot.roomNodeId,
        buildingId: chosenSlot.buildingId,
        floor: chosenSlot.floor,
      });
    }
  }

  return entries;
}

/**
 * Summarizes expected entries into per-section (with room label) and `"Not in class"` rows
 * for the Expected List UI table (SDD Figure 16).
 */
export function groupExpectedEntries(
  entries: readonly ExpectedEntry[],
  sections: readonly Section[] = [],
  mapNodes: readonly MapNode[] = [],
): ExpectedGroupSummary[] {
  const sectionsById = new Map<string, Section>();
  for (const section of sections) {
    sectionsById.set(section.id, section);
  }

  const nodesById = new Map<string, MapNode>();
  for (const node of mapNodes) {
    nodesById.set(node.id, node);
  }

  const summaries = new Map<string, ExpectedGroupSummary>();

  for (const entry of entries) {
    const isNotInClass =
      entry.group === NOT_IN_CLASS_GROUP || entry.sectionId.trim() === '';

    const key = isNotInClass ? 'not-in-class' : entry.sectionId;
    let bucket = summaries.get(key);

    if (!bucket) {
      if (isNotInClass) {
        bucket = {
          key,
          group: NOT_IN_CLASS_GROUP,
          sectionId: null,
          roomNodeId: null,
          roomLabel: '—',
          expected: 0,
        };
      } else {
        const section = sectionsById.get(entry.sectionId);
        const group =
          entry.sectionCode ?? entry.group ?? section?.code ?? entry.sectionId;
        const roomId = entry.expectedRoomId ?? entry.roomNodeId ?? null;
        const roomNode = roomId ? nodesById.get(roomId) : undefined;
        const roomLabel = roomNode?.label ?? roomId ?? '—';

        bucket = {
          key,
          group,
          sectionId: entry.sectionId,
          roomNodeId: roomId,
          roomLabel,
          expected: 0,
        };
      }
      summaries.set(key, bucket);
    }

    bucket.expected += 1;
  }

  return Array.from(summaries.values()).sort((a, b) => {
    if (a.key === 'not-in-class') return 1;
    if (b.key === 'not-in-class') return -1;
    return a.group.localeCompare(b.group);
  });
}

/**
 * Class wrapper matching the SDD Overall Class Diagram (`ScheduleResolver.expectedList(t)`).
 */
export class ScheduleResolver {
  private readonly students: readonly User[];
  private readonly enrollments: readonly Enrollment[];
  private readonly sections: readonly Section[];
  private readonly scheduleSlots: readonly ScheduleSlot[];

  constructor(data: {
    users: readonly User[];
    enrollments: readonly Enrollment[];
    sections: readonly Section[];
    scheduleSlots: readonly ScheduleSlot[];
  }) {
    this.students = data.users;
    this.enrollments = data.enrollments;
    this.sections = data.sections;
    this.scheduleSlots = data.scheduleSlots;
  }

  expectedList(t: Date, drillId = 'preview'): ExpectedEntry[] {
    return expectedList(
      t,
      this.students,
      this.enrollments,
      this.sections,
      this.scheduleSlots,
      drillId,
    );
  }
}

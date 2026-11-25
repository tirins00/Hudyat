import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { ROLES } from '../types/models.js';

export const NOT_IN_CLASS_GROUP = 'Not in class';

const JS_DAY_TO_CODE = Object.freeze([
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
]);

/**
 * @typedef {Object} ResolvedExpectedEntry
 * @property {string} studentUid
 * @property {string} group
 * @property {string} sectionId
 * @property {string} expectedRoomId
 */

/**
 * @typedef {Object} GroupedExpectedRow
 * @property {string} group
 * @property {string} sectionId
 * @property {string} room
 * @property {number} expectedCount
 * @property {string[]} studentUids
 */

/**
 * Parses a 24-hour "HH:MM" time string into total minutes since midnight.
 * Returns `NaN` for invalid strings.
 * @param {string} timeStr
 * @returns {number}
 */
function parseTimeToMinutes(timeStr) {
  if (typeof timeStr !== 'string') {
    return Number.NaN;
  }

  const trimmed = timeStr.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) {
    return Number.NaN;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return Number.NaN;
  }

  return hours * 60 + minutes;
}

/**
 * Extracts normalized day code ('SUN' | 'MON'–'SAT') and minutes since midnight
 * from a JS `Date` or `{ day, time }` object.
 * @param {Date | { day: string, time: string }} dateTime
 * @returns {{ day: string, minutes: number }}
 */
function normalizeDateTime(dateTime) {
  if (dateTime instanceof Date) {
    if (Number.isNaN(dateTime.getTime())) {
      return { day: '', minutes: Number.NaN };
    }
    return {
      day: JS_DAY_TO_CODE[dateTime.getDay()],
      minutes: dateTime.getHours() * 60 + dateTime.getMinutes(),
    };
  }

  if (dateTime && typeof dateTime === 'object') {
    const day = String(dateTime.day ?? dateTime.dayOfWeek ?? '')
      .trim()
      .toUpperCase();
    const minutes = parseTimeToMinutes(dateTime.time);
    return { day, minutes };
  }

  const now = new Date();
  return {
    day: JS_DAY_TO_CODE[now.getDay()],
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}

/**
 * Pure schedule resolver that computes the expected drill location for every
 * active student at a given date/time.
 *
 * Uses O(N) Map lookups to handle 3,000+ students well under 3 seconds.
 *
 * @param {Object} params
 * @param {Array<import('../types/models.js').User>} params.students
 * @param {Array<import('../types/models.js').Section>} params.sections
 * @param {Array<import('../types/models.js').Enrollment>} params.enrollments
 * @param {Array<import('../types/models.js').ScheduleSlot>} params.scheduleSlots
 * @param {Date | { day: string, time: string }} params.dateTime
 * @returns {ResolvedExpectedEntry[]}
 */
export function resolveExpectedList({
  students = [],
  sections = [],
  enrollments = [],
  scheduleSlots = [],
  dateTime,
} = {}) {
  const { day, minutes } = normalizeDateTime(dateTime);

  /** @type {Map<string, import('../types/models.js').Section>} */
  const sectionById = new Map();
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    if (section && section.id) {
      sectionById.set(section.id, section);
    }
  }

  // Map each sectionId to its earliest-starting covering slot at `dateTime`.
  /** @type {Map<string, { sectionId: string, startMin: number, roomId: string }>} */
  const coveringSlotBySection = new Map();

  if (day && day !== 'SUN' && !Number.isNaN(minutes)) {
    for (let i = 0; i < scheduleSlots.length; i += 1) {
      const slot = scheduleSlots[i];
      if (!slot || !slot.sectionId) {
        continue;
      }

      const slotDay = String(slot.dayOfWeek ?? slot.day ?? '')
        .trim()
        .toUpperCase();
      if (slotDay !== day) {
        continue;
      }

      const startMin = parseTimeToMinutes(slot.startTime ?? slot.start);
      const endMin = parseTimeToMinutes(slot.endTime ?? slot.end);
      if (Number.isNaN(startMin) || Number.isNaN(endMin)) {
        continue;
      }

      // Covering condition: start <= time < end
      if (startMin <= minutes && minutes < endMin) {
        const roomId = String(slot.roomNodeId ?? slot.roomId ?? '');
        const existing = coveringSlotBySection.get(slot.sectionId);
        if (!existing || startMin < existing.startMin) {
          coveringSlotBySection.set(slot.sectionId, {
            sectionId: slot.sectionId,
            startMin,
            roomId,
          });
        }
      }
    }
  }

  // Pick the best covering slot per student: earliest start, tie-break by sectionId.
  /** @type {Map<string, { sectionId: string, startMin: number, roomId: string }>} */
  const bestSlotByStudent = new Map();

  if (coveringSlotBySection.size > 0) {
    for (let i = 0; i < enrollments.length; i += 1) {
      const enrollment = enrollments[i];
      if (!enrollment || !enrollment.studentUid || !enrollment.sectionId) {
        continue;
      }

      const candidate = coveringSlotBySection.get(enrollment.sectionId);
      if (!candidate) {
        continue;
      }

      const existing = bestSlotByStudent.get(enrollment.studentUid);
      if (
        !existing ||
        candidate.startMin < existing.startMin ||
        (candidate.startMin === existing.startMin &&
          candidate.sectionId < existing.sectionId)
      ) {
        bestSlotByStudent.set(enrollment.studentUid, candidate);
      }
    }
  }

  /** @type {ResolvedExpectedEntry[]} */
  const entries = [];
  /** @type {Set<string>} */
  const seenStudentUids = new Set();

  for (let i = 0; i < students.length; i += 1) {
    const student = students[i];
    if (
      !student ||
      student.role !== ROLES.STUDENT ||
      student.active === false
    ) {
      continue;
    }

    const studentUid = student.uid ?? student.id;
    if (!studentUid || seenStudentUids.has(studentUid)) {
      continue;
    }
    seenStudentUids.add(studentUid);

    const matched = bestSlotByStudent.get(studentUid);
    if (matched) {
      const section = sectionById.get(matched.sectionId);
      const group =
        (section && (section.name || section.code)) || matched.sectionId;

      entries.push({
        studentUid,
        group,
        sectionId: matched.sectionId,
        expectedRoomId: matched.roomId,
      });
    } else {
      entries.push({
        studentUid,
        group: NOT_IN_CLASS_GROUP,
        sectionId: '',
        expectedRoomId: '',
      });
    }
  }

  return entries;
}

/**
 * Resolves a room label from a `Map` or plain dictionary object.
 * @param {string} roomId
 * @param {Map<string, string> | Record<string, string> | undefined} roomLabelsById
 * @returns {string}
 */
function lookupRoomLabel(roomId, roomLabelsById) {
  if (!roomId) {
    return '—';
  }
  if (roomLabelsById instanceof Map) {
    return roomLabelsById.get(roomId) || roomId;
  }
  if (roomLabelsById && typeof roomLabelsById === 'object') {
    return roomLabelsById[roomId] || roomId;
  }
  return roomId;
}

/**
 * Aggregates resolved expected entries into display rows grouped by section,
 * keeping `Not in class` as the final row.
 *
 * @param {ResolvedExpectedEntry[]} entries
 * @param {Map<string, string> | Record<string, string>} [roomLabelsById]
 * @returns {GroupedExpectedRow[]}
 */
export function groupExpectedEntries(entries = [], roomLabelsById) {
  /** @type {Map<string, GroupedExpectedRow>} */
  const sectionRows = new Map();
  /** @type {GroupedExpectedRow | null} */
  let notInClassRow = null;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry) {
      continue;
    }

    const isUnassigned =
      !entry.sectionId || entry.group === NOT_IN_CLASS_GROUP;

    if (isUnassigned) {
      if (!notInClassRow) {
        notInClassRow = {
          group: NOT_IN_CLASS_GROUP,
          sectionId: '',
          room: '—',
          expectedCount: 0,
          studentUids: [],
        };
      }
      notInClassRow.expectedCount += 1;
      notInClassRow.studentUids.push(entry.studentUid);
      continue;
    }

    const key = `${entry.sectionId}::${entry.expectedRoomId || ''}`;
    let row = sectionRows.get(key);
    if (!row) {
      row = {
        group: entry.group,
        sectionId: entry.sectionId,
        room: lookupRoomLabel(entry.expectedRoomId, roomLabelsById),
        expectedCount: 0,
        studentUids: [],
      };
      sectionRows.set(key, row);
    }

    row.expectedCount += 1;
    row.studentUids.push(entry.studentUid);
  }

  const sortedRows = Array.from(sectionRows.values()).sort((a, b) => {
    const groupCompare = a.group.localeCompare(b.group);
    if (groupCompare !== 0) {
      return groupCompare;
    }
    return a.sectionId.localeCompare(b.sectionId);
  });

  if (notInClassRow) {
    sortedRows.push(notInClassRow);
  }

  return sortedRows;
}

/**
 * Loads students, sections, enrollments, scheduleSlots, and optional mapNodes
 * for a campus from Cloud Firestore.
 *
 * @param {string} campusId
 * @returns {Promise<{
 *   students: import('../types/models.js').User[],
 *   sections: import('../types/models.js').Section[],
 *   enrollments: import('../types/models.js').Enrollment[],
 *   scheduleSlots: import('../types/models.js').ScheduleSlot[],
 *   mapNodes: import('../types/models.js').MapNode[],
 *   roomLabelsById: Record<string, string>,
 * }>}
 */
export async function fetchScheduleInputs(campusId) {
  if (!campusId) {
    throw new Error('A campusId is required to load schedule inputs.');
  }

  const studentsQuery = query(
    collection(db, 'users'),
    where('campusId', '==', campusId),
    where('role', '==', ROLES.STUDENT),
  );
  const sectionsQuery = query(
    collection(db, 'sections'),
    where('campusId', '==', campusId),
  );
  const enrollmentsQuery = query(
    collection(db, 'enrollments'),
    where('campusId', '==', campusId),
  );
  const scheduleSlotsQuery = query(
    collection(db, 'scheduleSlots'),
    where('campusId', '==', campusId),
  );
  const mapNodesCollection = collection(db, 'campuses', campusId, 'mapNodes');

  const [
    studentsSnap,
    sectionsSnap,
    enrollmentsSnap,
    scheduleSlotsSnap,
    mapNodesSnap,
  ] = await Promise.all([
    getDocs(studentsQuery),
    getDocs(sectionsQuery),
    getDocs(enrollmentsQuery),
    getDocs(scheduleSlotsQuery),
    getDocs(mapNodesCollection).catch(() => null),
  ]);

  const students = studentsSnap.docs.map((docSnap) => ({
    uid: docSnap.id,
    ...docSnap.data(),
  }));

  const sections = sectionsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  const enrollments = enrollmentsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  const scheduleSlots = scheduleSlotsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

  const mapNodes = mapNodesSnap
    ? mapNodesSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
    : [];

  /** @type {Record<string, string>} */
  const roomLabelsById = {};
  for (let i = 0; i < mapNodes.length; i += 1) {
    const node = mapNodes[i];
    if (node.id && node.label) {
      roomLabelsById[node.id] = node.label;
    }
  }

  return {
    students,
    sections,
    enrollments,
    scheduleSlots,
    mapNodes,
    roomLabelsById,
  };
}

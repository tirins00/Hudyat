import Papa from 'papaparse';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { DAYS_OF_WEEK, ROLES } from '../types/models.js';

const MAX_BATCH_OPERATIONS = 400;

const ROSTER_REQUIRED_COLUMNS = Object.freeze([
  'studentNo',
  'name',
  'email',
  'sectionName',
]);

const SCHEDULE_REQUIRED_COLUMNS = Object.freeze([
  'sectionName',
  'day',
  'start',
  'end',
  'roomId',
]);

const VALID_DAYS = new Set(Object.values(DAYS_OF_WEEK));
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const SAMPLE_ROSTER_CSV = [
  'studentNo,name,email,sectionName',
  '2024-00101,Ana Marie Cruz,ana.cruz@cit.edu,BSIT-3A',
  '2024-00102,Carlo James Reyes,carlo.reyes@cit.edu,BSIT-3A',
  '2024-00103,Bea Sofia Lim,bea.lim@cit.edu,BSIT-3A',
  '2024-00104,Miguel Paolo Santos,miguel.santos@cit.edu,BSIT-3B',
  '2024-00105,Dianne Grace Tan,dianne.tan@cit.edu,BSIT-3B',
  '2024-00106,Rafael Luis Gomez,rafael.gomez@cit.edu,BSIT-3B',
].join('\n');

export const SAMPLE_SCHEDULE_CSV = [
  'sectionName,day,start,end,roomId',
  'BSIT-3A,MON,08:00,12:00,NGE-301',
  'BSIT-3A,MON,13:00,17:00,NGE-301',
  'BSIT-3A,TUE,08:00,12:00,NGE-301',
  'BSIT-3A,TUE,13:00,17:00,NGE-301',
  'BSIT-3A,WED,08:00,12:00,NGE-301',
  'BSIT-3A,WED,13:00,17:00,NGE-301',
  'BSIT-3A,THU,08:00,12:00,NGE-301',
  'BSIT-3A,THU,13:00,17:00,NGE-301',
  'BSIT-3A,FRI,08:00,12:00,NGE-301',
  'BSIT-3A,FRI,13:00,17:00,NGE-301',
  'BSIT-3A,SAT,08:00,12:00,NGE-301',
  'BSIT-3B,MON,08:00,12:00,NGE-302',
  'BSIT-3B,MON,13:00,17:00,NGE-302',
  'BSIT-3B,TUE,08:00,12:00,NGE-302',
  'BSIT-3B,TUE,13:00,17:00,NGE-302',
  'BSIT-3B,WED,08:00,12:00,NGE-302',
  'BSIT-3B,WED,13:00,17:00,NGE-302',
  'BSIT-3B,THU,08:00,12:00,NGE-302',
  'BSIT-3B,THU,13:00,17:00,NGE-302',
  'BSIT-3B,FRI,08:00,12:00,NGE-302',
  'BSIT-3B,FRI,13:00,17:00,NGE-302',
  'BSIT-3B,SAT,08:00,12:00,NGE-302',
].join('\n');

/**
 * @typedef {Object} CsvRowError
 * @property {number} rowNumber - 1-based CSV row number (1 = header, 2+ = data rows).
 * @property {string} message
 */

/**
 * @typedef {Object} RosterCsvRow
 * @property {string} studentNo
 * @property {string} name
 * @property {string} email
 * @property {string} sectionName
 */

/**
 * @typedef {Object} ScheduleCsvRow
 * @property {string} sectionName
 * @property {import('../types/models.js').DayOfWeek} day
 * @property {string} start
 * @property {string} end
 * @property {string} roomId
 */

/**
 * Converts a string into a safe deterministic slug for Firestore document IDs.
 * @param {string} value
 * @returns {string}
 */
export function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parses a validated 24-hour `HH:MM` string into total minutes since midnight.
 * @param {string} timeStr
 * @returns {number}
 */
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Parses and validates a Roster & Enrollments CSV string.
 * Expected columns: `studentNo, name, email, sectionName`.
 *
 * @param {string} csvText
 * @returns {{ rows: RosterCsvRow[], errors: CsvRowError[] }}
 */
export function parseRosterCsv(csvText) {
  const text = String(csvText || '').trim();
  if (!text) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: 'CSV file is empty.' }],
    };
  }

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const headers = parsed.meta?.fields || [];
  const missingColumns = ROSTER_REQUIRED_COLUMNS.filter(
    (col) => !headers.includes(col),
  );

  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          message: `Missing required column(s): ${missingColumns.join(', ')}.`,
        },
      ],
    };
  }

  /** @type {RosterCsvRow[]} */
  const rows = [];
  /** @type {CsvRowError[]} */
  const errors = [];

  for (let i = 0; i < parsed.data.length; i += 1) {
    const raw = parsed.data[i] || {};
    const rowNumber = i + 2;

    const studentNo = String(raw.studentNo ?? '').trim();
    const name = String(raw.name ?? '').trim();
    const email = String(raw.email ?? '')
      .trim()
      .toLowerCase();
    const sectionName = String(raw.sectionName ?? '').trim();

    /** @type {string[]} */
    const rowErrors = [];

    if (!studentNo) {
      rowErrors.push('studentNo is required');
    }
    if (!name) {
      rowErrors.push('name is required');
    }
    if (!email) {
      rowErrors.push('email is required');
    } else if (!EMAIL_REGEX.test(email)) {
      rowErrors.push(`invalid email format ("${email}")`);
    }
    if (!sectionName) {
      rowErrors.push('sectionName is required');
    }

    if (rowErrors.length > 0) {
      errors.push({
        rowNumber,
        message: `${rowErrors.join('; ')}.`,
      });
    } else {
      rows.push({
        studentNo,
        name,
        email,
        sectionName,
      });
    }
  }

  return { rows, errors };
}

/**
 * Parses and validates a Class Schedules CSV string.
 * Expected columns: `sectionName, day, start, end, roomId`.
 *
 * @param {string} csvText
 * @returns {{ rows: ScheduleCsvRow[], errors: CsvRowError[] }}
 */
export function parseScheduleCsv(csvText) {
  const text = String(csvText || '').trim();
  if (!text) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: 'CSV file is empty.' }],
    };
  }

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const headers = parsed.meta?.fields || [];
  const missingColumns = SCHEDULE_REQUIRED_COLUMNS.filter(
    (col) => !headers.includes(col),
  );

  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          message: `Missing required column(s): ${missingColumns.join(', ')}.`,
        },
      ],
    };
  }

  /** @type {ScheduleCsvRow[]} */
  const rows = [];
  /** @type {CsvRowError[]} */
  const errors = [];

  for (let i = 0; i < parsed.data.length; i += 1) {
    const raw = parsed.data[i] || {};
    const rowNumber = i + 2;

    const sectionName = String(raw.sectionName ?? '').trim();
    const day = String(raw.day ?? '')
      .trim()
      .toUpperCase();
    const start = String(raw.start ?? '').trim();
    const end = String(raw.end ?? '').trim();
    const roomId = String(raw.roomId ?? '').trim();

    /** @type {string[]} */
    const rowErrors = [];

    if (!sectionName) {
      rowErrors.push('sectionName is required');
    }

    if (!day) {
      rowErrors.push('day is required');
    } else if (!VALID_DAYS.has(day)) {
      rowErrors.push(
        `invalid day "${day}" (must be MON, TUE, WED, THU, FRI, or SAT)`,
      );
    }

    const hasValidStart = TIME_24H_REGEX.test(start);
    const hasValidEnd = TIME_24H_REGEX.test(end);

    if (!start) {
      rowErrors.push('start is required');
    } else if (!hasValidStart) {
      rowErrors.push(`invalid start time "${start}" (expected 24-hour HH:MM)`);
    }

    if (!end) {
      rowErrors.push('end is required');
    } else if (!hasValidEnd) {
      rowErrors.push(`invalid end time "${end}" (expected 24-hour HH:MM)`);
    }

    if (hasValidStart && hasValidEnd) {
      if (timeToMinutes(start) >= timeToMinutes(end)) {
        rowErrors.push(`start time (${start}) must be earlier than end time (${end})`);
      }
    }

    if (!roomId) {
      rowErrors.push('roomId is required');
    }

    if (rowErrors.length > 0) {
      errors.push({
        rowNumber,
        message: `${rowErrors.join('; ')}.`,
      });
    } else {
      rows.push({
        sectionName,
        day: /** @type {import('../types/models.js').DayOfWeek} */ (day),
        start,
        end,
        roomId,
      });
    }
  }

  return { rows, errors };
}

/**
 * Commits an array of Firestore set operations in chunks of <= 400 writes
 * per `writeBatch` to remain safely under Firestore's 500-operation limit.
 *
 * @param {Array<{
 *   ref: import('firebase/firestore').DocumentReference,
 *   data: Record<string, unknown>,
 *   options?: import('firebase/firestore').SetOptions,
 * }>} operations
 * @returns {Promise<void>}
 */
async function commitChunkedOperations(operations) {
  for (let i = 0; i < operations.length; i += MAX_BATCH_OPERATIONS) {
    const chunk = operations.slice(i, i + MAX_BATCH_OPERATIONS);
    const batch = writeBatch(db);
    for (let j = 0; j < chunk.length; j += 1) {
      const op = chunk[j];
      batch.set(op.ref, op.data, op.options || { merge: true });
    }
    await batch.commit();
  }
}

/**
 * Upserts sections, student user profiles (without calling Firebase Auth
 * account creation), and enrollments to Firestore in chunked batches.
 *
 * @param {{ campusId: string, rows: RosterCsvRow[] }} params
 * @returns {Promise<{ sectionsCount: number, studentsCount: number, enrollmentsCount: number }>}
 */
export async function importRosterToFirestore({ campusId, rows }) {
  if (!campusId) {
    throw new Error('A campusId is required to import roster data.');
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No valid roster rows to import.');
  }

  const existingUsersSnap = await getDocs(
    query(collection(db, 'users'), where('campusId', '==', campusId)),
  );

  /** @type {Map<string, string>} */
  const uidByEmail = new Map();
  /** @type {Map<string, string>} */
  const uidByStudentNo = new Map();

  for (let i = 0; i < existingUsersSnap.docs.length; i += 1) {
    const userDoc = existingUsersSnap.docs[i];
    const data = userDoc.data();
    const email = String(data.email || '')
      .trim()
      .toLowerCase();
    const studentNo = String(data.studentNumber ?? data.studentNo ?? '').trim();

    if (email) {
      uidByEmail.set(email, userDoc.id);
    }
    if (studentNo) {
      uidByStudentNo.set(studentNo, userDoc.id);
    }
  }

  /** @type {Map<string, { ref: import('firebase/firestore').DocumentReference, data: Record<string, unknown> }>} */
  const sectionOps = new Map();
  /** @type {Map<string, { ref: import('firebase/firestore').DocumentReference, data: Record<string, unknown> }>} */
  const studentOps = new Map();
  /** @type {Map<string, { ref: import('firebase/firestore').DocumentReference, data: Record<string, unknown> }>} */
  const enrollmentOps = new Map();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const sectionId = `${campusId}__${slugify(row.sectionName)}`;

    if (!sectionOps.has(sectionId)) {
      sectionOps.set(sectionId, {
        ref: doc(db, 'sections', sectionId),
        data: {
          id: sectionId,
          campusId,
          code: row.sectionName,
          name: row.sectionName,
          updatedAt: serverTimestamp(),
        },
      });
    }

    let studentUid =
      uidByEmail.get(row.email) || uidByStudentNo.get(row.studentNo);

    if (!studentUid) {
      studentUid = `student__${campusId}__${slugify(row.studentNo || row.email)}`;
      uidByEmail.set(row.email, studentUid);
      uidByStudentNo.set(row.studentNo, studentUid);
    }

    if (!studentOps.has(studentUid)) {
      studentOps.set(studentUid, {
        ref: doc(db, 'users', studentUid),
        data: {
          uid: studentUid,
          email: row.email,
          displayName: row.name,
          studentNumber: row.studentNo,
          studentNo: row.studentNo,
          role: ROLES.STUDENT,
          active: true,
          campusId,
          updatedAt: serverTimestamp(),
        },
      });
    }

    const enrollmentId = `${sectionId}__${studentUid}`;
    if (!enrollmentOps.has(enrollmentId)) {
      enrollmentOps.set(enrollmentId, {
        ref: doc(db, 'enrollments', enrollmentId),
        data: {
          id: enrollmentId,
          campusId,
          sectionId,
          studentUid,
          enrolledAt: serverTimestamp(),
        },
      });
    }
  }

  await commitChunkedOperations([
    ...sectionOps.values(),
    ...studentOps.values(),
    ...enrollmentOps.values(),
  ]);

  return {
    sectionsCount: sectionOps.size,
    studentsCount: studentOps.size,
    enrollmentsCount: enrollmentOps.size,
  };
}

/**
 * Upserts sections (if missing) and writes scheduleSlots documents to Firestore
 * in chunked batches (<= 400 writes per batch).
 *
 * @param {{ campusId: string, rows: ScheduleCsvRow[] }} params
 * @returns {Promise<{ sectionsCount: number, slotsCount: number }>}
 */
export async function importSchedulesToFirestore({ campusId, rows }) {
  if (!campusId) {
    throw new Error('A campusId is required to import schedules.');
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No valid schedule rows to import.');
  }

  /** @type {Map<string, { ref: import('firebase/firestore').DocumentReference, data: Record<string, unknown> }>} */
  const sectionOps = new Map();
  /** @type {Map<string, { ref: import('firebase/firestore').DocumentReference, data: Record<string, unknown> }>} */
  const slotOps = new Map();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const sectionId = `${campusId}__${slugify(row.sectionName)}`;

    if (!sectionOps.has(sectionId)) {
      sectionOps.set(sectionId, {
        ref: doc(db, 'sections', sectionId),
        data: {
          id: sectionId,
          campusId,
          code: row.sectionName,
          name: row.sectionName,
          updatedAt: serverTimestamp(),
        },
      });
    }

    const slotId = `${sectionId}__${row.day}__${row.start.replace(':', '')}__${row.end.replace(':', '')}__${slugify(row.roomId)}`;
    if (!slotOps.has(slotId)) {
      slotOps.set(slotId, {
        ref: doc(db, 'scheduleSlots', slotId),
        data: {
          id: slotId,
          campusId,
          sectionId,
          day: row.day,
          dayOfWeek: row.day,
          start: row.start,
          startTime: row.start,
          end: row.end,
          endTime: row.end,
          roomId: row.roomId,
          roomNodeId: row.roomId,
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  await commitChunkedOperations([...sectionOps.values(), ...slotOps.values()]);

  return {
    sectionsCount: sectionOps.size,
    slotsCount: slotOps.size,
  };
}

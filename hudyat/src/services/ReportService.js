import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  CHECKIN_METHODS,
  DRILL_PHASES,
  DRILL_SCENARIOS,
  SOS_STATUSES,
} from '../types/models.js';
import { NOT_IN_CLASS_GROUP } from './ScheduleResolver.js';

/**
 * Safely converts a Firestore Timestamp, Date, ISO string, or millisecond epoch
 * into epoch milliseconds, or `null` if unavailable.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
export function toMillis(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      const ms = value.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value.toDate === 'function') {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime())
        ? date.getTime()
        : null;
    }
    if (typeof value.seconds === 'number') {
      return value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1e6);
    }
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Formats a duration in seconds as a human-readable string (e.g. "2m 15s" or "45s").
 * @param {number | null | undefined} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

/**
 * Formats a CSV cell safely according to RFC-4180.
 * @param {unknown} value
 * @returns {string}
 */
function escapeCsvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Computes a complete, deterministic post-drill / live-drill analytics report.
 *
 * @param {Object} params
 * @param {import('../types/models.js').Drill | Record<string, any>} params.drill
 * @param {Array<import('../types/models.js').ExpectedEntry | Record<string, any>>} [params.expectedEntries]
 * @param {Array<import('../types/models.js').Response | Record<string, any>>} [params.responses]
 * @param {Array<import('../types/models.js').CheckIn | Record<string, any>>} [params.checkIns]
 * @param {Array<import('../types/models.js').Alert | Record<string, any>>} [params.alerts]
 * @param {Array<import('../types/models.js').Sos | Record<string, any>>} [params.sos]
 * @param {Record<string, { name?: string, code?: string }>} [params.sectionsById]
 * @param {Record<string, { label?: string }>} [params.nodesById]
 */
export function computeDrillReport({
  drill,
  expectedEntries = [],
  responses = [],
  checkIns = [],
  alerts = [],
  sos = [],
  sectionsById = {},
  nodesById = {},
} = {}) {
  const safeDrill = drill || {
    id: 'unknown',
    title: 'Untitled Drill',
    phase: DRILL_PHASES.ENDED,
    scenario: DRILL_SCENARIOS.NORMAL,
    blockedNodeIds: [],
    blockedEdgeIds: [],
  };

  // Deduplicate check-ins by studentUid (enforcing doc ID = studentUid contract).
  /** @type {Map<string, Record<string, any>>} */
  const checkInByStudent = new Map();
  for (let i = 0; i < checkIns.length; i += 1) {
    const ci = checkIns[i];
    const studentUid = String(ci?.studentUid || ci?.id || '').trim();
    if (!studentUid) {
      continue;
    }
    checkInByStudent.set(studentUid, { ...ci, studentUid });
  }

  // Deduplicate expected entries by studentUid.
  /** @type {Map<string, Record<string, any>>} */
  const expectedByStudent = new Map();
  for (let i = 0; i < expectedEntries.length; i += 1) {
    const entry = expectedEntries[i];
    const studentUid = String(entry?.studentUid || '').trim();
    if (!studentUid || expectedByStudent.has(studentUid)) {
      continue;
    }
    expectedByStudent.set(studentUid, entry);
  }

  const startedMs = toMillis(safeDrill.startedAt);
  const evacuateMs = toMillis(safeDrill.evacuateAt);
  const endedMs = toMillis(safeDrill.endedAt);
  const referenceEvacMs = evacuateMs ?? startedMs;

  const drillDurationSec =
    startedMs !== null && endedMs !== null && endedMs >= startedMs
      ? Math.round((endedMs - startedMs) / 1000)
      : null;

  const actualDchDurationSec =
    startedMs !== null && evacuateMs !== null && evacuateMs >= startedMs
      ? Math.round((evacuateMs - startedMs) / 1000)
      : typeof safeDrill.dchDurationSec === 'number'
        ? safeDrill.dchDurationSec
        : null;

  const evacuationDurationSec =
    evacuateMs !== null && endedMs !== null && endedMs >= evacuateMs
      ? Math.round((endedMs - evacuateMs) / 1000)
      : null;

  // Check-in method breakdown & check-in timing stats.
  const methodCounts = {
    [CHECKIN_METHODS.QR]: 0,
    [CHECKIN_METHODS.TEACHER]: 0,
    [CHECKIN_METHODS.PEER]: 0,
  };

  /** @type {Map<string, { assemblyNodeId: string, label: string, count: number }>} */
  const assemblyMap = new Map();
  /** @type {number[]} */
  const checkInDurationsSec = [];

  for (const ci of checkInByStudent.values()) {
    const method = ci.method;
    if (method === CHECKIN_METHODS.QR) {
      methodCounts[CHECKIN_METHODS.QR] += 1;
    } else if (method === CHECKIN_METHODS.TEACHER) {
      methodCounts[CHECKIN_METHODS.TEACHER] += 1;
    } else if (method === CHECKIN_METHODS.PEER) {
      methodCounts[CHECKIN_METHODS.PEER] += 1;
    }

    const asmId = String(ci.assemblyNodeId || 'UNSPECIFIED').trim() || 'UNSPECIFIED';
    const asmLabel =
      nodesById[asmId]?.label ||
      (asmId === 'UNSPECIFIED' ? 'Unspecified Assembly Area' : asmId);
    const existingAsm = assemblyMap.get(asmId);
    if (existingAsm) {
      existingAsm.count += 1;
    } else {
      assemblyMap.set(asmId, {
        assemblyNodeId: asmId,
        label: asmLabel,
        count: 1,
      });
    }

    const ciMs = toMillis(ci.checkedInAt);
    if (ciMs !== null && referenceEvacMs !== null && ciMs >= referenceEvacMs) {
      checkInDurationsSec.push(Math.round((ciMs - referenceEvacMs) / 1000));
    }
  }

  checkInDurationsSec.sort((a, b) => a - b);
  const avgCheckInTimeSec =
    checkInDurationsSec.length > 0
      ? Math.round(
          checkInDurationsSec.reduce((sum, val) => sum + val, 0) /
            checkInDurationsSec.length,
        )
      : null;

  const medianCheckInTimeSec =
    checkInDurationsSec.length > 0
      ? (() => {
          const mid = Math.floor(checkInDurationsSec.length / 2);
          return checkInDurationsSec.length % 2 === 0
            ? Math.round(
                (checkInDurationsSec[mid - 1] + checkInDurationsSec[mid]) / 2,
              )
            : checkInDurationsSec[mid];
        })()
      : null;

  const fastestCheckInSec =
    checkInDurationsSec.length > 0 ? checkInDurationsSec[0] : null;
  const slowestCheckInSec =
    checkInDurationsSec.length > 0
      ? checkInDurationsSec[checkInDurationsSec.length - 1]
      : null;

  // Section breakdown, unaccounted list, and per-student accountability records.
  /** @type {Map<string, {
   *   sectionId: string,
   *   sectionName: string,
   *   roomLabel: string,
   *   expected: number,
   *   checkedIn: number,
   *   unaccounted: number,
   *   rate: number,
   *   qrCount: number,
   *   teacherCount: number,
   *   peerCount: number,
   * }>} */
  const sectionMap = new Map();
  /** @type {Array<Record<string, any>>} */
  const unaccountedStudents = [];
  /** @type {Array<Record<string, any>>} */
  const studentRows = [];

  let accountedExpectedCount = 0;

  for (const [studentUid, entry] of expectedByStudent.entries()) {
    const sectionId = String(entry.sectionId || '').trim();
    const sectionMeta = sectionId ? sectionsById[sectionId] : null;
    const sectionName = sectionId
      ? sectionMeta?.name || sectionMeta?.code || entry.group || sectionId
      : NOT_IN_CLASS_GROUP;

    const roomNodeId = String(entry.roomNodeId || entry.expectedRoomId || '').trim();
    const roomLabel = roomNodeId
      ? nodesById[roomNodeId]?.label || roomNodeId
      : '—';

    const key = sectionId || '__NOT_IN_CLASS__';
    let secRow = sectionMap.get(key);
    if (!secRow) {
      secRow = {
        sectionId,
        sectionName,
        roomLabel,
        expected: 0,
        checkedIn: 0,
        unaccounted: 0,
        rate: 0,
        qrCount: 0,
        teacherCount: 0,
        peerCount: 0,
      };
      sectionMap.set(key, secRow);
    }

    secRow.expected += 1;

    const checkIn = checkInByStudent.get(studentUid);
    if (checkIn) {
      accountedExpectedCount += 1;
      secRow.checkedIn += 1;
      if (checkIn.method === CHECKIN_METHODS.QR) secRow.qrCount += 1;
      if (checkIn.method === CHECKIN_METHODS.TEACHER) secRow.teacherCount += 1;
      if (checkIn.method === CHECKIN_METHODS.PEER) secRow.peerCount += 1;

      const asmId = String(checkIn.assemblyNodeId || '');
      studentRows.push({
        studentUid,
        displayName: entry.displayName || studentUid,
        sectionName,
        roomLabel,
        expected: true,
        status: 'Checked In',
        method: checkIn.method || '',
        assemblyLabel: nodesById[asmId]?.label || asmId || '—',
        checkedInAtMs: toMillis(checkIn.checkedInAt),
      });
    } else {
      secRow.unaccounted += 1;
      unaccountedStudents.push({
        studentUid,
        displayName: entry.displayName || studentUid,
        sectionId,
        sectionName,
        roomNodeId,
        roomLabel,
      });
      studentRows.push({
        studentUid,
        displayName: entry.displayName || studentUid,
        sectionName,
        roomLabel,
        expected: true,
        status: 'Unaccounted',
        method: '',
        assemblyLabel: '—',
        checkedInAtMs: null,
      });
    }
  }

  // Track walk-in / unplanned check-ins (checked in, but not in expectedEntries).
  let unplannedCheckInsCount = 0;
  for (const [studentUid, ci] of checkInByStudent.entries()) {
    if (!expectedByStudent.has(studentUid)) {
      unplannedCheckInsCount += 1;
      const asmId = String(ci.assemblyNodeId || '');
      const sectionMeta = ci.sectionId ? sectionsById[ci.sectionId] : null;
      studentRows.push({
        studentUid,
        displayName: ci.displayName || studentUid,
        sectionName:
          sectionMeta?.name || sectionMeta?.code || ci.sectionId || 'Walk-in / Unlisted',
        roomLabel: '—',
        expected: false,
        status: 'Checked In (Unplanned)',
        method: ci.method || '',
        assemblyLabel: nodesById[asmId]?.label || asmId || '—',
        checkedInAtMs: toMillis(ci.checkedInAt),
      });
    }
  }

  const sectionBreakdown = Array.from(sectionMap.values())
    .map((row) => ({
      ...row,
      rate:
        row.expected > 0
          ? Math.round((row.checkedIn / row.expected) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => {
      if (a.sectionName === NOT_IN_CLASS_GROUP) return 1;
      if (b.sectionName === NOT_IN_CLASS_GROUP) return -1;
      return a.sectionName.localeCompare(b.sectionName);
    });

  const expectedCount = expectedByStudent.size;
  const totalCheckInsCount = checkInByStudent.size;
  const unaccountedCount = unaccountedStudents.length;
  const accountedRate =
    expectedCount > 0
      ? Math.round((accountedExpectedCount / expectedCount) * 1000) / 10
      : 0;

  const assemblyBreakdown = Array.from(assemblyMap.values())
    .map((item) => ({
      ...item,
      sharePercent:
        totalCheckInsCount > 0
          ? Math.round((item.count / totalCheckInsCount) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // SOS incident log & metrics.
  let sosActive = 0;
  let sosAcknowledged = 0;
  let sosResolved = 0;

  const sosIncidents = sos.map((item) => {
    const createdMs = toMillis(item.createdAt);
    const ackMs = toMillis(item.acknowledgedAt);
    const resolvedMs = toMillis(item.resolvedAt);

    if (item.status === SOS_STATUSES.RESOLVED) {
      sosResolved += 1;
    } else if (item.status === SOS_STATUSES.ACKNOWLEDGED) {
      sosAcknowledged += 1;
    } else {
      sosActive += 1;
    }

    const nodeId = String(item.nodeId || '');
    return {
      id: item.id || '',
      uid: item.uid || '',
      nodeId,
      nodeLabel: nodesById[nodeId]?.label || nodeId || 'Unknown location',
      buildingId: item.buildingId || '',
      floor: item.floor ?? null,
      message: item.message || '',
      status: item.status || SOS_STATUSES.ACTIVE,
      createdAtMs: createdMs,
      responseTimeSec:
        createdMs !== null && ackMs !== null && ackMs >= createdMs
          ? Math.round((ackMs - createdMs) / 1000)
          : null,
      resolutionTimeSec:
        createdMs !== null && resolvedMs !== null && resolvedMs >= createdMs
          ? Math.round((resolvedMs - createdMs) / 1000)
          : null,
    };
  });

  // Safety compliance audit on drill alerts.
  /** @type {string[]} */
  const complianceViolations = [];
  for (let i = 0; i < alerts.length; i += 1) {
    const alert = alerts[i];
    if (!alert) continue;
    if (alert.visualCue !== true && alert.hapticCue !== true) {
      complianceViolations.push(
        `Alert "${alert.title || alert.id || i}" is missing both visual and haptic cues.`,
      );
    }
    if (typeof alert.flashHz === 'number' && alert.flashHz >= 3) {
      complianceViolations.push(
        `Alert "${alert.title || alert.id || i}" exceeded 3 Hz flash limit (${alert.flashHz} Hz).`,
      );
    }
  }

  return {
    drill: {
      id: safeDrill.id || '',
      campusId: safeDrill.campusId || '',
      title: safeDrill.title || 'Untitled Drill',
      phase: safeDrill.phase || DRILL_PHASES.ENDED,
      scenario: safeDrill.scenario || DRILL_SCENARIOS.NORMAL,
      blockedNodeIds: Array.isArray(safeDrill.blockedNodeIds)
        ? safeDrill.blockedNodeIds
        : [],
      blockedEdgeIds: Array.isArray(safeDrill.blockedEdgeIds)
        ? safeDrill.blockedEdgeIds
        : [],
      startedAtMs: startedMs,
      evacuateAtMs: evacuateMs,
      endedAtMs: endedMs,
    },
    kpis: {
      expectedCount,
      checkedInCount: accountedExpectedCount,
      totalCheckInsCount,
      unaccountedCount,
      unplannedCheckInsCount,
      accountedRate,
      responsesCount: responses.length,
      alertsCount: alerts.length,
      sosTotal: sos.length,
      sosActive,
      sosAcknowledged,
      sosResolved,
      drillDurationSec,
      dchDurationSec: actualDchDurationSec,
      evacuationDurationSec,
      avgCheckInTimeSec,
      medianCheckInTimeSec,
      fastestCheckInSec,
      slowestCheckInSec,
    },
    methodBreakdown: [
      {
        method: CHECKIN_METHODS.QR,
        label: 'QR Self Check-In',
        count: methodCounts[CHECKIN_METHODS.QR],
        percent:
          totalCheckInsCount > 0
            ? Math.round(
                (methodCounts[CHECKIN_METHODS.QR] / totalCheckInsCount) * 1000,
              ) / 10
            : 0,
      },
      {
        method: CHECKIN_METHODS.TEACHER,
        label: 'Teacher Assisted',
        count: methodCounts[CHECKIN_METHODS.TEACHER],
        percent:
          totalCheckInsCount > 0
            ? Math.round(
                (methodCounts[CHECKIN_METHODS.TEACHER] / totalCheckInsCount) *
                  1000,
              ) / 10
            : 0,
      },
      {
        method: CHECKIN_METHODS.PEER,
        label: 'Peer Assisted',
        count: methodCounts[CHECKIN_METHODS.PEER],
        percent:
          totalCheckInsCount > 0
            ? Math.round(
                (methodCounts[CHECKIN_METHODS.PEER] / totalCheckInsCount) *
                  1000,
              ) / 10
            : 0,
      },
    ],
    sectionBreakdown,
    assemblyBreakdown,
    unaccountedStudents,
    sosIncidents,
    studentRows,
    safetyCompliance: {
      passed: complianceViolations.length === 0,
      alertsAudited: alerts.length,
      violations: complianceViolations,
    },
  };
}

/**
 * Formats the drill summary report (KPIs + section accountability breakdown) as CSV.
 * @param {ReturnType<typeof computeDrillReport>} report
 * @returns {string}
 */
export function formatDrillSummaryCsv(report) {
  const lines = [
    ['HUDYAT DRILL SUMMARY REPORT'].map(escapeCsvCell).join(','),
    ['Drill Title', report.drill.title].map(escapeCsvCell).join(','),
    ['Drill ID', report.drill.id].map(escapeCsvCell).join(','),
    ['Scenario', report.drill.scenario].map(escapeCsvCell).join(','),
    ['Phase', report.drill.phase].map(escapeCsvCell).join(','),
    ['Expected Students', report.kpis.expectedCount].map(escapeCsvCell).join(','),
    ['Checked In (Expected)', report.kpis.checkedInCount].map(escapeCsvCell).join(','),
    ['Unaccounted Students', report.kpis.unaccountedCount].map(escapeCsvCell).join(','),
    ['Accountability Rate (%)', report.kpis.accountedRate].map(escapeCsvCell).join(','),
    ['Average Check-In Time', formatDuration(report.kpis.avgCheckInTimeSec)]
      .map(escapeCsvCell)
      .join(','),
    ['Drill Duration', formatDuration(report.kpis.drillDurationSec)]
      .map(escapeCsvCell)
      .join(','),
    ['SOS Total / Resolved', `${report.kpis.sosTotal} / ${report.kpis.sosResolved}`]
      .map(escapeCsvCell)
      .join(','),
    '',
    [
      'Section',
      'Room',
      'Expected',
      'Checked In',
      'Unaccounted',
      'Accounted Rate (%)',
      'QR',
      'Teacher Assisted',
      'Peer Assisted',
    ]
      .map(escapeCsvCell)
      .join(','),
  ];

  for (let i = 0; i < report.sectionBreakdown.length; i += 1) {
    const row = report.sectionBreakdown[i];
    lines.push(
      [
        row.sectionName,
        row.roomLabel,
        row.expected,
        row.checkedIn,
        row.unaccounted,
        row.rate,
        row.qrCount,
        row.teacherCount,
        row.peerCount,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }

  return lines.join('\n');
}

/**
 * Formats per-student accountability rows as CSV.
 * @param {ReturnType<typeof computeDrillReport>} report
 * @returns {string}
 */
export function formatCheckInsCsv(report) {
  const lines = [
    [
      'Student UID',
      'Name',
      'Section',
      'Expected Room',
      'Status',
      'Check-In Method',
      'Assembly Area',
      'Checked In At (ISO)',
    ]
      .map(escapeCsvCell)
      .join(','),
  ];

  for (let i = 0; i < report.studentRows.length; i += 1) {
    const row = report.studentRows[i];
    lines.push(
      [
        row.studentUid,
        row.displayName,
        row.sectionName,
        row.roomLabel,
        row.status,
        row.method || '—',
        row.assemblyLabel,
        row.checkedInAtMs ? new Date(row.checkedInAtMs).toISOString() : '',
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }

  return lines.join('\n');
}

/**
 * Sample realistic CIT-U drill input for offline / empty-database demo previews.
 */
export const SAMPLE_DEMO_DRILL_INPUT = Object.freeze({
  drill: {
    id: 'demo-cit-u-2026-q4',
    campusId: 'cit-u',
    title: 'CIT-U NGE Earthquake Drill (Sample Report)',
    phase: DRILL_PHASES.ENDED,
    scenario: DRILL_SCENARIOS.BLOCKED_EXIT,
    blockedNodeIds: ['NGE-STAIR-WEST'],
    blockedEdgeIds: [],
    dchDurationSec: 60,
    startedAt: new Date('2026-11-26T09:00:00+08:00'),
    evacuateAt: new Date('2026-11-26T09:01:00+08:00'),
    endedAt: new Date('2026-11-26T09:05:30+08:00'),
  },
  sectionsById: {
    'cit-u__bsit-3a': { name: 'BSIT-3A', code: 'BSIT-3A' },
    'cit-u__bsit-3b': { name: 'BSIT-3B', code: 'BSIT-3B' },
  },
  nodesById: {
    'NGE-301': { label: 'NGE 301' },
    'NGE-302': { label: 'NGE 302' },
    'NGE-3F-CORR': { label: 'NGE 3F Main Corridor' },
    'NGE-STAIR-WEST': { label: 'NGE West Stairwell' },
    'ASM-QUAD': { label: 'CIT-U Quadrangle Assembly Area' },
  },
  expectedEntries: [
    {
      studentUid: 'stu-1',
      displayName: 'Ana Marie Cruz',
      sectionId: 'cit-u__bsit-3a',
      roomNodeId: 'NGE-301',
    },
    {
      studentUid: 'stu-2',
      displayName: 'Carlo James Reyes',
      sectionId: 'cit-u__bsit-3a',
      roomNodeId: 'NGE-301',
    },
    {
      studentUid: 'stu-3',
      displayName: 'Bea Sofia Lim',
      sectionId: 'cit-u__bsit-3a',
      roomNodeId: 'NGE-301',
    },
    {
      studentUid: 'stu-4',
      displayName: 'Miguel Paolo Santos',
      sectionId: 'cit-u__bsit-3b',
      roomNodeId: 'NGE-302',
    },
    {
      studentUid: 'stu-5',
      displayName: 'Dianne Grace Tan',
      sectionId: 'cit-u__bsit-3b',
      roomNodeId: 'NGE-302',
    },
    {
      studentUid: 'stu-6',
      displayName: 'Rafael Luis Gomez',
      sectionId: 'cit-u__bsit-3b',
      roomNodeId: 'NGE-302',
    },
  ],
  checkIns: [
    {
      studentUid: 'stu-1',
      method: CHECKIN_METHODS.QR,
      assemblyNodeId: 'ASM-QUAD',
      checkedInAt: new Date('2026-11-26T09:02:18+08:00'),
    },
    {
      studentUid: 'stu-2',
      method: CHECKIN_METHODS.QR,
      assemblyNodeId: 'ASM-QUAD',
      checkedInAt: new Date('2026-11-26T09:02:32+08:00'),
    },
    {
      studentUid: 'stu-3',
      method: CHECKIN_METHODS.TEACHER,
      assemblyNodeId: 'ASM-QUAD',
      checkedInAt: new Date('2026-11-26T09:03:05+08:00'),
    },
    {
      studentUid: 'stu-4',
      method: CHECKIN_METHODS.QR,
      assemblyNodeId: 'ASM-QUAD',
      checkedInAt: new Date('2026-11-26T09:02:45+08:00'),
    },
    {
      studentUid: 'stu-5',
      method: CHECKIN_METHODS.PEER,
      assemblyNodeId: 'ASM-QUAD',
      checkedInAt: new Date('2026-11-26T09:03:20+08:00'),
    },
  ],
  responses: [
    { id: 'r1', uid: 'stu-1', status: 'arrived' },
    { id: 'r2', uid: 'stu-2', status: 'arrived' },
    { id: 'r3', uid: 'stu-3', status: 'arrived' },
    { id: 'r4', uid: 'stu-4', status: 'arrived' },
    { id: 'r5', uid: 'stu-5', status: 'arrived' },
    { id: 'r6', uid: 'stu-6', status: 'needs_help' },
  ],
  alerts: [
    {
      id: 'a1',
      title: 'Drop, Cover, and Hold',
      visualCue: true,
      hapticCue: true,
      flashHz: 2,
    },
    {
      id: 'a2',
      title: 'Evacuate via East Stairwell',
      visualCue: true,
      hapticCue: true,
      flashHz: 1.5,
    },
  ],
  sos: [
    {
      id: 'sos-1',
      uid: 'stu-6',
      nodeId: 'NGE-3F-CORR',
      buildingId: 'NGE',
      floor: 3,
      message: 'Sprained ankle near 3F corridor, needs responder assist',
      status: SOS_STATUSES.RESOLVED,
      createdAt: new Date('2026-11-26T09:02:10+08:00'),
      acknowledgedAt: new Date('2026-11-26T09:02:35+08:00'),
      resolvedAt: new Date('2026-11-26T09:04:40+08:00'),
    },
  ],
});

// ---------------------------------------------------------------------------
// Firestore Report Loaders
// ---------------------------------------------------------------------------

/**
 * Fetches all drills belonging to `campusId`, ordered newest first.
 * @param {string} campusId
 */
export async function fetchCampusDrills(campusId) {
  if (!campusId) {
    throw new Error('A campusId is required to load drills.');
  }

  const snap = await getDocs(
    query(collection(db, 'drills'), where('campusId', '==', campusId)),
  );

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (toMillis(b.startedAt) || 0) - (toMillis(a.startedAt) || 0));
}

/**
 * Fetches a single drill and all of its subcollections (`expectedEntries`,
 * `responses`, `checkIns`, `alerts`, `sos`) along with campus labels and
 * returns a computed drill report.
 *
 * @param {string} drillId
 * @param {string} campusId
 */
export async function fetchDrillReport(drillId, campusId) {
  if (!drillId) {
    throw new Error('A drillId is required to load a drill report.');
  }

  const drillRef = doc(db, 'drills', drillId);
  const [
    drillSnap,
    expectedSnap,
    responsesSnap,
    checkInsSnap,
    alertsSnap,
    sosSnap,
    sectionsSnap,
    nodesSnap,
  ] = await Promise.all([
    getDoc(drillRef),
    getDocs(collection(db, 'drills', drillId, 'expectedEntries')),
    getDocs(collection(db, 'drills', drillId, 'responses')),
    getDocs(collection(db, 'drills', drillId, 'checkIns')),
    getDocs(collection(db, 'drills', drillId, 'alerts')),
    getDocs(collection(db, 'drills', drillId, 'sos')),
    campusId
      ? getDocs(
          query(collection(db, 'sections'), where('campusId', '==', campusId)),
        ).catch(() => null)
      : Promise.resolve(null),
    campusId
      ? getDocs(collection(db, 'campuses', campusId, 'mapNodes')).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);

  if (!drillSnap.exists()) {
    throw new Error(`Drill "${drillId}" was not found.`);
  }

  const drill = { id: drillSnap.id, ...drillSnap.data() };
  const expectedEntries = expectedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const responses = responsesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const checkIns = checkInsSnap.docs.map((d) => ({
    studentUid: d.id,
    ...d.data(),
  }));
  const alerts = alertsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const sos = sosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  /** @type {Record<string, Record<string, any>>} */
  const sectionsById = {};
  if (sectionsSnap) {
    for (const d of sectionsSnap.docs) {
      sectionsById[d.id] = { id: d.id, ...d.data() };
    }
  }

  /** @type {Record<string, Record<string, any>>} */
  const nodesById = {};
  if (nodesSnap) {
    for (const d of nodesSnap.docs) {
      nodesById[d.id] = { id: d.id, ...d.data() };
    }
  }

  return computeDrillReport({
    drill,
    expectedEntries,
    responses,
    checkIns,
    alerts,
    sos,
    sectionsById,
    nodesById,
  });
}

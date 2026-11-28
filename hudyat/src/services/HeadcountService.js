import { Timestamp, doc, setDoc } from 'firebase/firestore';

export const NOT_IN_CLASS_GROUP = 'Not in class';

/**
 * Converts a Firestore Timestamp, Date, or epoch ms value to epoch milliseconds.
 */
export function toMillis(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      return value.toMillis();
    }
    if (typeof value.seconds === 'number') {
      return value.seconds * 1000;
    }
  }
  return null;
}

/**
 * Business rule (UC-5.2 / UC-5.3):
 * A student is Accounted only if they have a verified check-in:
 * - QR (`method === 'qr'`)
 * - Manual code (`method === 'manual_code'`)
 * - Teacher (`method === 'teacher'`)
 * - Peer (`method === 'peer'`) with `verifiedBy` set to a non-empty string.
 */
export function isVerifiedCheckIn(checkIn) {
  if (!checkIn) return false;
  if (
    checkIn.method === 'qr' ||
    checkIn.method === 'teacher' ||
    checkIn.method === 'manual_code'
  ) {
    return true;
  }
  if (checkIn.method === 'peer') {
    return Boolean(checkIn.verifiedBy && checkIn.verifiedBy.trim().length > 0);
  }
  return false;
}

/**
 * Returns true if the check-in is an unverified peer check-in (Pending verification).
 */
export function isPendingPeerCheckIn(checkIn) {
  if (!checkIn) return false;
  return checkIn.method === 'peer' && !isVerifiedCheckIn(checkIn);
}

/**
 * Returns true when an expected entry belongs to the "Not in class" group.
 */
export function isNotInClassEntry(entry) {
  if (entry.group === NOT_IN_CLASS_GROUP) return true;
  const sec = (entry.sectionId ?? '').trim().toLowerCase();
  return (
    sec === '' ||
    sec === 'not_in_class' ||
    sec === 'not in class' ||
    sec === 'not-in-class'
  );
}

/**
 * Returns true if a verified check-in occurred strictly after the drill's assembly deadline.
 */
export function isLateCheckIn(checkIn, drill) {
  if (!isVerifiedCheckIn(checkIn) || !checkIn) return false;
  const deadlineMs = toMillis(drill.deadlineAt);
  const checkInMs = toMillis(checkIn.checkedInAt);
  if (deadlineMs === null || checkInMs === null) return false;
  return checkInMs > deadlineMs;
}

/**
 * Computes live headcount totals, missing student rows past the assembly deadline,
 * and teacher/coordinator proximity alerts for Module 5.3.
 */
export class HeadcountService {
  constructor(input) {
    this.drill = input.drill;
    this.expectedEntries = input.expectedEntries;
    this.routeService = input.routeService;
    this.db = input.db;
    this.onWriteAlert = input.onWriteAlert;
    this.explicitCoordinatorUid = input.coordinatorUid;

    const checkInMap = new Map();
    for (const checkIn of input.checkIns) {
      checkInMap.set(checkIn.studentUid, checkIn);
    }
    this.checkInsByStudent = checkInMap;

    const responseMap = new Map();
    for (const response of input.responses ?? []) {
      const existing = responseMap.get(response.uid);
      const existingMs = toMillis(existing?.updatedAt) ?? -1;
      const incomingMs = toMillis(response.updatedAt) ?? 0;
      if (!existing || incomingMs >= existingMs) {
        responseMap.set(response.uid, response);
      }
    }
    this.responsesByUser = responseMap;

    const alertMap = new Map();
    for (const alert of input.alerts ?? []) {
      if (!alert.studentUid) continue;
      const existing = alertMap.get(alert.studentUid);
      const existingMs = toMillis(existing?.at ?? existing?.createdAt) ?? -1;
      const incomingMs = toMillis(alert.at ?? alert.createdAt) ?? 0;
      if (!existing || incomingMs >= existingMs) {
        alertMap.set(alert.studentUid, alert);
      }
    }
    this.latestAlertByStudent = alertMap;

    const userMap = new Map();
    for (const user of input.users ?? []) {
      userMap.set(user.uid, user);
    }
    this.usersById = userMap;

    const sectionMap = new Map();
    for (const section of input.sections ?? []) {
      sectionMap.set(section.id, section);
    }
    this.sectionsById = sectionMap;

    const nodeMap = new Map();
    for (const node of input.mapNodes ?? []) {
      nodeMap.set(node.id, node);
    }
    this.nodesById = nodeMap;
  }

  resolveGroupInfo(entry) {
    if (isNotInClassEntry(entry)) {
      return {
        key: 'not-in-class',
        group: NOT_IN_CLASS_GROUP,
        sectionId: null,
        roomNodeId: null,
        roomLabel: '—',
        displayLabel: NOT_IN_CLASS_GROUP,
      };
    }

    const section = this.sectionsById.get(entry.sectionId);
    const group =
      entry.group ??
      entry.sectionCode ??
      section?.code ??
      entry.sectionId;
    const roomId = entry.expectedRoomId ?? entry.roomNodeId ?? null;
    const roomNode = roomId ? this.nodesById.get(roomId) : undefined;
    const roomLabel = roomNode?.label ?? roomId ?? '—';
    const displayLabel =
      roomLabel && roomLabel !== '—' ? `${group} (${roomLabel})` : group;

    return {
      key: entry.sectionId,
      group,
      sectionId: entry.sectionId,
      roomNodeId: roomId,
      roomLabel,
      displayLabel,
    };
  }

  /**
   * Computes Expected, Accounted, Pending, and Missing totals per section (with room)
   * and for the "Not in class" group.
   */
  counts() {
    const groups = new Map();

    for (const entry of this.expectedEntries) {
      const info = this.resolveGroupInfo(entry);
      let bucket = groups.get(info.key);
      if (!bucket) {
        bucket = {
          ...info,
          expected: 0,
          accounted: 0,
          pending: 0,
          missing: 0,
          late: 0,
        };
        groups.set(info.key, bucket);
      }

      bucket.expected += 1;
      const checkIn = this.checkInsByStudent.get(entry.studentUid);
      if (isVerifiedCheckIn(checkIn)) {
        bucket.accounted += 1;
        if (isLateCheckIn(checkIn, this.drill)) {
          bucket.late += 1;
        }
      } else {
        bucket.missing += 1;
        if (isPendingPeerCheckIn(checkIn)) {
          bucket.pending += 1;
        }
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === 'not-in-class') return 1;
      if (b.key === 'not-in-class') return -1;
      return a.displayLabel.localeCompare(b.displayLabel);
    });
  }

  /**
   * Aggregates overall Expected, Accounted, Pending, Missing, and Late counts across all groups.
   */
  totals() {
    return this.counts().reduce(
      (acc, g) => ({
        expected: acc.expected + g.expected,
        accounted: acc.accounted + g.accounted,
        pending: acc.pending + g.pending,
        missing: acc.missing + g.missing,
        late: acc.late + g.late,
      }),
      { expected: 0, accounted: 0, pending: 0, missing: 0, late: 0 },
    );
  }

  /**
   * Returns every expected student without a verified check-in once the drill's `deadlineAt`
   * has passed, including their name, expected room, last known zone, and who was alerted.
   * Returns `[]` if `deadlineAt` is unset or has not yet passed.
   */
  missing(now = new Date()) {
    const deadlineMs = toMillis(this.drill.deadlineAt);
    if (deadlineMs === null || now.getTime() < deadlineMs) {
      return [];
    }

    const rows = [];
    for (const entry of this.expectedEntries) {
      const checkIn = this.checkInsByStudent.get(entry.studentUid);
      if (isVerifiedCheckIn(checkIn)) {
        continue;
      }

      const info = this.resolveGroupInfo(entry);
      const user = this.usersById.get(entry.studentUid);
      const studentName =
        user?.displayName ?? entry.displayName ?? entry.studentUid;

      const response = this.responsesByUser.get(entry.studentUid);
      const lastZoneNodeId =
        response?.currentNodeId ?? response?.zoneNodeId ?? null;
      const lastZoneNode = lastZoneNodeId
        ? this.nodesById.get(lastZoneNodeId)
        : undefined;
      const lastZoneLabel = lastZoneNode?.label ?? lastZoneNodeId ?? 'Unknown';

      const section = info.sectionId
        ? this.sectionsById.get(info.sectionId)
        : undefined;
      const teacherUid =
        section?.teacherUid ??
        (entry.teacherUid && entry.teacherUid.trim().length > 0
          ? entry.teacherUid
          : null);

      const alert = this.latestAlertByStudent.get(entry.studentUid);
      const alertedTeacherUid = alert?.teacherUid ?? null;
      let alertedName = '—';
      if (alertedTeacherUid) {
        const alertedUser = this.usersById.get(alertedTeacherUid);
        if (alertedUser) {
          alertedName =
            alertedUser.role === 'coordinator'
              ? 'Coordinator'
              : alertedUser.displayName;
        } else if (alertedTeacherUid === this.resolveCoordinatorUid()) {
          alertedName = 'Coordinator';
        } else {
          alertedName = alertedTeacherUid;
        }
      }

      rows.push({
        studentUid: entry.studentUid,
        studentName,
        group: info.group,
        sectionId: info.sectionId,
        teacherUid,
        expectedRoomId: info.roomNodeId,
        expectedRoomLabel: info.roomLabel,
        lastZoneNodeId,
        lastZoneLabel,
        alertedTeacherUid,
        alertedName,
        pendingPeerCheckIn: isPendingPeerCheckIn(checkIn),
      });
    }

    return rows;
  }

  resolveCoordinatorUid() {
    if (this.explicitCoordinatorUid) {
      return this.explicitCoordinatorUid;
    }
    for (const user of this.usersById.values()) {
      if (user.role === 'coordinator') {
        return user.uid;
      }
    }
    return this.drill.createdBy || 'coordinator';
  }

  /**
   * Resolves the recipient UID for a missing-student alert:
   * 1. Nearest teacher to `row.lastZoneNodeId` using `RouteService.distance` (when available).
   * 2. Fallback to the student's section teacher (`row.teacherUid`).
   * 3. Fallback to the Coordinator (e.g., for "Not in class").
   */
  resolveAlertRecipientUid(row) {
    if (row.lastZoneNodeId && this.routeService) {
      let bestTeacherUid = null;
      let bestDistance = Infinity;

      for (const user of this.usersById.values()) {
        if (user.role !== 'teacher') continue;
        const teacherResponse = this.responsesByUser.get(user.uid);
        const teacherZoneId =
          teacherResponse?.currentNodeId ?? teacherResponse?.zoneNodeId;
        if (!teacherZoneId) continue;

        const d = this.routeService.distance(
          teacherZoneId,
          row.lastZoneNodeId,
          this.drill.blockedNodeIds,
        );
        if (Number.isFinite(d) && d < bestDistance) {
          bestDistance = d;
          bestTeacherUid = user.uid;
        }
      }

      if (bestTeacherUid) {
        return bestTeacherUid;
      }
    }

    if (row.teacherUid) {
      return row.teacherUid;
    }

    return this.resolveCoordinatorUid();
  }

  /**
   * Finds the nearest teacher (or fallback section teacher / coordinator) for a missing
   * student and writes a missing-student alert document to `drills/{drillId}/alerts`.
   */
  async alertNearest(row) {
    const teacherUid = this.resolveAlertRecipientUid(row);
    const nowTs = Timestamp.now();
    const alertId = `missing-${row.studentUid}`;

    const alert = {
      id: alertId,
      drillId: this.drill.id,
      phase: this.drill.phase,
      severity: 'warning',
      title: `Missing student: ${row.studentName}`,
      message: `${row.studentName} (${row.group}) has not checked in. Expected: ${row.expectedRoomLabel}. Last zone: ${row.lastZoneLabel}.`,
      visualCue: true,
      hapticCue: true,
      studentUid: row.studentUid,
      teacherUid,
      at: nowTs,
      createdBy: this.resolveCoordinatorUid(),
      createdAt: nowTs,
    };

    if (this.onWriteAlert) {
      await this.onWriteAlert(alert);
      return;
    }

    if (this.db) {
      const alertRef = doc(
        this.db,
        'drills',
        this.drill.id,
        'alerts',
        alertId,
      );
      await setDoc(alertRef, alert);
    }
  }
}

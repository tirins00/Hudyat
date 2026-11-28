import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  DRILL_PHASES,
  DRILL_SCENARIOS,
  RESPONSE_STATUSES,
  ROLES,
} from '../types/models.js';
import { NOT_IN_CLASS_GROUP, ScheduleResolver } from './ScheduleResolver.js';

export const DRILL_PHASE_ORDER = Object.freeze([
  DRILL_PHASES.DCH,
  DRILL_PHASES.EVACUATE,
  DRILL_PHASES.ENDED,
]);

export const ACTIVE_DRILL_PHASES = Object.freeze([
  DRILL_PHASES.DCH,
  DRILL_PHASES.EVACUATE,
]);

export const ACTIVE_DRILL_ERROR_MESSAGE =
  'An active drill is already in progress for this campus.';

export const DEFAULT_ASSEMBLY_DEADLINE_SEC = 300;
export const EXPECTED_ENTRIES_BATCH_SIZE = 400;

/**
 * Resolves the assembly deadline duration in seconds from a campus policy doc,
 * defaulting to 5 minutes (300 seconds) when not configured.
 *
 * @param {Record<string, any> | null | undefined} policy
 * @returns {number}
 */
export function resolveAssemblyDeadlineSec(policy) {
  if (policy && typeof policy === 'object') {
    const secCandidate =
      policy.assemblyDeadlineSec ??
      policy.assemblyDeadlineSeconds ??
      policy.evacuationDeadlineSec;
    if (
      typeof secCandidate === 'number' &&
      Number.isFinite(secCandidate) &&
      secCandidate > 0
    ) {
      return Math.round(secCandidate);
    }
    if (
      typeof policy.assemblyDeadlineMin === 'number' &&
      Number.isFinite(policy.assemblyDeadlineMin) &&
      policy.assemblyDeadlineMin > 0
    ) {
      return Math.round(policy.assemblyDeadlineMin * 60);
    }
  }
  return DEFAULT_ASSEMBLY_DEADLINE_SEC;
}

function resolveStartMillis(data) {
  if (typeof data?.startedAtMillis === 'number' && Number.isFinite(data.startedAtMillis)) {
    return data.startedAtMillis;
  }
  if (data?.startedAt instanceof Date && !Number.isNaN(data.startedAt.getTime())) {
    return data.startedAt.getTime();
  }
  if (data?.startedAt && typeof data.startedAt.toMillis === 'function') {
    return data.startedAt.toMillis();
  }
  return Date.now();
}

/**
 * Normalizes a resolved expected entry to the exact Firestore schema consumed by
 * `HeadcountBoard.jsx` (`HeadcountService`) and `ReportPage.jsx` (`ReportService`),
 * ensuring no `undefined` field values are written.
 *
 * @param {Record<string, any>} entry
 * @param {string} drillId
 */
function normalizeExpectedEntry(entry, drillId) {
  const studentUid = String(entry.studentUid || entry.id || '').trim();
  const isNotInClass =
    !entry.sectionId || entry.group === NOT_IN_CLASS_GROUP;

  const normalized = {
    id: studentUid,
    drillId,
    studentUid,
    displayName: entry.displayName || studentUid,
    group: isNotInClass
      ? NOT_IN_CLASS_GROUP
      : entry.group || entry.sectionCode || entry.sectionId,
    sectionId: isNotInClass ? '' : String(entry.sectionId),
    teacherUid: isNotInClass ? '' : String(entry.teacherUid || ''),
    roomNodeId: isNotInClass
      ? ''
      : String(entry.roomNodeId || entry.expectedRoomId || ''),
    expectedRoomId: isNotInClass
      ? null
      : entry.expectedRoomId || entry.roomNodeId || null,
    buildingId: isNotInClass ? '' : String(entry.buildingId || ''),
    floor: isNotInClass
      ? 0
      : typeof entry.floor === 'number' && Number.isFinite(entry.floor)
        ? entry.floor
        : 0,
  };

  if (!isNotInClass && entry.sectionCode) {
    normalized.sectionCode = String(entry.sectionCode);
  }

  return normalized;
}

/**
 * In-memory reactive store for unit testing or offline fallback.
 */
export function createInMemoryDrillStore(seed = {}) {
  const drills = new Map();
  const expectedEntries = new Map();
  const responses = new Map();
  const listeners = new Set();

  const campusUsers = Array.isArray(seed.users || seed.students)
    ? [...(seed.users || seed.students)]
    : [];
  const campusEnrollments = Array.isArray(seed.enrollments)
    ? [...seed.enrollments]
    : [];
  const campusSections = Array.isArray(seed.sections)
    ? [...seed.sections]
    : [];
  const campusScheduleSlots = Array.isArray(seed.scheduleSlots)
    ? [...seed.scheduleSlots]
    : [];

  const campusPolicies = new Map();
  if (seed.policy && typeof seed.policy === 'object') {
    campusPolicies.set(seed.policy.campusId || 'cit-u', { ...seed.policy });
  }
  for (const [cid, pol] of Object.entries(seed.policies || {})) {
    if (pol && typeof pol === 'object') {
      campusPolicies.set(cid, { ...pol });
    }
  }

  for (const d of seed.drills || defaultSeedDrills()) {
    drills.set(d.id, { ...d });
    expectedEntries.set(d.id, new Map());
    responses.set(d.id, new Map());
  }

  for (const [drillId, list] of Object.entries(seed.expectedEntries || {})) {
    if (!expectedEntries.has(drillId)) expectedEntries.set(drillId, new Map());
    const map = expectedEntries.get(drillId);
    for (const item of list) map.set(item.id || item.studentUid, { ...item });
  }

  for (const [drillId, list] of Object.entries(seed.responses || {})) {
    if (!responses.has(drillId)) responses.set(drillId, new Map());
    const map = responses.get(drillId);
    for (const item of list) map.set(item.uid || item.id, { ...item });
  }

  const notify = () => {
    for (const cb of listeners) cb();
  };

  return {
    async listDrills() {
      return Array.from(drills.values()).sort(
        (a, b) => (b.startedAtMillis || 0) - (a.startedAtMillis || 0),
      );
    },
    async findActiveDrills(campusId) {
      return Array.from(drills.values()).filter(
        (d) =>
          d.campusId === campusId && ACTIVE_DRILL_PHASES.includes(d.phase),
      );
    },
    async getDrill(drillId) {
      return drills.get(drillId) || null;
    },
    async saveDrill(drill) {
      drills.set(drill.id, { ...drill });
      if (!expectedEntries.has(drill.id)) expectedEntries.set(drill.id, new Map());
      if (!responses.has(drill.id)) responses.set(drill.id, new Map());
      notify();
      return drills.get(drill.id);
    },
    async updateDrill(drillId, patch) {
      const existing = drills.get(drillId);
      if (!existing) throw new Error(`Drill "${drillId}" not found.`);
      const updated = { ...existing, ...patch, id: drillId };
      drills.set(drillId, updated);
      notify();
      return updated;
    },
    async getCampusScheduleInputs(campusId) {
      const matchesCampus = (item) =>
        item && (!item.campusId || item.campusId === campusId);
      return {
        users: campusUsers.filter(
          (u) => matchesCampus(u) && u.role === ROLES.STUDENT,
        ),
        enrollments: campusEnrollments.filter(matchesCampus),
        sections: campusSections.filter(matchesCampus),
        scheduleSlots: campusScheduleSlots.filter(matchesCampus),
      };
    },
    async saveExpectedEntries(drillId, entries) {
      if (!Array.isArray(entries) || entries.length === 0) {
        return 0;
      }
      if (!expectedEntries.has(drillId)) {
        expectedEntries.set(drillId, new Map());
      }
      const map = expectedEntries.get(drillId);
      for (const entry of entries) {
        const key = entry.studentUid || entry.id;
        if (!key) continue;
        map.set(key, { ...entry, id: key, drillId });
      }
      notify();
      return entries.length;
    },
    async getCampusPolicy(campusId) {
      return campusPolicies.get(campusId) || null;
    },
    async getExpectedEntries(drillId) {
      const map = expectedEntries.get(drillId);
      return map ? Array.from(map.values()) : [];
    },
    async getResponses(drillId) {
      const map = responses.get(drillId);
      return map ? Array.from(map.values()) : [];
    },
    async getUserResponse(drillId, uid) {
      const map = responses.get(drillId);
      return map ? map.get(uid) || null : null;
    },
    async upsertResponse(drillId, uid, payload) {
      if (!drills.has(drillId)) throw new Error(`Drill "${drillId}" not found.`);
      if (!responses.has(drillId)) responses.set(drillId, new Map());
      const map = responses.get(drillId);
      const existing = map.get(uid) || {};
      const next = {
        ...existing,
        ...payload,
        id: uid,
        uid,
        drillId,
        updatedAtMillis: Date.now(),
      };
      map.set(uid, next);
      notify();
      return next;
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

/**
 * Firestore-backed store matching `drills/{drillId}`, `expectedEntries`, and `responses`.
 */
export function createFirestoreDrillStore(firestoreDb = db) {
  return {
    async listDrills() {
      const q = query(collection(firestoreDb, 'drills'), orderBy('startedAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async findActiveDrills(campusId) {
      const q = query(
        collection(firestoreDb, 'drills'),
        where('campusId', '==', campusId),
        where('phase', 'in', [...ACTIVE_DRILL_PHASES]),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async getDrill(drillId) {
      const snap = await getDoc(doc(firestoreDb, 'drills', drillId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    async saveDrill(drill) {
      const ref = doc(firestoreDb, 'drills', drill.id);
      const payload = { ...drill, startedAt: serverTimestamp() };
      await setDoc(ref, payload);
      return { ...drill };
    },
    async updateDrill(drillId, patch) {
      const ref = doc(firestoreDb, 'drills', drillId);
      await updateDoc(ref, patch);
      const snap = await getDoc(ref);
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    async getCampusScheduleInputs(campusId) {
      try {
        const [usersSnap, enrollmentsSnap, sectionsSnap, scheduleSlotsSnap] =
          await Promise.all([
            getDocs(
              query(
                collection(firestoreDb, 'users'),
                where('campusId', '==', campusId),
                where('role', '==', ROLES.STUDENT),
              ),
            ),
            getDocs(
              query(
                collection(firestoreDb, 'enrollments'),
                where('campusId', '==', campusId),
              ),
            ),
            getDocs(
              query(
                collection(firestoreDb, 'sections'),
                where('campusId', '==', campusId),
              ),
            ),
            getDocs(
              query(
                collection(firestoreDb, 'scheduleSlots'),
                where('campusId', '==', campusId),
              ),
            ),
          ]);

        return {
          users: usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() })),
          enrollments: enrollmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          sections: sectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          scheduleSlots: scheduleSlotsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        };
      } catch {
        return { users: [], enrollments: [], sections: [], scheduleSlots: [] };
      }
    },
    async saveExpectedEntries(drillId, entries) {
      if (!Array.isArray(entries) || entries.length === 0) {
        return 0;
      }

      let written = 0;
      for (let i = 0; i < entries.length; i += EXPECTED_ENTRIES_BATCH_SIZE) {
        const chunk = entries.slice(i, i + EXPECTED_ENTRIES_BATCH_SIZE);
        const batch = writeBatch(firestoreDb);
        for (const entry of chunk) {
          const entryId = entry.studentUid || entry.id;
          if (!entryId) continue;
          const ref = doc(
            firestoreDb,
            'drills',
            drillId,
            'expectedEntries',
            entryId,
          );
          batch.set(ref, { ...entry, id: entryId, drillId });
          written += 1;
        }
        await batch.commit();
      }

      return written;
    },
    async getCampusPolicy(campusId) {
      try {
        const defaultSnap = await getDoc(
          doc(firestoreDb, 'campuses', campusId, 'policy', 'default'),
        );
        if (defaultSnap.exists()) {
          return { id: defaultSnap.id, ...defaultSnap.data() };
        }
        const listSnap = await getDocs(
          collection(firestoreDb, 'campuses', campusId, 'policy'),
        );
        if (listSnap.docs.length > 0) {
          const first = listSnap.docs[0];
          return { id: first.id, ...first.data() };
        }
        return null;
      } catch {
        return null;
      }
    },
    async getExpectedEntries(drillId) {
      const snap = await getDocs(collection(firestoreDb, 'drills', drillId, 'expectedEntries'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async getResponses(drillId) {
      const snap = await getDocs(collection(firestoreDb, 'drills', drillId, 'responses'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async getUserResponse(drillId, uid) {
      const snap = await getDoc(doc(firestoreDb, 'drills', drillId, 'responses', uid));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    async upsertResponse(drillId, uid, payload) {
      const ref = doc(firestoreDb, 'drills', drillId, 'responses', uid);
      const next = {
        ...payload,
        id: uid,
        uid,
        drillId,
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, next, { merge: true });
      return { ...next, updatedAtMillis: Date.now() };
    },
    subscribeDrills(callback) {
      const q = query(collection(firestoreDb, 'drills'), orderBy('startedAt', 'desc'));
      return onSnapshot(
        q,
        (snap) => {
          callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        () => {
          // Ignore transient offline/permission errors to keep UI stable
        },
      );
    },
    subscribeDrill(drillId, callback) {
      return onSnapshot(doc(firestoreDb, 'drills', drillId), (snap) => {
        callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      });
    },
    subscribeExpectedEntries(drillId, callback) {
      return onSnapshot(
        collection(firestoreDb, 'drills', drillId, 'expectedEntries'),
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      );
    },
    subscribeResponses(drillId, callback) {
      return onSnapshot(
        collection(firestoreDb, 'drills', drillId, 'responses'),
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      );
    },
  };
}

export function createDrillService(store = createFirestoreDrillStore()) {
  async function assertNoActiveDrill(campusId) {
    const activeDrills = store.findActiveDrills
      ? await store.findActiveDrills(campusId)
      : (await store.listDrills()).filter(
          (d) =>
            d.campusId === campusId && ACTIVE_DRILL_PHASES.includes(d.phase),
        );

    if (activeDrills.length > 0) {
      throw new Error(ACTIVE_DRILL_ERROR_MESSAGE);
    }
  }

  async function freezeExpectedEntries(drillId, campusId, startedAtMillis) {
    if (!store.getCampusScheduleInputs || !store.saveExpectedEntries) {
      return 0;
    }

    const inputs = await store.getCampusScheduleInputs(campusId);
    const users = Array.isArray(inputs?.users) ? inputs.users : [];
    const enrollments = Array.isArray(inputs?.enrollments)
      ? inputs.enrollments
      : [];
    const sections = Array.isArray(inputs?.sections) ? inputs.sections : [];
    const scheduleSlots = Array.isArray(inputs?.scheduleSlots)
      ? inputs.scheduleSlots
      : [];

    if (users.length === 0) {
      return 0;
    }

    const resolver = new ScheduleResolver({
      users,
      enrollments,
      sections,
      scheduleSlots,
    });
    const resolved = resolver
      .expectedList(new Date(startedAtMillis), drillId)
      .map((entry) => normalizeExpectedEntry(entry, drillId))
      .filter((entry) => entry.studentUid.length > 0);

    if (resolved.length === 0) {
      return 0;
    }

    return store.saveExpectedEntries(drillId, resolved);
  }

  return {
    async listDrills() {
      return store.listDrills();
    },
    async getDrill(drillId) {
      return store.getDrill(drillId);
    },
    async createDrill(data = {}) {
      const now = resolveStartMillis(data);
      const drill = {
        id: data.id || `drill-${now}`,
        campusId: data.campusId || 'cit-u',
        title: data.title || 'CIT-U Campus Earthquake Drill',
        phase: data.phase || DRILL_PHASES.DCH,
        scenario: data.scenario || DRILL_SCENARIOS.NORMAL,
        blockedNodeIds: Array.isArray(data.blockedNodeIds) ? data.blockedNodeIds : [],
        blockedEdgeIds: Array.isArray(data.blockedEdgeIds) ? data.blockedEdgeIds : [],
        createdBy: data.createdBy || 'coordinator',
        dchDurationSec: Number(data.dchDurationSec) || 60,
        startedAtMillis: now,
        evacuateAt: null,
        evacuateStartedAt: null,
        deadlineAt: null,
        endedAt: null,
      };
      return store.saveDrill(drill);
    },
    async startDrill(dataOrId) {
      if (typeof dataOrId === 'string') {
        const existing = await store.getDrill(dataOrId);
        if (!existing) throw new Error(`Drill "${dataOrId}" not found.`);
        if (existing.phase === DRILL_PHASES.ENDED) {
          throw new Error(`Drill "${dataOrId}" has already ended.`);
        }
        const campusId = existing.campusId || 'cit-u';
        await assertNoActiveDrill(campusId);
        const startedAtMillis = existing.startedAtMillis || Date.now();
        const updated = await store.updateDrill(dataOrId, {
          phase: DRILL_PHASES.DCH,
          startedAtMillis,
        });
        await freezeExpectedEntries(dataOrId, campusId, startedAtMillis);
        return updated;
      }

      const data = dataOrId || {};
      const campusId = data.campusId || 'cit-u';
      await assertNoActiveDrill(campusId);

      const startedAtMillis = resolveStartMillis(data);
      const created = await this.createDrill({
        ...data,
        campusId,
        phase: DRILL_PHASES.DCH,
        startedAtMillis,
      });

      await freezeExpectedEntries(created.id, campusId, startedAtMillis);
      return created;
    },
    async advanceToEvacuate(drillId) {
      const drill = await store.getDrill(drillId);
      if (!drill) throw new Error(`Drill "${drillId}" not found.`);
      if (drill.phase === DRILL_PHASES.ENDED) {
        throw new Error(`Drill "${drillId}" has already ended.`);
      }
      if (drill.phase !== DRILL_PHASES.DCH) {
        throw new Error(
          `Cannot transition drill from "${drill.phase}" to "${DRILL_PHASES.EVACUATE}".`,
        );
      }

      const campusId = drill.campusId || 'cit-u';
      const policy = store.getCampusPolicy
        ? await store.getCampusPolicy(campusId)
        : null;
      const assemblyDeadlineSec = resolveAssemblyDeadlineSec(policy);

      const now = Date.now();
      const deadlineMillis = now + assemblyDeadlineSec * 1000;
      const evacuateTs = Timestamp.fromMillis(now);
      const deadlineTs = Timestamp.fromMillis(deadlineMillis);

      return store.updateDrill(drillId, {
        phase: DRILL_PHASES.EVACUATE,
        evacuateStartedAt: evacuateTs,
        evacuateAt: evacuateTs,
        evacuateAtMillis: now,
        deadlineAt: deadlineTs,
        deadlineAtMillis: deadlineMillis,
        assemblyDeadlineSec,
      });
    },
    async advanceDrillPhase(drillId, targetPhase = null) {
      const drill = await store.getDrill(drillId);
      if (!drill) throw new Error(`Drill "${drillId}" not found.`);
      if (drill.phase === DRILL_PHASES.ENDED) {
        throw new Error(`Drill "${drillId}" has already ended.`);
      }
      const idx = DRILL_PHASE_ORDER.indexOf(drill.phase);
      const nextPhase = targetPhase || DRILL_PHASE_ORDER[idx + 1];
      const nextIdx = DRILL_PHASE_ORDER.indexOf(nextPhase);
      if (nextIdx === -1 || nextIdx <= idx) {
        throw new Error(`Cannot transition drill from "${drill.phase}" to "${nextPhase}".`);
      }

      if (nextPhase === DRILL_PHASES.EVACUATE) {
        return this.advanceToEvacuate(drillId);
      }

      const patch = { phase: nextPhase };
      if (nextPhase === DRILL_PHASES.ENDED) {
        const now = Date.now();
        patch.endedAt = Timestamp.fromMillis(now);
        patch.endedAtMillis = now;
      }
      return store.updateDrill(drillId, patch);
    },
    async endDrill(drillId) {
      const drill = await store.getDrill(drillId);
      if (!drill) throw new Error(`Drill "${drillId}" not found.`);
      if (drill.phase === DRILL_PHASES.ENDED) return drill;
      const now = Date.now();
      return store.updateDrill(drillId, {
        phase: DRILL_PHASES.ENDED,
        endedAt: Timestamp.fromMillis(now),
        endedAtMillis: now,
      });
    },
    async getExpectedEntries(drillId) {
      return store.getExpectedEntries(drillId);
    },
    async getResponses(drillId) {
      return store.getResponses(drillId);
    },
    async getUserResponse(drillId, uid) {
      return store.getUserResponse(drillId, uid);
    },
    async submitStepResponse(drillId, uid, payload) {
      if (!uid) throw new Error('User ID (uid) is required.');
      const resolvedNodeId = payload.nodeId || payload.currentNodeId || null;
      return store.upsertResponse(drillId, uid, {
        status: payload.status || RESPONSE_STATUSES.DCH_ACKNOWLEDGED,
        phase: payload.phase || DRILL_PHASES.DCH,
        currentNodeId: resolvedNodeId,
        nodeId: resolvedNodeId,
        qrCode: payload.qrCode || null,
        verifiedQr: Boolean(payload.verifiedQr),
        routeNodeIds: Array.isArray(payload.routeNodeIds) ? payload.routeNodeIds : [],
        completedSteps: Array.isArray(payload.completedSteps) ? payload.completedSteps : [],
        displayName: payload.displayName || uid,
        source: payload.source || 'manual',
        method: payload.method || payload.source || 'manual',
        note: payload.note || '',
      });
    },
    subscribeToDrills(callback) {
      if (store.subscribeDrills) return store.subscribeDrills(callback);
      let active = true;
      const emit = async () => {
        if (!active) return;
        const list = await store.listDrills();
        if (active) callback(list);
      };
      emit();
      const unsub = store.subscribe(emit);
      return () => {
        active = false;
        unsub();
      };
    },
    subscribeToDrill(drillId, callback) {
      if (store.subscribeDrill) return store.subscribeDrill(drillId, callback);
      let active = true;
      const emit = async () => {
        if (!active) return;
        const d = await store.getDrill(drillId);
        if (active) callback(d);
      };
      emit();
      const unsub = store.subscribe(emit);
      return () => {
        active = false;
        unsub();
      };
    },
    subscribeToExpectedEntries(drillId, callback) {
      if (store.subscribeExpectedEntries) return store.subscribeExpectedEntries(drillId, callback);
      let active = true;
      const emit = async () => {
        if (!active) return;
        const list = await store.getExpectedEntries(drillId);
        if (active) callback(list);
      };
      emit();
      const unsub = store.subscribe(emit);
      return () => {
        active = false;
        unsub();
      };
    },
    subscribeToResponses(drillId, callback) {
      if (store.subscribeResponses) return store.subscribeResponses(drillId, callback);
      let active = true;
      const emit = async () => {
        if (!active) return;
        const list = await store.getResponses(drillId);
        if (active) callback(list);
      };
      emit();
      const unsub = store.subscribe(emit);
      return () => {
        active = false;
        unsub();
      };
    },
  };
}

export const DrillService = createDrillService();

function defaultSeedDrills() {
  return [
    {
      id: 'drill-citu-eq-01',
      campusId: 'cit-u',
      title: 'CIT-U Campus Earthquake Drill',
      phase: DRILL_PHASES.DCH,
      scenario: DRILL_SCENARIOS.NORMAL,
      blockedNodeIds: [],
      blockedEdgeIds: [],
      createdBy: 'coord-01',
      dchDurationSec: 60,
      startedAtMillis: Date.now() - 120_000,
    },
  ];
}

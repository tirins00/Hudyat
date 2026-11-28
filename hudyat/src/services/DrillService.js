import {
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
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  DRILL_PHASES,
  DRILL_SCENARIOS,
  RESPONSE_STATUSES,
} from '../types/models.js';

export const DRILL_PHASE_ORDER = Object.freeze([
  DRILL_PHASES.DCH,
  DRILL_PHASES.EVACUATE,
  DRILL_PHASES.ENDED,
]);

/**
 * In-memory reactive store for unit testing or offline fallback.
 */
export function createInMemoryDrillStore(seed = {}) {
  const drills = new Map();
  const expectedEntries = new Map();
  const responses = new Map();
  const listeners = new Set();

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
  return {
    async listDrills() {
      return store.listDrills();
    },
    async getDrill(drillId) {
      return store.getDrill(drillId);
    },
    async createDrill(data = {}) {
      const now = Date.now();
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
        return store.updateDrill(dataOrId, {
          phase: DRILL_PHASES.DCH,
          startedAtMillis: existing.startedAtMillis || Date.now(),
        });
      }
      return this.createDrill({ ...dataOrId, phase: DRILL_PHASES.DCH });
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
      const patch = { phase: nextPhase };
      if (nextPhase === DRILL_PHASES.EVACUATE) patch.evacuateAtMillis = Date.now();
      if (nextPhase === DRILL_PHASES.ENDED) patch.endedAtMillis = Date.now();
      return store.updateDrill(drillId, patch);
    },
    async endDrill(drillId) {
      const drill = await store.getDrill(drillId);
      if (!drill) throw new Error(`Drill "${drillId}" not found.`);
      if (drill.phase === DRILL_PHASES.ENDED) return drill;
      return store.updateDrill(drillId, {
        phase: DRILL_PHASES.ENDED,
        endedAtMillis: Date.now(),
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

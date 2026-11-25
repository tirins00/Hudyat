import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { getHeadcountFirestore } from '../firebase/headcountClient';
import type { Sos, SosStatus } from '../types/models';

export interface SosPreset {
  id: string;
  label: string;
  shortText: string;
}

export const SOS_PRESETS: readonly SosPreset[] = [
  {
    id: 'injured',
    label: 'Injured / Need medical help',
    shortText: 'I am hurt',
  },
  {
    id: 'trapped',
    label: 'Trapped / Cannot exit',
    shortText: 'I am trapped',
  },
  {
    id: 'blocked-exit',
    label: 'Blocked exit / Hazard',
    shortText: 'I cannot find the exit',
  },
  {
    id: 'helping',
    label: 'Need assistance',
    shortText: 'I am helping someone',
  },
];

export interface SendSosInput {
  drillId: string;
  uid: string;
  nodeId: string;
  zoneLabel?: string;
  buildingId?: string;
  floor?: number;
  message: string;
  note?: string;
}

export interface SosStore {
  create(sos: Sos): Promise<void>;
  acknowledge(
    drillId: string,
    sosId: string,
    responderUid: string,
    at: Timestamp,
  ): Promise<void>;
  resolve(
    drillId: string,
    sosId: string,
    responderUid: string,
    at: Timestamp,
  ): Promise<void>;
  subscribe(
    drillId: string,
    callback: (alerts: Sos[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
}

const STATUS_PRIORITY: Record<SosStatus, number> = {
  active: 0,
  acknowledged: 1,
  resolved: 2,
};

function timestampMillis(ts: Timestamp | null | undefined): number {
  if (!ts) return 0;
  return typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
}

/**
 * Orders SOS alerts so `active` alerts appear first, followed by `acknowledged`,
 * then `resolved` (and newest first within the same status).
 */
export function sortSosAlerts(alerts: readonly Sos[]): Sos[] {
  return [...alerts].sort((a, b) => {
    const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (statusDiff !== 0) return statusDiff;
    return timestampMillis(b.createdAt) - timestampMillis(a.createdAt);
  });
}

/**
 * Creates an in-memory SOS store for unit tests and interactive Demo Mode.
 */
export function createMemorySosStore(initial: readonly Sos[] = []): SosStore & {
  getAll(drillId?: string): Sos[];
  clear(drillId?: string): void;
} {
  const items = new Map<string, Sos>();
  for (const s of initial) {
    items.set(s.id, s);
  }

  const listeners = new Map<string, Set<(alerts: Sos[]) => void>>();

  const listForDrill = (drillId: string): Sos[] =>
    sortSosAlerts(
      Array.from(items.values()).filter((item) => item.drillId === drillId),
    );

  const notifyDrill = (drillId: string) => {
    const subs = listeners.get(drillId);
    if (!subs) return;
    const snapshot = listForDrill(drillId);
    for (const cb of subs) {
      cb(snapshot);
    }
  };

  return {
    async create(sos) {
      items.set(sos.id, sos);
      notifyDrill(sos.drillId);
    },

    async acknowledge(drillId, sosId, responderUid, at) {
      const existing = items.get(sosId);
      if (!existing || existing.drillId !== drillId) {
        throw new Error(`SOS alert "${sosId}" not found.`);
      }
      if (existing.status === 'resolved') {
        throw new Error('Cannot acknowledge an already resolved SOS alert.');
      }
      items.set(sosId, {
        ...existing,
        status: 'acknowledged',
        acknowledgedBy: responderUid,
        acknowledgedAt: at,
      });
      notifyDrill(drillId);
    },

    async resolve(drillId, sosId, responderUid, at) {
      const existing = items.get(sosId);
      if (!existing || existing.drillId !== drillId) {
        throw new Error(`SOS alert "${sosId}" not found.`);
      }
      items.set(sosId, {
        ...existing,
        status: 'resolved',
        resolvedBy: responderUid,
        resolvedAt: at,
      });
      notifyDrill(drillId);
    },

    subscribe(drillId, callback) {
      let subs = listeners.get(drillId);
      if (!subs) {
        subs = new Set();
        listeners.set(drillId, subs);
      }
      subs.add(callback);
      callback(listForDrill(drillId));

      return () => {
        subs?.delete(callback);
      };
    },

    getAll(drillId) {
      return drillId
        ? listForDrill(drillId)
        : sortSosAlerts(Array.from(items.values()));
    },

    clear(drillId) {
      if (!drillId) {
        const affected = new Set(Array.from(items.values()).map((i) => i.drillId));
        items.clear();
        for (const d of affected) notifyDrill(d);
        return;
      }
      for (const [id, item] of items.entries()) {
        if (item.drillId === drillId) {
          items.delete(id);
        }
      }
      notifyDrill(drillId);
    },
  };
}

/**
 * Shared Demo Mode SOS store so SOS alerts sent from Check-In / SOS Sheet appear
 * immediately on the Coordinator's Headcount Board.
 */
export const demoSosStore = createMemorySosStore();

/**
 * Creates a Firestore-backed SOS store targeting `drills/{drillId}/sos`.
 */
export function createFirestoreSosStore(db: Firestore): SosStore {
  return {
    async create(sos) {
      const ref = doc(db, 'drills', sos.drillId, 'sos', sos.id);
      await setDoc(ref, sos);
    },

    async acknowledge(drillId, sosId, responderUid, at) {
      const ref = doc(db, 'drills', drillId, 'sos', sosId);
      await updateDoc(ref, {
        status: 'acknowledged',
        acknowledgedBy: responderUid,
        acknowledgedAt: at,
      });
    },

    async resolve(drillId, sosId, responderUid, at) {
      const ref = doc(db, 'drills', drillId, 'sos', sosId);
      await updateDoc(ref, {
        status: 'resolved',
        resolvedBy: responderUid,
        resolvedAt: at,
      });
    },

    subscribe(drillId, callback, onError) {
      const q = query(collection(db, 'drills', drillId, 'sos'));
      return onSnapshot(
        q,
        (snap) => {
          const alerts = snap.docs.map((d) => ({
            ...(d.data() as Omit<Sos, 'id'>),
            id: d.id,
          }));
          callback(sortSosAlerts(alerts));
        },
        (err) => {
          onError?.(err);
        },
      );
    },
  };
}

export interface SosActionOptions {
  store?: SosStore;
  useDemoMode?: boolean;
  now?: () => Timestamp;
  generateId?: () => string;
}

function resolveStore(options?: SosActionOptions): SosStore {
  if (options?.store) return options.store;
  if (options?.useDemoMode) return demoSosStore;
  const db = getHeadcountFirestore();
  return db ? createFirestoreSosStore(db) : demoSosStore;
}

function createSosId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sos-${crypto.randomUUID()}`;
  }
  return `sos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sends a student SOS alert with a required preset or custom message and indoor zone ID.
 */
export async function sendSos(
  input: SendSosInput,
  options?: SosActionOptions,
): Promise<Sos> {
  const trimmedMessage = input.message.trim();
  if (!trimmedMessage) {
    throw new Error('Please select an SOS message before sending.');
  }
  if (!input.drillId.trim()) {
    throw new Error('A drill ID is required to send an SOS.');
  }
  if (!input.uid.trim()) {
    throw new Error('A user ID is required to send an SOS.');
  }

  const trimmedNote = input.note?.trim();
  const createdAt = (options?.now ?? (() => Timestamp.now()))();
  const id = (options?.generateId ?? createSosId)();

  const sos: Sos = {
    id,
    drillId: input.drillId.trim(),
    uid: input.uid.trim(),
    nodeId: input.nodeId.trim() || 'unknown',
    ...(input.zoneLabel ? { zoneLabel: input.zoneLabel } : {}),
    ...(input.buildingId ? { buildingId: input.buildingId } : {}),
    ...(input.floor !== undefined ? { floor: input.floor } : {}),
    message: trimmedMessage,
    ...(trimmedNote ? { note: trimmedNote } : {}),
    status: 'active',
    createdAt,
    acknowledgedAt: null,
    resolvedAt: null,
  };

  const store = resolveStore(options);
  await store.create(sos);
  return sos;
}

/**
 * Marks an SOS alert as acknowledged by a coordinator or assigned teacher.
 */
export async function acknowledgeSos(
  drillId: string,
  sosId: string,
  responderUid: string,
  options?: SosActionOptions,
): Promise<void> {
  if (!responderUid.trim()) {
    throw new Error('Responder UID is required to acknowledge an SOS.');
  }
  const at = (options?.now ?? (() => Timestamp.now()))();
  const store = resolveStore(options);
  await store.acknowledge(drillId, sosId, responderUid.trim(), at);
}

/**
 * Marks an SOS alert as resolved by a coordinator or responder.
 */
export async function resolveSos(
  drillId: string,
  sosId: string,
  responderUid: string,
  options?: SosActionOptions,
): Promise<void> {
  if (!responderUid.trim()) {
    throw new Error('Responder UID is required to resolve an SOS.');
  }
  const at = (options?.now ?? (() => Timestamp.now()))();
  const store = resolveStore(options);
  await store.resolve(drillId, sosId, responderUid.trim(), at);
}

/**
 * Subscribes to `drills/{drillId}/sos` (or the Demo Mode store when Firebase is unconfigured).
 * Falls back to Demo Mode if Firestore subscription fails (e.g., locked rules).
 */
export function subscribeToSosAlerts(
  drillId: string,
  callback: (alerts: Sos[]) => void,
  options?: {
    store?: SosStore;
    useDemoMode?: boolean;
    onError?: (error: Error) => void;
  },
): () => void {
  if (options?.store) {
    return options.store.subscribe(drillId, callback, options.onError);
  }
  if (options?.useDemoMode) {
    return demoSosStore.subscribe(drillId, callback, options.onError);
  }

  const db = getHeadcountFirestore();
  if (!db) {
    return demoSosStore.subscribe(drillId, callback, options?.onError);
  }

  let activeUnsub: (() => void) | null = null;
  let fallbackUnsub: (() => void) | null = null;
  const firestoreStore = createFirestoreSosStore(db);

  activeUnsub = firestoreStore.subscribe(drillId, callback, (err) => {
    options?.onError?.(err);
    // Graceful fallback to Demo Mode if Firestore rules block read access.
    if (!fallbackUnsub) {
      fallbackUnsub = demoSosStore.subscribe(drillId, callback);
    }
  });

  return () => {
    activeUnsub?.();
    fallbackUnsub?.();
  };
}

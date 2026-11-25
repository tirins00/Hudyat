import {
  Timestamp,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { CheckIn } from '../types/models';
import { QrCodeParser } from './QrCodeParser';

export interface CheckInStore {
  getCheckIn(studentUid: string): Promise<CheckIn | null>;
  createIfAbsent(
    checkIn: CheckIn,
  ): Promise<{ checkIn: CheckIn; created: boolean }>;
  setVerifiedBy(studentUid: string, verifiedBy: string): Promise<void>;
  deleteCheckIn(studentUid: string): Promise<void>;
}

/**
 * Firestore-backed CheckInStore using `drills/{drillId}/checkIns/{studentUid}`
 * with transaction-guarded create-if-absent to guarantee at most one check-in per student.
 */
export function createFirestoreCheckInStore(
  db: Firestore,
  drillId: string,
): CheckInStore {
  const refFor = (studentUid: string) =>
    doc(db, 'drills', drillId, 'checkIns', studentUid);

  return {
    async getCheckIn(studentUid) {
      const snap = await getDoc(refFor(studentUid));
      if (!snap.exists()) return null;
      return { ...(snap.data() as CheckIn), studentUid: snap.id };
    },

    async createIfAbsent(checkIn) {
      const ref = refFor(checkIn.studentUid);
      return runTransaction(db, async (tx) => {
        const existingSnap = await tx.get(ref);
        if (existingSnap.exists()) {
          const existing = {
            ...(existingSnap.data() as CheckIn),
            studentUid: existingSnap.id,
          };
          return { checkIn: existing, created: false };
        }
        tx.set(ref, checkIn);
        return { checkIn, created: true };
      });
    },

    async setVerifiedBy(studentUid, verifiedBy) {
      await updateDoc(refFor(studentUid), { verifiedBy });
    },

    async deleteCheckIn(studentUid) {
      await deleteDoc(refFor(studentUid));
    },
  };
}

/**
 * In-memory CheckInStore for unit tests and interactive Demo Mode.
 */
export function createMemoryCheckInStore(
  initial: readonly CheckIn[] = [],
  callbacks?: {
    onChange?: (all: CheckIn[]) => void;
  },
): CheckInStore {
  const map = new Map<string, CheckIn>();
  for (const c of initial) {
    map.set(c.studentUid, c);
  }

  const notify = () => {
    callbacks?.onChange?.(Array.from(map.values()));
  };

  return {
    async getCheckIn(studentUid) {
      return map.get(studentUid) ?? null;
    },

    async createIfAbsent(checkIn) {
      const existing = map.get(checkIn.studentUid);
      if (existing) {
        return { checkIn: existing, created: false };
      }
      map.set(checkIn.studentUid, checkIn);
      notify();
      return { checkIn, created: true };
    },

    async setVerifiedBy(studentUid, verifiedBy) {
      const existing = map.get(studentUid);
      if (!existing) return;
      map.set(studentUid, { ...existing, verifiedBy });
      notify();
    },

    async deleteCheckIn(studentUid) {
      if (map.delete(studentUid)) {
        notify();
      }
    },
  };
}

export interface CheckInServiceOptions {
  drillId: string;
  actorUid: string;
  qrCodeParser: QrCodeParser;
  store: CheckInStore;
  defaultAssemblyNodeId?: string;
  now?: () => Timestamp;
  onDuplicate?: (existing: CheckIn) => void;
}

/**
 * Manages student QR check-ins (UC-5.1) and teacher/peer assisted check-ins (UC-5.2).
 *
 * - Document ID is `studentUid` so each student has at most one check-in per drill.
 * - Duplicate check-ins are ignored and the original timestamp is preserved.
 * - QR and teacher check-ins are immediately verified; peer check-ins remain Pending
 *   (`verifiedBy: null`) until confirmed or rejected by a teacher.
 */
export class CheckInService {
  private readonly drillId: string;
  private readonly actorUid: string;
  private readonly qrCodeParser: QrCodeParser;
  private readonly store: CheckInStore;
  private readonly defaultAssemblyNodeId: string;
  private readonly now: () => Timestamp;
  private readonly onDuplicate?: (existing: CheckIn) => void;

  constructor(options: CheckInServiceOptions) {
    this.drillId = options.drillId;
    this.actorUid = options.actorUid;
    this.qrCodeParser = options.qrCodeParser;
    this.store = options.store;
    this.defaultAssemblyNodeId = options.defaultAssemblyNodeId ?? '';
    this.now = options.now ?? (() => Timestamp.now());
    this.onDuplicate = options.onDuplicate;
  }

  /**
   * UC-5.1: Scans and validates an assembly QR code, then records a verified QR check-in.
   * Accepts any valid assembly area on campus (even if different from assigned area).
   */
  async checkInQr(
    code: string,
    studentUid: string = this.actorUid,
  ): Promise<CheckIn> {
    const nodeRef = this.qrCodeParser.parseAssembly(code);
    const checkIn: CheckIn = {
      studentUid,
      drillId: this.drillId,
      method: 'qr',
      assemblyNodeId: nodeRef.nodeId,
      checkedInBy: studentUid,
      byUid: studentUid,
      verifiedBy: null,
      checkedInAt: this.now(),
    };

    const result = await this.store.createIfAbsent(checkIn);
    if (!result.created) {
      this.onDuplicate?.(result.checkIn);
    }
    return result.checkIn;
  }

  /**
   * UC-5.2: Teacher marks a student present (immediately verified).
   */
  async markPresent(
    studentUid: string,
    assemblyNodeId: string = this.defaultAssemblyNodeId,
    sectionId?: string,
  ): Promise<CheckIn> {
    const checkIn: CheckIn = {
      studentUid,
      drillId: this.drillId,
      method: 'teacher',
      assemblyNodeId,
      ...(sectionId ? { sectionId } : {}),
      checkedInBy: this.actorUid,
      byUid: this.actorUid,
      verifiedBy: this.actorUid,
      checkedInAt: this.now(),
    };

    const result = await this.store.createIfAbsent(checkIn);
    if (!result.created) {
      this.onDuplicate?.(result.checkIn);
    }
    return result.checkIn;
  }

  /**
   * UC-5.2: Classmate submits a peer check-in as Pending (`verifiedBy: null`).
   */
  async peerCheckIn(
    studentUid: string,
    assemblyNodeId: string = this.defaultAssemblyNodeId,
    sectionId?: string,
  ): Promise<CheckIn> {
    const checkIn: CheckIn = {
      studentUid,
      drillId: this.drillId,
      method: 'peer',
      assemblyNodeId,
      ...(sectionId ? { sectionId } : {}),
      checkedInBy: this.actorUid,
      byUid: this.actorUid,
      verifiedBy: null,
      checkedInAt: this.now(),
    };

    const result = await this.store.createIfAbsent(checkIn);
    if (!result.created) {
      this.onDuplicate?.(result.checkIn);
    }
    return result.checkIn;
  }

  /**
   * UC-5.2: Teacher confirms a pending peer check-in, setting `verifiedBy`.
   */
  async verify(studentUid: string): Promise<void> {
    const existing = await this.store.getCheckIn(studentUid);
    if (!existing) {
      throw new Error('No check-in record found for this student.');
    }
    if (existing.method !== 'peer' || existing.verifiedBy) {
      return;
    }
    await this.store.setVerifiedBy(studentUid, this.actorUid);
  }

  /**
   * UC-5.2 (4a): Teacher rejects a pending peer check-in, removing it so the student
   * returns to Unaccounted.
   */
  async rejectPeerCheckIn(studentUid: string): Promise<void> {
    const existing = await this.store.getCheckIn(studentUid);
    if (!existing) return;
    if (existing.method !== 'peer' || existing.verifiedBy) {
      throw new Error('Only pending peer check-ins can be rejected.');
    }
    await this.store.deleteCheckIn(studentUid);
  }
}

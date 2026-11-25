import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Union Types
// ---------------------------------------------------------------------------

export type Role = 'student' | 'teacher' | 'coordinator' | 'admin';

export type NodeType =
  | 'room'
  | 'corridor'
  | 'stair'
  | 'lift'
  | 'exit'
  | 'assembly'
  | 'common';

export type DrillPhase = 'dch' | 'evacuate' | 'ended';

export type DrillScenario = 'normal' | 'blocked_exit';

export type CheckInMethod = 'qr' | 'teacher' | 'peer';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export type ResponseStatus =
  | 'dch_acknowledged'
  | 'evacuating'
  | 'arrived'
  | 'needs_help';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type SosStatus = 'active' | 'acknowledged' | 'resolved';

// ---------------------------------------------------------------------------
// Campus & Indoor Map Collections: campuses/{campusId}
// ---------------------------------------------------------------------------

/** Document path: `campuses/{campusId}` */
export interface Campus {
  id: string;
  name: string;
  code?: string;
  address?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/** Document path: `campuses/{campusId}/buildings/{buildingId}` */
export interface Building {
  id: string;
  campusId: string;
  name: string;
  code: string;
  floors: number[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/** Document path: `campuses/{campusId}/policy/{policyId}` */
export interface Policy {
  id: string;
  campusId: string;
  /** Duration of the Drop, Cover, and Hold phase in seconds. */
  dchDurationSec: number;
  /** Maximum visual flash frequency in Hz; must stay strictly under 3 Hz. */
  maxFlashHz: number;
  allowPeerCheckIn: boolean;
  requireQrCheckIn?: boolean;
  defaultAssemblyNodeId?: string;
  updatedAt: Timestamp;
  updatedBy?: string;
}

/**
 * Document path: `campuses/{campusId}/mapNodes/{nodeId}`
 * Uses floor-plan pixel/grid coordinates (`x`, `y`); GPS coordinates are disallowed.
 */
export interface MapNode {
  id: string;
  campusId: string;
  buildingId: string | null;
  floor: number;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  qrCode?: string;
  accessible?: boolean;
  capacity?: number;
}

/**
 * Document path: `campuses/{campusId}/mapEdges/{edgeId}`
 * Edges with `isLift: true` must always be excluded from evacuation/navigation routes.
 */
export interface MapEdge {
  id: string;
  campusId: string;
  fromNodeId: string;
  toNodeId: string;
  weight: number;
  /** Lift edges are always excluded from evacuation routes. */
  isLift: boolean;
  isStair?: boolean;
  isAccessible?: boolean;
  isBlocked?: boolean;
  bidirectional: boolean;
}

/** Document path: `campuses/{campusId}/floorPlans/{floorPlanId}` */
export interface FloorPlan {
  id: string;
  campusId: string;
  buildingId: string;
  floor: number;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  updatedAt?: Timestamp;
}

// ---------------------------------------------------------------------------
// Academic & User Collections
// ---------------------------------------------------------------------------

/** Document path: `users/{uid}` */
export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  campusId: string;
  active?: boolean;
  studentNumber?: string;
  employeeNumber?: string;
  mobilityNeeds?: boolean;
  hearingImpaired?: boolean;
  visualImpaired?: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/** Document path: `sections/{sectionId}` */
export interface Section {
  id: string;
  campusId: string;
  code: string;
  name: string;
  courseCode?: string;
  teacherUid: string;
  term?: string;
  createdAt?: Timestamp;
}

/** Document path: `enrollments/{enrollmentId}` */
export interface Enrollment {
  id: string;
  campusId: string;
  sectionId: string;
  studentUid: string;
  enrolledAt?: Timestamp;
}

/** Document path: `scheduleSlots/{slotId}` */
export interface ScheduleSlot {
  id: string;
  campusId: string;
  sectionId: string;
  roomNodeId: string;
  buildingId: string;
  floor: number;
  dayOfWeek: DayOfWeek;
  /** 24-hour `HH:mm` start time. */
  startTime: string;
  /** 24-hour `HH:mm` end time. */
  endTime: string;
}

// ---------------------------------------------------------------------------
// Drill Collections: drills/{drillId}
// ---------------------------------------------------------------------------

/** Document path: `drills/{drillId}` */
export interface Drill {
  id: string;
  campusId: string;
  title: string;
  phase: DrillPhase;
  scenario: DrillScenario;
  blockedNodeIds: string[];
  blockedEdgeIds: string[];
  createdBy: string;
  startedAt: Timestamp;
  evacuateAt?: Timestamp | null;
  deadlineAt?: Timestamp | null;
  endedAt?: Timestamp | null;
  dchDurationSec: number;
}

/** Document path: `drills/{drillId}/expectedEntries/{entryId}` */
export interface ExpectedEntry {
  id: string;
  drillId: string;
  studentUid: string;
  displayName: string;
  group?: string;
  sectionId: string;
  sectionCode?: string;
  teacherUid: string;
  roomNodeId: string;
  expectedRoomId?: string | null;
  buildingId: string;
  floor: number;
  expectedAssemblyNodeId?: string;
}

/** Document path: `drills/{drillId}/responses/{responseId}` */
export interface Response {
  id: string;
  drillId: string;
  uid: string;
  phase: DrillPhase;
  status: ResponseStatus;
  currentNodeId?: string;
  zoneNodeId?: string;
  routeNodeIds?: string[];
  updatedAt: Timestamp;
}

/**
 * Document path: `drills/{drillId}/checkIns/{studentUid}`
 * Document ID MUST equal `studentUid` to prevent duplicate check-ins.
 */
export interface CheckIn {
  /** Also used as the Firestore document ID. */
  studentUid: string;
  drillId: string;
  method: CheckInMethod;
  assemblyNodeId: string;
  sectionId?: string;
  checkedInBy: string;
  byUid?: string;
  verifiedBy?: string | null;
  checkedInAt: Timestamp;
  notes?: string;
}

/**
 * Document path: `drills/{drillId}/alerts/{alertId}`
 * Sound-only alerts are disallowed; every alert must include visual/haptic cues
 * and keep any flashing strictly under 3 flashes/sec.
 */
export interface Alert {
  id: string;
  drillId: string;
  phase: DrillPhase;
  severity: AlertSeverity;
  title: string;
  message: string;
  /** Non-audio visual cue (at least one of visualCue or hapticCue must be true; no sound-only alerts). */
  visualCue: boolean;
  hapticCue: boolean;
  /** Optional flash rate in Hz; must be strictly < 3. */
  flashHz?: number;
  targetBuildingIds?: string[];
  studentUid?: string;
  teacherUid?: string;
  at?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
}

/**
 * Document path: `drills/{drillId}/sos/{sosId}`
 * Uses indoor `nodeId` rather than GPS coordinates.
 */
export interface Sos {
  id: string;
  drillId: string;
  uid: string;
  nodeId: string;
  buildingId?: string;
  floor?: number;
  message?: string;
  status: SosStatus;
  createdAt: Timestamp;
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp | null;
  resolvedBy?: string;
  resolvedAt?: Timestamp | null;
}

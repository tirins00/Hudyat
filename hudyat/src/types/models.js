// ---------------------------------------------------------------------------
// Enum Constants
// ---------------------------------------------------------------------------

/** @readonly */
export const ROLES = Object.freeze({
  STUDENT: 'student',
  TEACHER: 'teacher',
  COORDINATOR: 'coordinator',
  ADMIN: 'admin',
});

/** @readonly */
export const NODE_TYPES = Object.freeze({
  ROOM: 'room',
  CORRIDOR: 'corridor',
  STAIR: 'stair',
  LIFT: 'lift',
  EXIT: 'exit',
  ASSEMBLY: 'assembly',
  COMMON: 'common',
});

/** @readonly */
export const DRILL_PHASES = Object.freeze({
  DCH: 'dch',
  EVACUATE: 'evacuate',
  ENDED: 'ended',
});

/** @readonly */
export const DRILL_SCENARIOS = Object.freeze({
  NORMAL: 'normal',
  BLOCKED_EXIT: 'blocked_exit',
});

/** @readonly */
export const CHECKIN_METHODS = Object.freeze({
  QR: 'qr',
  TEACHER: 'teacher',
  PEER: 'peer',
});

/** @readonly */
export const DAYS_OF_WEEK = Object.freeze({
  MON: 'MON',
  TUE: 'TUE',
  WED: 'WED',
  THU: 'THU',
  FRI: 'FRI',
  SAT: 'SAT',
});

/** @readonly */
export const RESPONSE_STATUSES = Object.freeze({
  DCH_ACKNOWLEDGED: 'dch_acknowledged',
  EVACUATING: 'evacuating',
  ARRIVED: 'arrived',
  NEEDS_HELP: 'needs_help',
});

/** @readonly */
export const ALERT_SEVERITIES = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
});

/** @readonly */
export const SOS_STATUSES = Object.freeze({
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
});

// ---------------------------------------------------------------------------
// Union JSDoc Typedefs
// ---------------------------------------------------------------------------

/** @typedef {import('firebase/firestore').Timestamp} Timestamp */

/** @typedef {'student' | 'teacher' | 'coordinator' | 'admin'} Role */

/** @typedef {'room' | 'corridor' | 'stair' | 'lift' | 'exit' | 'assembly' | 'common'} NodeType */

/** @typedef {'dch' | 'evacuate' | 'ended'} DrillPhase */

/** @typedef {'normal' | 'blocked_exit'} DrillScenario */

/** @typedef {'qr' | 'teacher' | 'peer'} CheckInMethod */

/** @typedef {'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'} DayOfWeek */

/** @typedef {'dch_acknowledged' | 'evacuating' | 'arrived' | 'needs_help'} ResponseStatus */

/** @typedef {'info' | 'warning' | 'critical'} AlertSeverity */

/** @typedef {'active' | 'acknowledged' | 'resolved'} SosStatus */

// ---------------------------------------------------------------------------
// Campus & Indoor Map Collections: campuses/{campusId}
// ---------------------------------------------------------------------------

/**
 * Document path: `campuses/{campusId}`
 * @typedef {Object} Campus
 * @property {string} id
 * @property {string} name
 * @property {string} [code]
 * @property {string} [address]
 * @property {Timestamp} createdAt
 * @property {Timestamp} [updatedAt]
 */

/**
 * Document path: `campuses/{campusId}/buildings/{buildingId}`
 * @typedef {Object} Building
 * @property {string} id
 * @property {string} campusId
 * @property {string} name
 * @property {string} code
 * @property {number[]} floors
 * @property {Timestamp} [createdAt]
 * @property {Timestamp} [updatedAt]
 */

/**
 * Document path: `campuses/{campusId}/policy/{policyId}`
 * @typedef {Object} Policy
 * @property {string} id
 * @property {string} campusId
 * @property {number} dchDurationSec - Duration of the Drop, Cover, and Hold phase in seconds.
 * @property {number} maxFlashHz - Maximum visual flash frequency in Hz; must stay strictly under 3 Hz.
 * @property {boolean} allowPeerCheckIn
 * @property {boolean} [requireQrCheckIn]
 * @property {string} [defaultAssemblyNodeId]
 * @property {Timestamp} updatedAt
 * @property {string} [updatedBy]
 */

/**
 * Document path: `campuses/{campusId}/mapNodes/{nodeId}`
 * Uses floor-plan pixel/grid coordinates (`x`, `y`); GPS coordinates are disallowed.
 * @typedef {Object} MapNode
 * @property {string} id
 * @property {string} campusId
 * @property {string | null} buildingId
 * @property {number} floor
 * @property {string} label
 * @property {NodeType} type
 * @property {number} x
 * @property {number} y
 * @property {string} [qrCode]
 * @property {boolean} [accessible]
 * @property {number} [capacity]
 */

/**
 * Document path: `campuses/{campusId}/mapEdges/{edgeId}`
 * Edges with `isLift: true` must always be excluded from evacuation/navigation routes.
 * @typedef {Object} MapEdge
 * @property {string} id
 * @property {string} campusId
 * @property {string} fromNodeId
 * @property {string} toNodeId
 * @property {number} weight
 * @property {boolean} isLift - Lift edges are always excluded from evacuation routes.
 * @property {boolean} [isStair]
 * @property {boolean} [isAccessible]
 * @property {boolean} [isBlocked]
 * @property {boolean} bidirectional
 */

/**
 * Document path: `campuses/{campusId}/floorPlans/{floorPlanId}`
 * @typedef {Object} FloorPlan
 * @property {string} id
 * @property {string} campusId
 * @property {string} buildingId
 * @property {number} floor
 * @property {string} name
 * @property {string} imageUrl
 * @property {number} width
 * @property {number} height
 * @property {Timestamp} [updatedAt]
 */

// ---------------------------------------------------------------------------
// Academic & User Collections
// ---------------------------------------------------------------------------

/**
 * Document path: `users/{uid}`
 * @typedef {Object} User
 * @property {string} uid
 * @property {string} email
 * @property {string} displayName
 * @property {Role} role
 * @property {string} campusId
 * @property {string} [studentNumber]
 * @property {string} [employeeNumber]
 * @property {boolean} [mobilityNeeds]
 * @property {boolean} [hearingImpaired]
 * @property {boolean} [visualImpaired]
 * @property {Timestamp} createdAt
 * @property {Timestamp} [updatedAt]
 */

/**
 * Document path: `sections/{sectionId}`
 * @typedef {Object} Section
 * @property {string} id
 * @property {string} campusId
 * @property {string} code
 * @property {string} name
 * @property {string} [courseCode]
 * @property {string} teacherUid
 * @property {string} [term]
 * @property {Timestamp} [createdAt]
 */

/**
 * Document path: `enrollments/{enrollmentId}`
 * @typedef {Object} Enrollment
 * @property {string} id
 * @property {string} campusId
 * @property {string} sectionId
 * @property {string} studentUid
 * @property {Timestamp} [enrolledAt]
 */

/**
 * Document path: `scheduleSlots/{slotId}`
 * @typedef {Object} ScheduleSlot
 * @property {string} id
 * @property {string} campusId
 * @property {string} sectionId
 * @property {string} roomNodeId
 * @property {string} buildingId
 * @property {number} floor
 * @property {DayOfWeek} dayOfWeek
 * @property {string} startTime - 24-hour `HH:mm` start time.
 * @property {string} endTime - 24-hour `HH:mm` end time.
 */

// ---------------------------------------------------------------------------
// Drill Collections: drills/{drillId}
// ---------------------------------------------------------------------------

/**
 * Document path: `drills/{drillId}`
 * @typedef {Object} Drill
 * @property {string} id
 * @property {string} campusId
 * @property {string} title
 * @property {DrillPhase} phase
 * @property {DrillScenario} scenario
 * @property {string[]} blockedNodeIds
 * @property {string[]} blockedEdgeIds
 * @property {string} createdBy
 * @property {Timestamp} startedAt
 * @property {Timestamp | null} [evacuateAt]
 * @property {Timestamp | null} [endedAt]
 * @property {number} dchDurationSec
 */

/**
 * Document path: `drills/{drillId}/expectedEntries/{entryId}`
 * @typedef {Object} ExpectedEntry
 * @property {string} id
 * @property {string} drillId
 * @property {string} studentUid
 * @property {string} displayName
 * @property {string} sectionId
 * @property {string} teacherUid
 * @property {string} roomNodeId
 * @property {string} buildingId
 * @property {number} floor
 * @property {string} [expectedAssemblyNodeId]
 */

/**
 * Document path: `drills/{drillId}/responses/{responseId}`
 * @typedef {Object} Response
 * @property {string} id
 * @property {string} drillId
 * @property {string} uid
 * @property {DrillPhase} phase
 * @property {ResponseStatus} status
 * @property {string} [currentNodeId]
 * @property {string[]} [routeNodeIds]
 * @property {Timestamp} updatedAt
 */

/**
 * Document path: `drills/{drillId}/checkIns/{studentUid}`
 * Document ID MUST equal `studentUid` to prevent duplicate check-ins.
 * @typedef {Object} CheckIn
 * @property {string} studentUid - Also used as the Firestore document ID.
 * @property {string} drillId
 * @property {CheckInMethod} method
 * @property {string} assemblyNodeId
 * @property {string} [sectionId]
 * @property {string} checkedInBy
 * @property {Timestamp} checkedInAt
 * @property {string} [notes]
 */

/**
 * Document path: `drills/{drillId}/alerts/{alertId}`
 * Sound-only alerts are disallowed; every alert must include visual/haptic cues
 * and keep any flashing strictly under 3 flashes/sec.
 * @typedef {Object} Alert
 * @property {string} id
 * @property {string} drillId
 * @property {DrillPhase} phase
 * @property {AlertSeverity} severity
 * @property {string} title
 * @property {string} message
 * @property {boolean} visualCue - Non-audio visual cue (at least one of visualCue or hapticCue must be true; no sound-only alerts).
 * @property {boolean} hapticCue
 * @property {number} [flashHz] - Optional flash rate in Hz; must be strictly < 3.
 * @property {string[]} [targetBuildingIds]
 * @property {string} createdBy
 * @property {Timestamp} createdAt
 */

/**
 * Document path: `drills/{drillId}/sos/{sosId}`
 * Uses indoor `nodeId` rather than GPS coordinates.
 * @typedef {Object} Sos
 * @property {string} id
 * @property {string} drillId
 * @property {string} uid
 * @property {string} nodeId
 * @property {string} [buildingId]
 * @property {number} [floor]
 * @property {string} [message]
 * @property {SosStatus} status
 * @property {Timestamp} createdAt
 * @property {string} [acknowledgedBy]
 * @property {Timestamp | null} [acknowledgedAt]
 * @property {string} [resolvedBy]
 * @property {Timestamp | null} [resolvedAt]
 */

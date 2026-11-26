import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { NODE_TYPES } from '../types/models.js';
import { ALLOWED_NODE_TYPES, formatQrPayload } from './QrCodeParser.js';

const ALLOWED_NODE_TYPES_SET = new Set(ALLOWED_NODE_TYPES);
const DEFAULT_POLICY_ID = 'default';

/**
 * Validates and normalizes a campus document payload.
 * @param {string} campusId
 * @param {Record<string, any>} input
 */
export function normalizeCampusInput(campusId, input) {
  const id = String(campusId || input?.id || '').trim();
  if (!id) {
    throw new Error('Campus ID is required.');
  }

  const name = String(input?.name || '').trim();
  if (!name) {
    throw new Error('Campus name is required.');
  }

  return {
    id,
    name,
    code: String(input?.code || '').trim(),
    address: String(input?.address || '').trim(),
  };
}

/**
 * Validates and normalizes a campus safety policy payload.
 * Enforces the hard safety invariant: `maxFlashHz` must be strictly < 3 Hz.
 *
 * @param {string} campusId
 * @param {Record<string, any>} input
 */
export function normalizePolicyInput(campusId, input) {
  const normalizedCampusId = String(campusId || '').trim();
  if (!normalizedCampusId) {
    throw new Error('Campus ID is required for policy.');
  }

  const id = String(input?.id || DEFAULT_POLICY_ID).trim() || DEFAULT_POLICY_ID;
  const dchDurationSec = Number(input?.dchDurationSec);
  const maxFlashHz = Number(input?.maxFlashHz);

  if (!Number.isFinite(dchDurationSec) || dchDurationSec < 10 || dchDurationSec > 600) {
    throw new Error(
      'DCH duration must be a number between 10 and 600 seconds.',
    );
  }

  if (!Number.isFinite(maxFlashHz) || maxFlashHz <= 0 || maxFlashHz >= 3) {
    throw new Error(
      'Safety invariant violation: maxFlashHz must be greater than 0 and strictly under 3 Hz.',
    );
  }

  return {
    id,
    campusId: normalizedCampusId,
    dchDurationSec: Math.round(dchDurationSec),
    maxFlashHz: Math.round(maxFlashHz * 100) / 100,
    allowPeerCheckIn: Boolean(input?.allowPeerCheckIn),
    requireQrCheckIn: Boolean(input?.requireQrCheckIn),
    defaultAssemblyNodeId: String(input?.defaultAssemblyNodeId || '').trim(),
  };
}

/**
 * Validates and normalizes a Building payload.
 * @param {string} campusId
 * @param {Record<string, any>} input
 */
export function normalizeBuildingInput(campusId, input) {
  const normalizedCampusId = String(campusId || '').trim();
  if (!normalizedCampusId) {
    throw new Error('Campus ID is required.');
  }

  const id = String(input?.id || '').trim();
  const name = String(input?.name || '').trim();
  const code = String(input?.code || id).trim();

  if (!id) {
    throw new Error('Building ID is required.');
  }
  if (!name) {
    throw new Error('Building name is required.');
  }

  const rawFloors = Array.isArray(input?.floors)
    ? input.floors
    : String(input?.floors || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  const parsedFloors = Array.from(
    new Set(
      rawFloors
        .map((f) => Number(f))
        .filter((f) => Number.isFinite(f) && Number.isInteger(f)),
    ),
  ).sort((a, b) => a - b);

  if (parsedFloors.length === 0) {
    throw new Error('Building must list at least one valid floor number.');
  }

  return {
    id,
    campusId: normalizedCampusId,
    name,
    code,
    floors: parsedFloors,
  };
}

/**
 * Validates and normalizes a MapNode payload and guarantees a valid
 * `HUDYAT|<campusId>|<nodeType>|<nodeId>` QR payload.
 *
 * @param {string} campusId
 * @param {Record<string, any>} input
 */
export function normalizeMapNodeInput(campusId, input) {
  const normalizedCampusId = String(campusId || '').trim();
  if (!normalizedCampusId) {
    throw new Error('Campus ID is required.');
  }

  const id = String(input?.id || '').trim();
  if (!id) {
    throw new Error('Node ID is required.');
  }
  if (id.includes('|')) {
    throw new Error('Node ID must not contain "|".');
  }

  const label = String(input?.label || '').trim();
  if (!label) {
    throw new Error('Node label is required.');
  }

  const type = String(input?.type || '')
    .trim()
    .toLowerCase();
  if (!ALLOWED_NODE_TYPES_SET.has(type)) {
    throw new Error(
      `Invalid node type "${type}". Allowed: ${ALLOWED_NODE_TYPES.join(', ')}.`,
    );
  }

  const floor = Number(input?.floor);
  const x = Number(input?.x);
  const y = Number(input?.y);

  if (!Number.isFinite(floor) || !Number.isInteger(floor)) {
    throw new Error('Node floor must be a valid integer.');
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('Node coordinates (x, y) must be valid finite numbers.');
  }

  const buildingIdRaw = String(input?.buildingId ?? '').trim();
  const buildingId = buildingIdRaw || null;

  const capacityRaw =
    input?.capacity === '' || input?.capacity === undefined || input?.capacity === null
      ? null
      : Number(input.capacity);

  if (capacityRaw !== null && (!Number.isFinite(capacityRaw) || capacityRaw < 0)) {
    throw new Error('Node capacity must be a non-negative number.');
  }

  const normalized = {
    id,
    campusId: normalizedCampusId,
    buildingId,
    floor,
    label,
    type: /** @type {import('../types/models.js').NodeType} */ (type),
    x: Math.round(x),
    y: Math.round(y),
    accessible:
      input?.accessible !== undefined
        ? Boolean(input.accessible)
        : type !== NODE_TYPES.STAIR,
    qrCode: formatQrPayload({
      campusId: normalizedCampusId,
      nodeType: type,
      nodeId: id,
    }),
  };

  if (capacityRaw !== null) {
    normalized.capacity = Math.round(capacityRaw);
  }

  return normalized;
}

/**
 * Validates and normalizes a MapEdge payload.
 * @param {string} campusId
 * @param {Record<string, any>} input
 * @param {Set<string>} [validNodeIds]
 */
export function normalizeMapEdgeInput(campusId, input, validNodeIds) {
  const normalizedCampusId = String(campusId || '').trim();
  if (!normalizedCampusId) {
    throw new Error('Campus ID is required.');
  }

  const fromNodeId = String(input?.fromNodeId || '').trim();
  const toNodeId = String(input?.toNodeId || '').trim();
  if (!fromNodeId || !toNodeId) {
    throw new Error('Both fromNodeId and toNodeId are required.');
  }
  if (fromNodeId === toNodeId) {
    throw new Error('An edge cannot connect a node to itself.');
  }

  if (validNodeIds instanceof Set) {
    if (!validNodeIds.has(fromNodeId)) {
      throw new Error(`Unknown fromNodeId "${fromNodeId}".`);
    }
    if (!validNodeIds.has(toNodeId)) {
      throw new Error(`Unknown toNodeId "${toNodeId}".`);
    }
  }

  const weight = Number(input?.weight);
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('Edge weight must be a positive finite number.');
  }

  const fallbackId = `edge-${fromNodeId.toLowerCase()}-${toNodeId.toLowerCase()}`;
  const id = String(input?.id || fallbackId).trim() || fallbackId;
  const isLift = Boolean(input?.isLift);
  const isStair = Boolean(input?.isStair);

  return {
    id,
    campusId: normalizedCampusId,
    fromNodeId,
    toNodeId,
    weight: Math.round(weight * 100) / 100,
    isLift,
    isStair,
    isAccessible:
      input?.isAccessible !== undefined
        ? Boolean(input.isAccessible)
        : !isStair && !isLift,
    isBlocked: Boolean(input?.isBlocked),
    bidirectional: input?.bidirectional !== false,
  };
}

/**
 * Validates and normalizes a FloorPlan payload.
 * @param {string} campusId
 * @param {Record<string, any>} input
 */
export function normalizeFloorPlanInput(campusId, input) {
  const normalizedCampusId = String(campusId || '').trim();
  if (!normalizedCampusId) {
    throw new Error('Campus ID is required.');
  }

  const buildingId = String(input?.buildingId || '').trim();
  const floor = Number(input?.floor);
  const name = String(input?.name || '').trim();
  const imageUrl = String(input?.imageUrl || '').trim();
  const width = Number(input?.width || 400);
  const height = Number(input?.height || 520);

  if (!buildingId) {
    throw new Error('Building ID is required for a floor plan.');
  }
  if (!Number.isFinite(floor) || !Number.isInteger(floor)) {
    throw new Error('Floor number must be a valid integer.');
  }
  if (!name) {
    throw new Error('Floor plan name is required.');
  }
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Floor plan width and height must be positive numbers.');
  }

  const fallbackId = `${buildingId.toLowerCase()}-f${floor}`;
  const id = String(input?.id || fallbackId).trim() || fallbackId;

  return {
    id,
    campusId: normalizedCampusId,
    buildingId,
    floor,
    name,
    imageUrl,
    width: Math.round(width),
    height: Math.round(height),
  };
}

// ---------------------------------------------------------------------------
// Firestore Read/Write Operations
// ---------------------------------------------------------------------------

/**
 * Loads the campus document (`campuses/{campusId}`).
 * @param {string} campusId
 */
export async function getCampus(campusId) {
  const snap = await getDoc(doc(db, 'campuses', campusId));
  if (!snap.exists()) {
    return null;
  }
  return { id: snap.id, ...snap.data() };
}

/**
 * Upserts the campus document (`campuses/{campusId}`).
 * @param {string} campusId
 * @param {Record<string, any>} input
 */
export async function saveCampus(campusId, input) {
  const normalized = normalizeCampusInput(campusId, input);
  await setDoc(
    doc(db, 'campuses', normalized.id),
    { ...normalized, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return normalized;
}

/**
 * Loads the default policy document (`campuses/{campusId}/policy/{policyId}`).
 * @param {string} campusId
 * @param {string} [policyId='default']
 */
export async function getPolicy(campusId, policyId = DEFAULT_POLICY_ID) {
  const snap = await getDoc(doc(db, 'campuses', campusId, 'policy', policyId));
  if (!snap.exists()) {
    return null;
  }
  return { id: snap.id, ...snap.data() };
}

/**
 * Validates and saves the campus safety policy (`campuses/{campusId}/policy/{policyId}`).
 * @param {string} campusId
 * @param {Record<string, any>} input
 * @param {string} [updatedBy]
 */
export async function savePolicy(campusId, input, updatedBy) {
  const normalized = normalizePolicyInput(campusId, input);
  const payload = {
    ...normalized,
    updatedAt: serverTimestamp(),
    ...(updatedBy ? { updatedBy } : {}),
  };
  await setDoc(
    doc(db, 'campuses', normalized.campusId, 'policy', normalized.id),
    payload,
    { merge: true },
  );
  return normalized;
}

/**
 * Loads all buildings under `campuses/{campusId}/buildings`.
 * @param {string} campusId
 */
export async function getBuildings(campusId) {
  const snap = await getDocs(collection(db, 'campuses', campusId, 'buildings'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.code || a.id).localeCompare(String(b.code || b.id)));
}

/**
 * Creates or updates a building document.
 * @param {string} campusId
 * @param {Record<string, any>} input
 */
export async function saveBuilding(campusId, input) {
  const normalized = normalizeBuildingInput(campusId, input);
  await setDoc(
    doc(db, 'campuses', normalized.campusId, 'buildings', normalized.id),
    { ...normalized, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return normalized;
}

/**
 * Deletes a building document.
 * @param {string} campusId
 * @param {string} buildingId
 */
export async function deleteBuilding(campusId, buildingId) {
  await deleteDoc(doc(db, 'campuses', campusId, 'buildings', buildingId));
}

/**
 * Loads all mapNodes under `campuses/{campusId}/mapNodes`.
 * @param {string} campusId
 */
export async function getMapNodes(campusId) {
  const snap = await getDocs(collection(db, 'campuses', campusId, 'mapNodes'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/**
 * Creates or updates a MapNode document.
 * @param {string} campusId
 * @param {Record<string, any>} input
 */
export async function saveMapNode(campusId, input) {
  const normalized = normalizeMapNodeInput(campusId, input);
  await setDoc(
    doc(db, 'campuses', normalized.campusId, 'mapNodes', normalized.id),
    normalized,
    { merge: true },
  );
  return normalized;
}

/**
 * Deletes a MapNode document.
 * @param {string} campusId
 * @param {string} nodeId
 */
export async function deleteMapNode(campusId, nodeId) {
  await deleteDoc(doc(db, 'campuses', campusId, 'mapNodes', nodeId));
}

/**
 * Loads all mapEdges under `campuses/{campusId}/mapEdges`.
 * @param {string} campusId
 */
export async function getMapEdges(campusId) {
  const snap = await getDocs(collection(db, 'campuses', campusId, 'mapEdges'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/**
 * Creates or updates a MapEdge document.
 * @param {string} campusId
 * @param {Record<string, any>} input
 * @param {Set<string>} [validNodeIds]
 */
export async function saveMapEdge(campusId, input, validNodeIds) {
  const normalized = normalizeMapEdgeInput(campusId, input, validNodeIds);
  await setDoc(
    doc(db, 'campuses', normalized.campusId, 'mapEdges', normalized.id),
    normalized,
    { merge: true },
  );
  return normalized;
}

/**
 * Deletes a MapEdge document.
 * @param {string} campusId
 * @param {string} edgeId
 */
export async function deleteMapEdge(campusId, edgeId) {
  await deleteDoc(doc(db, 'campuses', campusId, 'mapEdges', edgeId));
}

/**
 * Loads all floorPlans under `campuses/{campusId}/floorPlans`.
 * @param {string} campusId
 */
export async function getFloorPlans(campusId) {
  const snap = await getDocs(collection(db, 'campuses', campusId, 'floorPlans'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const bCmp = String(a.buildingId || '').localeCompare(String(b.buildingId || ''));
      if (bCmp !== 0) return bCmp;
      return Number(a.floor || 0) - Number(b.floor || 0);
    });
}

/**
 * Creates or updates a FloorPlan document.
 * @param {string} campusId
 * @param {Record<string, any>} input
 */
export async function saveFloorPlan(campusId, input) {
  const normalized = normalizeFloorPlanInput(campusId, input);
  await setDoc(
    doc(db, 'campuses', normalized.campusId, 'floorPlans', normalized.id),
    { ...normalized, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return normalized;
}

/**
 * Deletes a FloorPlan document.
 * @param {string} campusId
 * @param {string} floorPlanId
 */
export async function deleteFloorPlan(campusId, floorPlanId) {
  await deleteDoc(doc(db, 'campuses', campusId, 'floorPlans', floorPlanId));
}

/**
 * Loads the complete campus setup bundle in parallel:
 * campus doc, default policy, buildings, mapNodes, mapEdges, and floorPlans.
 *
 * @param {string} campusId
 */
export async function loadCampusBundle(campusId) {
  if (!campusId) {
    throw new Error('A campusId is required to load campus data.');
  }

  const [campus, policy, buildings, mapNodes, mapEdges, floorPlans] =
    await Promise.all([
      getCampus(campusId),
      getPolicy(campusId),
      getBuildings(campusId),
      getMapNodes(campusId),
      getMapEdges(campusId),
      getFloorPlans(campusId),
    ]);

  return {
    campus,
    policy,
    buildings,
    mapNodes,
    mapEdges,
    floorPlans,
  };
}

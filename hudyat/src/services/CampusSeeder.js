import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { NODE_TYPES } from '../types/models.js';
import {
  ALLOWED_NODE_TYPES,
  formatQrPayload,
  parseQrPayload,
} from './QrCodeParser.js';

const CAMPUS_ID = 'cit-u';
const BUILDING_ID_NGE = 'NGE';
const ALLOWED_NODE_TYPES_SET = new Set(ALLOWED_NODE_TYPES);

/**
 * Helper to construct an immutable `MapNode` seed record with a valid QR payload.
 * @param {Omit<import('../types/models.js').MapNode, 'campusId' | 'qrCode'>} node
 * @returns {Readonly<import('../types/models.js').MapNode>}
 */
function createSeedNode(node) {
  return Object.freeze({
    ...node,
    campusId: CAMPUS_ID,
    qrCode: formatQrPayload({
      campusId: CAMPUS_ID,
      nodeType: node.type,
      nodeId: node.id,
    }),
  });
}

/**
 * Helper to construct an immutable `MapEdge` seed record.
 * @param {Omit<import('../types/models.js').MapEdge, 'campusId'>} edge
 * @returns {Readonly<import('../types/models.js').MapEdge>}
 */
function createSeedEdge(edge) {
  return Object.freeze({
    ...edge,
    campusId: CAMPUS_ID,
  });
}

const DEFAULT_POLICY = Object.freeze({
  id: 'default',
  campusId: CAMPUS_ID,
  dchDurationSec: 60,
  maxFlashHz: 2,
  allowPeerCheckIn: true,
  requireQrCheckIn: false,
  defaultAssemblyNodeId: 'ASM-QUAD',
});

/**
 * Deterministic, idempotent seed dataset for CIT-University (`campuses/cit-u`).
 * Aligned with `src/types/models.js`, `firestore.rules`, and `SAMPLE_SCHEDULE_CSV`.
 */
export const CIT_U_SEED_DATA = Object.freeze({
  campus: Object.freeze({
    id: CAMPUS_ID,
    name: 'CIT-University',
    code: 'CIT-U',
    address: 'N. Bacalso Avenue, Cebu City, Philippines',
    dchDurationSec: DEFAULT_POLICY.dchDurationSec,
    maxFlashHz: DEFAULT_POLICY.maxFlashHz,
    allowPeerCheckIn: DEFAULT_POLICY.allowPeerCheckIn,
    requireQrCheckIn: DEFAULT_POLICY.requireQrCheckIn,
    defaultAssemblyNodeId: DEFAULT_POLICY.defaultAssemblyNodeId,
  }),
  policy: DEFAULT_POLICY,
  buildings: Object.freeze([
    Object.freeze({
      id: BUILDING_ID_NGE,
      campusId: CAMPUS_ID,
      name: 'New Graduate & Engineering Building',
      code: 'NGE',
      floors: Object.freeze([1, 2, 3]),
    }),
  ]),
  mapNodes: Object.freeze([
    createSeedNode({
      id: 'NGE-301',
      buildingId: BUILDING_ID_NGE,
      floor: 3,
      label: 'NGE 301',
      type: NODE_TYPES.ROOM,
      x: 120,
      y: 100,
      accessible: true,
      capacity: 45,
    }),
    createSeedNode({
      id: 'NGE-302',
      buildingId: BUILDING_ID_NGE,
      floor: 3,
      label: 'NGE 302',
      type: NODE_TYPES.ROOM,
      x: 280,
      y: 100,
      accessible: true,
      capacity: 45,
    }),
    createSeedNode({
      id: 'NGE-3F-CORR',
      buildingId: BUILDING_ID_NGE,
      floor: 3,
      label: 'NGE 3F Main Corridor',
      type: NODE_TYPES.CORRIDOR,
      x: 200,
      y: 180,
      accessible: true,
    }),
    createSeedNode({
      id: 'NGE-STAIR-WEST',
      buildingId: BUILDING_ID_NGE,
      floor: 3,
      label: 'NGE West Stairwell',
      type: NODE_TYPES.STAIR,
      x: 80,
      y: 220,
      accessible: false,
    }),
    createSeedNode({
      id: 'NGE-STAIR-EAST',
      buildingId: BUILDING_ID_NGE,
      floor: 3,
      label: 'NGE East Stairwell',
      type: NODE_TYPES.STAIR,
      x: 320,
      y: 220,
      accessible: false,
    }),
    createSeedNode({
      id: 'NGE-EXIT-MAIN',
      buildingId: BUILDING_ID_NGE,
      floor: 1,
      label: 'NGE Main Ground Exit',
      type: NODE_TYPES.EXIT,
      x: 200,
      y: 340,
      accessible: true,
    }),
    createSeedNode({
      id: 'ASM-QUAD',
      buildingId: null,
      floor: 1,
      label: 'CIT-U Quadrangle Assembly Area',
      type: NODE_TYPES.ASSEMBLY,
      x: 200,
      y: 460,
      accessible: true,
      capacity: 1500,
    }),
  ]),
  mapEdges: Object.freeze([
    createSeedEdge({
      id: 'edge-nge-301-corr',
      fromNodeId: 'NGE-301',
      toNodeId: 'NGE-3F-CORR',
      weight: 8,
      isLift: false,
      isStair: false,
      isAccessible: true,
      isBlocked: false,
      bidirectional: true,
    }),
    createSeedEdge({
      id: 'edge-nge-302-corr',
      fromNodeId: 'NGE-302',
      toNodeId: 'NGE-3F-CORR',
      weight: 8,
      isLift: false,
      isStair: false,
      isAccessible: true,
      isBlocked: false,
      bidirectional: true,
    }),
    createSeedEdge({
      id: 'edge-corr-stair-west',
      fromNodeId: 'NGE-3F-CORR',
      toNodeId: 'NGE-STAIR-WEST',
      weight: 12,
      isLift: false,
      isStair: false,
      isAccessible: true,
      isBlocked: false,
      bidirectional: true,
    }),
    createSeedEdge({
      id: 'edge-corr-stair-east',
      fromNodeId: 'NGE-3F-CORR',
      toNodeId: 'NGE-STAIR-EAST',
      weight: 14,
      isLift: false,
      isStair: false,
      isAccessible: true,
      isBlocked: false,
      bidirectional: true,
    }),
    createSeedEdge({
      id: 'edge-stair-west-exit',
      fromNodeId: 'NGE-STAIR-WEST',
      toNodeId: 'NGE-EXIT-MAIN',
      weight: 28,
      isLift: false,
      isStair: true,
      isAccessible: false,
      isBlocked: false,
      bidirectional: true,
    }),
    createSeedEdge({
      id: 'edge-stair-east-exit',
      fromNodeId: 'NGE-STAIR-EAST',
      toNodeId: 'NGE-EXIT-MAIN',
      weight: 30,
      isLift: false,
      isStair: true,
      isAccessible: false,
      isBlocked: false,
      bidirectional: true,
    }),
    createSeedEdge({
      id: 'edge-exit-asm-quad',
      fromNodeId: 'NGE-EXIT-MAIN',
      toNodeId: 'ASM-QUAD',
      weight: 20,
      isLift: false,
      isStair: false,
      isAccessible: true,
      isBlocked: false,
      bidirectional: true,
    }),
  ]),
});

/**
 * Builds an evacuation adjacency list from valid edges, excluding lift edges
 * (`isLift: true`) and blocked edges (`isBlocked: true`).
 *
 * @param {Array<import('../types/models.js').MapEdge>} edges
 * @param {Set<string>} validNodeIds
 * @returns {Map<string, string[]>}
 */
function buildEvacuationAdjacency(edges, validNodeIds) {
  /** @type {Map<string, string[]>} */
  const adjacency = new Map();

  for (const nodeId of validNodeIds) {
    adjacency.set(nodeId, []);
  }

  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i];
    if (
      !edge ||
      edge.isLift === true ||
      edge.isBlocked === true ||
      typeof edge.weight !== 'number' ||
      !Number.isFinite(edge.weight) ||
      edge.weight <= 0
    ) {
      continue;
    }

    if (!validNodeIds.has(edge.fromNodeId) || !validNodeIds.has(edge.toNodeId)) {
      continue;
    }

    adjacency.get(edge.fromNodeId).push(edge.toNodeId);
    if (edge.bidirectional !== false) {
      adjacency.get(edge.toNodeId).push(edge.fromNodeId);
    }
  }

  return adjacency;
}

/**
 * Runs BFS from `startNodeId` over evacuation-safe edges to determine whether
 * any node in `targetNodeIds` is reachable.
 *
 * @param {Map<string, string[]>} adjacency
 * @param {string} startNodeId
 * @param {Set<string>} targetNodeIds
 * @returns {boolean}
 */
function canReachAnyTarget(adjacency, startNodeId, targetNodeIds) {
  if (!adjacency.has(startNodeId) || targetNodeIds.size === 0) {
    return false;
  }

  const visited = new Set([startNodeId]);
  const queue = [startNodeId];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;

    if (targetNodeIds.has(current)) {
      return true;
    }

    const neighbors = adjacency.get(current) || [];
    for (let i = 0; i < neighbors.length; i += 1) {
      const next = neighbors[i];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

/**
 * Pure validator for campus seed payloads.
 * Verifies campus metadata, unique node IDs, valid node types and QR codes,
 * edge referential integrity and positive weights, and BFS evacuation
 * reachability from every room (including `NGE-301` and `NGE-302`) to an
 * `assembly` node while excluding lift edges.
 *
 * @param {typeof CIT_U_SEED_DATA | Record<string, any>} seedData
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCampusSeed(seedData) {
  /** @type {string[]} */
  const errors = [];

  if (!seedData || typeof seedData !== 'object') {
    return { valid: false, errors: ['Seed data must be an object.'] };
  }

  const campus = seedData.campus;
  const campusId =
    typeof campus?.id === 'string' ? campus.id.trim() : '';

  if (!campusId) {
    errors.push('Campus document must include a non-empty string id.');
  }

  if (typeof campus?.name !== 'string' || !campus.name.trim()) {
    errors.push('Campus document must include a non-empty name.');
  }

  const maxFlashHz = seedData.policy?.maxFlashHz ?? campus?.maxFlashHz;
  if (
    maxFlashHz !== undefined &&
    (typeof maxFlashHz !== 'number' ||
      !Number.isFinite(maxFlashHz) ||
      maxFlashHz <= 0 ||
      maxFlashHz >= 3)
  ) {
    errors.push(
      `Policy maxFlashHz must be a finite number strictly between 0 and 3 (got ${String(maxFlashHz)}).`,
    );
  }

  const mapNodes = Array.isArray(seedData.mapNodes) ? seedData.mapNodes : null;
  const mapEdges = Array.isArray(seedData.mapEdges) ? seedData.mapEdges : null;

  if (!mapNodes || mapNodes.length === 0) {
    errors.push('Seed data must include a non-empty mapNodes array.');
  }

  if (!mapEdges) {
    errors.push('Seed data must include a mapEdges array.');
  }

  /** @type {Set<string>} */
  const nodeIds = new Set();
  /** @type {Set<string>} */
  const assemblyNodeIds = new Set();
  /** @type {string[]} */
  const roomNodeIds = [];

  if (mapNodes) {
    for (let i = 0; i < mapNodes.length; i += 1) {
      const node = mapNodes[i];
      if (!node || typeof node !== 'object') {
        errors.push(`mapNodes[${i}] must be an object.`);
        continue;
      }

      const id = typeof node.id === 'string' ? node.id.trim() : '';
      if (!id) {
        errors.push(`mapNodes[${i}] is missing a valid string id.`);
        continue;
      }

      if (nodeIds.has(id)) {
        errors.push(`Duplicate node id "${id}".`);
      } else {
        nodeIds.add(id);
      }

      const nodeType = typeof node.type === 'string' ? node.type.trim() : '';
      if (!ALLOWED_NODE_TYPES_SET.has(nodeType)) {
        errors.push(
          `Node "${id}" has invalid type "${String(node.type)}". Allowed types: ${ALLOWED_NODE_TYPES.join(', ')}.`,
        );
      } else {
        if (nodeType === NODE_TYPES.ASSEMBLY) {
          assemblyNodeIds.add(id);
        }
        if (nodeType === NODE_TYPES.ROOM) {
          roomNodeIds.push(id);
        }
      }

      if (typeof node.qrCode !== 'string' || !node.qrCode.trim()) {
        errors.push(`Node "${id}" is missing a qrCode payload.`);
      } else if (campusId) {
        const parsedQr = parseQrPayload(node.qrCode, {
          expectedCampusId: campusId,
        });
        if (!parsedQr.valid) {
          errors.push(`Node "${id}" has invalid qrCode: ${parsedQr.error}`);
        } else if (parsedQr.nodeId !== id || parsedQr.nodeType !== nodeType) {
          errors.push(
            `Node "${id}" qrCode metadata does not match node id/type.`,
          );
        }
      }
    }
  }

  if (assemblyNodeIds.size === 0) {
    errors.push('Seed data must include at least one assembly node.');
  }

  /** @type {Set<string>} */
  const edgeIds = new Set();

  if (mapEdges) {
    for (let i = 0; i < mapEdges.length; i += 1) {
      const edge = mapEdges[i];
      if (!edge || typeof edge !== 'object') {
        errors.push(`mapEdges[${i}] must be an object.`);
        continue;
      }

      const edgeId = typeof edge.id === 'string' ? edge.id.trim() : '';
      if (!edgeId) {
        errors.push(`mapEdges[${i}] is missing a valid string id.`);
      } else if (edgeIds.has(edgeId)) {
        errors.push(`Duplicate edge id "${edgeId}".`);
      } else {
        edgeIds.add(edgeId);
      }

      if (!nodeIds.has(edge.fromNodeId)) {
        errors.push(
          `Edge "${edgeId || i}" references unknown fromNodeId "${String(edge.fromNodeId)}".`,
        );
      }

      if (!nodeIds.has(edge.toNodeId)) {
        errors.push(
          `Edge "${edgeId || i}" references unknown toNodeId "${String(edge.toNodeId)}".`,
        );
      }

      if (
        typeof edge.weight !== 'number' ||
        !Number.isFinite(edge.weight) ||
        edge.weight <= 0
      ) {
        errors.push(
          `Edge "${edgeId || i}" must have a positive finite weight (got ${String(edge.weight)}).`,
        );
      }
    }
  }

  if (mapNodes && mapEdges && assemblyNodeIds.size > 0) {
    const adjacency = buildEvacuationAdjacency(mapEdges, nodeIds);
    const roomsToVerify = new Set(roomNodeIds);

    for (const requiredRoom of ['NGE-301', 'NGE-302']) {
      if (nodeIds.has(requiredRoom)) {
        roomsToVerify.add(requiredRoom);
      }
    }

    for (const roomId of roomsToVerify) {
      if (!canReachAnyTarget(adjacency, roomId, assemblyNodeIds)) {
        errors.push(
          `Room "${roomId}" has no evacuation path to any assembly node.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates and idempotently seeds the `cit-u` campus document, default policy,
 * NGE building, indoor map nodes, and evacuation edges to Cloud Firestore using
 * a single `writeBatch` with `{ merge: true }` and deterministic IDs.
 *
 * @returns {Promise<{ campusId: string, nodesSeeded: number, edgesSeeded: number }>}
 */
export async function seedCitUCampusToFirestore() {
  const validation = validateCampusSeed(CIT_U_SEED_DATA);
  if (!validation.valid) {
    throw new Error(
      `Invalid CIT-U campus seed data: ${validation.errors.join(' ')}`,
    );
  }

  const { campus, policy, buildings, mapNodes, mapEdges } = CIT_U_SEED_DATA;
  const campusId = campus.id;
  const batch = writeBatch(db);

  batch.set(
    doc(db, 'campuses', campusId),
    {
      ...campus,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    doc(db, 'campuses', campusId, 'policy', policy.id),
    {
      ...policy,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  for (let i = 0; i < buildings.length; i += 1) {
    const building = buildings[i];
    batch.set(
      doc(db, 'campuses', campusId, 'buildings', building.id),
      {
        ...building,
        floors: [...building.floors],
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  for (let i = 0; i < mapNodes.length; i += 1) {
    const node = mapNodes[i];
    batch.set(
      doc(db, 'campuses', campusId, 'mapNodes', node.id),
      { ...node },
      { merge: true },
    );
  }

  for (let i = 0; i < mapEdges.length; i += 1) {
    const edge = mapEdges[i];
    batch.set(
      doc(db, 'campuses', campusId, 'mapEdges', edge.id),
      { ...edge },
      { merge: true },
    );
  }

  await batch.commit();

  return {
    campusId,
    nodesSeeded: mapNodes.length,
    edgesSeeded: mapEdges.length,
  };
}

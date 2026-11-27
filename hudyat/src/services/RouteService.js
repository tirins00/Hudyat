import { NODE_TYPES } from '../types/models.js';

/**
 * Default walking speed multiplier in graph weight units per second.
 * CIT-U seed edge weights roughly correspond to meters/seconds.
 */
export const DEFAULT_UNITS_PER_SECOND = 1;

/**
 * @typedef {import('../types/models.js').MapNode} MapNode
 * @typedef {import('../types/models.js').MapEdge} MapEdge
 */

/**
 * @typedef {Object} RouteStep
 * @property {number} stepNumber
 * @property {string} nodeId
 * @property {string} label
 * @property {string} nodeType
 * @property {number} floor
 * @property {string | null} buildingId
 * @property {string | null} edgeId
 * @property {number} weight
 * @property {boolean} isStair
 * @property {string} instruction
 */

/**
 * @typedef {Object} EvacuationRouteResult
 * @property {boolean} reachable
 * @property {string} startNodeId
 * @property {string | null} targetNodeId
 * @property {MapNode | null} targetNode
 * @property {number} totalWeight
 * @property {number | null} estimatedSeconds
 * @property {string[]} nodeIds
 * @property {MapNode[]} nodes
 * @property {string[]} edgeIds
 * @property {MapEdge[]} edges
 * @property {number[]} floorsTraversed
 * @property {boolean} usesStairs
 * @property {boolean} accessibleOnly
 * @property {RouteStep[]} steps
 * @property {number} excludedLiftEdgeCount
 * @property {string} reason
 */

/**
 * Converts an optional iterable or array of IDs into a Set of trimmed strings.
 * @param {Iterable<string> | null | undefined} ids
 * @returns {Set<string>}
 */
function toIdSet(ids) {
  /** @type {Set<string>} */
  const set = new Set();
  if (!ids) {
    return set;
  }
  for (const id of ids) {
    if (typeof id === 'string') {
      const trimmed = id.trim();
      if (trimmed) {
        set.add(trimmed);
      }
    }
  }
  return set;
}

/**
 * Returns true if a node cannot be traversed during evacuation.
 * Lift nodes are always excluded as traversal destinations; inaccessible/stair
 * nodes are excluded when `accessibleOnly` is enabled.
 *
 * @param {MapNode} node
 * @param {Set<string>} blockedNodes
 * @param {boolean} accessibleOnly
 * @returns {boolean}
 */
function isNodeForbiddenForTraversal(node, blockedNodes, accessibleOnly) {
  if (!node || !node.id) {
    return true;
  }
  if (blockedNodes.has(node.id)) {
    return true;
  }
  if (node.type === NODE_TYPES.LIFT) {
    return true;
  }
  if (accessibleOnly) {
    if (node.type === NODE_TYPES.STAIR || node.accessible === false) {
      return true;
    }
  }
  return false;
}

/**
 * Builds an evacuation-safe adjacency graph from campus `mapNodes` and `mapEdges`.
 *
 * Invariants enforced:
 * - Lift edges (`isLift: true`) are ALWAYS excluded.
 * - Blocked edges (`edge.isBlocked === true` or listed in `blockedEdgeIds`) are excluded.
 * - Non-positive or non-finite edge weights are excluded.
 * - Lift nodes (`type === 'lift'`) and `blockedNodeIds` cannot be entered.
 * - When `accessibleOnly` is true, stair edges (`isStair: true`), inaccessible
 *   edges (`isAccessible === false`), and stair/inaccessible nodes are excluded.
 *
 * @param {Object} params
 * @param {MapNode[]} params.mapNodes
 * @param {MapEdge[]} params.mapEdges
 * @param {Iterable<string>} [params.blockedNodeIds]
 * @param {Iterable<string>} [params.blockedEdgeIds]
 * @param {boolean} [params.accessibleOnly=false]
 * @returns {{
 *   nodesById: Map<string, MapNode>,
 *   adjacency: Map<string, Array<{ toNodeId: string, weight: number, edge: MapEdge }>>,
 *   excludedLiftEdgeCount: number,
 *   blockedNodes: Set<string>,
 *   blockedEdges: Set<string>,
 * }}
 */
export function buildEvacuationGraph({
  mapNodes = [],
  mapEdges = [],
  blockedNodeIds,
  blockedEdgeIds,
  accessibleOnly = false,
} = {}) {
  const blockedNodes = toIdSet(blockedNodeIds);
  const blockedEdges = toIdSet(blockedEdgeIds);

  /** @type {Map<string, MapNode>} */
  const nodesById = new Map();
  /** @type {Map<string, Array<{ toNodeId: string, weight: number, edge: MapEdge }>>} */
  const adjacency = new Map();

  for (let i = 0; i < mapNodes.length; i += 1) {
    const node = mapNodes[i];
    if (!node || typeof node.id !== 'string' || !node.id.trim()) {
      continue;
    }
    const id = node.id.trim();
    nodesById.set(id, node);
    adjacency.set(id, []);
  }

  let excludedLiftEdgeCount = 0;

  for (let i = 0; i < mapEdges.length; i += 1) {
    const edge = mapEdges[i];
    if (!edge || typeof edge !== 'object') {
      continue;
    }

    // Hard safety invariant: lift edges are NEVER included in evacuation routing.
    if (edge.isLift === true) {
      excludedLiftEdgeCount += 1;
      continue;
    }

    if (edge.isBlocked === true || (edge.id && blockedEdges.has(edge.id))) {
      continue;
    }

    if (
      typeof edge.weight !== 'number' ||
      !Number.isFinite(edge.weight) ||
      edge.weight <= 0
    ) {
      continue;
    }

    if (accessibleOnly) {
      if (edge.isStair === true || edge.isAccessible === false) {
        continue;
      }
    }

    const fromNode = nodesById.get(edge.fromNodeId);
    const toNode = nodesById.get(edge.toNodeId);
    if (!fromNode || !toNode) {
      continue;
    }

    if (fromNode.id === toNode.id) {
      continue;
    }

    // Never allow entering a blocked or forbidden node.
    // Note: if the origin is not blocked, allow stepping out of it even if
    // someone somehow started near a lift lobby, while never entering a lift.
    if (
      !blockedNodes.has(fromNode.id) &&
      !isNodeForbiddenForTraversal(toNode, blockedNodes, accessibleOnly)
    ) {
      adjacency.get(fromNode.id).push({
        toNodeId: toNode.id,
        weight: edge.weight,
        edge,
      });
    }

    if (edge.bidirectional !== false) {
      if (
        !blockedNodes.has(toNode.id) &&
        !isNodeForbiddenForTraversal(fromNode, blockedNodes, accessibleOnly)
      ) {
        adjacency.get(toNode.id).push({
          toNodeId: fromNode.id,
          weight: edge.weight,
          edge,
        });
      }
    }
  }

  // Deterministic ordering for tie-breaking across engines/runs.
  for (const neighbors of adjacency.values()) {
    neighbors.sort((a, b) => {
      const nodeCompare = a.toNodeId.localeCompare(b.toNodeId);
      if (nodeCompare !== 0) {
        return nodeCompare;
      }
      return String(a.edge.id || '').localeCompare(String(b.edge.id || ''));
    });
  }

  return {
    nodesById,
    adjacency,
    excludedLiftEdgeCount,
    blockedNodes,
    blockedEdges,
  };
}

/**
 * Formats a floor label for human-readable route directions.
 * @param {MapNode} node
 * @returns {string}
 */
function formatFloorContext(node) {
  if (!node) {
    return '';
  }
  if (node.type === NODE_TYPES.ASSEMBLY && !node.buildingId) {
    return 'Campus Grounds';
  }
  if (typeof node.floor === 'number' && Number.isFinite(node.floor)) {
    return `Floor ${node.floor}`;
  }
  return '';
}

/**
 * Converts a sequence of nodes and traversed edges into accessible,
 * step-by-step evacuation instructions.
 *
 * @param {MapNode[]} nodes
 * @param {MapEdge[]} edges
 * @returns {RouteStep[]}
 */
export function formatRouteSteps(nodes = [], edges = []) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return [];
  }

  /** @type {RouteStep[]} */
  const steps = [];
  const start = nodes[0];
  const startFloor = formatFloorContext(start);

  steps.push({
    stepNumber: 1,
    nodeId: start.id,
    label: start.label || start.id,
    nodeType: start.type,
    floor: start.floor,
    buildingId: start.buildingId ?? null,
    edgeId: null,
    weight: 0,
    isStair: false,
    instruction:
      nodes.length === 1 && start.type === NODE_TYPES.ASSEMBLY
        ? `You are already at ${start.label || start.id}. Proceed directly to assembly check-in.`
        : `Start at ${start.label || start.id}${startFloor ? ` (${startFloor})` : ''}.`,
  });

  for (let i = 1; i < nodes.length; i += 1) {
    const prev = nodes[i - 1];
    const current = nodes[i];
    const edge = edges[i - 1] || null;
    const label = current.label || current.id;
    const currentFloor = formatFloorContext(current);
    const isStairMove =
      Boolean(edge?.isStair) || current.type === NODE_TYPES.STAIR;

    let instruction;
    if (current.type === NODE_TYPES.ASSEMBLY) {
      instruction = `Proceed to ${label} and complete your assembly check-in.`;
    } else if (current.type === NODE_TYPES.EXIT) {
      if (
        edge?.isStair &&
        typeof prev.floor === 'number' &&
        typeof current.floor === 'number' &&
        prev.floor !== current.floor
      ) {
        const direction = current.floor < prev.floor ? 'down' : 'up';
        instruction = `Take stairs ${direction} to Floor ${current.floor} and exit via ${label}.`;
      } else {
        instruction = `Exit building through ${label}${currentFloor ? ` (${currentFloor})` : ''}.`;
      }
    } else if (isStairMove) {
      if (
        typeof prev.floor === 'number' &&
        typeof current.floor === 'number' &&
        prev.floor !== current.floor
      ) {
        const direction = current.floor < prev.floor ? 'down' : 'up';
        instruction = `Use ${label} to go ${direction} from Floor ${prev.floor} to Floor ${current.floor}.`;
      } else {
        instruction = `Head to ${label} (stairs — do not use elevators).`;
      }
    } else {
      instruction = `Continue to ${label}${currentFloor ? ` (${currentFloor})` : ''}.`;
    }

    steps.push({
      stepNumber: i + 1,
      nodeId: current.id,
      label,
      nodeType: current.type,
      floor: current.floor,
      buildingId: current.buildingId ?? null,
      edgeId: edge?.id ?? null,
      weight: edge?.weight ?? 0,
      isStair: isStairMove,
      instruction,
    });
  }

  return steps;
}

/**
 * Computes the shortest safe evacuation route using Dijkstra's algorithm.
 *
 * - Always excludes lift edges (`isLift: true`) and lift nodes (`type: 'lift'`).
 * - Respects `blockedNodeIds`, `blockedEdgeIds`, and `edge.isBlocked`.
 * - If `targetNodeId` and `targetNodeIds` are omitted, automatically routes to
 *   the nearest reachable `assembly` node.
 *
 * @param {Object} params
 * @param {MapNode[]} params.mapNodes
 * @param {MapEdge[]} params.mapEdges
 * @param {string} params.startNodeId
 * @param {string} [params.targetNodeId]
 * @param {string[]} [params.targetNodeIds]
 * @param {Iterable<string>} [params.blockedNodeIds]
 * @param {Iterable<string>} [params.blockedEdgeIds]
 * @param {boolean} [params.accessibleOnly=false]
 * @param {number} [params.unitsPerSecond=DEFAULT_UNITS_PER_SECOND]
 * @returns {EvacuationRouteResult}
 */
export function findEvacuationRoute({
  mapNodes = [],
  mapEdges = [],
  startNodeId,
  targetNodeId,
  targetNodeIds,
  blockedNodeIds,
  blockedEdgeIds,
  accessibleOnly = false,
  unitsPerSecond = DEFAULT_UNITS_PER_SECOND,
} = {}) {
  const normalizedStartId =
    typeof startNodeId === 'string' ? startNodeId.trim() : '';

  const { nodesById, adjacency, excludedLiftEdgeCount, blockedNodes } =
    buildEvacuationGraph({
      mapNodes,
      mapEdges,
      blockedNodeIds,
      blockedEdgeIds,
      accessibleOnly,
    });

  /**
   * Helper to construct an unreachable result with consistent shape.
   * @param {string} reason
   * @returns {EvacuationRouteResult}
   */
  const unreachable = (reason) => ({
    reachable: false,
    startNodeId: normalizedStartId,
    targetNodeId: targetNodeId ? targetNodeId.trim() : null,
    targetNode: null,
    totalWeight: Number.POSITIVE_INFINITY,
    estimatedSeconds: null,
    nodeIds: [],
    nodes: [],
    edgeIds: [],
    edges: [],
    floorsTraversed: [],
    usesStairs: false,
    accessibleOnly: Boolean(accessibleOnly),
    steps: [],
    excludedLiftEdgeCount,
    reason,
  });

  if (!normalizedStartId || !nodesById.has(normalizedStartId)) {
    return unreachable(
      `Start location "${normalizedStartId || '(none)'}" was not found on this campus map.`,
    );
  }

  if (blockedNodes.has(normalizedStartId)) {
    return unreachable(
      `Starting location "${nodesById.get(normalizedStartId).label || normalizedStartId}" is currently marked blocked.`,
    );
  }

  // Determine candidate destination nodes.
  /** @type {Set<string>} */
  const candidateTargets = new Set();
  if (typeof targetNodeId === 'string' && targetNodeId.trim()) {
    const trimmedTarget = targetNodeId.trim();
    if (!nodesById.has(trimmedTarget)) {
      return unreachable(
        `Destination "${trimmedTarget}" was not found on this campus map.`,
      );
    }
    candidateTargets.add(trimmedTarget);
  } else if (Array.isArray(targetNodeIds) && targetNodeIds.length > 0) {
    for (let i = 0; i < targetNodeIds.length; i += 1) {
      const id =
        typeof targetNodeIds[i] === 'string' ? targetNodeIds[i].trim() : '';
      if (id && nodesById.has(id)) {
        candidateTargets.add(id);
      }
    }
  } else {
    for (const [id, node] of nodesById.entries()) {
      if (node.type === NODE_TYPES.ASSEMBLY) {
        candidateTargets.add(id);
      }
    }
  }

  if (candidateTargets.size === 0) {
    return unreachable(
      'No assembly area destination is configured on this campus map.',
    );
  }

  /** @type {Set<string>} */
  const validTargets = new Set();
  for (const candidateId of candidateTargets) {
    const node = nodesById.get(candidateId);
    if (
      node &&
      !isNodeForbiddenForTraversal(node, blockedNodes, accessibleOnly)
    ) {
      validTargets.add(candidateId);
    }
  }

  if (validTargets.size === 0) {
    return unreachable(
      accessibleOnly
        ? 'No accessible assembly destination is currently unblocked.'
        : 'All candidate destinations are currently blocked or unavailable.',
    );
  }

  // Standard Dijkstra with deterministic tie-breaking.
  /** @type {Map<string, number>} */
  const distances = new Map();
  /** @type {Map<string, { prevNodeId: string, edge: MapEdge }>} */
  const previous = new Map();
  /** @type {Set<string>} */
  const visited = new Set();

  for (const id of nodesById.keys()) {
    distances.set(id, Number.POSITIVE_INFINITY);
  }
  distances.set(normalizedStartId, 0);

  while (visited.size < nodesById.size) {
    let currentId = null;
    let smallestDist = Number.POSITIVE_INFINITY;

    for (const [nodeId, dist] of distances.entries()) {
      if (visited.has(nodeId)) {
        continue;
      }
      if (
        dist < smallestDist ||
        (dist === smallestDist &&
          dist < Number.POSITIVE_INFINITY &&
          currentId !== null &&
          nodeId.localeCompare(currentId) < 0)
      ) {
        smallestDist = dist;
        currentId = nodeId;
      }
    }

    if (currentId === null || smallestDist === Number.POSITIVE_INFINITY) {
      break;
    }

    visited.add(currentId);

    const neighbors = adjacency.get(currentId) || [];
    for (let i = 0; i < neighbors.length; i += 1) {
      const { toNodeId, weight, edge } = neighbors[i];
      if (visited.has(toNodeId)) {
        continue;
      }
      const candidateDist = smallestDist + weight;
      const existingDist = distances.get(toNodeId);
      if (candidateDist < existingDist) {
        distances.set(toNodeId, candidateDist);
        previous.set(toNodeId, { prevNodeId: currentId, edge });
      }
    }
  }

  // Select the closest reachable target node (deterministic tie-break by ID).
  let bestTargetId = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidateId of validTargets) {
    const dist = distances.get(candidateId);
    if (
      dist < bestDistance ||
      (dist === bestDistance &&
        dist < Number.POSITIVE_INFINITY &&
        bestTargetId !== null &&
        candidateId.localeCompare(bestTargetId) < 0)
    ) {
      bestDistance = dist;
      bestTargetId = candidateId;
    }
  }

  if (bestTargetId === null || bestDistance === Number.POSITIVE_INFINITY) {
    return unreachable(
      accessibleOnly
        ? 'No step-free accessible evacuation route is available from this location. Request assistance via SOS.'
        : 'No unblocked evacuation route is available from this location. Avoid hazards and trigger SOS for assistance.',
    );
  }

  // Reconstruct path from bestTargetId back to startNodeId.
  /** @type {string[]} */
  const nodeIds = [];
  /** @type {MapEdge[]} */
  const edges = [];

  let cursor = bestTargetId;
  while (cursor !== normalizedStartId) {
    nodeIds.push(cursor);
    const step = previous.get(cursor);
    if (!step) {
      break;
    }
    edges.push(step.edge);
    cursor = step.prevNodeId;
  }
  nodeIds.push(normalizedStartId);
  nodeIds.reverse();
  edges.reverse();

  const nodes = nodeIds.map((id) => nodesById.get(id));
  const edgeIds = edges.map((edge) => edge.id);

  /** @type {number[]} */
  const floorsTraversed = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const floor = nodes[i]?.floor;
    if (
      typeof floor === 'number' &&
      Number.isFinite(floor) &&
      floorsTraversed[floorsTraversed.length - 1] !== floor
    ) {
      floorsTraversed.push(floor);
    }
  }

  const usesStairs =
    edges.some((edge) => edge.isStair === true) ||
    nodes.some((node) => node.type === NODE_TYPES.STAIR);

  const safeSpeed =
    typeof unitsPerSecond === 'number' &&
    Number.isFinite(unitsPerSecond) &&
    unitsPerSecond > 0
      ? unitsPerSecond
      : DEFAULT_UNITS_PER_SECOND;

  const totalWeight = Math.round(bestDistance * 100) / 100;
  const estimatedSeconds = Math.round(totalWeight / safeSpeed);

  return {
    reachable: true,
    startNodeId: normalizedStartId,
    targetNodeId: bestTargetId,
    targetNode: nodesById.get(bestTargetId),
    totalWeight,
    estimatedSeconds,
    nodeIds,
    nodes,
    edgeIds,
    edges,
    floorsTraversed,
    usesStairs,
    accessibleOnly: Boolean(accessibleOnly),
    steps: formatRouteSteps(nodes, edges),
    excludedLiftEdgeCount,
    reason: '',
  };
}

/**
 * Audits evacuation reachability from every room node in a campus graph
 * to the nearest assembly area (always excluding lift edges).
 *
 * @param {Object} params
 * @param {MapNode[]} params.mapNodes
 * @param {MapEdge[]} params.mapEdges
 * @param {Iterable<string>} [params.blockedNodeIds]
 * @param {Iterable<string>} [params.blockedEdgeIds]
 * @param {boolean} [params.accessibleOnly=false]
 * @returns {{
 *   totalRooms: number,
 *   reachableRooms: number,
 *   unreachableRoomIds: string[],
 *   routesByRoomId: Record<string, EvacuationRouteResult>,
 *   excludedLiftEdgeCount: number,
 * }}
 */
export function auditCampusRoutes({
  mapNodes = [],
  mapEdges = [],
  blockedNodeIds,
  blockedEdgeIds,
  accessibleOnly = false,
} = {}) {
  const roomNodes = mapNodes.filter(
    (node) => node && node.type === NODE_TYPES.ROOM && node.id,
  );

  /** @type {Record<string, EvacuationRouteResult>} */
  const routesByRoomId = {};
  /** @type {string[]} */
  const unreachableRoomIds = [];
  let reachableRooms = 0;
  let excludedLiftEdgeCount = mapEdges.filter(
    (edge) => edge && edge.isLift === true,
  ).length;

  for (let i = 0; i < roomNodes.length; i += 1) {
    const room = roomNodes[i];
    const route = findEvacuationRoute({
      mapNodes,
      mapEdges,
      startNodeId: room.id,
      blockedNodeIds,
      blockedEdgeIds,
      accessibleOnly,
    });
    routesByRoomId[room.id] = route;
    excludedLiftEdgeCount = route.excludedLiftEdgeCount;

    if (route.reachable) {
      reachableRooms += 1;
    } else {
      unreachableRoomIds.push(room.id);
    }
  }

  return {
    totalRooms: roomNodes.length,
    reachableRooms,
    unreachableRoomIds,
    routesByRoomId,
    excludedLiftEdgeCount,
  };
}

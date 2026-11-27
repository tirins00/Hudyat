import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/firebase/config.js', () => ({
  app: {},
  auth: {},
  db: {},
}));

import { NODE_TYPES } from '../src/types/models.js';
import { CIT_U_SEED_DATA } from '../src/services/CampusSeeder.js';
import {
  auditCampusRoutes,
  findEvacuationRoute,
  formatRouteSteps,
} from '../src/services/RouteService.js';

describe('RouteService (Dijkstra Evacuation Routing)', () => {
  it('computes the shortest evacuation route on CIT_U_SEED_DATA from NGE-301 to ASM-QUAD', () => {
    const result = findEvacuationRoute({
      mapNodes: CIT_U_SEED_DATA.mapNodes,
      mapEdges: CIT_U_SEED_DATA.mapEdges,
      startNodeId: 'NGE-301',
    });

    expect(result.reachable).toBe(true);
    expect(result.targetNodeId).toBe('ASM-QUAD');
    // West stairwell: 8 + 12 + 28 + 20 = 68 (beats East stairwell: 8 + 14 + 30 + 20 = 72)
    expect(result.totalWeight).toBe(68);
    expect(result.nodeIds).toEqual([
      'NGE-301',
      'NGE-3F-CORR',
      'NGE-STAIR-WEST',
      'NGE-EXIT-MAIN',
      'ASM-QUAD',
    ]);
    expect(result.usesStairs).toBe(true);
    expect(result.floorsTraversed).toEqual([3, 1]);
    expect(result.steps).toHaveLength(5);
    expect(result.steps[0].instruction).toContain('NGE 301');
    expect(result.steps[4].instruction).toContain(
      'CIT-U Quadrangle Assembly Area',
    );
  });

  it('ALWAYS excludes lift edges (isLift: true) even when a lift shortcut is much shorter', () => {
    const nodesWithLift = [
      ...CIT_U_SEED_DATA.mapNodes,
      {
        id: 'NGE-LIFT-1',
        campusId: 'cit-u',
        buildingId: 'NGE',
        floor: 3,
        label: 'NGE Main Elevator',
        type: NODE_TYPES.LIFT,
        x: 200,
        y: 240,
        accessible: true,
      },
    ];

    const edgesWithLiftShortcut = [
      ...CIT_U_SEED_DATA.mapEdges,
      // Ultra-short lift shortcut directly from 3F corridor to ground exit (weight 1!)
      {
        id: 'edge-corr-lift-direct',
        campusId: 'cit-u',
        fromNodeId: 'NGE-3F-CORR',
        toNodeId: 'NGE-EXIT-MAIN',
        weight: 1,
        isLift: true,
        isStair: false,
        isAccessible: true,
        isBlocked: false,
        bidirectional: true,
      },
      // Another lift path going through a lift node with isLift: false accidentally
      {
        id: 'edge-corr-to-lift-node',
        campusId: 'cit-u',
        fromNodeId: 'NGE-3F-CORR',
        toNodeId: 'NGE-LIFT-1',
        weight: 1,
        isLift: false,
        isStair: false,
        isAccessible: true,
        isBlocked: false,
        bidirectional: true,
      },
      {
        id: 'edge-lift-node-to-exit',
        campusId: 'cit-u',
        fromNodeId: 'NGE-LIFT-1',
        toNodeId: 'NGE-EXIT-MAIN',
        weight: 1,
        isLift: false,
        isStair: false,
        isAccessible: true,
        isBlocked: false,
        bidirectional: true,
      },
    ];

    const result = findEvacuationRoute({
      mapNodes: nodesWithLift,
      mapEdges: edgesWithLiftShortcut,
      startNodeId: 'NGE-301',
    });

    expect(result.reachable).toBe(true);
    expect(result.excludedLiftEdgeCount).toBe(1);
    expect(result.nodeIds).not.toContain('NGE-LIFT-1');
    expect(result.edgeIds).not.toContain('edge-corr-lift-direct');
    expect(result.totalWeight).toBe(68);
  });

  it('reroutes via NGE East Stairwell when NGE West Stairwell is blocked', () => {
    const result = findEvacuationRoute({
      mapNodes: CIT_U_SEED_DATA.mapNodes,
      mapEdges: CIT_U_SEED_DATA.mapEdges,
      startNodeId: 'NGE-301',
      blockedNodeIds: ['NGE-STAIR-WEST'],
    });

    expect(result.reachable).toBe(true);
    expect(result.nodeIds).toEqual([
      'NGE-301',
      'NGE-3F-CORR',
      'NGE-STAIR-EAST',
      'NGE-EXIT-MAIN',
      'ASM-QUAD',
    ]);
    expect(result.totalWeight).toBe(72);
  });

  it('reroutes when specific edge IDs are blocked', () => {
    const result = findEvacuationRoute({
      mapNodes: CIT_U_SEED_DATA.mapNodes,
      mapEdges: CIT_U_SEED_DATA.mapEdges,
      startNodeId: 'NGE-302',
      blockedEdgeIds: ['edge-stair-west-exit'],
    });

    expect(result.reachable).toBe(true);
    expect(result.nodeIds).toContain('NGE-STAIR-EAST');
    expect(result.nodeIds).not.toContain('NGE-STAIR-WEST');
    expect(result.totalWeight).toBe(72);
  });

  it('returns unreachable gracefully when all exits are blocked', () => {
    const result = findEvacuationRoute({
      mapNodes: CIT_U_SEED_DATA.mapNodes,
      mapEdges: CIT_U_SEED_DATA.mapEdges,
      startNodeId: 'NGE-301',
      blockedNodeIds: ['NGE-EXIT-MAIN'],
    });

    expect(result.reachable).toBe(false);
    expect(result.nodeIds).toEqual([]);
    expect(result.reason).toMatch(/no unblocked evacuation route/i);
  });

  it('selects the nearest assembly area when multiple assembly nodes exist', () => {
    const nodes = [
      ...CIT_U_SEED_DATA.mapNodes,
      {
        id: 'ASM-NORTH',
        campusId: 'cit-u',
        buildingId: null,
        floor: 1,
        label: 'North Field Assembly',
        type: NODE_TYPES.ASSEMBLY,
        x: 340,
        y: 440,
        accessible: true,
      },
    ];
    const edges = [
      ...CIT_U_SEED_DATA.mapEdges,
      {
        id: 'edge-exit-asm-north',
        campusId: 'cit-u',
        fromNodeId: 'NGE-EXIT-MAIN',
        toNodeId: 'ASM-NORTH',
        weight: 10,
        isLift: false,
        isStair: false,
        isAccessible: true,
        isBlocked: false,
        bidirectional: true,
      },
    ];

    const nearest = findEvacuationRoute({
      mapNodes: nodes,
      mapEdges: edges,
      startNodeId: 'NGE-301',
    });
    expect(nearest.reachable).toBe(true);
    expect(nearest.targetNodeId).toBe('ASM-NORTH');
    expect(nearest.totalWeight).toBe(58);

    const specific = findEvacuationRoute({
      mapNodes: nodes,
      mapEdges: edges,
      startNodeId: 'NGE-301',
      targetNodeId: 'ASM-QUAD',
    });
    expect(specific.reachable).toBe(true);
    expect(specific.targetNodeId).toBe('ASM-QUAD');
    expect(specific.totalWeight).toBe(68);
  });

  it('enforces step-free accessibleOnly routing by excluding stairs and using ramps', () => {
    const nodes = [
      {
        id: 'RM-101',
        campusId: 'cit-u',
        buildingId: 'NGE',
        floor: 2,
        label: 'Room 201',
        type: NODE_TYPES.ROOM,
        x: 100,
        y: 100,
        accessible: true,
      },
      {
        id: 'STAIR-A',
        campusId: 'cit-u',
        buildingId: 'NGE',
        floor: 2,
        label: 'Main Stairs',
        type: NODE_TYPES.STAIR,
        x: 200,
        y: 150,
        accessible: false,
      },
      {
        id: 'RAMP-A',
        campusId: 'cit-u',
        buildingId: 'NGE',
        floor: 2,
        label: 'Accessible Ramp',
        type: NODE_TYPES.CORRIDOR,
        x: 100,
        y: 250,
        accessible: true,
      },
      {
        id: 'ASM-1',
        campusId: 'cit-u',
        buildingId: null,
        floor: 1,
        label: 'Quad Assembly',
        type: NODE_TYPES.ASSEMBLY,
        x: 200,
        y: 350,
        accessible: true,
      },
    ];

    const edges = [
      {
        id: 'e1',
        fromNodeId: 'RM-101',
        toNodeId: 'STAIR-A',
        weight: 5,
        isLift: false,
        isStair: true,
        isAccessible: false,
        bidirectional: true,
      },
      {
        id: 'e2',
        fromNodeId: 'STAIR-A',
        toNodeId: 'ASM-1',
        weight: 5,
        isLift: false,
        isStair: true,
        isAccessible: false,
        bidirectional: true,
      },
      {
        id: 'e3',
        fromNodeId: 'RM-101',
        toNodeId: 'RAMP-A',
        weight: 15,
        isLift: false,
        isStair: false,
        isAccessible: true,
        bidirectional: true,
      },
      {
        id: 'e4',
        fromNodeId: 'RAMP-A',
        toNodeId: 'ASM-1',
        weight: 20,
        isLift: false,
        isStair: false,
        isAccessible: true,
        bidirectional: true,
      },
    ];

    const standard = findEvacuationRoute({
      mapNodes: nodes,
      mapEdges: edges,
      startNodeId: 'RM-101',
    });
    expect(standard.totalWeight).toBe(10);
    expect(standard.nodeIds).toEqual(['RM-101', 'STAIR-A', 'ASM-1']);

    const accessible = findEvacuationRoute({
      mapNodes: nodes,
      mapEdges: edges,
      startNodeId: 'RM-101',
      accessibleOnly: true,
    });
    expect(accessible.reachable).toBe(true);
    expect(accessible.usesStairs).toBe(false);
    expect(accessible.totalWeight).toBe(35);
    expect(accessible.nodeIds).toEqual(['RM-101', 'RAMP-A', 'ASM-1']);
  });

  it('respects unidirectional (bidirectional: false) edges', () => {
    const nodes = [
      { id: 'A', label: 'A', type: NODE_TYPES.ROOM, floor: 1, x: 0, y: 0 },
      { id: 'B', label: 'B', type: NODE_TYPES.ASSEMBLY, floor: 1, x: 100, y: 0 },
    ];
    const edges = [
      {
        id: 'e-b-to-a',
        fromNodeId: 'B',
        toNodeId: 'A',
        weight: 10,
        isLift: false,
        bidirectional: false,
      },
    ];

    const result = findEvacuationRoute({
      mapNodes: nodes,
      mapEdges: edges,
      startNodeId: 'A',
    });
    expect(result.reachable).toBe(false);
  });

  it('handles already being at an assembly node with distance 0', () => {
    const result = findEvacuationRoute({
      mapNodes: CIT_U_SEED_DATA.mapNodes,
      mapEdges: CIT_U_SEED_DATA.mapEdges,
      startNodeId: 'ASM-QUAD',
    });

    expect(result.reachable).toBe(true);
    expect(result.totalWeight).toBe(0);
    expect(result.nodeIds).toEqual(['ASM-QUAD']);
    expect(result.steps[0].instruction).toMatch(/already at/i);
  });

  it('audits all campus rooms via auditCampusRoutes', () => {
    const audit = auditCampusRoutes({
      mapNodes: CIT_U_SEED_DATA.mapNodes,
      mapEdges: CIT_U_SEED_DATA.mapEdges,
    });

    expect(audit.totalRooms).toBe(2);
    expect(audit.reachableRooms).toBe(2);
    expect(audit.unreachableRoomIds).toEqual([]);
    expect(audit.routesByRoomId['NGE-301'].totalWeight).toBe(68);
    expect(audit.routesByRoomId['NGE-302'].totalWeight).toBe(68);
  });

  it('formats empty node lists cleanly in formatRouteSteps', () => {
    expect(formatRouteSteps([], [])).toEqual([]);
  });
});

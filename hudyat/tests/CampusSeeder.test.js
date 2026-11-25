import { describe, expect, it } from 'vitest';
import { NODE_TYPES } from '../src/types/models.js';
import {
  CIT_U_SEED_DATA,
  validateCampusSeed,
} from '../src/services/CampusSeeder.js';
import { parseQrPayload } from '../src/services/QrCodeParser.js';

function cloneSeedData() {
  return {
    campus: { ...CIT_U_SEED_DATA.campus },
    policy: { ...CIT_U_SEED_DATA.policy },
    buildings: CIT_U_SEED_DATA.buildings.map((b) => ({
      ...b,
      floors: [...b.floors],
    })),
    mapNodes: CIT_U_SEED_DATA.mapNodes.map((n) => ({ ...n })),
    mapEdges: CIT_U_SEED_DATA.mapEdges.map((e) => ({ ...e })),
  };
}

describe('CampusSeeder', () => {
  it('validates CIT_U_SEED_DATA cleanly with zero errors', () => {
    const result = validateCampusSeed(CIT_U_SEED_DATA);
    expect(result).toEqual({ valid: true, errors: [] });
    expect(CIT_U_SEED_DATA.campus.id).toBe('cit-u');
    expect(CIT_U_SEED_DATA.campus.name).toBe('CIT-University');
    expect(CIT_U_SEED_DATA.policy.maxFlashHz).toBeLessThan(3);
  });

  it('includes NGE-301, NGE-302, and ASM-QUAD with valid QR payloads and evacuation reachability', () => {
    const nodesById = new Map(
      CIT_U_SEED_DATA.mapNodes.map((node) => [node.id, node]),
    );

    const room301 = nodesById.get('NGE-301');
    const room302 = nodesById.get('NGE-302');
    const assemblyQuad = nodesById.get('ASM-QUAD');

    expect(room301).toBeDefined();
    expect(room302).toBeDefined();
    expect(assemblyQuad).toBeDefined();
    expect(assemblyQuad.type).toBe(NODE_TYPES.ASSEMBLY);

    for (const node of CIT_U_SEED_DATA.mapNodes) {
      const parsed = parseQrPayload(node.qrCode, {
        expectedCampusId: 'cit-u',
      });
      expect(parsed).toEqual({
        valid: true,
        campusId: 'cit-u',
        nodeType: node.type,
        nodeId: node.id,
        raw: node.qrCode,
      });
    }

    // Verify direct BFS path from NGE-301 and NGE-302 to ASM-QUAD (excluding lift edges)
    const adjacency = new Map();
    for (const node of CIT_U_SEED_DATA.mapNodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of CIT_U_SEED_DATA.mapEdges) {
      expect(edge.isLift).toBe(false);
      adjacency.get(edge.fromNodeId).push(edge.toNodeId);
      if (edge.bidirectional) {
        adjacency.get(edge.toNodeId).push(edge.fromNodeId);
      }
    }

    function canReach(startId, targetId) {
      const visited = new Set([startId]);
      const queue = [startId];
      while (queue.length > 0) {
        const current = queue.shift();
        if (current === targetId) return true;
        for (const next of adjacency.get(current) || []) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }
      return false;
    }

    expect(canReach('NGE-301', 'ASM-QUAD')).toBe(true);
    expect(canReach('NGE-302', 'ASM-QUAD')).toBe(true);
  });

  it('catches broken edges referencing unknown node IDs', () => {
    const broken = cloneSeedData();
    broken.mapEdges.push({
      id: 'edge-broken',
      campusId: 'cit-u',
      fromNodeId: 'NGE-301',
      toNodeId: 'NGE-999-MISSING',
      weight: 10,
      isLift: false,
      bidirectional: true,
    });

    const result = validateCampusSeed(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((msg) => /unknown toNodeId/i.test(msg))).toBe(
      true,
    );
  });

  it('catches edges with zero or negative weights', () => {
    const zeroWeight = cloneSeedData();
    zeroWeight.mapEdges[0].weight = 0;

    const zeroResult = validateCampusSeed(zeroWeight);
    expect(zeroResult.valid).toBe(false);
    expect(
      zeroResult.errors.some((msg) => /positive finite weight/i.test(msg)),
    ).toBe(true);

    const negativeWeight = cloneSeedData();
    negativeWeight.mapEdges[1].weight = -5;

    const negResult = validateCampusSeed(negativeWeight);
    expect(negResult.valid).toBe(false);
    expect(
      negResult.errors.some((msg) => /positive finite weight/i.test(msg)),
    ).toBe(true);
  });

  it('catches disconnected rooms with no evacuation path to an assembly area', () => {
    const disconnected = cloneSeedData();
    // Sever the corridor-to-room edge for NGE-302
    disconnected.mapEdges = disconnected.mapEdges.filter(
      (edge) => edge.id !== 'edge-nge-302-corr',
    );

    const result = validateCampusSeed(disconnected);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((msg) => /NGE-302.*no evacuation path/i.test(msg)),
    ).toBe(true);
  });

  it('treats lift-only paths as disconnected for evacuation reachability', () => {
    const liftOnly = cloneSeedData();
    // Replace NGE-301's only edge with a lift edge
    liftOnly.mapEdges = liftOnly.mapEdges.map((edge) =>
      edge.id === 'edge-nge-301-corr' ? { ...edge, isLift: true } : edge,
    );

    const result = validateCampusSeed(liftOnly);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((msg) => /NGE-301.*no evacuation path/i.test(msg)),
    ).toBe(true);
  });
});

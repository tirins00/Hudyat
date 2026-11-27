import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/firebase/config.js', () => ({
  app: {},
  auth: {},
  db: {},
}));

import { NODE_TYPES } from '../src/types/models.js';
import {
  normalizeBuildingInput,
  normalizeFloorPlanInput,
  normalizeMapEdgeInput,
  normalizeMapNodeInput,
  normalizePolicyInput,
} from '../src/services/CampusRepository.js';
import { parseQrPayload } from '../src/services/QrCodeParser.js';

describe('CampusRepository normalizers & safety invariants', () => {
  it('enforces maxFlashHz strictly under 3 Hz in normalizePolicyInput', () => {
    const valid = normalizePolicyInput('cit-u', {
      dchDurationSec: 60,
      maxFlashHz: 2.5,
      allowPeerCheckIn: true,
    });
    expect(valid.maxFlashHz).toBe(2.5);
    expect(valid.dchDurationSec).toBe(60);

    expect(() =>
      normalizePolicyInput('cit-u', {
        dchDurationSec: 60,
        maxFlashHz: 3,
      }),
    ).toThrow(/strictly under 3 Hz/i);

    expect(() =>
      normalizePolicyInput('cit-u', {
        dchDurationSec: 60,
        maxFlashHz: 5,
      }),
    ).toThrow(/strictly under 3 Hz/i);
  });

  it('auto-generates standardized HUDYAT QR payloads in normalizeMapNodeInput', () => {
    const node = normalizeMapNodeInput('cit-u', {
      id: 'NGE-305',
      label: 'NGE 305',
      type: NODE_TYPES.ROOM,
      buildingId: 'NGE',
      floor: 3,
      x: 180,
      y: 120,
    });

    expect(node.qrCode).toBe('HUDYAT|cit-u|room|NGE-305');
    expect(parseQrPayload(node.qrCode, { expectedCampusId: 'cit-u' }).valid).toBe(
      true,
    );
  });

  it('rejects self-loop edges, zero/negative weights, and unknown node references', () => {
    const validNodes = new Set(['NGE-301', 'NGE-3F-CORR']);

    const edge = normalizeMapEdgeInput(
      'cit-u',
      {
        fromNodeId: 'NGE-301',
        toNodeId: 'NGE-3F-CORR',
        weight: 10,
        isLift: false,
      },
      validNodes,
    );
    expect(edge.id).toBe('edge-nge-301-nge-3f-corr');
    expect(edge.bidirectional).toBe(true);

    expect(() =>
      normalizeMapEdgeInput(
        'cit-u',
        { fromNodeId: 'NGE-301', toNodeId: 'NGE-301', weight: 5 },
        validNodes,
      ),
    ).toThrow(/itself/i);

    expect(() =>
      normalizeMapEdgeInput(
        'cit-u',
        { fromNodeId: 'NGE-301', toNodeId: 'NGE-3F-CORR', weight: 0 },
        validNodes,
      ),
    ).toThrow(/positive finite number/i);

    expect(() =>
      normalizeMapEdgeInput(
        'cit-u',
        { fromNodeId: 'NGE-301', toNodeId: 'UNKNOWN', weight: 10 },
        validNodes,
      ),
    ).toThrow(/unknown toNodeId/i);
  });

  it('normalizes buildings and floor plans cleanly', () => {
    const building = normalizeBuildingInput('cit-u', {
      id: 'SAL',
      name: 'Salazar Building',
      floors: '3, 1, 2, 2',
    });
    expect(building.floors).toEqual([1, 2, 3]);

    const fp = normalizeFloorPlanInput('cit-u', {
      buildingId: 'NGE',
      floor: 3,
      name: 'NGE Floor 3',
      width: 800,
      height: 600,
    });
    expect(fp.id).toBe('nge-f3');
    expect(fp.width).toBe(800);
  });
});

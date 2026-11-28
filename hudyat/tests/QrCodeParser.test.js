import { describe, expect, it } from 'vitest';
import { NODE_TYPES } from '../src/types/models.js';
import { CIT_U_SEED_DATA } from '../src/services/CampusSeeder.js';
import {
  ALLOWED_NODE_TYPES,
  QR_PREFIX,
  formatQrPayload,
  isValidQrPayload,
  isVerifiedEvacuationResponse,
  parseQrPayload,
  validateAssemblyQrPayload,
  validateManualAssemblyCode,
} from '../src/services/QrCodeParser.js';

describe('QrCodeParser', () => {
  it('exports QR_PREFIX and ALLOWED_NODE_TYPES aligned with models.js NODE_TYPES', () => {
    expect(QR_PREFIX).toBe('HUDYAT');
    expect(ALLOWED_NODE_TYPES).toEqual(Object.values(NODE_TYPES));
    expect(ALLOWED_NODE_TYPES).toContain(NODE_TYPES.ROOM);
    expect(ALLOWED_NODE_TYPES).toContain(NODE_TYPES.ASSEMBLY);
    expect(ALLOWED_NODE_TYPES).toContain(NODE_TYPES.CORRIDOR);
    expect(ALLOWED_NODE_TYPES).toContain(NODE_TYPES.STAIR);
    expect(ALLOWED_NODE_TYPES).toContain(NODE_TYPES.EXIT);
  });

  it('parses valid room and assembly payloads and supports formatQrPayload round-trip', () => {
    const roomPayload = formatQrPayload({
      campusId: 'cit-u',
      nodeType: NODE_TYPES.ROOM,
      nodeId: 'NGE-301',
    });
    expect(roomPayload).toBe('HUDYAT|cit-u|room|NGE-301');

    const parsedRoom = parseQrPayload(roomPayload);
    expect(parsedRoom).toEqual({
      valid: true,
      campusId: 'cit-u',
      nodeType: NODE_TYPES.ROOM,
      nodeId: 'NGE-301',
      raw: 'HUDYAT|cit-u|room|NGE-301',
    });
    expect(isValidQrPayload(roomPayload)).toBe(true);

    const assemblyPayload = formatQrPayload({
      campusId: 'cit-u',
      nodeType: 'ASSEMBLY',
      nodeId: 'ASM-MAIN-FIELD',
    });
    expect(assemblyPayload).toBe('HUDYAT|cit-u|assembly|ASM-MAIN-FIELD');

    const parsedAssembly = parseQrPayload(assemblyPayload, {
      expectedCampusId: 'cit-u',
    });
    expect(parsedAssembly).toEqual({
      valid: true,
      campusId: 'cit-u',
      nodeType: NODE_TYPES.ASSEMBLY,
      nodeId: 'ASM-MAIN-FIELD',
      raw: 'HUDYAT|cit-u|assembly|ASM-MAIN-FIELD',
    });
    expect(isValidQrPayload(assemblyPayload, { expectedCampusId: 'cit-u' })).toBe(
      true,
    );
  });

  it('normalizes uppercase/mixed-case nodeType during parsing and formatting', () => {
    const parsedUpper = parseQrPayload('HUDYAT|cit-u|ROOM|NGE-301');
    expect(parsedUpper).toEqual({
      valid: true,
      campusId: 'cit-u',
      nodeType: NODE_TYPES.ROOM,
      nodeId: 'NGE-301',
      raw: 'HUDYAT|cit-u|ROOM|NGE-301',
    });

    const formatted = formatQrPayload({
      campusId: 'cit-u',
      nodeType: 'Exit',
      nodeId: 'EXIT-NORTH',
    });
    expect(formatted).toBe('HUDYAT|cit-u|exit|EXIT-NORTH');
  });

  it('trims leading and trailing whitespace in formatQrPayload and parseQrPayload', () => {
    const formatted = formatQrPayload({
      campusId: '  cit-u  ',
      nodeType: '  room ',
      nodeId: '\tNGE-301\n',
    });
    expect(formatted).toBe('HUDYAT|cit-u|room|NGE-301');

    const parsed = parseQrPayload('   \n HUDYAT|cit-u|room|NGE-301 \t  ');
    expect(parsed).toEqual({
      valid: true,
      campusId: 'cit-u',
      nodeType: NODE_TYPES.ROOM,
      nodeId: 'NGE-301',
      raw: 'HUDYAT|cit-u|room|NGE-301',
    });
    expect(isValidQrPayload('  HUDYAT|cit-u|assembly|ASM-1  ')).toBe(true);
  });

  it('rejects null, undefined, empty, and non-string inputs without throwing', () => {
    const invalidInputs = [null, undefined, '', '   ', 12345, {}, ['HUDYAT|cit-u|room|NGE-301']];

    for (const input of invalidInputs) {
      const result = parseQrPayload(input);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
      expect(isValidQrPayload(input)).toBe(false);
    }
  });

  it('rejects wrong prefix (including lowercase prefix)', () => {
    for (const raw of ['OTHER|cit-u|room|NGE-301', 'hudyat|cit-u|room|NGE-301', 'not-a-qr']) {
      const result = parseQrPayload(raw);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/prefix/i);
      expect(isValidQrPayload(raw)).toBe(false);
    }
  });

  it('rejects missing or extra pipe segments', () => {
    const missing = parseQrPayload('HUDYAT|cit-u|room');
    expect(missing.valid).toBe(false);
    expect(missing.error).toMatch(/4 segments/i);

    const extra = parseQrPayload('HUDYAT|cit-u|room|NGE-301|extra');
    expect(extra.valid).toBe(false);
    expect(extra.error).toMatch(/4 segments/i);
  });

  it('rejects empty campusId or nodeId segments', () => {
    const emptyCampus = parseQrPayload('HUDYAT||room|NGE-301');
    expect(emptyCampus.valid).toBe(false);
    expect(emptyCampus.error).toMatch(/campusId/i);

    const whitespaceCampus = parseQrPayload('HUDYAT|   |room|NGE-301');
    expect(whitespaceCampus.valid).toBe(false);
    expect(whitespaceCampus.error).toMatch(/campusId/i);

    const emptyNodeId = parseQrPayload('HUDYAT|cit-u|room|');
    expect(emptyNodeId.valid).toBe(false);
    expect(emptyNodeId.error).toMatch(/nodeId/i);

    const whitespaceNodeId = parseQrPayload('HUDYAT|cit-u|room|   ');
    expect(whitespaceNodeId.valid).toBe(false);
    expect(whitespaceNodeId.error).toMatch(/nodeId/i);
  });

  it('rejects invalid nodeType in both parseQrPayload and formatQrPayload', () => {
    const parsedInvalid = parseQrPayload('HUDYAT|cit-u|cafeteria|CAF-1');
    expect(parsedInvalid.valid).toBe(false);
    expect(parsedInvalid.error).toMatch(/nodeType/i);

    const parsedEmptyType = parseQrPayload('HUDYAT|cit-u||NGE-301');
    expect(parsedEmptyType.valid).toBe(false);
    expect(parsedEmptyType.error).toMatch(/nodeType/i);

    expect(() =>
      formatQrPayload({
        campusId: 'cit-u',
        nodeType: 'cafeteria',
        nodeId: 'CAF-1',
      }),
    ).toThrow(/nodeType/i);
  });

  it('throws descriptive errors in formatQrPayload on pipe injection or invalid fields', () => {
    expect(() => formatQrPayload(null)).toThrow(/object/i);

    expect(() =>
      formatQrPayload({
        campusId: 'cit|u',
        nodeType: NODE_TYPES.ROOM,
        nodeId: 'NGE-301',
      }),
    ).toThrow(/\|/);

    expect(() =>
      formatQrPayload({
        campusId: 'cit-u',
        nodeType: NODE_TYPES.ROOM,
        nodeId: 'NGE|301',
      }),
    ).toThrow(/\|/);

    expect(() =>
      formatQrPayload({
        campusId: '   ',
        nodeType: NODE_TYPES.ROOM,
        nodeId: 'NGE-301',
      }),
    ).toThrow(/campusId/i);

    expect(() =>
      formatQrPayload({
        campusId: 'cit-u',
        nodeType: NODE_TYPES.ROOM,
        nodeId: '',
      }),
    ).toThrow(/nodeId/i);
  });

  it('rejects payloads when expectedCampusId does not match', () => {
    const raw = 'HUDYAT|cit-u|room|NGE-301';

    const mismatch = parseQrPayload(raw, { expectedCampusId: 'other-campus' });
    expect(mismatch.valid).toBe(false);
    expect(mismatch.error).toMatch(/campus mismatch/i);
    expect(isValidQrPayload(raw, { expectedCampusId: 'other-campus' })).toBe(
      false,
    );

    const match = parseQrPayload(raw, { expectedCampusId: 'cit-u' });
    expect(match.valid).toBe(true);
    expect(isValidQrPayload(raw, { expectedCampusId: 'cit-u' })).toBe(true);
  });

  it('validates assembly QR payloads strictly for Phase 2 evacuation confirmation', () => {
    const validAssembly = validateAssemblyQrPayload(
      'HUDYAT|cit-u|assembly|ASM-QUAD-01',
      'cit-u',
    );
    expect(validAssembly).toEqual({
      valid: true,
      campusId: 'cit-u',
      nodeType: NODE_TYPES.ASSEMBLY,
      nodeId: 'ASM-QUAD-01',
      qrCode: 'HUDYAT|cit-u|assembly|ASM-QUAD-01',
      raw: 'HUDYAT|cit-u|assembly|ASM-QUAD-01',
    });

    // Reject non-Hudyat QR codes
    const nonHudyat = validateAssemblyQrPayload('https://example.com/checkin', 'cit-u');
    expect(nonHudyat.valid).toBe(false);
    expect(nonHudyat.error).toMatch(/prefix/i);

    // Reject wrong campus IDs
    const wrongCampus = validateAssemblyQrPayload(
      'HUDYAT|other-campus|assembly|ASM-QUAD-01',
      'cit-u',
    );
    expect(wrongCampus.valid).toBe(false);
    expect(wrongCampus.error).toMatch(/campus mismatch/i);

    // Reject non-assembly nodes (rooms, corridors, stairs, exits)
    for (const nonAssemblyQr of [
      'HUDYAT|cit-u|room|NGE-301',
      'HUDYAT|cit-u|corridor|NGE-3F-CORR',
      'HUDYAT|cit-u|stair|NGE-STAIR-WEST',
      'HUDYAT|cit-u|exit|EXIT-NORTH',
    ]) {
      const res = validateAssemblyQrPayload(nonAssemblyQr, 'cit-u');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/assembly/i);
    }
  });

  it('verifies evacuation response records for Coordinator dashboard counting', () => {
    expect(
      isVerifiedEvacuationResponse(
        {
          nodeId: 'ASM-QUAD-01',
          currentNodeId: 'ASM-QUAD-01',
          qrCode: 'HUDYAT|cit-u|assembly|ASM-QUAD-01',
        },
        'cit-u',
      ),
    ).toBe(true);

    // Reject unverified DCH-only response (no QR)
    expect(
      isVerifiedEvacuationResponse({ status: 'dch_acknowledged', nodeId: null, qrCode: null }, 'cit-u'),
    ).toBe(false);

    // Reject room QR or wrong-campus QR or mismatched nodeId
    expect(
      isVerifiedEvacuationResponse(
        { nodeId: 'NGE-301', qrCode: 'HUDYAT|cit-u|room|NGE-301' },
        'cit-u',
      ),
    ).toBe(false);
    expect(
      isVerifiedEvacuationResponse(
        { nodeId: 'ASM-QUAD-01', qrCode: 'HUDYAT|other|assembly|ASM-QUAD-01' },
        'cit-u',
      ),
    ).toBe(false);
    expect(
      isVerifiedEvacuationResponse(
        { nodeId: 'ASM-OTHER', qrCode: 'HUDYAT|cit-u|assembly|ASM-QUAD-01' },
        'cit-u',
      ),
    ).toBe(false);
  });

  it('validates printed manual assembly codes against CIT-U seed assembly nodes', () => {
    const options = {
      expectedCampusId: 'cit-u',
      mapNodes: CIT_U_SEED_DATA.mapNodes,
    };

    // Short assembly code (case-insensitive with whitespace)
    const shortRes = validateManualAssemblyCode('  asm-quad  ', options);
    expect(shortRes).toEqual({
      valid: true,
      campusId: 'cit-u',
      nodeType: NODE_TYPES.ASSEMBLY,
      nodeId: 'ASM-QUAD',
      label: 'CIT-U Quadrangle Assembly Area',
      qrCode: 'HUDYAT|cit-u|assembly|ASM-QUAD',
      raw: 'asm-quad',
      method: 'manual_code',
    });
    expect(isVerifiedEvacuationResponse(shortRes, 'cit-u')).toBe(true);

    // Full Hudyat assembly QR payload typed manually
    const fullRes = validateManualAssemblyCode(
      'HUDYAT|cit-u|assembly|ASM-QUAD',
      options,
    );
    expect(fullRes.valid).toBe(true);
    expect(fullRes.nodeId).toBe('ASM-QUAD');
    expect(fullRes.method).toBe('manual_code');

    // Reject empty or random/unrecognized codes
    expect(validateManualAssemblyCode('', options).valid).toBe(false);
    expect(validateManualAssemblyCode('RANDOM-999', options).valid).toBe(false);
    expect(
      validateManualAssemblyCode('HUDYAT|cit-u|assembly|FAKE-ASM', options).valid,
    ).toBe(false);

    // Reject non-assembly nodes (rooms, stairs, exits)
    const roomShort = validateManualAssemblyCode('NGE-301', options);
    expect(roomShort.valid).toBe(false);
    expect(roomShort.error).toMatch(/not an assembly area/i);

    const roomFull = validateManualAssemblyCode('HUDYAT|cit-u|room|NGE-301', options);
    expect(roomFull.valid).toBe(false);
    expect(roomFull.error).toMatch(/assembly/i);

    // Reject wrong campus
    const wrongCampus = validateManualAssemblyCode(
      'HUDYAT|other-campus|assembly|ASM-QUAD',
      options,
    );
    expect(wrongCampus.valid).toBe(false);
    expect(wrongCampus.error).toMatch(/campus mismatch/i);
  });
});

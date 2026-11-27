import { describe, expect, it } from 'vitest';
import { NODE_TYPES } from '../src/types/models.js';
import {
  ALLOWED_NODE_TYPES,
  QR_PREFIX,
  formatQrPayload,
  isValidQrPayload,
  parseQrPayload,
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
});

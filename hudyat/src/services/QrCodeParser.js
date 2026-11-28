import { NODE_TYPES } from '../types/models.js';

export const QR_PREFIX = 'HUDYAT';
export const QR_DELIMITER = '|';

/** @readonly */
export const ALLOWED_NODE_TYPES = Object.freeze(Object.values(NODE_TYPES));

const ALLOWED_NODE_TYPES_SET = new Set(ALLOWED_NODE_TYPES);

/**
 * @typedef {Object} QrPayloadFields
 * @property {string} campusId
 * @property {import('../types/models.js').NodeType | string} nodeType
 * @property {string} nodeId
 */

/**
 * @typedef {Object} ParseQrOptions
 * @property {string} [expectedCampusId]
 */

/**
 * @typedef {Object} QrParseSuccess
 * @property {true} valid
 * @property {string} campusId
 * @property {import('../types/models.js').NodeType} nodeType
 * @property {string} nodeId
 * @property {string} raw
 */

/**
 * @typedef {Object} QrParseFailure
 * @property {false} valid
 * @property {string} error
 */

/** @typedef {QrParseSuccess | QrParseFailure} QrParseResult */

/**
 * Validates and trims a required string field for QR payload formatting.
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
function validateSegment(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: must be a non-empty string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Invalid ${fieldName}: must be a non-empty string.`);
  }

  if (trimmed.includes(QR_DELIMITER)) {
    throw new Error(
      `Invalid ${fieldName}: must not contain "${QR_DELIMITER}".`,
    );
  }

  return trimmed;
}

/**
 * Formats a Hudyat QR payload string: `HUDYAT|<campusId>|<nodeType>|<nodeId>`.
 * Normalizes `nodeType` to lowercase to match `NODE_TYPES` in `src/types/models.js`.
 *
 * @param {QrPayloadFields} payload
 * @returns {string}
 */
export function formatQrPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid QR payload input: expected an object.');
  }

  const campusId = validateSegment(payload.campusId, 'campusId');
  const rawNodeType = validateSegment(payload.nodeType, 'nodeType');
  const nodeType = rawNodeType.toLowerCase();

  if (!ALLOWED_NODE_TYPES_SET.has(nodeType)) {
    throw new Error(
      `Invalid nodeType "${rawNodeType}". Allowed node types: ${ALLOWED_NODE_TYPES.join(', ')}.`,
    );
  }

  const nodeId = validateSegment(payload.nodeId, 'nodeId');

  return `${QR_PREFIX}${QR_DELIMITER}${campusId}${QR_DELIMITER}${nodeType}${QR_DELIMITER}${nodeId}`;
}

/**
 * Parses and validates a raw Hudyat QR payload string without throwing.
 *
 * @param {unknown} rawText
 * @param {ParseQrOptions} [options={}]
 * @returns {QrParseResult}
 */
export function parseQrPayload(rawText, options = {}) {
  if (typeof rawText !== 'string') {
    return {
      valid: false,
      error: 'QR payload must be a string.',
    };
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'QR payload is empty.',
    };
  }

  const segments = trimmed.split(QR_DELIMITER);

  if (segments[0] !== QR_PREFIX) {
    return {
      valid: false,
      error: `Invalid QR prefix "${segments[0]}": expected "${QR_PREFIX}".`,
    };
  }

  if (segments.length !== 4) {
    return {
      valid: false,
      error: `Invalid QR payload format: expected 4 segments separated by "${QR_DELIMITER}", got ${segments.length}.`,
    };
  }

  const campusId = segments[1].trim();
  if (!campusId) {
    return {
      valid: false,
      error: 'Invalid QR payload: campusId must be non-empty.',
    };
  }

  const rawNodeType = segments[2].trim();
  if (!rawNodeType) {
    return {
      valid: false,
      error: 'Invalid QR payload: nodeType must be non-empty.',
    };
  }

  const nodeType = rawNodeType.toLowerCase();
  if (!ALLOWED_NODE_TYPES_SET.has(nodeType)) {
    return {
      valid: false,
      error: `Invalid nodeType "${rawNodeType}". Allowed node types: ${ALLOWED_NODE_TYPES.join(', ')}.`,
    };
  }

  const nodeId = segments[3].trim();
  if (!nodeId) {
    return {
      valid: false,
      error: 'Invalid QR payload: nodeId must be non-empty.',
    };
  }

  const safeOptions = options && typeof options === 'object' ? options : {};
  const expectedCampusId =
    typeof safeOptions.expectedCampusId === 'string'
      ? safeOptions.expectedCampusId.trim()
      : '';

  if (expectedCampusId && campusId !== expectedCampusId) {
    return {
      valid: false,
      error: `Campus mismatch: expected "${expectedCampusId}", got "${campusId}".`,
    };
  }

  return {
    valid: true,
    campusId,
    nodeType: /** @type {import('../types/models.js').NodeType} */ (nodeType),
    nodeId,
    raw: trimmed,
  };
}

/**
 * Returns true if `rawText` is a valid Hudyat QR payload matching `options`.
 *
 * @param {unknown} rawText
 * @param {ParseQrOptions} [options]
 * @returns {boolean}
 */
export function isValidQrPayload(rawText, options) {
  return parseQrPayload(rawText, options).valid;
}

/**
 * Validates that `rawText` is a Hudyat Assembly Area QR code matching `expectedCampusId`
 * (i.e. `HUDYAT|<campusId>|assembly|<nodeId>`).
 *
 * Rejects non-Hudyat QR codes, campus mismatches, and non-assembly node types
 * (rooms, corridors, stairs, exits, lifts, common areas).
 *
 * @param {unknown} rawText
 * @param {string} [expectedCampusId='cit-u']
 * @returns {{ valid: true, campusId: string, nodeType: 'assembly', nodeId: string, qrCode: string, raw: string } | { valid: false, error: string }}
 */
export function validateAssemblyQrPayload(rawText, expectedCampusId = 'cit-u') {
  const campus =
    typeof expectedCampusId === 'string' && expectedCampusId.trim()
      ? expectedCampusId.trim()
      : 'cit-u';

  const parsed = parseQrPayload(rawText, { expectedCampusId: campus });
  if (!parsed.valid) {
    return {
      valid: false,
      error: parsed.error,
    };
  }

  if (parsed.nodeType !== NODE_TYPES.ASSEMBLY) {
    return {
      valid: false,
      error: `Invalid QR node type "${parsed.nodeType}": scan an Assembly Area QR code (HUDYAT|${campus}|assembly|<nodeId>).`,
    };
  }

  return {
    valid: true,
    campusId: parsed.campusId,
    nodeType: NODE_TYPES.ASSEMBLY,
    nodeId: parsed.nodeId,
    qrCode: parsed.raw,
    raw: parsed.raw,
  };
}

/**
 * Returns true if a drill response document represents a QR-verified evacuation
 * arrival at an assembly node for `expectedCampusId`.
 *
 * @param {Record<string, unknown> | null | undefined} response
 * @param {string} [expectedCampusId='cit-u']
 * @returns {boolean}
 */
export function isVerifiedEvacuationResponse(response, expectedCampusId = 'cit-u') {
  if (!response || typeof response !== 'object') {
    return false;
  }
  const nodeId =
    typeof response.nodeId === 'string' && response.nodeId.trim()
      ? response.nodeId.trim()
      : typeof response.currentNodeId === 'string' && response.currentNodeId.trim()
        ? response.currentNodeId.trim()
        : '';

  if (!nodeId || typeof response.qrCode !== 'string') {
    return false;
  }

  const validation = validateAssemblyQrPayload(response.qrCode, expectedCampusId);
  return validation.valid && validation.nodeId === nodeId;
}

/**
 * Validates a student-entered printed assembly code fallback (either short node code
 * like `ASM-QUAD` or full QR payload `HUDYAT|cit-u|assembly|ASM-QUAD`) against known
 * campus assembly nodes (`type === 'assembly'`).
 *
 * Rejects empty strings, random/unrecognized codes, wrong campus IDs, and non-assembly nodes.
 *
 * @param {unknown} rawInput
 * @param {{ expectedCampusId?: string, mapNodes?: ReadonlyArray<{ id: string, campusId?: string, type: string, label?: string }> }} [options={}]
 * @returns {{ valid: true, campusId: string, nodeType: 'assembly', nodeId: string, label: string, qrCode: string, raw: string, method: 'manual_code' } | { valid: false, error: string }}
 */
export function validateManualAssemblyCode(rawInput, options = {}) {
  const safeOptions = options && typeof options === 'object' ? options : {};
  const expectedCampusId =
    typeof safeOptions.expectedCampusId === 'string' && safeOptions.expectedCampusId.trim()
      ? safeOptions.expectedCampusId.trim()
      : 'cit-u';
  const mapNodes = Array.isArray(safeOptions.mapNodes) ? safeOptions.mapNodes : [];

  if (typeof rawInput !== 'string' || !rawInput.trim()) {
    return {
      valid: false,
      error: 'Enter the printed Assembly Area code posted at your muster point (e.g., ASM-QUAD).',
    };
  }

  const trimmed = rawInput.trim();
  const normalizedCampus = expectedCampusId.toLowerCase();

  const campusNodes = mapNodes.filter(
    (node) =>
      node &&
      typeof node.id === 'string' &&
      (!node.campusId || node.campusId.trim().toLowerCase() === normalizedCampus),
  );
  const assemblyNodes = campusNodes.filter((node) => node.type === NODE_TYPES.ASSEMBLY);
  const sampleHint =
    assemblyNodes.length > 0
      ? assemblyNodes.map((n) => n.id).join(', ')
      : 'ASM-QUAD';

  // Case 1: Full pipe-delimited Hudyat QR string
  if (trimmed.includes(QR_DELIMITER)) {
    const qrResult = validateAssemblyQrPayload(trimmed, expectedCampusId);
    if (!qrResult.valid) {
      return { valid: false, error: qrResult.error };
    }

    const matchedAssembly = assemblyNodes.find(
      (node) => node.id.toLowerCase() === qrResult.nodeId.toLowerCase(),
    );
    if (assemblyNodes.length > 0 && !matchedAssembly) {
      return {
        valid: false,
        error: `Unknown assembly code "${qrResult.nodeId}". Enter a valid ${expectedCampusId} assembly area code (e.g., ${sampleHint}).`,
      };
    }

    const canonicalNodeId = matchedAssembly ? matchedAssembly.id : qrResult.nodeId;
    const canonicalQr = formatQrPayload({
      campusId: expectedCampusId,
      nodeType: NODE_TYPES.ASSEMBLY,
      nodeId: canonicalNodeId,
    });

    return {
      valid: true,
      campusId: expectedCampusId,
      nodeType: NODE_TYPES.ASSEMBLY,
      nodeId: canonicalNodeId,
      label: matchedAssembly?.label || canonicalNodeId,
      qrCode: canonicalQr,
      raw: trimmed,
      method: 'manual_code',
    };
  }

  // Case 2: Short printed assembly node code (e.g., ASM-QUAD)
  const upperTrimmed = trimmed.toLowerCase();
  const matchedAssembly = assemblyNodes.find(
    (node) => node.id.toLowerCase() === upperTrimmed,
  );

  if (!matchedAssembly) {
    const matchedOther = campusNodes.find(
      (node) => node.id.toLowerCase() === upperTrimmed,
    );
    if (matchedOther) {
      return {
        valid: false,
        error: `"${matchedOther.id}" is a ${matchedOther.type}, not an assembly area. Enter a posted Assembly Area code (e.g., ${sampleHint}).`,
      };
    }

    return {
      valid: false,
      error: `Unrecognized assembly code "${trimmed}". Enter a valid ${expectedCampusId} assembly area code (e.g., ${sampleHint}).`,
    };
  }

  const canonicalQr = formatQrPayload({
    campusId: expectedCampusId,
    nodeType: NODE_TYPES.ASSEMBLY,
    nodeId: matchedAssembly.id,
  });

  const verified = validateAssemblyQrPayload(canonicalQr, expectedCampusId);
  if (!verified.valid) {
    return { valid: false, error: verified.error };
  }

  return {
    valid: true,
    campusId: verified.campusId,
    nodeType: NODE_TYPES.ASSEMBLY,
    nodeId: verified.nodeId,
    label: matchedAssembly.label || verified.nodeId,
    qrCode: verified.qrCode,
    raw: trimmed,
    method: 'manual_code',
  };
}

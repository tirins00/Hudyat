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

import type { MapNode, NodeType } from '../types/models';

export interface NodeRef {
  node: MapNode;
  nodeId: string;
  campusId: string;
  label: string;
  type: NodeType;
}

export interface ParseQrOptions {
  /** When true, rejects non-assembly nodes (required for Module 5.1 assembly check-in). */
  requireAssembly?: boolean;
}

export class QrCodeError extends Error {
  readonly code:
    | 'EMPTY_QR'
    | 'WRONG_CAMPUS'
    | 'NODE_NOT_FOUND'
    | 'NOT_ASSEMBLY_NODE';

  constructor(
    code: QrCodeError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'QrCodeError';
    this.code = code;
  }
}

interface DecodedQrPayload {
  campusId?: string;
  nodeId?: string;
}

function extractPayload(raw: string): DecodedQrPayload {
  // 1. URI form: hudyat://<campusId>/<nodeId>
  const uriMatch = /^hudyat:\/\/([^/]+)\/(.+)$/i.exec(raw);
  if (uriMatch) {
    return {
      campusId: decodeURIComponent(uriMatch[1]).trim(),
      nodeId: decodeURIComponent(uriMatch[2]).trim(),
    };
  }

  // 2. Colon-delimited form: hudyat:<campusId>:<nodeId>
  const colonMatch = /^hudyat:([^:]+):(.+)$/i.exec(raw);
  if (colonMatch) {
    return {
      campusId: colonMatch[1].trim(),
      nodeId: colonMatch[2].trim(),
    };
  }

  // 3. JSON payload form: { "campusId": "...", "nodeId": "..." }
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const campusId =
        typeof parsed.campusId === 'string' ? parsed.campusId.trim() : undefined;
      const nodeId =
        typeof parsed.nodeId === 'string'
          ? parsed.nodeId.trim()
          : typeof parsed.id === 'string'
            ? parsed.id.trim()
            : undefined;
      if (campusId || nodeId) {
        return { campusId, nodeId };
      }
    } catch {
      // Fall through to raw string matching
    }
  }

  return {};
}

/**
 * Validates and resolves a scanned QR code string against a campus's `MapNode` records.
 * Rejects codes from another campus and (when `requireAssembly` is true) non-assembly nodes.
 */
export function parseQrCode(
  text: string,
  campusId: string,
  mapNodes: readonly MapNode[],
  options: ParseQrOptions = {},
): NodeRef {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new QrCodeError(
      'EMPTY_QR',
      'Empty QR code. Please scan a valid campus QR code.',
    );
  }

  const payload = extractPayload(trimmed);
  if (payload.campusId && payload.campusId !== campusId) {
    throw new QrCodeError(
      'WRONG_CAMPUS',
      `This QR code belongs to another campus ("${payload.campusId}") and cannot be used here.`,
    );
  }

  // Match exact `qrCode` field first, then `id` (from extracted payload or raw text).
  const matchedNode =
    mapNodes.find((n) => n.qrCode === trimmed) ??
    (payload.nodeId
      ? mapNodes.find((n) => n.id === payload.nodeId)
      : undefined) ??
    mapNodes.find((n) => n.id === trimmed);

  if (!matchedNode) {
    throw new QrCodeError(
      'NODE_NOT_FOUND',
      'Invalid QR code. This code is not recognized on the campus map.',
    );
  }

  if (matchedNode.campusId !== campusId) {
    throw new QrCodeError(
      'WRONG_CAMPUS',
      `This QR code belongs to another campus ("${matchedNode.campusId}") and cannot be used here.`,
    );
  }

  if (options.requireAssembly && matchedNode.type !== 'assembly') {
    throw new QrCodeError(
      'NOT_ASSEMBLY_NODE',
      `Invalid assembly QR code: "${matchedNode.label}" is a ${matchedNode.type}, not an assembly area. Please scan an assembly area QR code.`,
    );
  }

  return {
    node: matchedNode,
    nodeId: matchedNode.id,
    campusId: matchedNode.campusId,
    label: matchedNode.label,
    type: matchedNode.type,
  };
}

/**
 * Class wrapper matching the SDD `QrCodeParser` design (`+parse(text): NodeRef`).
 */
export class QrCodeParser {
  private readonly campusId: string;
  private readonly mapNodes: readonly MapNode[];

  constructor(campusId: string, mapNodes: readonly MapNode[]) {
    this.campusId = campusId;
    this.mapNodes = mapNodes;
  }

  parse(text: string, options: ParseQrOptions = {}): NodeRef {
    return parseQrCode(text, this.campusId, this.mapNodes, options);
  }

  parseAssembly(text: string): NodeRef {
    return parseQrCode(text, this.campusId, this.mapNodes, {
      requireAssembly: true,
    });
  }
}

import { useMemo } from 'react';
import { NODE_TYPES } from '../types/models.js';

const NODE_STYLE_BY_TYPE = Object.freeze({
  [NODE_TYPES.ROOM]: {
    fill: '#0f172a',
    stroke: '#0f172a',
    text: '#ffffff',
    tag: 'RM',
  },
  [NODE_TYPES.CORRIDOR]: {
    fill: '#334155',
    stroke: '#0f172a',
    text: '#ffffff',
    tag: 'COR',
  },
  [NODE_TYPES.STAIR]: {
    fill: '#92400e',
    stroke: '#451a03',
    text: '#ffffff',
    tag: 'STR',
  },
  [NODE_TYPES.LIFT]: {
    fill: '#991b1b',
    stroke: '#450a0a',
    text: '#ffffff',
    tag: 'LIFT',
  },
  [NODE_TYPES.EXIT]: {
    fill: '#1e40af',
    stroke: '#172554',
    text: '#ffffff',
    tag: 'EXIT',
  },
  [NODE_TYPES.ASSEMBLY]: {
    fill: '#065f46',
    stroke: '#022c22',
    text: '#ffffff',
    tag: 'ASM',
  },
  [NODE_TYPES.COMMON]: {
    fill: '#475569',
    stroke: '#0f172a',
    text: '#ffffff',
    tag: 'COM',
  },
});

/**
 * Interactive, high-contrast indoor campus map SVG renderer.
 * Displays floor plans, nodes, edges (clearly marking excluded lifts & blocked
 * routes), and overlays the active Dijkstra evacuation path.
 */
function CampusMapSvg({
  mapNodes = [],
  mapEdges = [],
  floorPlans = [],
  selectedFloor = 'all',
  route = null,
  startNodeId = '',
  selectedNodeId = '',
  blockedNodeIds = [],
  blockedEdgeIds = [],
  onNodeClick,
  onCanvasClick,
  title = 'Campus Indoor Evacuation Map',
}) {
  const blockedNodeSet = useMemo(
    () => new Set(blockedNodeIds || []),
    [blockedNodeIds],
  );
  const blockedEdgeSet = useMemo(
    () => new Set(blockedEdgeIds || []),
    [blockedEdgeIds],
  );

  const visibleNodes = useMemo(() => {
    if (selectedFloor === 'all' || selectedFloor === '' || selectedFloor === null) {
      return mapNodes;
    }
    const targetFloor = Number(selectedFloor);
    return mapNodes.filter(
      (node) =>
        Number(node.floor) === targetFloor ||
        node.type === NODE_TYPES.ASSEMBLY,
    );
  }, [mapNodes, selectedFloor]);

  const visibleNodeMap = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < visibleNodes.length; i += 1) {
      map.set(visibleNodes[i].id, visibleNodes[i]);
    }
    return map;
  }, [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      mapEdges.filter(
        (edge) =>
          visibleNodeMap.has(edge.fromNodeId) &&
          visibleNodeMap.has(edge.toNodeId),
      ),
    [mapEdges, visibleNodeMap],
  );

  const routeEdgeSet = useMemo(
    () => new Set(route?.reachable ? route.edgeIds || [] : []),
    [route],
  );

  const routeNodeOrder = useMemo(() => {
    const order = new Map();
    if (route?.reachable && Array.isArray(route.nodeIds)) {
      route.nodeIds.forEach((id, idx) => {
        order.set(id, idx + 1);
      });
    }
    return order;
  }, [route]);

  const activeFloorPlan = useMemo(() => {
    if (selectedFloor === 'all' || !Array.isArray(floorPlans)) {
      return null;
    }
    const floorNum = Number(selectedFloor);
    return (
      floorPlans.find(
        (fp) => Number(fp.floor) === floorNum && fp.imageUrl,
      ) || null
    );
  }, [floorPlans, selectedFloor]);

  const bounds = useMemo(() => {
    if (visibleNodes.length === 0) {
      return { minX: 0, minY: 0, width: 420, height: 520 };
    }
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < visibleNodes.length; i += 1) {
      const n = visibleNodes[i];
      if (typeof n.x === 'number' && Number.isFinite(n.x)) {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
      }
      if (typeof n.y === 'number' && Number.isFinite(n.y)) {
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y);
      }
    }

    if (!Number.isFinite(minX)) {
      return { minX: 0, minY: 0, width: 420, height: 520 };
    }

    const padX = 90;
    const padY = 75;
    const vx = Math.min(0, Math.floor(minX - padX));
    const vy = Math.min(0, Math.floor(minY - padY));
    const width = Math.max(400, Math.ceil(maxX + padX) - vx);
    const height = Math.max(480, Math.ceil(maxY + padY) - vy);

    return { minX: vx, minY: vy, width, height };
  }, [visibleNodes]);

  // Directional polyline segments for the active route so arrowheads always
  // point in the exact evacuation travel direction.
  const directedRouteSegments = useMemo(() => {
    if (!route?.reachable || !Array.isArray(route.nodeIds)) {
      return [];
    }
    const segments = [];
    for (let i = 0; i < route.nodeIds.length - 1; i += 1) {
      const from = visibleNodeMap.get(route.nodeIds[i]);
      const to = visibleNodeMap.get(route.nodeIds[i + 1]);
      if (from && to) {
        segments.push({
          key: `${from.id}->${to.id}`,
          from,
          to,
          weight: route.edges?.[i]?.weight ?? null,
        });
      }
    }
    return segments;
  }, [route, visibleNodeMap]);

  function handleSvgClick(event) {
    if (!onCanvasClick) {
      return;
    }
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const x = Math.round(bounds.minX + relX * bounds.width);
    const y = Math.round(bounds.minY + relY * bounds.height);
    onCanvasClick({ x, y });
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border-2 border-slate-900 bg-slate-50">
        <svg
          role="img"
          aria-label={title}
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
          className={`w-full h-auto max-h-[540px] block select-none ${
            onCanvasClick ? 'cursor-crosshair' : ''
          }`}
          onClick={handleSvgClick}
        >
          <title>{title}</title>
          <defs>
            <pattern
              id="hudyat-map-grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
            </pattern>
            <marker
              id="hudyat-route-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#047857" />
            </marker>
          </defs>

          <rect
            x={bounds.minX}
            y={bounds.minY}
            width={bounds.width}
            height={bounds.height}
            fill="url(#hudyat-map-grid)"
          />

          {activeFloorPlan && (
            <image
              href={activeFloorPlan.imageUrl}
              x={0}
              y={0}
              width={activeFloorPlan.width || bounds.width}
              height={activeFloorPlan.height || bounds.height}
              opacity="0.35"
              preserveAspectRatio="xMidYMid meet"
            />
          )}

          {/* Base graph edges */}
          {visibleEdges.map((edge) => {
            const from = visibleNodeMap.get(edge.fromNodeId);
            const to = visibleNodeMap.get(edge.toNodeId);
            if (!from || !to) {
              return null;
            }

            const isOnRoute = routeEdgeSet.has(edge.id);
            const isLift = edge.isLift === true;
            const isBlocked =
              edge.isBlocked === true || blockedEdgeSet.has(edge.id);
            const isStair = edge.isStair === true;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

            let stroke = '#64748b';
            let strokeWidth = 3;
            let dashArray;

            if (isLift) {
              stroke = '#b91c1c';
              strokeWidth = 3;
              dashArray = '3 5';
            } else if (isBlocked) {
              stroke = '#991b1b';
              strokeWidth = 3.5;
              dashArray = '8 5';
            } else if (isStair) {
              stroke = '#b45309';
              strokeWidth = 3.5;
              dashArray = '6 4';
            }

            return (
              <g key={edge.id} opacity={isOnRoute ? 0.25 : 0.9}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                />

                {!isOnRoute && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={isLift ? -34 : isBlocked ? -28 : -14}
                      y={-10}
                      width={isLift ? 68 : isBlocked ? 56 : 28}
                      height={20}
                      rx={4}
                      fill={
                        isLift || isBlocked ? '#fef2f2' : '#ffffff'
                      }
                      stroke={isLift || isBlocked ? '#991b1b' : '#475569'}
                      strokeWidth={1.2}
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill={isLift || isBlocked ? '#991b1b' : '#0f172a'}
                    >
                      {isLift
                        ? 'NO LIFT'
                        : isBlocked
                          ? 'BLOCKED'
                          : `${edge.weight}`}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Highlighted Dijkstra evacuation route */}
          {directedRouteSegments.map((seg) => {
            const dx = seg.to.x - seg.from.x;
            const dy = seg.to.y - seg.from.y;
            const len = Math.hypot(dx, dy) || 1;
            const shorten = Math.min(24, len * 0.3);
            const endX = seg.to.x - (dx / len) * shorten;
            const endY = seg.to.y - (dy / len) * shorten;
            const midX = (seg.from.x + seg.to.x) / 2;
            const midY = (seg.from.y + seg.to.y) / 2;

            return (
              <g key={seg.key}>
                <line
                  x1={seg.from.x}
                  y1={seg.from.y}
                  x2={endX}
                  y2={endY}
                  stroke="#047857"
                  strokeWidth={6}
                  strokeLinecap="round"
                  markerEnd="url(#hudyat-route-arrow)"
                />
                {seg.weight !== null && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-16}
                      y={-11}
                      width={32}
                      height={22}
                      rx={6}
                      fill="#065f46"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="800"
                      fill="#ffffff"
                    >
                      {seg.weight}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Map nodes */}
          {visibleNodes.map((node) => {
            const style =
              NODE_STYLE_BY_TYPE[node.type] ||
              NODE_STYLE_BY_TYPE[NODE_TYPES.COMMON];
            const isStart = node.id === startNodeId;
            const isSelected = node.id === selectedNodeId;
            const isBlocked = blockedNodeSet.has(node.id);
            const routeStepNum = routeNodeOrder.get(node.id);
            const isAssembly = node.type === NODE_TYPES.ASSEMBLY;
            const radius = isAssembly ? 24 : 19;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className={onNodeClick ? 'cursor-pointer' : ''}
                onClick={(event) => {
                  if (onNodeClick) {
                    event.stopPropagation();
                    onNodeClick(node);
                  }
                }}
              >
                {/* Focus / Route / Start / Blocked outer halo */}
                {(isStart || isSelected || routeStepNum || isBlocked) && (
                  <circle
                    r={radius + 6}
                    fill="none"
                    stroke={
                      isBlocked
                        ? '#991b1b'
                        : isStart
                          ? '#1d4ed8'
                          : isSelected
                            ? '#0f172a'
                            : '#047857'
                    }
                    strokeWidth={3.5}
                    strokeDasharray={isBlocked ? '4 3' : undefined}
                  />
                )}

                {isAssembly ? (
                  <rect
                    x={-28}
                    y={-20}
                    width={56}
                    height={40}
                    rx={10}
                    fill={isBlocked ? '#991b1b' : style.fill}
                    stroke="#ffffff"
                    strokeWidth={2.5}
                  />
                ) : (
                  <circle
                    r={radius}
                    fill={isBlocked ? '#991b1b' : style.fill}
                    stroke="#ffffff"
                    strokeWidth={2.5}
                  />
                )}

                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="800"
                  fill={style.text}
                >
                  {isBlocked ? 'BLK' : style.tag}
                </text>

                {/* Step badge on active route */}
                {routeStepNum && !isBlocked && (
                  <g transform={`translate(${radius - 2}, ${-radius + 2})`}>
                    <circle
                      r={10}
                      fill={isStart ? '#1d4ed8' : '#047857'}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <text
                      x={0}
                      y={3.5}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="800"
                      fill="#ffffff"
                    >
                      {routeStepNum}
                    </text>
                  </g>
                )}

                {/* High-contrast node label pill */}
                <g transform={`translate(0, ${radius + 17})`}>
                  <rect
                    x={-Math.min(72, Math.max(36, (node.label || node.id).length * 3.4))}
                    y={-11}
                    width={Math.min(144, Math.max(72, (node.label || node.id).length * 6.8))}
                    height={20}
                    rx={4}
                    fill="#ffffff"
                    stroke={isBlocked ? '#991b1b' : '#0f172a'}
                    strokeWidth={1.2}
                  />
                  <text
                    x={0}
                    y={3}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill={isBlocked ? '#991b1b' : '#0f172a'}
                  >
                    {(node.label || node.id).length > 22
                      ? `${(node.label || node.id).slice(0, 20)}…`
                      : node.label || node.id}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Accessible Map Legend */}
      <div
        aria-label="Map legend"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-900"
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-emerald-700" />
          Evacuation Path
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-full bg-slate-950" />
          Room (RM)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-full bg-amber-800" />
          Stairwell (STR)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-full bg-blue-800" />
          Exit (EXIT)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-5 rounded bg-emerald-800" />
          Assembly (ASM)
        </span>
        <span className="inline-flex items-center gap-1.5 text-red-900">
          <span className="inline-block h-3.5 w-3.5 rounded-full bg-red-800" />
          Blocked / Lift (Excluded)
        </span>
      </div>
    </div>
  );
}

export default CampusMapSvg;

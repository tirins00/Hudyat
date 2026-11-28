import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../routes/authContext.js';
import { DRILL_PHASES, NODE_TYPES } from '../types/models.js';
import { loadCampusBundle } from '../services/CampusRepository.js';
import { CIT_U_SEED_DATA } from '../services/CampusSeeder.js';
import { parseQrPayload } from '../services/QrCodeParser.js';
import { findEvacuationRoute } from '../services/RouteService.js';
import { formatDuration } from '../services/ReportService.js';
import AppShell from '../components/AppShell.jsx';
import CampusMapSvg from '../components/CampusMapSvg.jsx';

function RouteScreen() {
  const { user } = useAuth();
  const campusId = user?.campusId || 'cit-u';

  const [bundle, setBundle] = useState(null);
  const [isUsingSample, setIsUsingSample] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [startNodeId, setStartNodeId] = useState('');
  const [targetNodeId, setTargetNodeId] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [accessibleOnly, setAccessibleOnly] = useState(
    Boolean(user?.mobilityNeeds),
  );
  const [blockedNodeIds, setBlockedNodeIds] = useState([]);
  const [blockedEdgeIds, setBlockedEdgeIds] = useState([]);
  const [activeDrillTitle, setActiveDrillTitle] = useState('');

  const [qrInput, setQrInput] = useState('');
  const [qrFeedback, setQrFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const [campusBundle, drillsSnap] = await Promise.all([
          loadCampusBundle(campusId),
          getDocs(
            query(
              collection(db, 'drills'),
              where('campusId', '==', campusId),
            ),
          ).catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        const hasNodes = campusBundle.mapNodes.length > 0;
        const effectiveBundle = hasNodes
          ? campusBundle
          : {
              campus: CIT_U_SEED_DATA.campus,
              policy: CIT_U_SEED_DATA.policy,
              buildings: CIT_U_SEED_DATA.buildings,
              mapNodes: CIT_U_SEED_DATA.mapNodes,
              mapEdges: CIT_U_SEED_DATA.mapEdges,
              floorPlans: [],
            };

        setBundle(effectiveBundle);
        setIsUsingSample(!hasNodes);

        const defaultStart =
          effectiveBundle.mapNodes.find((n) => n.type === NODE_TYPES.ROOM)?.id ||
          effectiveBundle.mapNodes[0]?.id ||
          '';
        setStartNodeId((current) => current || defaultStart);

        // Apply live blocked nodes/edges if an active drill is running.
        if (drillsSnap && !drillsSnap.empty) {
          const activeDrill = drillsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .find((d) => d.phase && d.phase !== DRILL_PHASES.ENDED);

          if (activeDrill) {
            setActiveDrillTitle(activeDrill.title || 'Active Drill');
            setBlockedNodeIds(
              Array.isArray(activeDrill.blockedNodeIds)
                ? activeDrill.blockedNodeIds
                : [],
            );
            setBlockedEdgeIds(
              Array.isArray(activeDrill.blockedEdgeIds)
                ? activeDrill.blockedEdgeIds
                : [],
            );
          }
        }
      } catch (error) {
        console.error('Failed to load campus map for routing:', error);
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Could not load campus map from Firestore. Showing CIT-U sample graph.',
          );
          setBundle({
            campus: CIT_U_SEED_DATA.campus,
            policy: CIT_U_SEED_DATA.policy,
            buildings: CIT_U_SEED_DATA.buildings,
            mapNodes: CIT_U_SEED_DATA.mapNodes,
            mapEdges: CIT_U_SEED_DATA.mapEdges,
            floorPlans: [],
          });
          setIsUsingSample(true);
          setStartNodeId('NGE-301');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [campusId]);

  const mapNodes = useMemo(() => bundle?.mapNodes || [], [bundle]);
  const mapEdges = useMemo(() => bundle?.mapEdges || [], [bundle]);
  const floorPlans = useMemo(() => bundle?.floorPlans || [], [bundle]);

  const floors = useMemo(() => {
    const unique = new Set();
    for (let i = 0; i < mapNodes.length; i += 1) {
      if (typeof mapNodes[i].floor === 'number') {
        unique.add(mapNodes[i].floor);
      }
    }
    return Array.from(unique).sort((a, b) => b - a);
  }, [mapNodes]);

  const assemblyNodes = useMemo(
    () => mapNodes.filter((node) => node.type === NODE_TYPES.ASSEMBLY),
    [mapNodes],
  );

  const blockableNodes = useMemo(
    () =>
      mapNodes.filter(
        (node) =>
          node.type === NODE_TYPES.STAIR ||
          node.type === NODE_TYPES.EXIT ||
          node.type === NODE_TYPES.CORRIDOR,
      ),
    [mapNodes],
  );

  const route = useMemo(() => {
    if (!startNodeId || mapNodes.length === 0) {
      return null;
    }
    return findEvacuationRoute({
      mapNodes,
      mapEdges,
      startNodeId,
      targetNodeId: targetNodeId || undefined,
      blockedNodeIds,
      blockedEdgeIds,
      accessibleOnly,
    });
  }, [
    mapNodes,
    mapEdges,
    startNodeId,
    targetNodeId,
    blockedNodeIds,
    blockedEdgeIds,
    accessibleOnly,
  ]);

  function toggleBlockedNode(nodeId) {
    setBlockedNodeIds((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId],
    );
  }

  function handleApplyQrLocation(event) {
    event.preventDefault();
    const parsed = parseQrPayload(qrInput, {
      expectedCampusId: bundle?.campus?.id || campusId,
    });
    if (!parsed.valid) {
      setQrFeedback({ type: 'error', text: parsed.error });
      return;
    }
    const matchingNode = mapNodes.find((n) => n.id === parsed.nodeId);
    if (!matchingNode) {
      setQrFeedback({
        type: 'error',
        text: `QR location "${parsed.nodeId}" does not exist on this campus map.`,
      });
      return;
    }
    setStartNodeId(matchingNode.id);
    setQrFeedback({
      type: 'success',
      text: `Current location set to ${matchingNode.label} (${matchingNode.id}).`,
    });
  }

  return (
    <AppShell
      title="Evacuation Route"
      subtitle="Indoor Dijkstra shortest safe path to your assembly area. Elevators (lifts) are always excluded."
    >
      {isUsingSample && (
        <div
          role="status"
          className="mb-5 rounded-lg border-2 border-amber-800 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"
        >
          Showing built-in CIT-U sample campus graph (no nodes seeded in
          Firestore yet). Admins can seed the campus in Campus Setup.
        </div>
      )}

      {activeDrillTitle && (
        <div
          role="status"
          className="mb-5 rounded-lg border-2 border-blue-900 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-950"
        >
          Active Drill: <strong>{activeDrillTitle}</strong> — live blocked
          exits/nodes are automatically applied to your route.
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="mb-5 rounded-lg border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
        >
          {loadError}
        </div>
      )}

      {loading ? (
        <section
          role="status"
          className="rounded-xl border-2 border-slate-300 bg-white p-8 text-center"
        >
          <p className="text-base font-bold text-slate-800">
            Loading campus map and computing evacuation route…
          </p>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Location & Scenario Controls */}
          <section
            aria-label="Route controls"
            className="rounded-xl border-2 border-slate-900 bg-white p-4 sm:p-5 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="route-start-node"
                  className="block text-sm font-bold text-slate-900 mb-1.5"
                >
                  Current Location (No GPS)
                </label>
                <select
                  id="route-start-node"
                  value={startNodeId}
                  onChange={(e) => setStartNodeId(e.target.value)}
                  className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold text-slate-950 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
                >
                  {mapNodes
                    .filter((n) => n.type !== NODE_TYPES.LIFT)
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label} ({node.id} · F{node.floor})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="route-target-node"
                  className="block text-sm font-bold text-slate-900 mb-1.5"
                >
                  Assembly Destination
                </label>
                <select
                  id="route-target-node"
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold text-slate-950 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
                >
                  <option value="">Nearest Reachable Assembly Area</option>
                  {assemblyNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label} ({node.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="route-floor-filter"
                  className="block text-sm font-bold text-slate-900 mb-1.5"
                >
                  Map Floor View
                </label>
                <select
                  id="route-floor-filter"
                  value={selectedFloor}
                  onChange={(e) => setSelectedFloor(e.target.value)}
                  className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold text-slate-950 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
                >
                  <option value="all">All Floors (Full Evacuation View)</option>
                  {floors.map((floor) => (
                    <option key={floor} value={String(floor)}>
                      Floor {floor}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* QR Payload Input + Accessibility Toggle */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <form
                onSubmit={handleApplyQrLocation}
                className="flex flex-col sm:flex-row gap-2"
              >
                <label htmlFor="route-qr-input" className="sr-only">
                  Enter Room or Corridor QR Payload
                </label>
                <input
                  id="route-qr-input"
                  type="text"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder={`Scan/paste QR: HUDYAT|${bundle?.campus?.id || campusId}|room|NGE-301`}
                  className="flex-1 min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-medium text-slate-950 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
                />
                <button
                  type="submit"
                  className="hudyat-btn hudyat-btn-primary"
                >
                  Set via QR
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-slate-300 bg-slate-50 px-3.5 py-2">
                <label className="inline-flex min-h-12 items-center gap-3 cursor-pointer text-sm font-bold text-slate-950">
                  <input
                    type="checkbox"
                    checked={accessibleOnly}
                    onChange={(e) => setAccessibleOnly(e.target.checked)}
                    className="h-5 w-5 rounded border-2 border-slate-900 text-slate-950 focus:ring-2 focus:ring-blue-800"
                  />
                  Step-free accessible route only (avoid stairs)
                </label>
              </div>
            </div>

            {qrFeedback.text && (
              <p
                role={qrFeedback.type === 'error' ? 'alert' : 'status'}
                className={`rounded-lg border-2 px-3.5 py-2 text-sm font-bold ${
                  qrFeedback.type === 'error'
                    ? 'border-red-800 bg-red-50 text-red-950'
                    : 'border-emerald-800 bg-emerald-50 text-emerald-950'
                }`}
              >
                {qrFeedback.text}
              </p>
            )}

            {/* Blocked Exit / Stairwell Simulator */}
            {blockableNodes.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-slate-800">
                    Blocked Exits / Hazard Rerouting (click to toggle blocked)
                  </p>
                  {blockedNodeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBlockedNodeIds([])}
                      className="hudyat-btn hudyat-btn-secondary w-auto px-3 text-xs"
                    >
                      Clear All Blocked ({blockedNodeIds.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {blockableNodes.map((node) => {
                    const isBlocked = blockedNodeIds.includes(node.id);
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => toggleBlockedNode(node.id)}
                        aria-pressed={isBlocked}
                        className={`min-h-12 rounded-lg border-2 px-3.5 py-2 text-xs font-extrabold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800 ${
                          isBlocked
                            ? 'border-red-900 bg-red-800 text-white'
                            : 'border-slate-700 bg-white text-slate-950 hover:bg-slate-200'
                        }`}
                      >
                        {isBlocked ? 'BLOCKED: ' : 'Block '}
                        {node.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Route Summary Banner */}
          {route && route.reachable ? (
            <section
              aria-label="Route summary"
              className="rounded-xl border-2 border-emerald-900 bg-emerald-50 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-900">
                    SAFE EVACUATION ROUTE READY
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-emerald-950">
                    Destination: {route.targetNode?.label || route.targetNodeId}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-emerald-900">
                    {route.steps.length} waypoints · Distance weight:{' '}
                    {route.totalWeight} · Est. time:{' '}
                    {formatDuration(route.estimatedSeconds)}
                    {route.floorsTraversed.length > 0
                      ? ` · Floors: ${route.floorsTraversed.join(' → ')}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-900 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white">
                    No Elevators Used
                  </span>
                  {route.usesStairs && (
                    <span className="inline-flex items-center rounded-full bg-amber-900 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white">
                      Uses Stairs
                    </span>
                  )}
                </div>
              </div>
            </section>
          ) : route ? (
            <section
              role="alert"
              className="rounded-xl border-2 border-red-900 bg-red-50 p-5"
            >
              <h2 className="text-lg font-extrabold text-red-950">
                No Safe Evacuation Route Found
              </h2>
              <p className="mt-1 text-sm font-bold text-red-900">
                {route.reason}
              </p>
              <p className="mt-2 text-sm font-medium text-red-950">
                Stay away from glass and hazards, never use elevators, and
                notify a coordinator via SOS immediately.
              </p>
            </section>
          ) : null}

          {/* Map + Step-by-Step Instructions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <section className="lg:col-span-7 rounded-xl border-2 border-slate-900 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-lg font-extrabold text-slate-950">
                  Indoor Campus Map
                </h2>
                <p className="text-xs font-bold text-slate-700">
                  Tip: Click any room or node to set as start location
                </p>
              </div>
              <CampusMapSvg
                mapNodes={mapNodes}
                mapEdges={mapEdges}
                floorPlans={floorPlans}
                selectedFloor={selectedFloor}
                route={route}
                startNodeId={startNodeId}
                blockedNodeIds={blockedNodeIds}
                blockedEdgeIds={blockedEdgeIds}
                onNodeClick={(node) => {
                  if (node.type !== NODE_TYPES.LIFT) {
                    setStartNodeId(node.id);
                  }
                }}
              />
            </section>

            <section className="lg:col-span-5 rounded-xl border-2 border-slate-900 bg-white p-4 sm:p-5">
              <h2 className="text-lg font-extrabold text-slate-950 mb-3">
                Step-by-Step Directions
              </h2>

              {route && route.reachable ? (
                <ol className="space-y-3">
                  {route.steps.map((step) => (
                    <li
                      key={`${step.stepNumber}-${step.nodeId}`}
                      className="flex items-start gap-3 rounded-lg border-2 border-slate-300 bg-slate-50 p-3"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${
                          step.nodeType === NODE_TYPES.ASSEMBLY
                            ? 'bg-emerald-800'
                            : step.stepNumber === 1
                              ? 'bg-blue-800'
                              : step.isStair
                                ? 'bg-amber-800'
                                : 'bg-slate-900'
                        }`}
                      >
                        {step.stepNumber}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-950">
                          {step.instruction}
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-slate-700">
                          Node: {step.nodeId} · Type: {step.nodeType.toUpperCase()}
                          {step.weight > 0 ? ` · Leg weight: ${step.weight}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm font-medium text-slate-700">
                  Select an unblocked starting node to view turn-by-turn
                  evacuation steps.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default RouteScreen;

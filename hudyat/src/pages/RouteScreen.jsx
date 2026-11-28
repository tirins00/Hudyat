import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import AppShell from '../components/AppShell.jsx';
import RouteControlsCard from '../components/student/RouteControlsCard.jsx';
import RouteMapCard from '../components/student/RouteMapCard.jsx';
import RouteStepsCard from '../components/student/RouteStepsCard.jsx';
import RouteSummaryBanner from '../components/student/RouteSummaryBanner.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import LoadingCard from '../components/ui/LoadingCard.jsx';
import PageGrid from '../components/ui/PageGrid.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import StatusBanner from '../components/ui/StatusBanner.jsx';
import { db } from '../firebase/config.js';
import { useAuth } from '../routes/authContext.js';
import { loadCampusBundle } from '../services/CampusRepository.js';
import { CIT_U_SEED_DATA } from '../services/CampusSeeder.js';
import { parseQrPayload } from '../services/QrCodeParser.js';
import { findEvacuationRoute } from '../services/RouteService.js';
import { DRILL_PHASES, NODE_TYPES } from '../types/models.js';

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

        if (cancelled) return;

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
      <PageStack gap="lg">
        {isUsingSample && (
          <StatusBanner
            tone="warning"
            message="Showing built-in CIT-U sample campus graph (no nodes seeded in Firestore yet). Admins can seed the campus in Campus Setup."
          />
        )}

        {activeDrillTitle && (
          <StatusBanner
            tone="info"
            message={`Active Drill: ${activeDrillTitle} — live blocked exits/nodes are automatically applied to your route.`}
          />
        )}

        <ErrorBanner message={loadError} />

        {loading ? (
          <LoadingCard message="Loading campus map and computing evacuation route…" />
        ) : (
          <PageStack gap="lg">
            <RouteControlsCard
              campusId={bundle?.campus?.id || campusId}
              mapNodes={mapNodes}
              assemblyNodes={assemblyNodes}
              floors={floors}
              blockableNodes={blockableNodes}
              startNodeId={startNodeId}
              onStartNodeChange={setStartNodeId}
              targetNodeId={targetNodeId}
              onTargetNodeChange={setTargetNodeId}
              selectedFloor={selectedFloor}
              onSelectedFloorChange={setSelectedFloor}
              qrInput={qrInput}
              onQrInputChange={setQrInput}
              onApplyQrLocation={handleApplyQrLocation}
              qrFeedback={qrFeedback}
              accessibleOnly={accessibleOnly}
              onAccessibleOnlyChange={setAccessibleOnly}
              blockedNodeIds={blockedNodeIds}
              onToggleBlockedNode={toggleBlockedNode}
              onClearBlockedNodes={() => setBlockedNodeIds([])}
            />

            <RouteSummaryBanner route={route} />

            <PageGrid cols={12}>
              <RouteMapCard
                mapNodes={mapNodes}
                mapEdges={mapEdges}
                floorPlans={floorPlans}
                selectedFloor={selectedFloor}
                route={route}
                startNodeId={startNodeId}
                blockedNodeIds={blockedNodeIds}
                blockedEdgeIds={blockedEdgeIds}
                onSelectStartNode={setStartNodeId}
              />
              <RouteStepsCard route={route} />
            </PageGrid>
          </PageStack>
        )}
      </PageStack>
    </AppShell>
  );
}

export default RouteScreen;

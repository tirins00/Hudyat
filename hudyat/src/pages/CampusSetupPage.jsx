import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import CampusBuildingsTab from '../components/admin/CampusBuildingsTab.jsx';
import CampusGraphEditors from '../components/admin/CampusGraphEditors.jsx';
import CampusGraphInventory from '../components/admin/CampusGraphInventory.jsx';
import CampusGraphPreviewCard from '../components/admin/CampusGraphPreviewCard.jsx';
import CampusOverviewTab from '../components/admin/CampusOverviewTab.jsx';
import CampusSetupHeaderActions from '../components/admin/CampusSetupHeaderActions.jsx';
import CampusSetupTabs from '../components/admin/CampusSetupTabs.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import LoadingCard from '../components/ui/LoadingCard.jsx';
import PageStack from '../components/ui/PageStack.jsx';
import StatusBanner from '../components/ui/StatusBanner.jsx';
import { useAuth } from '../routes/authContext.js';
import {
  deleteBuilding,
  deleteFloorPlan,
  deleteMapEdge,
  deleteMapNode,
  loadCampusBundle,
  saveBuilding,
  saveCampus,
  saveFloorPlan,
  saveMapEdge,
  saveMapNode,
  savePolicy,
} from '../services/CampusRepository.js';
import {
  seedCitUCampusToFirestore,
  validateCampusSeed,
} from '../services/CampusSeeder.js';
import {
  auditCampusRoutes,
  findEvacuationRoute,
} from '../services/RouteService.js';
import { NODE_TYPES, ROLES } from '../types/models.js';

const TABS = Object.freeze({
  OVERVIEW: 'overview',
  BUILDINGS: 'buildings',
  GRAPH: 'graph',
});

const EMPTY_BUILDING = { id: '', name: '', code: '', floors: '1, 2, 3' };
const EMPTY_FLOOR_PLAN = {
  id: '',
  buildingId: '',
  floor: '1',
  name: '',
  imageUrl: '',
  width: '400',
  height: '520',
};
const EMPTY_NODE = {
  id: '',
  label: '',
  type: NODE_TYPES.ROOM,
  buildingId: '',
  floor: '1',
  x: '200',
  y: '200',
  accessible: true,
  capacity: '',
};
const EMPTY_EDGE = {
  id: '',
  fromNodeId: '',
  toNodeId: '',
  weight: '10',
  isLift: false,
  isStair: false,
  isAccessible: true,
  isBlocked: false,
  bidirectional: true,
};

function CampusSetupPage() {
  const { user } = useAuth();
  const campusId = user?.campusId || 'cit-u';
  const isAdmin = user?.role === ROLES.ADMIN;
  const rolePrefix = isAdmin ? '/admin' : '/coordinator';

  const [activeTab, setActiveTab] = useState(TABS.OVERVIEW);
  const [refreshToken, setRefreshToken] = useState(0);
  const [fetchState, setFetchState] = useState({
    campusId: '',
    token: -1,
    bundle: null,
    error: '',
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const [campusForm, setCampusForm] = useState({
    name: '',
    code: '',
    address: '',
  });
  const [policyForm, setPolicyForm] = useState({
    dchDurationSec: '60',
    maxFlashHz: '2',
    allowPeerCheckIn: true,
    requireQrCheckIn: false,
    defaultAssemblyNodeId: '',
  });

  const [buildingForm, setBuildingForm] = useState(EMPTY_BUILDING);
  const [floorPlanForm, setFloorPlanForm] = useState(EMPTY_FLOOR_PLAN);

  const [nodeForm, setNodeForm] = useState(EMPTY_NODE);
  const [edgeForm, setEdgeForm] = useState(EMPTY_EDGE);
  const [pickCoordsOnMap, setPickCoordsOnMap] = useState(false);
  const [testStartNodeId, setTestStartNodeId] = useState('');
  const [testBlockedIds, setTestBlockedIds] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState('all');

  useEffect(() => {
    let cancelled = false;

    loadCampusBundle(campusId)
      .then((data) => {
        if (cancelled) return;
        setFetchState({
          campusId,
          token: refreshToken,
          bundle: data,
          error: '',
        });
        setCampusForm({
          name: data.campus?.name || '',
          code: data.campus?.code || '',
          address: data.campus?.address || '',
        });
        setPolicyForm({
          dchDurationSec: String(data.policy?.dchDurationSec ?? 60),
          maxFlashHz: String(data.policy?.maxFlashHz ?? 2),
          allowPeerCheckIn: Boolean(data.policy?.allowPeerCheckIn ?? true),
          requireQrCheckIn: Boolean(data.policy?.requireQrCheckIn ?? false),
          defaultAssemblyNodeId: data.policy?.defaultAssemblyNodeId || '',
        });
        const firstRoom =
          data.mapNodes.find((n) => n.type === NODE_TYPES.ROOM)?.id ||
          data.mapNodes[0]?.id ||
          '';
        setTestStartNodeId((curr) =>
          curr && data.mapNodes.some((n) => n.id === curr) ? curr : firstRoom,
        );
      })
      .catch((error) => {
        console.error('Failed to load campus setup bundle:', error);
        if (!cancelled) {
          setFetchState({
            campusId,
            token: refreshToken,
            bundle: null,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to load campus configuration from Firestore.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campusId, refreshToken]);

  const loading =
    fetchState.campusId !== campusId || fetchState.token !== refreshToken;
  const bundle = !loading ? fetchState.bundle : null;
  const errorMsg = mutationError || (!loading ? fetchState.error : '');

  const mapNodes = useMemo(() => bundle?.mapNodes || [], [bundle]);
  const mapEdges = useMemo(() => bundle?.mapEdges || [], [bundle]);
  const buildings = useMemo(() => bundle?.buildings || [], [bundle]);
  const floorPlans = useMemo(() => bundle?.floorPlans || [], [bundle]);

  const assemblyNodes = useMemo(
    () => mapNodes.filter((n) => n.type === NODE_TYPES.ASSEMBLY),
    [mapNodes],
  );

  const floors = useMemo(() => {
    const set = new Set();
    mapNodes.forEach((n) => {
      if (typeof n.floor === 'number') set.add(n.floor);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [mapNodes]);

  const graphAudit = useMemo(() => {
    if (mapNodes.length === 0) return null;
    const seedValidation = validateCampusSeed({
      campus: bundle?.campus || {
        id: campusId,
        name: campusForm.name || campusId,
      },
      policy: bundle?.policy,
      buildings,
      mapNodes,
      mapEdges,
    });
    const routeAudit = auditCampusRoutes({ mapNodes, mapEdges });
    return { seedValidation, routeAudit };
  }, [bundle, campusId, campusForm.name, buildings, mapNodes, mapEdges]);

  const previewRoute = useMemo(() => {
    if (!testStartNodeId || mapNodes.length === 0) return null;
    return findEvacuationRoute({
      mapNodes,
      mapEdges,
      startNodeId: testStartNodeId,
      blockedNodeIds: testBlockedIds,
    });
  }, [mapNodes, mapEdges, testStartNodeId, testBlockedIds]);

  async function runAdminMutation(label, fn) {
    if (!isAdmin) return;
    setBusyAction(label);
    setStatusMsg('');
    setMutationError('');
    try {
      const message = await fn();
      setStatusMsg(message);
      setRefreshToken((t) => t + 1);
    } catch (error) {
      console.error(`${label} failed:`, error);
      setMutationError(
        error instanceof Error ? error.message : `${label} failed.`,
      );
    } finally {
      setBusyAction('');
    }
  }

  function handleSeedCitU() {
    runAdminMutation('seed', async () => {
      const summary = await seedCitUCampusToFirestore();
      return `Seeded campus "${summary.campusId}": ${summary.nodesSeeded} map nodes and ${summary.edgesSeeded} map edges saved.`;
    });
  }

  function handleSaveCampus(event) {
    event.preventDefault();
    runAdminMutation('campus', async () => {
      await saveCampus(campusId, campusForm);
      return `Saved campus profile for "${campusId}".`;
    });
  }

  function handleSavePolicy(event) {
    event.preventDefault();
    runAdminMutation('policy', async () => {
      const saved = await savePolicy(campusId, policyForm, user?.uid);
      return `Saved safety policy (DCH: ${saved.dchDurationSec}s, maxFlashHz: ${saved.maxFlashHz} Hz).`;
    });
  }

  function handleSaveBuilding(event) {
    event.preventDefault();
    runAdminMutation('building', async () => {
      const saved = await saveBuilding(campusId, buildingForm);
      setBuildingForm(EMPTY_BUILDING);
      return `Saved building "${saved.name}" (${saved.id}).`;
    });
  }

  function handleSaveFloorPlan(event) {
    event.preventDefault();
    runAdminMutation('floorPlan', async () => {
      const saved = await saveFloorPlan(campusId, floorPlanForm);
      setFloorPlanForm(EMPTY_FLOOR_PLAN);
      return `Saved floor plan "${saved.name}" (Floor ${saved.floor}).`;
    });
  }

  function handleSaveNode(event) {
    event.preventDefault();
    runAdminMutation('node', async () => {
      const saved = await saveMapNode(campusId, nodeForm);
      setNodeForm(EMPTY_NODE);
      setPickCoordsOnMap(false);
      return `Saved map node "${saved.label}" (${saved.id}) with QR ${saved.qrCode}.`;
    });
  }

  function handleSaveEdge(event) {
    event.preventDefault();
    runAdminMutation('edge', async () => {
      const validIds = new Set(mapNodes.map((n) => n.id));
      const saved = await saveMapEdge(campusId, edgeForm, validIds);
      setEdgeForm(EMPTY_EDGE);
      return `Saved map edge "${saved.id}" (${saved.fromNodeId} → ${saved.toNodeId}, weight ${saved.weight}).`;
    });
  }

  function handleEditBuilding(b) {
    setBuildingForm({
      id: b.id,
      name: b.name || '',
      code: b.code || b.id,
      floors: Array.isArray(b.floors) ? b.floors.join(', ') : '1',
    });
  }

  function handleDeleteBuilding(buildingId) {
    runAdminMutation('delete-building', async () => {
      await deleteBuilding(campusId, buildingId);
      return `Deleted building "${buildingId}".`;
    });
  }

  function handleDeleteFloorPlan(floorPlanId) {
    runAdminMutation('delete-fp', async () => {
      await deleteFloorPlan(campusId, floorPlanId);
      return `Deleted floor plan "${floorPlanId}".`;
    });
  }

  function handleEditNode(n) {
    setNodeForm({
      id: n.id,
      label: n.label || '',
      type: n.type || NODE_TYPES.ROOM,
      buildingId: n.buildingId || '',
      floor: String(n.floor ?? 1),
      x: String(n.x ?? 0),
      y: String(n.y ?? 0),
      accessible: Boolean(n.accessible),
      capacity: n.capacity !== undefined ? String(n.capacity) : '',
    });
  }

  function handleDeleteNode(nodeId) {
    runAdminMutation('delete-node', async () => {
      await deleteMapNode(campusId, nodeId);
      return `Deleted map node "${nodeId}".`;
    });
  }

  function handleEditEdge(edge) {
    setEdgeForm({
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      weight: String(edge.weight),
      isLift: Boolean(edge.isLift),
      isStair: Boolean(edge.isStair),
      isAccessible: Boolean(edge.isAccessible),
      isBlocked: Boolean(edge.isBlocked),
      bidirectional: edge.bidirectional !== false,
    });
  }

  function handleDeleteEdge(edgeId) {
    runAdminMutation('delete-edge', async () => {
      await deleteMapEdge(campusId, edgeId);
      return `Deleted map edge "${edgeId}".`;
    });
  }

  return (
    <AppShell
      title="Campus Setup & Map Graph"
      subtitle="Manage campus buildings, floor plans, indoor navigation graph (mapNodes & mapEdges), and safety policy."
      actions={<CampusSetupHeaderActions rolePrefix={rolePrefix} />}
    >
      <PageStack gap="lg">
        {!isAdmin && (
          <StatusBanner
            tone="info"
            message="Read-only view for Coordinators. Campus edits are restricted to Administrators by Firestore Security Rules — you can inspect the map, test evacuation routes, and print Assembly QR sheets."
          />
        )}

        <StatusBanner tone="success" message={statusMsg} />
        <ErrorBanner message={errorMsg} />

        <CampusSetupTabs
          tabs={TABS}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          buildingsCount={buildings.length}
          floorPlansCount={floorPlans.length}
          nodesCount={mapNodes.length}
          edgesCount={mapEdges.length}
        />

        {loading ? (
          <LoadingCard message="Loading campus configuration…" />
        ) : activeTab === TABS.OVERVIEW ? (
          <CampusOverviewTab
            campusId={campusId}
            isAdmin={isAdmin}
            busyAction={busyAction}
            graphAudit={graphAudit}
            campusForm={campusForm}
            onCampusFormChange={setCampusForm}
            policyForm={policyForm}
            onPolicyFormChange={setPolicyForm}
            assemblyNodes={assemblyNodes}
            onSeedCitU={handleSeedCitU}
            onSaveCampus={handleSaveCampus}
            onSavePolicy={handleSavePolicy}
          />
        ) : activeTab === TABS.BUILDINGS ? (
          <CampusBuildingsTab
            isAdmin={isAdmin}
            busyAction={busyAction}
            buildings={buildings}
            floorPlans={floorPlans}
            buildingForm={buildingForm}
            onBuildingFormChange={setBuildingForm}
            onSaveBuilding={handleSaveBuilding}
            onEditBuilding={handleEditBuilding}
            onDeleteBuilding={handleDeleteBuilding}
            floorPlanForm={floorPlanForm}
            onFloorPlanFormChange={setFloorPlanForm}
            onSaveFloorPlan={handleSaveFloorPlan}
            onDeleteFloorPlan={handleDeleteFloorPlan}
          />
        ) : (
          <PageStack gap="lg">
            <CampusGraphPreviewCard
              isAdmin={isAdmin}
              mapNodes={mapNodes}
              mapEdges={mapEdges}
              floorPlans={floorPlans}
              floors={floors}
              selectedFloor={selectedFloor}
              onSelectedFloorChange={setSelectedFloor}
              testStartNodeId={testStartNodeId}
              onTestStartNodeChange={setTestStartNodeId}
              testBlockedIds={testBlockedIds}
              onToggleTestBlocked={(id) =>
                setTestBlockedIds((prev) =>
                  prev.includes(id)
                    ? prev.filter((item) => item !== id)
                    : [...prev, id],
                )
              }
              onClearTestBlocked={() => setTestBlockedIds([])}
              pickCoordsOnMap={pickCoordsOnMap}
              onTogglePickCoords={() => setPickCoordsOnMap((v) => !v)}
              onCanvasPickCoords={({ x, y }) => {
                setNodeForm((f) => ({ ...f, x: String(x), y: String(y) }));
                setPickCoordsOnMap(false);
              }}
              previewRoute={previewRoute}
            />

            {isAdmin && (
              <CampusGraphEditors
                mapNodes={mapNodes}
                nodeForm={nodeForm}
                onNodeFormChange={setNodeForm}
                onSaveNode={handleSaveNode}
                edgeForm={edgeForm}
                onEdgeFormChange={setEdgeForm}
                onSaveEdge={handleSaveEdge}
                busyAction={busyAction}
              />
            )}

            <CampusGraphInventory
              isAdmin={isAdmin}
              mapNodes={mapNodes}
              mapEdges={mapEdges}
              onEditNode={handleEditNode}
              onDeleteNode={handleDeleteNode}
              onEditEdge={handleEditEdge}
              onDeleteEdge={handleDeleteEdge}
            />
          </PageStack>
        )}
      </PageStack>
    </AppShell>
  );
}

export default CampusSetupPage;

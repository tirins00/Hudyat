import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../routes/authContext.js';
import { NODE_TYPES, ROLES } from '../types/models.js';
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
  CIT_U_SEED_DATA,
  seedCitUCampusToFirestore,
  validateCampusSeed,
} from '../services/CampusSeeder.js';
import { ALLOWED_NODE_TYPES } from '../services/QrCodeParser.js';
import {
  auditCampusRoutes,
  findEvacuationRoute,
} from '../services/RouteService.js';
import AppShell from '../components/AppShell.jsx';
import CampusMapSvg from '../components/CampusMapSvg.jsx';

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

  // Overview & Policy forms
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

  // Buildings & Floor Plans forms
  const [buildingForm, setBuildingForm] = useState(EMPTY_BUILDING);
  const [floorPlanForm, setFloorPlanForm] = useState(EMPTY_FLOOR_PLAN);

  // Graph forms & interactive test state
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
    if (mapNodes.length === 0) {
      return null;
    }
    const seedValidation = validateCampusSeed({
      campus: bundle?.campus || { id: campusId, name: campusForm.name || campusId },
      policy: bundle?.policy,
      buildings,
      mapNodes,
      mapEdges,
    });
    const routeAudit = auditCampusRoutes({ mapNodes, mapEdges });
    return { seedValidation, routeAudit };
  }, [bundle, campusId, campusForm.name, buildings, mapNodes, mapEdges]);

  const previewRoute = useMemo(() => {
    if (!testStartNodeId || mapNodes.length === 0) {
      return null;
    }
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

  return (
    <AppShell
      title="Campus Setup & Map Graph"
      subtitle="Manage campus buildings, floor plans, indoor navigation graph (mapNodes & mapEdges), and safety policy."
      actions={
        <>
          <Link
            to={`${rolePrefix}/qr-sheet`}
            className="inline-flex min-h-12 items-center rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-800"
          >
            Assembly QR Sheets
          </Link>
          <Link
            to={`${rolePrefix}/route`}
            className="inline-flex min-h-12 items-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-800"
          >
            Open Full Route Screen
          </Link>
        </>
      }
    >
      {!isAdmin && (
        <div
          role="status"
          className="mb-5 rounded-lg border-2 border-blue-900 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-950"
        >
          Read-only view for Coordinators. Campus edits are restricted to
          Administrators by Firestore Security Rules — you can inspect the map,
          test evacuation routes, and print Assembly QR sheets.
        </div>
      )}

      {statusMsg && (
        <div
          role="status"
          className="mb-5 rounded-lg border-2 border-emerald-800 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950"
        >
          {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="mb-5 rounded-lg border-2 border-red-800 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
        >
          {errorMsg}
        </div>
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Campus setup sections"
        className="mb-6 flex flex-wrap gap-3"
      >
        {[
          { id: TABS.OVERVIEW, label: '1. Campus, Policy & Audit' },
          {
            id: TABS.BUILDINGS,
            label: `2. Buildings (${buildings.length}) & Floor Plans (${floorPlans.length})`,
          },
          {
            id: TABS.GRAPH,
            label: `3. Map Graph (${mapNodes.length} Nodes / ${mapEdges.length} Edges)`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-12 rounded-lg border-2 px-4 py-2.5 text-sm font-extrabold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-800 ${
              activeTab === tab.id
                ? 'border-slate-950 bg-slate-950 text-white'
                : 'border-slate-700 bg-white text-slate-950 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <section
          role="status"
          className="rounded-xl border-2 border-slate-300 bg-white p-8 text-center"
        >
          <p className="text-base font-bold text-slate-800">
            Loading campus configuration…
          </p>
        </section>
      ) : (
        <>
          {/* TAB 1: Overview, Policy & Graph Audit */}
          {activeTab === TABS.OVERVIEW && (
            <div className="space-y-6">
              {/* Quick Seed & Audit Row */}
              <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-950">
                      Campus Graph Readiness ({campusId})
                    </h2>
                    <p className="text-sm font-medium text-slate-700">
                      Verifies valid QR payloads, positive edge weights, room-to-assembly
                      Dijkstra reachability, and elevator exclusion.
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleSeedCitU}
                      disabled={Boolean(busyAction)}
                      className="min-h-12 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-800 disabled:opacity-60"
                    >
                      {busyAction === 'seed'
                        ? 'Seeding CIT-U Campus…'
                        : 'Seed CIT-U Sample Campus'}
                    </button>
                  )}
                </div>

                {!graphAudit ? (
                  <div className="rounded-lg border-2 border-amber-800 bg-amber-50 p-4 text-sm font-bold text-amber-950">
                    No map nodes exist yet for campus <strong>{campusId}</strong>.{' '}
                    {isAdmin
                      ? `Click "Seed CIT-U Sample Campus" to load ${CIT_U_SEED_DATA.mapNodes.length} nodes and ${CIT_U_SEED_DATA.mapEdges.length} edges, or add nodes manually in the Map Graph tab.`
                      : 'Ask an Administrator to seed or configure the campus map.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-lg border-2 border-slate-300 bg-slate-50 p-4">
                      <p className="text-xs font-extrabold uppercase text-slate-700">
                        Room Reachability
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-slate-950 tabular-nums">
                        {graphAudit.routeAudit.reachableRooms} /{' '}
                        {graphAudit.routeAudit.totalRooms}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {graphAudit.routeAudit.unreachableRoomIds.length === 0
                          ? 'All rooms reach an assembly area'
                          : `Disconnected: ${graphAudit.routeAudit.unreachableRoomIds.join(', ')}`}
                      </p>
                    </div>

                    <div className="rounded-lg border-2 border-slate-300 bg-slate-50 p-4">
                      <p className="text-xs font-extrabold uppercase text-slate-700">
                        Lift Exclusion Guard
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-emerald-900 tabular-nums">
                        Active
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {graphAudit.routeAudit.excludedLiftEdgeCount} lift edge(s)
                        excluded from routing
                      </p>
                    </div>

                    <div
                      className={`rounded-lg border-2 p-4 ${
                        graphAudit.seedValidation.valid
                          ? 'border-emerald-800 bg-emerald-50'
                          : 'border-red-800 bg-red-50'
                      }`}
                    >
                      <p className="text-xs font-extrabold uppercase text-slate-800">
                        Schema &amp; QR Validation
                      </p>
                      <p
                        className={`mt-1 text-2xl font-extrabold ${
                          graphAudit.seedValidation.valid
                            ? 'text-emerald-950'
                            : 'text-red-950'
                        }`}
                      >
                        {graphAudit.seedValidation.valid
                          ? 'Passed'
                          : `${graphAudit.seedValidation.errors.length} Issue(s)`}
                      </p>
                      {!graphAudit.seedValidation.valid && (
                        <ul className="mt-1 list-disc pl-4 text-xs font-bold text-red-950">
                          {graphAudit.seedValidation.errors.slice(0, 3).map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Campus Metadata Form */}
                <form
                  onSubmit={handleSaveCampus}
                  className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4"
                >
                  <h2 className="text-lg font-extrabold text-slate-950">
                    Campus Details
                  </h2>

                  <div>
                    <label
                      htmlFor="campus-name"
                      className="block text-sm font-bold text-slate-900 mb-1"
                    >
                      Campus Name
                    </label>
                    <input
                      id="campus-name"
                      type="text"
                      required
                      disabled={!isAdmin}
                      value={campusForm.name}
                      onChange={(e) =>
                        setCampusForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="CIT-University"
                      className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="campus-code"
                      className="block text-sm font-bold text-slate-900 mb-1"
                    >
                      Campus Code
                    </label>
                    <input
                      id="campus-code"
                      type="text"
                      disabled={!isAdmin}
                      value={campusForm.code}
                      onChange={(e) =>
                        setCampusForm((f) => ({ ...f, code: e.target.value }))
                      }
                      placeholder="CIT-U"
                      className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="campus-address"
                      className="block text-sm font-bold text-slate-900 mb-1"
                    >
                      Address
                    </label>
                    <input
                      id="campus-address"
                      type="text"
                      disabled={!isAdmin}
                      value={campusForm.address}
                      onChange={(e) =>
                        setCampusForm((f) => ({ ...f, address: e.target.value }))
                      }
                      placeholder="N. Bacalso Avenue, Cebu City"
                      className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 disabled:bg-slate-100"
                    />
                  </div>

                  {isAdmin && (
                    <button
                      type="submit"
                      disabled={Boolean(busyAction)}
                      className="min-h-12 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-800 disabled:opacity-60"
                    >
                      {busyAction === 'campus' ? 'Saving…' : 'Save Campus Details'}
                    </button>
                  )}
                </form>

                {/* Policy Form */}
                <form
                  onSubmit={handleSavePolicy}
                  className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4"
                >
                  <h2 className="text-lg font-extrabold text-slate-950">
                    Drill &amp; Accessibility Policy
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="policy-dch"
                        className="block text-sm font-bold text-slate-900 mb-1"
                      >
                        DCH Duration (seconds)
                      </label>
                      <input
                        id="policy-dch"
                        type="number"
                        min={10}
                        max={600}
                        required
                        disabled={!isAdmin}
                        value={policyForm.dchDurationSec}
                        onChange={(e) =>
                          setPolicyForm((f) => ({
                            ...f,
                            dchDurationSec: e.target.value,
                          }))
                        }
                        className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-sm font-bold text-slate-950 disabled:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="policy-flash"
                        className="block text-sm font-bold text-slate-900 mb-1"
                      >
                        Max Flash Rate (Hz, strictly &lt; 3)
                      </label>
                      <input
                        id="policy-flash"
                        type="number"
                        step="0.1"
                        min={0.1}
                        max={2.9}
                        required
                        disabled={!isAdmin}
                        value={policyForm.maxFlashHz}
                        onChange={(e) =>
                          setPolicyForm((f) => ({
                            ...f,
                            maxFlashHz: e.target.value,
                          }))
                        }
                        className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-sm font-bold text-slate-950 disabled:bg-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="policy-assembly"
                      className="block text-sm font-bold text-slate-900 mb-1"
                    >
                      Default Assembly Node
                    </label>
                    <select
                      id="policy-assembly"
                      disabled={!isAdmin}
                      value={policyForm.defaultAssemblyNodeId}
                      onChange={(e) =>
                        setPolicyForm((f) => ({
                          ...f,
                          defaultAssemblyNodeId: e.target.value,
                        }))
                      }
                      className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3.5 py-2 text-sm font-bold text-slate-950 disabled:bg-slate-100"
                    >
                      <option value="">Auto (Nearest Assembly)</option>
                      {assemblyNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex min-h-12 items-center gap-3 text-sm font-bold text-slate-950 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={policyForm.allowPeerCheckIn}
                        onChange={(e) =>
                          setPolicyForm((f) => ({
                            ...f,
                            allowPeerCheckIn: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 rounded border-2 border-slate-900"
                      />
                      Allow peer-assisted check-in
                    </label>

                    <label className="flex min-h-12 items-center gap-3 text-sm font-bold text-slate-950 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={policyForm.requireQrCheckIn}
                        onChange={(e) =>
                          setPolicyForm((f) => ({
                            ...f,
                            requireQrCheckIn: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 rounded border-2 border-slate-900"
                      />
                      Require QR scan for self check-in
                    </label>
                  </div>

                  {isAdmin && (
                    <button
                      type="submit"
                      disabled={Boolean(busyAction)}
                      className="min-h-12 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-800 disabled:opacity-60"
                    >
                      {busyAction === 'policy' ? 'Saving…' : 'Save Policy'}
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: Buildings & Floor Plans */}
          {activeTab === TABS.BUILDINGS && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Buildings Panel */}
              <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4">
                <h2 className="text-lg font-extrabold text-slate-950">
                  Campus Buildings
                </h2>

                {isAdmin && (
                  <form
                    onSubmit={handleSaveBuilding}
                    className="space-y-3 rounded-lg border-2 border-slate-300 bg-slate-50 p-4"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="bldg-id"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Building ID
                        </label>
                        <input
                          id="bldg-id"
                          type="text"
                          required
                          value={buildingForm.id}
                          onChange={(e) =>
                            setBuildingForm((f) => ({ ...f, id: e.target.value }))
                          }
                          placeholder="NGE"
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="bldg-code"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Code
                        </label>
                        <input
                          id="bldg-code"
                          type="text"
                          value={buildingForm.code}
                          onChange={(e) =>
                            setBuildingForm((f) => ({
                              ...f,
                              code: e.target.value,
                            }))
                          }
                          placeholder="NGE"
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="bldg-name"
                        className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                      >
                        Building Name
                      </label>
                      <input
                        id="bldg-name"
                        type="text"
                        required
                        value={buildingForm.name}
                        onChange={(e) =>
                          setBuildingForm((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="New Graduate & Engineering Building"
                        className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-medium"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="bldg-floors"
                        className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                      >
                        Floors (comma-separated)
                      </label>
                      <input
                        id="bldg-floors"
                        type="text"
                        required
                        value={buildingForm.floors}
                        onChange={(e) =>
                          setBuildingForm((f) => ({
                            ...f,
                            floors: e.target.value,
                          }))
                        }
                        placeholder="1, 2, 3"
                        className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={Boolean(busyAction)}
                      className="min-h-12 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Save Building
                    </button>
                  </form>
                )}

                {buildings.length === 0 ? (
                  <p className="text-sm font-medium text-slate-700">
                    No buildings configured yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-300 border-2 border-slate-300 rounded-lg">
                    {buildings.map((b) => (
                      <li
                        key={b.id}
                        className="p-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-extrabold text-slate-950">
                            {b.name} ({b.code || b.id})
                          </p>
                          <p className="text-xs font-bold text-slate-700">
                            Floors: {Array.isArray(b.floors) ? b.floors.join(', ') : '—'}
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setBuildingForm({
                                  id: b.id,
                                  name: b.name || '',
                                  code: b.code || b.id,
                                  floors: Array.isArray(b.floors)
                                    ? b.floors.join(', ')
                                    : '1',
                                })
                              }
                              className="min-h-12 rounded-lg border-2 border-slate-900 bg-white px-3 py-1 text-xs font-bold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                runAdminMutation('delete-building', async () => {
                                  await deleteBuilding(campusId, b.id);
                                  return `Deleted building "${b.id}".`;
                                })
                              }
                              className="min-h-12 rounded-lg border-2 border-red-800 bg-red-50 px-3 py-1 text-xs font-bold text-red-950"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Floor Plans Panel */}
              <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4">
                <h2 className="text-lg font-extrabold text-slate-950">
                  Floor Plans
                </h2>

                {isAdmin && (
                  <form
                    onSubmit={handleSaveFloorPlan}
                    className="space-y-3 rounded-lg border-2 border-slate-300 bg-slate-50 p-4"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="fp-building"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Building ID
                        </label>
                        <input
                          id="fp-building"
                          type="text"
                          required
                          value={floorPlanForm.buildingId}
                          onChange={(e) =>
                            setFloorPlanForm((f) => ({
                              ...f,
                              buildingId: e.target.value,
                            }))
                          }
                          placeholder="NGE"
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="fp-floor"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Floor
                        </label>
                        <input
                          id="fp-floor"
                          type="number"
                          required
                          value={floorPlanForm.floor}
                          onChange={(e) =>
                            setFloorPlanForm((f) => ({
                              ...f,
                              floor: e.target.value,
                            }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="fp-name"
                        className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                      >
                        Floor Plan Name
                      </label>
                      <input
                        id="fp-name"
                        type="text"
                        required
                        value={floorPlanForm.name}
                        onChange={(e) =>
                          setFloorPlanForm((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="NGE 3rd Floor Map"
                        className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-medium"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="fp-url"
                        className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                      >
                        Floor Plan Image URL (optional overlay)
                      </label>
                      <input
                        id="fp-url"
                        type="url"
                        value={floorPlanForm.imageUrl}
                        onChange={(e) =>
                          setFloorPlanForm((f) => ({
                            ...f,
                            imageUrl: e.target.value,
                          }))
                        }
                        placeholder="https://example.com/nge-3f.png"
                        className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="fp-w"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Width (px)
                        </label>
                        <input
                          id="fp-w"
                          type="number"
                          min={100}
                          value={floorPlanForm.width}
                          onChange={(e) =>
                            setFloorPlanForm((f) => ({
                              ...f,
                              width: e.target.value,
                            }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="fp-h"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Height (px)
                        </label>
                        <input
                          id="fp-h"
                          type="number"
                          min={100}
                          value={floorPlanForm.height}
                          onChange={(e) =>
                            setFloorPlanForm((f) => ({
                              ...f,
                              height: e.target.value,
                            }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={Boolean(busyAction)}
                      className="min-h-12 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Save Floor Plan
                    </button>
                  </form>
                )}

                {floorPlans.length === 0 ? (
                  <p className="text-sm font-medium text-slate-700">
                    No floor plan overlays uploaded yet. The interactive map
                    uses clean architectural grid coordinates by default.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-300 border-2 border-slate-300 rounded-lg">
                    {floorPlans.map((fp) => (
                      <li
                        key={fp.id}
                        className="p-3 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-extrabold text-slate-950">
                            {fp.name} ({fp.buildingId} · F{fp.floor})
                          </p>
                          <p className="text-xs font-bold text-slate-700">
                            {fp.width}×{fp.height}px
                            {fp.imageUrl ? ' · Image linked' : ' · Grid only'}
                          </p>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              runAdminMutation('delete-fp', async () => {
                                await deleteFloorPlan(campusId, fp.id);
                                return `Deleted floor plan "${fp.id}".`;
                              })
                            }
                            className="min-h-12 rounded-lg border-2 border-red-800 bg-red-50 px-3 py-1 text-xs font-bold text-red-950"
                          >
                            Delete
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          {/* TAB 3: Map Graph Editor + Manual Test Graph */}
          {activeTab === TABS.GRAPH && (
            <div className="space-y-6">
              {/* Interactive Map & Live Route Tester */}
              <section className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-950">
                      Interactive Graph Preview &amp; Dijkstra Test
                    </h2>
                    <p className="text-xs font-bold text-slate-700">
                      {pickCoordsOnMap
                        ? 'Click anywhere on the map canvas to populate (x, y) coordinates in the Node form below.'
                        : 'Select a test start node or click a node on the map to verify shortest evacuation routing.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Map floor filter"
                      value={selectedFloor}
                      onChange={(e) => setSelectedFloor(e.target.value)}
                      className="min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-xs font-bold"
                    >
                      <option value="all">All Floors</option>
                      {floors.map((f) => (
                        <option key={f} value={String(f)}>
                          Floor {f}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Test start node"
                      value={testStartNodeId}
                      onChange={(e) => setTestStartNodeId(e.target.value)}
                      className="min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-xs font-bold"
                    >
                      <option value="">No Route Overlay</option>
                      {mapNodes
                        .filter((n) => n.type !== NODE_TYPES.LIFT)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            Test from: {n.label} ({n.id})
                          </option>
                        ))}
                    </select>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setPickCoordsOnMap((v) => !v)}
                        aria-pressed={pickCoordsOnMap}
                        className={`min-h-12 rounded-lg border-2 px-3.5 py-2 text-xs font-extrabold ${
                          pickCoordsOnMap
                            ? 'border-blue-900 bg-blue-800 text-white'
                            : 'border-slate-900 bg-white text-slate-950 hover:bg-slate-200'
                        }`}
                      >
                        {pickCoordsOnMap
                          ? 'Picking (x, y) — Click Map'
                          : 'Pick (x, y) from Map'}
                      </button>
                    )}
                  </div>
                </div>

                {previewRoute && (
                  <div
                    className={`rounded-lg border-2 px-4 py-2.5 text-sm font-bold ${
                      previewRoute.reachable
                        ? 'border-emerald-800 bg-emerald-50 text-emerald-950'
                        : 'border-red-800 bg-red-50 text-red-950'
                    }`}
                  >
                    {previewRoute.reachable
                      ? `Dijkstra Path (${previewRoute.totalWeight} weight): ${previewRoute.nodeIds.join(' → ')}`
                      : `Unreachable: ${previewRoute.reason}`}
                  </div>
                )}

                <CampusMapSvg
                  mapNodes={mapNodes}
                  mapEdges={mapEdges}
                  floorPlans={floorPlans}
                  selectedFloor={selectedFloor}
                  route={previewRoute}
                  startNodeId={testStartNodeId}
                  blockedNodeIds={testBlockedIds}
                  onNodeClick={(node) => {
                    if (pickCoordsOnMap) return;
                    if (
                      node.type === NODE_TYPES.STAIR ||
                      node.type === NODE_TYPES.EXIT
                    ) {
                      setTestBlockedIds((prev) =>
                        prev.includes(node.id)
                          ? prev.filter((id) => id !== node.id)
                          : [...prev, node.id],
                      );
                    } else if (node.type !== NODE_TYPES.LIFT) {
                      setTestStartNodeId(node.id);
                    }
                  }}
                  onCanvasClick={
                    pickCoordsOnMap
                      ? ({ x, y }) => {
                          setNodeForm((f) => ({
                            ...f,
                            x: String(x),
                            y: String(y),
                          }));
                          setPickCoordsOnMap(false);
                        }
                      : undefined
                  }
                />

                {testBlockedIds.length > 0 && (
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-red-950">
                    <span>
                      Simulated blocked nodes: {testBlockedIds.join(', ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTestBlockedIds([])}
                      className="min-h-10 rounded-lg border-2 border-slate-900 bg-white px-3 py-1 text-xs font-bold text-slate-950"
                    >
                      Clear Simulated Blocks
                    </button>
                  </div>
                )}
              </section>

              {/* Node & Edge Editor Forms (Admins) */}
              {isAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Node Form */}
                  <form
                    onSubmit={handleSaveNode}
                    className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-3"
                  >
                    <h3 className="text-lg font-extrabold text-slate-950">
                      Add / Update Map Node
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="node-id"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Node ID
                        </label>
                        <input
                          id="node-id"
                          type="text"
                          required
                          value={nodeForm.id}
                          onChange={(e) =>
                            setNodeForm((f) => ({ ...f, id: e.target.value }))
                          }
                          placeholder="NGE-303"
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 px-3 py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="node-type"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Type
                        </label>
                        <select
                          id="node-type"
                          value={nodeForm.type}
                          onChange={(e) =>
                            setNodeForm((f) => ({ ...f, type: e.target.value }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-3 py-2 text-sm font-bold"
                        >
                          {ALLOWED_NODE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="node-label"
                        className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                      >
                        Label
                      </label>
                      <input
                        id="node-label"
                        type="text"
                        required
                        value={nodeForm.label}
                        onChange={(e) =>
                          setNodeForm((f) => ({ ...f, label: e.target.value }))
                        }
                        placeholder="NGE 303"
                        className="w-full min-h-12 rounded-lg border-2 border-slate-700 px-3 py-2 text-sm font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label
                          htmlFor="node-bldg"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Bldg
                        </label>
                        <input
                          id="node-bldg"
                          type="text"
                          value={nodeForm.buildingId}
                          onChange={(e) =>
                            setNodeForm((f) => ({
                              ...f,
                              buildingId: e.target.value,
                            }))
                          }
                          placeholder="NGE"
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 px-2.5 py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="node-floor"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Floor
                        </label>
                        <input
                          id="node-floor"
                          type="number"
                          required
                          value={nodeForm.floor}
                          onChange={(e) =>
                            setNodeForm((f) => ({ ...f, floor: e.target.value }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 px-2.5 py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="node-x"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          X
                        </label>
                        <input
                          id="node-x"
                          type="number"
                          required
                          value={nodeForm.x}
                          onChange={(e) =>
                            setNodeForm((f) => ({ ...f, x: e.target.value }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 px-2.5 py-2 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="node-y"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Y
                        </label>
                        <input
                          id="node-y"
                          type="number"
                          required
                          value={nodeForm.y}
                          onChange={(e) =>
                            setNodeForm((f) => ({ ...f, y: e.target.value }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 px-2.5 py-2 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex min-h-12 items-center gap-2 text-sm font-bold text-slate-950">
                        <input
                          type="checkbox"
                          checked={nodeForm.accessible}
                          onChange={(e) =>
                            setNodeForm((f) => ({
                              ...f,
                              accessible: e.target.checked,
                            }))
                          }
                          className="h-5 w-5 rounded border-2 border-slate-900"
                        />
                        Step-free accessible
                      </label>

                      <button
                        type="submit"
                        disabled={Boolean(busyAction)}
                        className="min-h-12 rounded-lg bg-slate-950 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800"
                      >
                        Save Map Node
                      </button>
                    </div>
                  </form>

                  {/* Edge Form */}
                  <form
                    onSubmit={handleSaveEdge}
                    className="rounded-xl border-2 border-slate-900 bg-white p-5 space-y-3"
                  >
                    <h3 className="text-lg font-extrabold text-slate-950">
                      Add / Update Map Edge
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="edge-from"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          From Node
                        </label>
                        <select
                          id="edge-from"
                          required
                          value={edgeForm.fromNodeId}
                          onChange={(e) =>
                            setEdgeForm((f) => ({
                              ...f,
                              fromNodeId: e.target.value,
                            }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-2.5 py-2 text-sm font-bold"
                        >
                          <option value="">Select node…</option>
                          {mapNodes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.id} ({n.label})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="edge-to"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          To Node
                        </label>
                        <select
                          id="edge-to"
                          required
                          value={edgeForm.toNodeId}
                          onChange={(e) =>
                            setEdgeForm((f) => ({
                              ...f,
                              toNodeId: e.target.value,
                            }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 bg-white px-2.5 py-2 text-sm font-bold"
                        >
                          <option value="">Select node…</option>
                          {mapNodes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.id} ({n.label})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="edge-id"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Edge ID (optional)
                        </label>
                        <input
                          id="edge-id"
                          type="text"
                          value={edgeForm.id}
                          onChange={(e) =>
                            setEdgeForm((f) => ({ ...f, id: e.target.value }))
                          }
                          placeholder="Auto-generated if blank"
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 px-3 py-2 text-sm font-medium"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edge-weight"
                          className="block text-xs font-extrabold uppercase text-slate-800 mb-1"
                        >
                          Weight (distance/sec &gt; 0)
                        </label>
                        <input
                          id="edge-weight"
                          type="number"
                          min={1}
                          step="1"
                          required
                          value={edgeForm.weight}
                          onChange={(e) =>
                            setEdgeForm((f) => ({ ...f, weight: e.target.value }))
                          }
                          className="w-full min-h-12 rounded-lg border-2 border-slate-700 px-3 py-2 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      <label className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-red-950">
                        <input
                          type="checkbox"
                          checked={edgeForm.isLift}
                          onChange={(e) =>
                            setEdgeForm((f) => ({
                              ...f,
                              isLift: e.target.checked,
                            }))
                          }
                          className="h-5 w-5 rounded border-2 border-red-900"
                        />
                        Lift (always excluded)
                      </label>
                      <label className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-slate-950">
                        <input
                          type="checkbox"
                          checked={edgeForm.isStair}
                          onChange={(e) =>
                            setEdgeForm((f) => ({
                              ...f,
                              isStair: e.target.checked,
                            }))
                          }
                          className="h-5 w-5 rounded border-2 border-slate-900"
                        />
                        Stairs
                      </label>
                      <label className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-slate-950">
                        <input
                          type="checkbox"
                          checked={edgeForm.bidirectional}
                          onChange={(e) =>
                            setEdgeForm((f) => ({
                              ...f,
                              bidirectional: e.target.checked,
                            }))
                          }
                          className="h-5 w-5 rounded border-2 border-slate-900"
                        />
                        Bidirectional
                      </label>
                      <label className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-slate-950">
                        <input
                          type="checkbox"
                          checked={edgeForm.isAccessible}
                          onChange={(e) =>
                            setEdgeForm((f) => ({
                              ...f,
                              isAccessible: e.target.checked,
                            }))
                          }
                          className="h-5 w-5 rounded border-2 border-slate-900"
                        />
                        Accessible
                      </label>
                      <label className="inline-flex min-h-10 items-center gap-2 text-xs font-bold text-slate-950">
                        <input
                          type="checkbox"
                          checked={edgeForm.isBlocked}
                          onChange={(e) =>
                            setEdgeForm((f) => ({
                              ...f,
                              isBlocked: e.target.checked,
                            }))
                          }
                          className="h-5 w-5 rounded border-2 border-slate-900"
                        />
                        Blocked
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={Boolean(busyAction)}
                      className="min-h-12 rounded-lg bg-slate-950 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Save Map Edge
                    </button>
                  </form>
                </div>
              )}

              {/* Nodes & Edges Inventory Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="rounded-xl border-2 border-slate-900 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b-2 border-slate-900 bg-slate-100">
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">
                      Map Nodes ({mapNodes.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50">
                          <th className="px-3 py-2 font-extrabold">Node</th>
                          <th className="px-3 py-2 font-extrabold">Type</th>
                          <th className="px-3 py-2 font-extrabold">Pos</th>
                          {isAdmin && (
                            <th className="px-3 py-2 text-right font-extrabold">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {mapNodes.map((n) => (
                          <tr key={n.id}>
                            <td className="px-3 py-2">
                              <p className="font-bold text-slate-950">{n.id}</p>
                              <p className="text-xs text-slate-700">{n.label}</p>
                            </td>
                            <td className="px-3 py-2 font-bold uppercase text-xs">
                              {n.type} · F{n.floor}
                            </td>
                            <td className="px-3 py-2 text-xs font-mono">
                              ({n.x}, {n.y})
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-2 text-right whitespace-nowrap space-x-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNodeForm({
                                      id: n.id,
                                      label: n.label || '',
                                      type: n.type || NODE_TYPES.ROOM,
                                      buildingId: n.buildingId || '',
                                      floor: String(n.floor ?? 1),
                                      x: String(n.x ?? 0),
                                      y: String(n.y ?? 0),
                                      accessible: Boolean(n.accessible),
                                      capacity:
                                        n.capacity !== undefined
                                          ? String(n.capacity)
                                          : '',
                                    })
                                  }
                                  className="min-h-10 rounded border-2 border-slate-900 px-2.5 py-1 text-xs font-bold"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAdminMutation('delete-node', async () => {
                                      await deleteMapNode(campusId, n.id);
                                      return `Deleted map node "${n.id}".`;
                                    })
                                  }
                                  className="min-h-10 rounded border-2 border-red-800 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-950"
                                >
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border-2 border-slate-900 bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b-2 border-slate-900 bg-slate-100">
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">
                      Map Edges ({mapEdges.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-50">
                          <th className="px-3 py-2 font-extrabold">Connection</th>
                          <th className="px-3 py-2 font-extrabold">Weight</th>
                          <th className="px-3 py-2 font-extrabold">Flags</th>
                          {isAdmin && (
                            <th className="px-3 py-2 text-right font-extrabold">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {mapEdges.map((edge) => (
                          <tr key={edge.id}>
                            <td className="px-3 py-2">
                              <p className="font-bold text-slate-950">
                                {edge.fromNodeId}{' '}
                                {edge.bidirectional === false ? '→' : '↔'}{' '}
                                {edge.toNodeId}
                              </p>
                              <p className="text-xs font-mono text-slate-700">
                                {edge.id}
                              </p>
                            </td>
                            <td className="px-3 py-2 font-extrabold tabular-nums">
                              {edge.weight}
                            </td>
                            <td className="px-3 py-2 text-xs font-bold space-x-1">
                              {edge.isLift && (
                                <span className="inline-block rounded bg-red-800 px-1.5 py-0.5 text-white">
                                  LIFT
                                </span>
                              )}
                              {edge.isStair && (
                                <span className="inline-block rounded bg-amber-800 px-1.5 py-0.5 text-white">
                                  STAIR
                                </span>
                              )}
                              {edge.isBlocked && (
                                <span className="inline-block rounded bg-red-950 px-1.5 py-0.5 text-white">
                                  BLOCKED
                                </span>
                              )}
                              {!edge.isLift && !edge.isStair && !edge.isBlocked && (
                                <span className="text-slate-700">Normal</span>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-2 text-right whitespace-nowrap space-x-1">
                                <button
                                  type="button"
                                  onClick={() =>
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
                                    })
                                  }
                                  className="min-h-10 rounded border-2 border-slate-900 px-2.5 py-1 text-xs font-bold"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAdminMutation('delete-edge', async () => {
                                      await deleteMapEdge(campusId, edge.id);
                                      return `Deleted map edge "${edge.id}".`;
                                    })
                                  }
                                  className="min-h-10 rounded border-2 border-red-800 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-950"
                                >
                                  Delete
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

export default CampusSetupPage;

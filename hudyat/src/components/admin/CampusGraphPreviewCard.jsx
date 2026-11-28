import { NODE_TYPES } from '../../types/models.js';
import CampusMapSvg from '../CampusMapSvg.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import StatusBanner from '../ui/StatusBanner.jsx';

/**
 * Interactive indoor graph preview & Dijkstra route test card for CampusSetupPage.
 */
export default function CampusGraphPreviewCard({
  isAdmin,
  mapNodes,
  mapEdges,
  floorPlans,
  floors,
  selectedFloor,
  onSelectedFloorChange,
  testStartNodeId,
  onTestStartNodeChange,
  testBlockedIds,
  onToggleTestBlocked,
  onClearTestBlocked,
  pickCoordsOnMap,
  onTogglePickCoords,
  onCanvasPickCoords,
  previewRoute,
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">
            Interactive Graph Preview &amp; Dijkstra Test
          </h2>
          <p className="text-xs font-bold text-slate-600">
            {pickCoordsOnMap
              ? 'Click anywhere on the map canvas to populate (x, y) coordinates in the Node form below.'
              : 'Select a test start node or click a node on the map to verify shortest evacuation routing.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Map floor filter"
            value={selectedFloor}
            onChange={(e) => onSelectedFloorChange(e.target.value)}
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
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
            onChange={(e) => onTestStartNodeChange(e.target.value)}
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
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
            <Button
              variant={pickCoordsOnMap ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={pickCoordsOnMap}
              onClick={onTogglePickCoords}
            >
              {pickCoordsOnMap
                ? 'Picking (x, y) — Click Map'
                : 'Pick (x, y) from Map'}
            </Button>
          )}
        </div>
      </div>

      {previewRoute &&
        (previewRoute.reachable ? (
          <StatusBanner
            tone="success"
            message={`Dijkstra Path (${previewRoute.totalWeight} weight): ${previewRoute.nodeIds.join(' → ')}`}
          />
        ) : (
          <ErrorBanner message={`Unreachable: ${previewRoute.reason}`} />
        ))}

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
            onToggleTestBlocked(node.id);
          } else if (node.type !== NODE_TYPES.LIFT) {
            onTestStartNodeChange(node.id);
          }
        }}
        onCanvasClick={pickCoordsOnMap ? onCanvasPickCoords : undefined}
      />

      {testBlockedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-red-950">
          <span>Simulated blocked nodes: {testBlockedIds.join(', ')}</span>
          <Button variant="secondary" size="sm" onClick={onClearTestBlocked}>
            Clear Simulated Blocks
          </Button>
        </div>
      )}
    </Card>
  );
}

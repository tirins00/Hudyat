import { NODE_TYPES } from '../../types/models.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import StatusBanner from '../ui/StatusBanner.jsx';

/**
 * Location selectors, QR location entry, accessibility toggle, and blocked-exit simulator.
 */
export default function RouteControlsCard({
  campusId,
  mapNodes,
  assemblyNodes,
  floors,
  blockableNodes,
  startNodeId,
  onStartNodeChange,
  targetNodeId,
  onTargetNodeChange,
  selectedFloor,
  onSelectedFloorChange,
  qrInput,
  onQrInputChange,
  onApplyQrLocation,
  qrFeedback,
  accessibleOnly,
  onAccessibleOnlyChange,
  blockedNodeIds,
  onToggleBlockedNode,
  onClearBlockedNodes,
}) {
  return (
    <Card aria-label="Route controls" padding="compact" className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="route-start-node"
            className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Current Location (No GPS)
          </label>
          <select
            id="route-start-node"
            value={startNodeId}
            onChange={(e) => onStartNodeChange(e.target.value)}
            className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-950 focus:border-slate-900 focus:outline-none"
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
            className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Assembly Destination
          </label>
          <select
            id="route-target-node"
            value={targetNodeId}
            onChange={(e) => onTargetNodeChange(e.target.value)}
            className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-950 focus:border-slate-900 focus:outline-none"
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
            className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Map Floor View
          </label>
          <select
            id="route-floor-filter"
            value={selectedFloor}
            onChange={(e) => onSelectedFloorChange(e.target.value)}
            className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-950 focus:border-slate-900 focus:outline-none"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
        <form
          onSubmit={onApplyQrLocation}
          className="flex flex-col sm:flex-row gap-2"
        >
          <label htmlFor="route-qr-input" className="sr-only">
            Enter Room or Corridor QR Payload
          </label>
          <input
            id="route-qr-input"
            type="text"
            value={qrInput}
            onChange={(e) => onQrInputChange(e.target.value)}
            placeholder={`Scan/paste QR: HUDYAT|${campusId}|room|NGE-301`}
            className="flex-1 min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 focus:border-slate-900 focus:outline-none"
          />
          <Button type="submit" variant="primary">
            Set via QR
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
          <label className="inline-flex min-h-12 items-center gap-3 cursor-pointer text-sm font-bold text-slate-950">
            <input
              type="checkbox"
              checked={accessibleOnly}
              onChange={(e) => onAccessibleOnlyChange(e.target.checked)}
              className="h-5 w-5 rounded border-slate-900 accent-slate-950"
            />
            Step-free accessible route only (avoid stairs)
          </label>
        </div>
      </div>

      {qrFeedback.text &&
        (qrFeedback.type === 'error' ? (
          <ErrorBanner message={qrFeedback.text} />
        ) : (
          <StatusBanner tone="success" message={qrFeedback.text} />
        ))}

      {blockableNodes.length > 0 && (
        <div className="pt-3 border-t border-slate-200 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
              Blocked Exits / Hazard Rerouting (click to toggle blocked)
            </p>
            {blockedNodeIds.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onClearBlockedNodes}
              >
                Clear All Blocked ({blockedNodeIds.length})
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {blockableNodes.map((node) => {
              const isBlocked = blockedNodeIds.includes(node.id);
              return (
                <Button
                  key={node.id}
                  variant={isBlocked ? 'danger' : 'secondary'}
                  size="sm"
                  aria-pressed={isBlocked}
                  onClick={() => onToggleBlockedNode(node.id)}
                >
                  {isBlocked ? 'BLOCKED: ' : 'Block '}
                  {node.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

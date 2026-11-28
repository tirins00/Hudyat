import { ALLOWED_NODE_TYPES } from '../../services/QrCodeParser.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Admin forms for adding or updating Map Nodes and Map Edges.
 */
export default function CampusGraphEditors({
  mapNodes,
  nodeForm,
  onNodeFormChange,
  onSaveNode,
  edgeForm,
  onEdgeFormChange,
  onSaveEdge,
  busyAction,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card
        as="form"
        onSubmit={onSaveNode}
        title="Add / Update Map Node"
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="node-id"
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
            >
              Node ID
            </label>
            <input
              id="node-id"
              type="text"
              required
              value={nodeForm.id}
              onChange={(e) =>
                onNodeFormChange({ ...nodeForm, id: e.target.value })
              }
              placeholder="NGE-303"
              className="w-full min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
            />
          </div>
          <div>
            <label
              htmlFor="node-type"
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
            >
              Type
            </label>
            <select
              id="node-type"
              value={nodeForm.type}
              onChange={(e) =>
                onNodeFormChange({ ...nodeForm, type: e.target.value })
              }
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
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
            className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
          >
            Label
          </label>
          <input
            id="node-label"
            type="text"
            required
            value={nodeForm.label}
            onChange={(e) =>
              onNodeFormChange({ ...nodeForm, label: e.target.value })
            }
            placeholder="NGE 303"
            className="w-full min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div>
            <label
              htmlFor="node-bldg"
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
            >
              Bldg
            </label>
            <input
              id="node-bldg"
              type="text"
              value={nodeForm.buildingId}
              onChange={(e) =>
                onNodeFormChange({ ...nodeForm, buildingId: e.target.value })
              }
              placeholder="NGE"
              className="w-full min-h-12 rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-bold"
            />
          </div>
          <div>
            <label
              htmlFor="node-floor"
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
            >
              Floor
            </label>
            <input
              id="node-floor"
              type="number"
              required
              value={nodeForm.floor}
              onChange={(e) =>
                onNodeFormChange({ ...nodeForm, floor: e.target.value })
              }
              className="w-full min-h-12 rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-bold"
            />
          </div>
          <div>
            <label
              htmlFor="node-x"
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
            >
              X
            </label>
            <input
              id="node-x"
              type="number"
              required
              value={nodeForm.x}
              onChange={(e) =>
                onNodeFormChange({ ...nodeForm, x: e.target.value })
              }
              className="w-full min-h-12 rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-bold"
            />
          </div>
          <div>
            <label
              htmlFor="node-y"
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
            >
              Y
            </label>
            <input
              id="node-y"
              type="number"
              required
              value={nodeForm.y}
              onChange={(e) =>
                onNodeFormChange({ ...nodeForm, y: e.target.value })
              }
              className="w-full min-h-12 rounded-xl border border-slate-300 px-2.5 py-2 text-sm font-bold"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="inline-flex min-h-12 items-center gap-2 text-sm font-bold text-slate-950">
            <input
              type="checkbox"
              checked={nodeForm.accessible}
              onChange={(e) =>
                onNodeFormChange({ ...nodeForm, accessible: e.target.checked })
              }
              className="h-5 w-5 rounded border-slate-900 accent-slate-950"
            />
            Step-free accessible
          </label>

          <Button type="submit" variant="primary" disabled={Boolean(busyAction)}>
            Save Map Node
          </Button>
        </div>
      </Card>

      <Card
        as="form"
        onSubmit={onSaveEdge}
        title="Add / Update Map Edge"
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="edge-from"
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
            >
              From Node
            </label>
            <select
              id="edge-from"
              required
              value={edgeForm.fromNodeId}
              onChange={(e) =>
                onEdgeFormChange({ ...edgeForm, fromNodeId: e.target.value })
              }
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm font-bold"
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
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
            >
              To Node
            </label>
            <select
              id="edge-to"
              required
              value={edgeForm.toNodeId}
              onChange={(e) =>
                onEdgeFormChange({ ...edgeForm, toNodeId: e.target.value })
              }
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm font-bold"
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
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
            >
              Edge ID (optional)
            </label>
            <input
              id="edge-id"
              type="text"
              value={edgeForm.id}
              onChange={(e) =>
                onEdgeFormChange({ ...edgeForm, id: e.target.value })
              }
              placeholder="Auto-generated if blank"
              className="w-full min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium"
            />
          </div>
          <div>
            <label
              htmlFor="edge-weight"
              className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
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
                onEdgeFormChange({ ...edgeForm, weight: e.target.value })
              }
              className="w-full min-h-12 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          <label className="inline-flex min-h-12 items-center gap-2 text-xs font-bold text-red-900">
            <input
              type="checkbox"
              checked={edgeForm.isLift}
              onChange={(e) =>
                onEdgeFormChange({ ...edgeForm, isLift: e.target.checked })
              }
              className="h-5 w-5 rounded accent-red-700"
            />
            Lift (always excluded)
          </label>
          <label className="inline-flex min-h-12 items-center gap-2 text-xs font-bold text-slate-950">
            <input
              type="checkbox"
              checked={edgeForm.isStair}
              onChange={(e) =>
                onEdgeFormChange({ ...edgeForm, isStair: e.target.checked })
              }
              className="h-5 w-5 rounded accent-slate-950"
            />
            Stairs
          </label>
          <label className="inline-flex min-h-12 items-center gap-2 text-xs font-bold text-slate-950">
            <input
              type="checkbox"
              checked={edgeForm.bidirectional}
              onChange={(e) =>
                onEdgeFormChange({
                  ...edgeForm,
                  bidirectional: e.target.checked,
                })
              }
              className="h-5 w-5 rounded accent-slate-950"
            />
            Bidirectional
          </label>
          <label className="inline-flex min-h-12 items-center gap-2 text-xs font-bold text-slate-950">
            <input
              type="checkbox"
              checked={edgeForm.isAccessible}
              onChange={(e) =>
                onEdgeFormChange({
                  ...edgeForm,
                  isAccessible: e.target.checked,
                })
              }
              className="h-5 w-5 rounded accent-slate-950"
            />
            Accessible
          </label>
          <label className="inline-flex min-h-12 items-center gap-2 text-xs font-bold text-slate-950">
            <input
              type="checkbox"
              checked={edgeForm.isBlocked}
              onChange={(e) =>
                onEdgeFormChange({ ...edgeForm, isBlocked: e.target.checked })
              }
              className="h-5 w-5 rounded accent-slate-950"
            />
            Blocked
          </label>
        </div>

        <Button type="submit" variant="primary" disabled={Boolean(busyAction)}>
          Save Map Edge
        </Button>
      </Card>
    </div>
  );
}

import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Inventory tables for Map Nodes and Map Edges on CampusSetupPage.
 */
export default function CampusGraphInventory({
  isAdmin,
  mapNodes,
  mapEdges,
  onEditNode,
  onDeleteNode,
  onEditEdge,
  onDeleteEdge,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card padding="none" className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">
            Map Nodes ({mapNodes.length})
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-700">
                  Node
                </th>
                <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-700">
                  Type
                </th>
                <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-700">
                  Pos
                </th>
                {isAdmin && (
                  <th className="px-3 py-2 text-right text-xs font-extrabold uppercase text-slate-700">
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
                    <p className="text-xs text-slate-600">{n.label}</p>
                  </td>
                  <td className="px-3 py-2 font-bold uppercase text-xs">
                    {n.type} · F{n.floor}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">
                    ({n.x}, {n.y})
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onEditNode(n)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onDeleteNode(n.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-950">
            Map Edges ({mapEdges.length})
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-700">
                  Connection
                </th>
                <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-700">
                  Weight
                </th>
                <th className="px-3 py-2 text-xs font-extrabold uppercase text-slate-700">
                  Flags
                </th>
                {isAdmin && (
                  <th className="px-3 py-2 text-right text-xs font-extrabold uppercase text-slate-700">
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
                      {edge.bidirectional === false ? '→' : '↔'} {edge.toNodeId}
                    </p>
                    <p className="text-xs font-mono text-slate-600">
                      {edge.id}
                    </p>
                  </td>
                  <td className="px-3 py-2 font-extrabold tabular-nums">
                    {edge.weight}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {edge.isLift && (
                        <StatusBadge status="danger">LIFT</StatusBadge>
                      )}
                      {edge.isStair && (
                        <StatusBadge status="warning">STAIR</StatusBadge>
                      )}
                      {edge.isBlocked && (
                        <StatusBadge status="danger">BLOCKED</StatusBadge>
                      )}
                      {!edge.isLift && !edge.isStair && !edge.isBlocked && (
                        <span className="text-xs font-bold text-slate-600">
                          Normal
                        </span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onEditEdge(edge)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onDeleteEdge(edge.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

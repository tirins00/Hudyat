import { CIT_U_SEED_DATA } from '../../services/CampusSeeder.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatCard from '../ui/StatCard.jsx';

/**
 * Tab 1 of CampusSetupPage: Campus Graph Readiness audit, Seed button,
 * Campus Details form, and Drill & Accessibility Policy form.
 */
export default function CampusOverviewTab({
  campusId,
  isAdmin,
  busyAction,
  graphAudit,
  campusForm,
  onCampusFormChange,
  policyForm,
  onPolicyFormChange,
  assemblyNodes,
  onSeedCitU,
  onSaveCampus,
  onSavePolicy,
}) {
  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">
              Campus Graph Readiness ({campusId})
            </h2>
            <p className="text-sm font-medium text-slate-700">
              Verifies valid QR payloads, positive edge weights,
              room-to-assembly Dijkstra reachability, and elevator exclusion.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="primary"
              onClick={onSeedCitU}
              disabled={Boolean(busyAction)}
            >
              {busyAction === 'seed'
                ? 'Seeding CIT-U Campus…'
                : 'Seed CIT-U Sample Campus'}
            </Button>
          )}
        </div>

        {!graphAudit ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
            No map nodes exist yet for campus <strong>{campusId}</strong>.{' '}
            {isAdmin
              ? `Click "Seed CIT-U Sample Campus" to load ${CIT_U_SEED_DATA.mapNodes.length} nodes and ${CIT_U_SEED_DATA.mapEdges.length} edges, or add nodes manually in the Map Graph tab.`
              : 'Ask an Administrator to seed or configure the campus map.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Room Reachability"
              value={`${graphAudit.routeAudit.reachableRooms} / ${graphAudit.routeAudit.totalRooms}`}
              helper={
                graphAudit.routeAudit.unreachableRoomIds.length === 0
                  ? 'All rooms reach an assembly area'
                  : `Disconnected: ${graphAudit.routeAudit.unreachableRoomIds.join(', ')}`
              }
            />

            <StatCard
              label="Lift Exclusion Guard"
              value="Active"
              tone="success"
              helper={`${graphAudit.routeAudit.excludedLiftEdgeCount} lift edge(s) excluded from routing`}
            />

            <StatCard
              label="Schema & QR Validation"
              value={
                graphAudit.seedValidation.valid
                  ? 'Passed'
                  : `${graphAudit.seedValidation.errors.length} Issue(s)`
              }
              tone={graphAudit.seedValidation.valid ? 'success' : 'danger'}
              helper={
                !graphAudit.seedValidation.valid
                  ? graphAudit.seedValidation.errors.slice(0, 2).join('; ')
                  : 'All map nodes and edges valid'
              }
            />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card as="form" onSubmit={onSaveCampus} title="Campus Details" className="space-y-4">
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
                onCampusFormChange({ ...campusForm, name: e.target.value })
              }
              placeholder="CIT-University"
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 disabled:bg-slate-100"
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
                onCampusFormChange({ ...campusForm, code: e.target.value })
              }
              placeholder="CIT-U"
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 disabled:bg-slate-100"
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
                onCampusFormChange({ ...campusForm, address: e.target.value })
              }
              placeholder="N. Bacalso Avenue, Cebu City"
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 disabled:bg-slate-100"
            />
          </div>

          {isAdmin && (
            <Button
              type="submit"
              variant="primary"
              disabled={Boolean(busyAction)}
            >
              {busyAction === 'campus' ? 'Saving…' : 'Save Campus Details'}
            </Button>
          )}
        </Card>

        <Card
          as="form"
          onSubmit={onSavePolicy}
          title="Drill & Accessibility Policy"
          className="space-y-4"
        >
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
                  onPolicyFormChange({
                    ...policyForm,
                    dchDurationSec: e.target.value,
                  })
                }
                className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-950 disabled:bg-slate-100"
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
                  onPolicyFormChange({
                    ...policyForm,
                    maxFlashHz: e.target.value,
                  })
                }
                className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-950 disabled:bg-slate-100"
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
                onPolicyFormChange({
                  ...policyForm,
                  defaultAssemblyNodeId: e.target.value,
                })
              }
              className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-950 disabled:bg-slate-100"
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
                  onPolicyFormChange({
                    ...policyForm,
                    allowPeerCheckIn: e.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-slate-900 accent-slate-950"
              />
              Allow peer-assisted check-in
            </label>

            <label className="flex min-h-12 items-center gap-3 text-sm font-bold text-slate-950 cursor-pointer">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={policyForm.requireQrCheckIn}
                onChange={(e) =>
                  onPolicyFormChange({
                    ...policyForm,
                    requireQrCheckIn: e.target.checked,
                  })
                }
                className="h-5 w-5 rounded border-slate-900 accent-slate-950"
              />
              Require QR scan for self check-in
            </label>
          </div>

          {isAdmin && (
            <Button
              type="submit"
              variant="primary"
              disabled={Boolean(busyAction)}
            >
              {busyAction === 'policy' ? 'Saving…' : 'Save Policy'}
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}

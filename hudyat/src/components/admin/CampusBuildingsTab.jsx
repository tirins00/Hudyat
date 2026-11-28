import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Tab 2 of CampusSetupPage: Buildings and Floor Plans CRUD forms & inventories.
 */
export default function CampusBuildingsTab({
  isAdmin,
  busyAction,
  buildings,
  floorPlans,
  buildingForm,
  onBuildingFormChange,
  onSaveBuilding,
  onEditBuilding,
  onDeleteBuilding,
  floorPlanForm,
  onFloorPlanFormChange,
  onSaveFloorPlan,
  onDeleteFloorPlan,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Campus Buildings" className="space-y-4">
        {isAdmin && (
          <form
            onSubmit={onSaveBuilding}
            className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="bldg-id"
                  className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
                >
                  Building ID
                </label>
                <input
                  id="bldg-id"
                  type="text"
                  required
                  value={buildingForm.id}
                  onChange={(e) =>
                    onBuildingFormChange({ ...buildingForm, id: e.target.value })
                  }
                  placeholder="NGE"
                  className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label
                  htmlFor="bldg-code"
                  className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
                >
                  Code
                </label>
                <input
                  id="bldg-code"
                  type="text"
                  value={buildingForm.code}
                  onChange={(e) =>
                    onBuildingFormChange({
                      ...buildingForm,
                      code: e.target.value,
                    })
                  }
                  placeholder="NGE"
                  className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="bldg-name"
                className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
              >
                Building Name
              </label>
              <input
                id="bldg-name"
                type="text"
                required
                value={buildingForm.name}
                onChange={(e) =>
                  onBuildingFormChange({ ...buildingForm, name: e.target.value })
                }
                placeholder="New Graduate & Engineering Building"
                className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
              />
            </div>

            <div>
              <label
                htmlFor="bldg-floors"
                className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
              >
                Floors (comma-separated)
              </label>
              <input
                id="bldg-floors"
                type="text"
                required
                value={buildingForm.floors}
                onChange={(e) =>
                  onBuildingFormChange({
                    ...buildingForm,
                    floors: e.target.value,
                  })
                }
                placeholder="1, 2, 3"
                className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={Boolean(busyAction)}
            >
              Save Building
            </Button>
          </form>
        )}

        {buildings.length === 0 ? (
          <p className="text-sm font-medium text-slate-700">
            No buildings configured yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
            {buildings.map((b) => (
              <li
                key={b.id}
                className="p-3.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-extrabold text-slate-950">
                    {b.name} ({b.code || b.id})
                  </p>
                  <p className="text-xs font-bold text-slate-600">
                    Floors:{' '}
                    {Array.isArray(b.floors) ? b.floors.join(', ') : '—'}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onEditBuilding(b)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onDeleteBuilding(b.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Floor Plans" className="space-y-4">
        {isAdmin && (
          <form
            onSubmit={onSaveFloorPlan}
            className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="fp-building"
                  className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
                >
                  Building ID
                </label>
                <input
                  id="fp-building"
                  type="text"
                  required
                  value={floorPlanForm.buildingId}
                  onChange={(e) =>
                    onFloorPlanFormChange({
                      ...floorPlanForm,
                      buildingId: e.target.value,
                    })
                  }
                  placeholder="NGE"
                  className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label
                  htmlFor="fp-floor"
                  className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
                >
                  Floor
                </label>
                <input
                  id="fp-floor"
                  type="number"
                  required
                  value={floorPlanForm.floor}
                  onChange={(e) =>
                    onFloorPlanFormChange({
                      ...floorPlanForm,
                      floor: e.target.value,
                    })
                  }
                  className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="fp-name"
                className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
              >
                Floor Plan Name
              </label>
              <input
                id="fp-name"
                type="text"
                required
                value={floorPlanForm.name}
                onChange={(e) =>
                  onFloorPlanFormChange({
                    ...floorPlanForm,
                    name: e.target.value,
                  })
                }
                placeholder="NGE 3rd Floor Map"
                className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
              />
            </div>

            <div>
              <label
                htmlFor="fp-url"
                className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
              >
                Floor Plan Image URL (optional overlay)
              </label>
              <input
                id="fp-url"
                type="url"
                value={floorPlanForm.imageUrl}
                onChange={(e) =>
                  onFloorPlanFormChange({
                    ...floorPlanForm,
                    imageUrl: e.target.value,
                  })
                }
                placeholder="https://example.com/nge-3f.png"
                className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="fp-w"
                  className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
                >
                  Width (px)
                </label>
                <input
                  id="fp-w"
                  type="number"
                  min={100}
                  value={floorPlanForm.width}
                  onChange={(e) =>
                    onFloorPlanFormChange({
                      ...floorPlanForm,
                      width: e.target.value,
                    })
                  }
                  className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label
                  htmlFor="fp-h"
                  className="block text-xs font-extrabold uppercase text-slate-700 mb-1"
                >
                  Height (px)
                </label>
                <input
                  id="fp-h"
                  type="number"
                  min={100}
                  value={floorPlanForm.height}
                  onChange={(e) =>
                    onFloorPlanFormChange({
                      ...floorPlanForm,
                      height: e.target.value,
                    })
                  }
                  className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={Boolean(busyAction)}
            >
              Save Floor Plan
            </Button>
          </form>
        )}

        {floorPlans.length === 0 ? (
          <p className="text-sm font-medium text-slate-700">
            No floor plan overlays uploaded yet. The interactive map uses clean
            architectural grid coordinates by default.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
            {floorPlans.map((fp) => (
              <li
                key={fp.id}
                className="p-3.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-extrabold text-slate-950">
                    {fp.name} ({fp.buildingId} · F{fp.floor})
                  </p>
                  <p className="text-xs font-bold text-slate-600">
                    {fp.width}×{fp.height}px
                    {fp.imageUrl ? ' · Image linked' : ' · Grid only'}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDeleteFloorPlan(fp.id)}
                  >
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

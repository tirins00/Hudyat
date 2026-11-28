import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Filter tabs, search bar, and print selection controls for QrSheet.
 */
export default function QrSheetFilterToolbar({
  filterModes,
  filterMode,
  onSelectFilterMode,
  searchQuery,
  onSearchChange,
  filteredCount,
  onSelectAll,
  onClearSelection,
}) {
  const tabs = [
    { id: filterModes.ALL, label: 'All Nodes' },
    { id: filterModes.ASSEMBLY, label: 'Assembly Areas (Check-In)' },
    { id: filterModes.ROOMS, label: 'Rooms' },
    { id: filterModes.EXITS_STAIRS, label: 'Exits & Stairs' },
  ];

  return (
    <Card
      aria-label="QR sheet filters"
      padding="compact"
      className="space-y-4 print:hidden"
    >
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={filterMode === tab.id ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={filterMode === tab.id}
            onClick={() => onSelectFilterMode(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1">
          <label htmlFor="qr-search" className="sr-only">
            Search map nodes
          </label>
          <input
            id="qr-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by node ID, label, building…"
            className="w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-950 focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onSelectAll}>
            Select All ({filteredCount})
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear Selection
          </Button>
        </div>
      </div>
    </Card>
  );
}

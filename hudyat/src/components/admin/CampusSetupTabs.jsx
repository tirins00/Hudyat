import Button from '../ui/Button.jsx';

/**
 * Section tab selector for CampusSetupPage (Overview, Buildings & Floor Plans, Map Graph).
 */
export default function CampusSetupTabs({
  tabs,
  activeTab,
  onSelectTab,
  buildingsCount,
  floorPlansCount,
  nodesCount,
  edgesCount,
}) {
  const items = [
    { id: tabs.OVERVIEW, label: '1. Campus, Policy & Audit' },
    {
      id: tabs.BUILDINGS,
      label: `2. Buildings (${buildingsCount}) & Floor Plans (${floorPlansCount})`,
    },
    {
      id: tabs.GRAPH,
      label: `3. Map Graph (${nodesCount} Nodes / ${edgesCount} Edges)`,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Campus setup sections"
      className="flex flex-wrap gap-3"
    >
      {items.map((tab) => (
        <Button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          variant={activeTab === tab.id ? 'primary' : 'secondary'}
          onClick={() => onSelectTab(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

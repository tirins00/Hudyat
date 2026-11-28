import Button from '../ui/Button.jsx';

/**
 * Tab selector for switching between Roster CSV and Class Schedules CSV import panels.
 */
export default function ImportTypeTabs({ activeTab, onSelectTab, tabs }) {
  return (
    <div
      role="tablist"
      aria-label="CSV import types"
      className="flex flex-wrap gap-3"
    >
      <Button
        role="tab"
        id="tab-roster"
        aria-selected={activeTab === tabs.ROSTER}
        aria-controls="panel-roster"
        variant={activeTab === tabs.ROSTER ? 'primary' : 'secondary'}
        onClick={() => onSelectTab(tabs.ROSTER)}
      >
        1. Roster &amp; Enrollments CSV
      </Button>

      <Button
        role="tab"
        id="tab-schedules"
        aria-selected={activeTab === tabs.SCHEDULES}
        aria-controls="panel-schedules"
        variant={activeTab === tabs.SCHEDULES ? 'primary' : 'secondary'}
        onClick={() => onSelectTab(tabs.SCHEDULES)}
      >
        2. Class Schedules CSV
      </Button>
    </div>
  );
}

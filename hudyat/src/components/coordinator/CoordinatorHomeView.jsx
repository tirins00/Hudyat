import AppShell from '../AppShell.jsx';
import CampusStatusHeader from '../layout/CampusStatusHeader.jsx';
import NavIcon from '../layout/NavIcon.jsx';
import ActionCard from '../ui/ActionCard.jsx';
import Button from '../ui/Button.jsx';

/**
 * Coordinator home view extracted from RoleRouter.
 * Displays live drill status and grouped 1-click operation cards.
 */
export default function CoordinatorHomeView() {
  return (
    <AppShell
      title="Coordinator Operations"
      subtitle="Start or advance campus drills, monitor the live headcount board, preview expected attendance, and manage campus routes and rosters."
    >
      <div className="space-y-6">
        <CampusStatusHeader
          helperText="Launch, advance, or end campus drills and track accountability across all sections."
          action={
            <Button to="/coordinator/drills" variant="primary" size="sm">
              Manage Drills
            </Button>
          }
        />

        <section aria-label="Live drill operations" className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Live Drill Operations
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ActionCard
              to="/coordinator/drills"
              tone="primary"
              icon={<NavIcon name="drills" />}
              title="Manage Drills (Start / Advance / End)"
              description="Start a campus earthquake drill, transition phases, and track verified arrivals."
            />

            <ActionCard
              to="/coordinator/headcount"
              tone="primary"
              icon={<NavIcon name="clipboard" />}
              title="Open Headcount Board"
              description="Monitor section accountability, missing alerts, and incoming SOS incidents."
            />

            <ActionCard
              to="/coordinator/expected-list"
              icon={<NavIcon name="list" />}
              title="Open Expected List"
              description="Preview scheduled attendance by section and room for any date and time."
            />

            <ActionCard
              to="/assisted-check-in"
              icon={<NavIcon name="users" />}
              title="Open Assisted Check-In"
              description="Mark students present manually or verify peer-assisted check-ins."
            />
          </div>
        </section>

        <section aria-label="Preparation and reporting" className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Campus Preparation &amp; Reporting
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ActionCard
              to="/coordinator/roster-import"
              icon={<NavIcon name="upload" />}
              title="Open Roster Import"
              description="Upload validated student roster and class schedule CSV files."
            />

            <ActionCard
              to="/coordinator/reports"
              icon={<NavIcon name="chart" />}
              title="Drill Reports"
              description="Review post-drill accountability metrics, timing, SOS logs, and CSV/PDF export."
            />

            <ActionCard
              to="/coordinator/route"
              icon={<NavIcon name="route" />}
              title="Evacuation Route"
              description="Test stair-only shortest safe paths and blocked-exit rerouting."
            />

            <ActionCard
              to="/coordinator/qr-sheet"
              icon={<NavIcon name="qr" />}
              title="Assembly QR Sheets"
              description="Generate and print standardized assembly and location QR posters."
            />

            <ActionCard
              to="/coordinator/campus-setup"
              icon={<NavIcon name="building" />}
              title="Campus Setup"
              description="Inspect buildings, indoor map graph, and safety policies (read-only)."
            />

            <ActionCard
              to="/alert"
              icon={<NavIcon name="alert" />}
              title="Visual Alert Screen"
              description="Preview the live emergency alert screen with audio and haptic cues."
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

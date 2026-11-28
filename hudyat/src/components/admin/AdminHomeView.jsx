import AppShell from '../AppShell.jsx';
import CampusStatusHeader from '../layout/CampusStatusHeader.jsx';
import NavIcon from '../layout/NavIcon.jsx';
import ActionCard from '../ui/ActionCard.jsx';
import Button from '../ui/Button.jsx';

/**
 * Admin home view extracted from RoleRouter.
 * Gives administrators a clean status overview and 1-click access to Campus Setup,
 * QR Sheets, Roster Import, Drill Dashboard, and Reports.
 */
export default function AdminHomeView() {
  return (
    <AppShell
      title="Admin Console"
      subtitle="Configure campus map graphs and policies, print QR posters, import rosters, and oversee campus drills."
    >
      <div className="space-y-6">
        <CampusStatusHeader
          helperText="Administrators have full write access to campus map graphs, safety policies, QR posters, and drill controls."
          action={
            <Button to="/admin/campus-setup" variant="primary" size="sm">
              Open Campus Setup
            </Button>
          }
        />

        <section aria-label="Administration tools" className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Campus Administration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ActionCard
              to="/admin/campus-setup"
              tone="primary"
              icon={<NavIcon name="building" />}
              title="Campus Setup & Map Graph"
              description="Manage buildings, floor plans, indoor navigation nodes/edges, and <3 Hz alert policy."
            />

            <ActionCard
              to="/coordinator/drills"
              tone="primary"
              icon={<NavIcon name="drills" />}
              title="Drill Dashboard"
              description="Start, advance, or end campus earthquake drills and monitor live responses."
            />

            <ActionCard
              to="/admin/qr-sheet"
              icon={<NavIcon name="qr" />}
              title="Assembly QR Sheets"
              description="Generate, filter, and print standardized HUDYAT QR posters for campus nodes."
            />

            <ActionCard
              to="/admin/roster-import"
              icon={<NavIcon name="upload" />}
              title="Roster & Schedule Import"
              description="Upload validated student rosters, enrollments, and class schedules to Firestore."
            />

            <ActionCard
              to="/admin/reports"
              icon={<NavIcon name="chart" />}
              title="Drill Reports"
              description="Review accountability analytics, evacuation durations, and export CSV/PDF reports."
            />

            <ActionCard
              to="/headcount"
              icon={<NavIcon name="clipboard" />}
              title="Headcount Board"
              description="Inspect live section accountability, missing alerts, and SOS response statuses."
            />

            <ActionCard
              to="/admin/route"
              icon={<NavIcon name="route" />}
              title="Evacuation Route"
              description="Verify Dijkstra stair-only routing and simulate blocked exits across floors."
              className="sm:col-span-2"
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

import AppShell from '../AppShell.jsx';
import CampusStatusHeader from '../layout/CampusStatusHeader.jsx';
import NavIcon from '../layout/NavIcon.jsx';
import ActionCard from '../ui/ActionCard.jsx';
import Button from '../ui/Button.jsx';

/**
 * Teacher home view extracted from RoleRouter.
 * Displays live campus drill status and a responsive grid of Teacher tools.
 */
export default function TeacherHomeView() {
  return (
    <AppShell
      title="My Sections"
      subtitle="View evacuation routes, mark students present, verify peer check-ins, and monitor live section headcount."
    >
      <div className="space-y-6">
        <CampusStatusHeader
          helperText="Monitor section headcount in real time and verify peer-submitted check-ins during evacuation."
          action={
            <Button to="/teacher/headcount" variant="primary" size="sm">
              Open Headcount
            </Button>
          }
        />

        <section aria-label="Teacher drill tools" className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Teacher Drill Tools
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ActionCard
              to="/teacher/headcount"
              tone="primary"
              icon={<NavIcon name="clipboard" />}
              title="Open Headcount Board"
              description="Track accounted, pending peer, and missing students across your sections in real time."
            />

            <ActionCard
              to="/teacher/assisted-check-in"
              icon={<NavIcon name="users" />}
              title="Open Assisted Check-In"
              description="Mark students without phones present and confirm or reject pending peer check-ins."
            />

            <ActionCard
              to="/teacher/route"
              icon={<NavIcon name="route" />}
              title="View Evacuation Route"
              description="Inspect stair-only evacuation routes from classrooms to assembly areas."
            />

            <ActionCard
              to="/alert"
              icon={<NavIcon name="alert" />}
              title="Emergency Alert Screen"
              description="View active drill phase banners, instructions, and visual/haptic alert cues."
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

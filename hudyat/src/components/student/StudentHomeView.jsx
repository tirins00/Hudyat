import AppShell from '../AppShell.jsx';
import CampusStatusHeader from '../layout/CampusStatusHeader.jsx';
import NavIcon from '../layout/NavIcon.jsx';
import ActionCard from '../ui/ActionCard.jsx';
import Button from '../ui/Button.jsx';

/**
 * Student home view extracted from RoleRouter.
 * Displays live campus drill status and a scannable 1-click action grid.
 */
export default function StudentHomeView() {
  return (
    <AppShell
      title="My Drill Plan"
      subtitle="Confirm your safety status and assembly check-in, follow your evacuation route, help a classmate, or send an SOS."
    >
      <div className="space-y-6">
        <CampusStatusHeader
          helperText="When an earthquake drill starts, you will be automatically alerted and guided to the Emergency Alert screen."
          action={
            <Button to="/student/alert" variant="secondary" size="sm">
              Open Alert Screen
            </Button>
          }
        />

        <section aria-label="Quick drill actions" className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700">
            Quick Drill Actions
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ActionCard
              to="/student/step"
              tone="primary"
              icon={<NavIcon name="checkin" />}
              title="Confirm Safety & Assembly Check-In"
              description="1-tap Drop, Cover & Hold confirmation and Assembly Area QR or printed code check-in."
            />

            <ActionCard
              to="/student/route"
              icon={<NavIcon name="route" />}
              title="View Evacuation Route"
              description="Step-by-step indoor shortest safe path to your assembly area (elevators excluded)."
            />

            <ActionCard
              to="/student/assisted-check-in"
              icon={<NavIcon name="users" />}
              title="Check In a Classmate"
              description="Submit a peer check-in for a classmate without a phone or working camera."
            />

            <ActionCard
              to="/student/alert"
              icon={<NavIcon name="alert" />}
              title="Emergency Alert Screen"
              description="View live phase instructions with visual, haptic, and audio alert controls."
            />

            <ActionCard
              to="/student/sos"
              tone="danger"
              icon={<NavIcon name="sos" />}
              title="Send SOS"
              description="Send a silent emergency alert with your last known campus zone."
              className="sm:col-span-2"
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

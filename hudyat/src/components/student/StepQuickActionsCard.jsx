import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Quick navigation actions shown below StepScreen for Student users.
 */
export default function StepQuickActionsCard() {
  return (
    <Card
      aria-label="Other drill actions"
      title="Other Drill Actions"
      padding="compact"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button to="/student/route" variant="secondary" fullWidth>
          View Evacuation Route
        </Button>
        <Button to="/student/assisted-check-in" variant="secondary" fullWidth>
          Check In a Classmate
        </Button>
        <Button to="/student/sos" variant="danger" fullWidth>
          Send SOS
        </Button>
      </div>
    </Card>
  );
}

import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Consolidated, non-overlapping next-step drill actions shown on AlertScreen.
 */
export default function AlertActionGrid({
  isStudent,
  stepPath,
  routePath,
  peerCheckInPath,
  sosPath,
  onNavigate,
}) {
  return (
    <Card
      as="section"
      aria-label="Next drill steps"
      title="Next Drill Steps"
      subtitle="Confirm Safety & Assembly Check-In → Evacuation Route → Peer Check-In → SOS"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          variant="primary"
          fullWidth
          onClick={() => onNavigate(stepPath)}
        >
          Confirm Safety &amp; Assembly Check-In
        </Button>

        <Button
          variant="secondary"
          fullWidth
          onClick={() => onNavigate(routePath)}
        >
          View Evacuation Route
        </Button>

        <Button
          variant="secondary"
          fullWidth
          onClick={() => onNavigate(peerCheckInPath)}
        >
          {isStudent ? 'Check In a Classmate' : 'Assisted Check-In'}
        </Button>

        <Button
          variant={isStudent ? 'danger' : 'secondary'}
          fullWidth
          onClick={() => onNavigate(sosPath)}
        >
          {isStudent ? 'Send SOS' : 'Headcount Board'}
        </Button>
      </div>
    </Card>
  );
}

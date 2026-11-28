import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Interactive Demo Mode controls banner for HeadcountBoard.
 */
export default function HeadcountDemoBanner({
  firebaseReady,
  pastDeadline,
  hasPendingPeerInDemo,
  canSimulateLateCheckIn,
  onToggleDeadline,
  onVerifyPendingPeer,
  onSimulateLateCheckIn,
  onSimulateSos,
  onResetDemo,
}) {
  return (
    <Card
      aria-label="Demo mode controls"
      tone="warning"
      padding="compact"
      className="space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm font-bold text-amber-950">
          {firebaseReady
            ? 'Demo Mode active — showing interactive sample drill data.'
            : 'Firebase .env keys not configured — running in interactive Demo Mode.'}
        </p>
        <span className="text-xs font-semibold text-amber-900">
          MissingMonitor checks every 5s
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onToggleDeadline}>
          {pastDeadline ? 'Simulate Before Deadline' : 'Simulate Past Deadline'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onVerifyPendingPeer}
          disabled={!hasPendingPeerInDemo}
        >
          Verify Pending Peer Check-In
        </Button>
        <Button
          variant="success"
          size="sm"
          onClick={onSimulateLateCheckIn}
          disabled={!canSimulateLateCheckIn}
        >
          Simulate Late Check-In
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => void onSimulateSos()}
        >
          Simulate SOS
        </Button>
        <Button variant="primary" size="sm" onClick={onResetDemo}>
          Reset Demo
        </Button>
      </div>
    </Card>
  );
}

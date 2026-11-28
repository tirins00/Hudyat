import Button from '../ui/Button.jsx';

/**
 * Header action bar for CheckInScreen (SOS trigger + Demo/Live mode toggle).
 */
export default function CheckInHeaderActions({
  useDemoMode,
  onOpenSos,
  onToggleMode,
}) {
  return (
    <>
      <Button variant="danger" onClick={onOpenSos}>
        SOS
      </Button>
      <Button variant="primary" onClick={onToggleMode}>
        {useDemoMode
          ? 'Mode: Demo (Switch to Live)'
          : 'Mode: Live Firestore (Switch to Demo)'}
      </Button>
    </>
  );
}

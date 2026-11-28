import Button from '../ui/Button.jsx';

/**
 * Header action toggle for AssistedCheckInPage.
 */
export default function AssistedHeaderActions({ useDemoMode, onToggleMode }) {
  return (
    <Button variant="primary" onClick={onToggleMode}>
      {useDemoMode
        ? 'Mode: Demo (Switch to Live)'
        : 'Mode: Live Firestore (Switch to Demo)'}
    </Button>
  );
}

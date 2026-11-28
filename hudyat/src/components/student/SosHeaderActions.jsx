import Button from '../ui/Button.jsx';

/**
 * Header action toggle for SosPage (Demo vs Live Firestore).
 */
export default function SosHeaderActions({ useDemoMode, onToggleMode }) {
  return (
    <Button variant="primary" onClick={onToggleMode}>
      {useDemoMode
        ? 'Mode: Demo (Switch to Live)'
        : 'Mode: Live Firestore (Switch to Demo)'}
    </Button>
  );
}

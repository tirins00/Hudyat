import Button from '../ui/Button.jsx';

/**
 * Header print action for QrSheet.
 */
export default function QrSheetHeaderActions({ printableCount, onPrint }) {
  return (
    <Button
      variant="primary"
      onClick={onPrint}
      disabled={printableCount === 0}
    >
      Print / Save PDF ({printableCount})
    </Button>
  );
}

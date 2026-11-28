import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Manual QR payload submission form and Demo Mode simulator buttons.
 */
export default function CheckInManualSimulator({
  manualQrInput,
  onManualQrChange,
  onSubmitQr,
  useDemoMode,
  onSimulateQr,
  onResetDemo,
}) {
  return (
    <Card
      aria-label="Manual QR input and simulator"
      title="QR Simulator & Manual Test"
      className="space-y-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmitQr(manualQrInput);
        }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <input
          type="text"
          value={manualQrInput}
          onChange={(e) => onManualQrChange(e.target.value)}
          placeholder="Paste QR payload (e.g. hudyat://citu-main/assembly-b)"
          aria-label="Manual QR payload"
          className="flex-1 min-h-12 px-4 rounded-xl border border-slate-300 text-sm font-mono text-slate-950 bg-white focus:border-slate-900 focus:outline-none"
        />
        <Button type="submit" variant="primary">
          Submit QR
        </Button>
      </form>

      {useDemoMode && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="success"
            size="sm"
            onClick={() => void onSimulateQr('hudyat://citu-main/assembly-b')}
          >
            Simulate Valid QR (Assembly Area B)
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={() => void onSimulateQr('hudyat://citu-main/assembly-a')}
          >
            Simulate Alternate Assembly (Area A)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void onSimulateQr('hudyat://citu-main/eng-401')}
          >
            Simulate Non-Assembly Door QR (ENG 401)
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() =>
              void onSimulateQr('hudyat://other-campus/assembly-1')
            }
          >
            Simulate Wrong-Campus QR
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void onResetDemo()}
          >
            Reset Check-In
          </Button>
        </div>
      )}
    </Card>
  );
}

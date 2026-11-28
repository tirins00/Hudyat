import Button from '../ui/Button.jsx';

/**
 * Collapsible manual assembly code entry & peer/teacher assisted check-in fallback
 * for students whose device camera is unavailable during evacuation.
 */
export default function ManualAssemblyFallback({
  open,
  onToggle,
  expectedCampusId,
  hintCode,
  manualCodeInput,
  onManualCodeChange,
  onVerifyManualCode,
  submitting,
  assistedCheckInPath,
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-3">
      <Button
        variant="ghost"
        fullWidth
        aria-expanded={open}
        onClick={onToggle}
        className="justify-between px-3 text-left text-slate-950"
      >
        <span>Camera not working? Use manual fallback</span>
        <span aria-hidden="true" className="text-xs font-extrabold uppercase">
          {open ? 'Hide ▲' : 'Show ▼'}
        </span>
      </Button>

      {open && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="space-y-2.5">
            <p className="text-sm font-extrabold text-slate-950">
              Option A: Enter Printed Assembly Code
            </p>
            <p className="text-xs font-medium text-slate-700">
              Type the official assembly code posted on the muster point sign (for
              example:{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-slate-950 border border-slate-200">
                {hintCode}
              </code>{' '}
              or{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-slate-950 border border-slate-200">
                HUDYAT|{expectedCampusId}|assembly|{hintCode}
              </code>
              ).
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={manualCodeInput}
                onChange={(e) => onManualCodeChange(e.target.value)}
                placeholder={`e.g., ${hintCode}`}
                aria-label="Printed assembly area code"
                className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono font-semibold text-slate-950 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
              <Button
                variant="secondary"
                onClick={onVerifyManualCode}
                disabled={submitting}
              >
                Verify Printed Code
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
            <p className="text-sm font-extrabold text-slate-950">
              Option B: Peer / Teacher Check-In
            </p>
            <p className="text-xs font-medium text-slate-700">
              If your phone or camera is completely unusable, ask a classmate or
              teacher at the assembly area to mark you present via Assisted
              Check-In.
            </p>
            <Button to={assistedCheckInPath} variant="secondary">
              Check In a Classmate / Assisted Check-In
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

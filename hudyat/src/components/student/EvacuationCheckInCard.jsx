import QrCameraScanner from '../QrCameraScanner.jsx';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import ManualAssemblyFallback from './ManualAssemblyFallback.jsx';

const EVACUATION_SAFETY_STEPS = Object.freeze([
  { id: 'dch', label: 'Completed Drop, Cover, and Hold On during shaking' },
  { id: 'stairs', label: 'Evacuated using stairs only (no elevators)' },
  {
    id: 'assembly',
    label: 'Arrived at designated Assembly Area and verified code',
  },
]);

/**
 * Phase 2 (Evacuate) assembly QR check-in flow wrapping `<QrCameraScanner>`,
 * `<ManualAssemblyFallback>`, evacuation checklist, and arrival confirmation.
 */
export default function EvacuationCheckInCard({
  expectedCampusId,
  hintCode,
  showManualFallback,
  onToggleManualFallback,
  manualCodeInput,
  onManualCodeChange,
  onQrDecoded,
  onVerifyManualCode,
  verifiedScan,
  onResetScan,
  scanError,
  completedSteps,
  onToggleStep,
  note,
  onNoteChange,
  submitting,
  confirmSectionRef,
  assistedCheckInPath,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card className="space-y-4">
        <div className="space-y-1.5">
          <StatusBadge status="evacuate" pulse>
            Phase 2 — Evacuation &amp; Assembly Check-In
          </StatusBadge>
          <h2 className="text-lg font-extrabold text-slate-950">
            1. Scan Official Assembly Area QR Code
          </h2>
          <p className="text-sm font-medium text-slate-700">
            Proceed to your designated assembly area using stairs only and scan
            the posted{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-950">
              HUDYAT|{expectedCampusId}|assembly|…
            </code>{' '}
            QR code to check in and record your safe arrival.
          </p>
        </div>

        <QrCameraScanner
          elementId="hudyat-step-assembly-qr-reader"
          onScan={onQrDecoded}
          disabled={submitting}
        />

        <ManualAssemblyFallback
          open={showManualFallback}
          onToggle={onToggleManualFallback}
          expectedCampusId={expectedCampusId}
          hintCode={hintCode}
          manualCodeInput={manualCodeInput}
          onManualCodeChange={onManualCodeChange}
          onVerifyManualCode={onVerifyManualCode}
          submitting={submitting}
          assistedCheckInPath={assistedCheckInPath}
        />

        {scanError && (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
          >
            Code Rejected: {scanError}
          </div>
        )}

        {verifiedScan && (
          <div
            role="status"
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                {verifiedScan.method === 'manual_code'
                  ? 'Printed Assembly Code Verified'
                  : 'Assembly QR Verified'}
              </p>
              <p className="text-sm font-extrabold text-slate-950">
                Assembly Area: {verifiedScan.nodeId} (Campus:{' '}
                {verifiedScan.campusId})
              </p>
              <p className="text-xs font-mono text-emerald-950">
                {verifiedScan.qrCode}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={onResetScan}>
              Rescan / Change Code
            </Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card title="2. Evacuation Safety Steps">
          <ul className="space-y-2.5">
            {EVACUATION_SAFETY_STEPS.map((step, idx) => {
              const checked = completedSteps.includes(step.id);
              return (
                <li
                  key={step.id}
                  className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
                    checked
                      ? 'border-emerald-300 bg-emerald-50/80'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                      checked ? 'bg-emerald-700' : 'bg-slate-800'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleStep(step.id)}
                      className="h-5 w-5 accent-slate-950"
                    />
                    <span>{step.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          ref={confirmSectionRef}
          tone={verifiedScan ? 'success' : 'default'}
          title="3. Confirm Safe Arrival at Assembly"
          className={`space-y-4 transition-all ${
            verifiedScan ? 'ring-2 ring-emerald-400' : ''
          }`}
        >
          <label className="block">
            <span className="block text-xs font-bold text-slate-800 mb-1.5">
              Optional Note
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="e.g., Arrived with Section CS-3A"
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-950 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </label>

          {!verifiedScan ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-950">
              Scan the {expectedCampusId} Assembly Area QR code (or verify the
              printed assembly code) above to unlock check-in.
            </p>
          ) : (
            <p className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2.5 text-xs font-extrabold text-emerald-950">
              Ready to record safe arrival &amp; assembly check-in at{' '}
              {verifiedScan.nodeId}.
            </p>
          )}

          <Button
            type="submit"
            variant="success"
            fullWidth
            disabled={!verifiedScan || submitting}
            className="min-h-14 text-base"
          >
            {submitting
              ? 'Recording Safe Arrival…'
              : 'Confirm Safe Arrival at Assembly'}
          </Button>
        </Card>
      </div>
    </form>
  );
}

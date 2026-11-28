import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Confirmation banner rendered on StepScreen once DCH or Assembly check-in is saved.
 */
export default function StepSavedBanner({ saved }) {
  if (!saved) return null;

  return (
    <Card
      as="div"
      role="status"
      tone="success"
      padding="compact"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
          SAFE ARRIVAL &amp; CHECK-IN RECORDED
        </p>
        <p className="text-base font-extrabold text-slate-950">
          Status: {saved.status}
          {saved.nodeId || saved.currentNodeId
            ? ` • Assembly Area: ${saved.nodeId || saved.currentNodeId}`
            : ' • Drop, Cover & Hold Confirmed'}
        </p>
        {saved.qrCode && (
          <p className="mt-0.5 text-xs font-mono font-bold text-emerald-950">
            Verified Code: {saved.qrCode} (
            {saved.method === 'manual_code' ? 'Manual Code' : 'QR Scan'})
          </p>
        )}
      </div>
      <StatusBadge status="safe">
        {saved.verifiedQr ? 'CHECKED IN' : 'CONFIRMED'}
      </StatusBadge>
    </Card>
  );
}

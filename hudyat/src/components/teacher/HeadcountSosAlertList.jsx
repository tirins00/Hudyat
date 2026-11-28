import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Active incoming SOS alert cards for coordinators and teachers on HeadcountBoard.
 */
export default function HeadcountSosAlertList({
  incomingSosAlerts,
  resolvedSosCount,
  sosActionError,
  activeUsersList,
  activeNodesList,
  activeResponsesList,
  onAcknowledgeSos,
  onResolveSos,
}) {
  if (
    incomingSosAlerts.length === 0 &&
    resolvedSosCount === 0 &&
    !sosActionError
  ) {
    return null;
  }

  return (
    <section aria-label="Incoming SOS alerts" className="space-y-3">
      {sosActionError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-950"
        >
          {sosActionError}
        </div>
      )}

      {incomingSosAlerts.map((sos) => {
        const student = activeUsersList.find((u) => u.uid === sos.uid);
        const studentName = student?.displayName ?? sos.uid;
        const responseZoneId = activeResponsesList.find(
          (r) => r.uid === sos.uid,
        )?.currentNodeId;
        const zoneId = sos.nodeId || responseZoneId || '';
        const zoneNode = activeNodesList.find((n) => n.id === zoneId);
        const zoneLabel =
          zoneNode?.label ?? sos.zoneLabel ?? (zoneId || 'Unknown');
        const timeSent = sos.createdAt.toDate().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const isAcknowledged = sos.status === 'acknowledged';

        return (
          <Card
            key={sos.id}
            as="article"
            role="alert"
            tone="danger"
            padding="none"
            className="overflow-hidden"
          >
            <div className="bg-red-700 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-red-900">
                  SOS
                </span>
                <h2 className="text-base font-extrabold">{studentName}</h2>
              </div>
              <StatusBadge status={isAcknowledged ? 'acknowledged' : 'active'}>
                {isAcknowledged ? 'Acknowledged' : 'Active'}
              </StatusBadge>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1 text-sm text-slate-950">
                <p className="text-base font-extrabold text-red-950">
                  {sos.message || 'Emergency assistance needed'}
                </p>
                {sos.note && (
                  <p className="font-semibold text-slate-900">
                    Note: {sos.note}
                  </p>
                )}
                <p className="font-semibold text-slate-800">
                  Last known zone:{' '}
                  <span className="font-extrabold text-slate-950">
                    {zoneLabel}
                  </span>{' '}
                  • Sent at{' '}
                  <span className="font-extrabold text-slate-950">
                    {timeSent}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                {!isAcknowledged && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void onAcknowledgeSos(sos.id)}
                  >
                    Acknowledge
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void onResolveSos(sos.id)}
                >
                  Resolve
                </Button>
              </div>
            </div>
          </Card>
        );
      })}

      {incomingSosAlerts.length === 0 && resolvedSosCount > 0 && (
        <p className="text-xs font-bold text-emerald-950 bg-emerald-50 border border-emerald-300 rounded-xl px-3.5 py-2.5">
          All SOS alerts resolved ({resolvedSosCount} resolved).
        </p>
      )}
    </section>
  );
}

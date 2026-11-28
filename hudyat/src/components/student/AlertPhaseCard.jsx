import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';

/**
 * Displays the active emergency alert phase banner, safety instructions,
 * and visual/haptic/audio cue controls. Preserves < 3 Hz pulse invariant.
 */
export default function AlertPhaseCard({
  drill,
  phase,
  isLive,
  copy,
  soundMuted,
  vibrating,
  audioSupported,
  vibrationSupported,
  onToggleSoundMute,
  onToggleVibration,
}) {
  return (
    <Card
      as="section"
      role="alertdialog"
      aria-live="assertive"
      aria-label={copy.title}
      tone={copy.cardTone}
      className="text-center space-y-5 p-6 sm:p-8"
    >
      <div className="flex items-center justify-center">
        <StatusBadge status={copy.badgeStatus} pulse={isLive}>
          {copy.badge}
        </StatusBadge>
      </div>

      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
        {copy.title}
      </h2>

      {drill && (
        <p className="text-sm font-bold text-slate-800">
          {drill.title} • Campus: {drill.campusId} • Phase: {phase.toUpperCase()}
        </p>
      )}

      <Card as="div" padding="compact" className="mx-auto max-w-xl text-left">
        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
          Immediate Safety Instructions
        </p>
        <p className="text-base font-semibold text-slate-950">
          {copy.instructions}
        </p>
      </Card>

      <Card
        as="div"
        padding="compact"
        className="mx-auto max-w-xl space-y-3 bg-white/95"
      >
        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
          Alert Cues — Visual &amp; Haptic Always Active
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
          <Button
            variant={soundMuted ? 'primary' : 'secondary'}
            onClick={onToggleSoundMute}
            aria-pressed={soundMuted}
          >
            {soundMuted ? 'Unmute Sound' : 'Mute Sound'}
          </Button>

          <Button
            variant="secondary"
            onClick={onToggleVibration}
            disabled={!vibrationSupported && (!audioSupported || soundMuted)}
          >
            {vibrating ? 'Stop Alert Cues' : 'Replay Alert Cues'}
          </Button>
        </div>

        <div className="text-xs font-semibold text-slate-700 space-y-1">
          <p>
            Sound:{' '}
            {audioSupported
              ? soundMuted
                ? 'Muted (Visual & Haptic Active)'
                : 'On'
              : 'Audio unavailable (Visual & Haptic Active)'}
          </p>
          <p>
            Haptic / Vibration:{' '}
            {vibrationSupported
              ? `${vibrating ? 'Active' : 'Ready'} — ${copy.hapticSummary}`
              : 'Not supported on this device (Visual Active)'}
          </p>
        </div>
      </Card>
    </Card>
  );
}

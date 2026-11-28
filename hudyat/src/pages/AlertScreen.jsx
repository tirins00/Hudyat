import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../routes/authContext.js';
import {
  claimPhaseAlertTrigger,
  findLatestDrillForCampus,
  getDrillPhaseEventKey,
  isActiveDrillPhase,
} from '../services/AlertCoordinator.js';
import { DrillService } from '../services/DrillService.js';
import { SoundService } from '../services/SoundService.js';
import { VibrationService } from '../services/VibrationService.js';
import { DRILL_PHASES, ROLES } from '../types/models.js';

const PHASE_ALERT_COPY = Object.freeze({
  [DRILL_PHASES.DCH]: {
    badge: 'DROP • COVER • HOLD ON',
    title: 'EARTHQUAKE DRILL ALERT',
    instructions:
      'Drop to the floor, take cover under a sturdy desk or table, and hold on until the shaking stops.',
    hapticSummary: '3 long pulses (Drop, Cover & Hold)',
    cardClass: 'border-red-700 bg-red-50',
    badgeClass: 'bg-red-700 text-white',
  },
  [DRILL_PHASES.EVACUATE]: {
    badge: 'EVACUATE NOW • NO ELEVATORS',
    title: 'EVACUATION PHASE ACTIVE',
    instructions:
      'Proceed calmly to your designated assembly area using stairwells only. Do not use elevators.',
    hapticSummary: '4 urgent pulses (Evacuate Now)',
    cardClass: 'border-amber-800 bg-amber-50',
    badgeClass: 'bg-amber-900 text-white',
  },
  [DRILL_PHASES.ENDED]: {
    badge: 'ALL CLEAR',
    title: 'DRILL ENDED',
    instructions:
      'The drill has concluded. Follow coordinator instructions to return to rooms.',
    hapticSummary: '1 steady confirmation pulse (All Clear)',
    cardClass: 'border-emerald-800 bg-emerald-50',
    badgeClass: 'bg-emerald-800 text-white',
  },
});

export default function AlertScreen({
  drillService = DrillService,
  vibrationService = VibrationService,
  soundService = SoundService,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const campusId = user?.campusId || 'cit-u';
  const isStudent = !user?.role || user.role === ROLES.STUDENT;

  const [drill, setDrill] = useState(null);
  const [vibrating, setVibrating] = useState(false);
  const [soundMuted, setSoundMuted] = useState(() => soundService.isMuted());

  const vibrationSupported = vibrationService.isSupported();
  const audioSupported = soundService.isSupported();
  const lastHandledKeyRef = useRef(null);

  useEffect(() => {
    return drillService.subscribeToDrills((list) => {
      setDrill(findLatestDrillForCampus(list, campusId));
    });
  }, [drillService, campusId]);

  useEffect(() => {
    return soundService.subscribeMute((muted) => {
      setSoundMuted(muted);
    });
  }, [soundService]);

  const phase = drill?.phase || DRILL_PHASES.DCH;
  const isLive = isActiveDrillPhase(phase);
  const copy = PHASE_ALERT_COPY[phase] || PHASE_ALERT_COPY[DRILL_PHASES.DCH];

  useEffect(() => {
    if (!drill?.id) {
      return;
    }

    const eventKey = getDrillPhaseEventKey(drill);
    if (!eventKey || lastHandledKeyRef.current === eventKey) {
      return;
    }
    lastHandledKeyRef.current = eventKey;

    if (claimPhaseAlertTrigger(eventKey)) {
      if (vibrationSupported) {
        vibrationService.vibratePhase(phase);
      }
      soundService.playPhaseAlertSound(phase);
    }
  }, [drill, phase, vibrationSupported, vibrationService, soundService]);

  function handleToggleSoundMute() {
    soundService.unlockAudio();
    const nextMuted = soundService.toggleMuted();
    setSoundMuted(nextMuted);
    if (!nextMuted && isLive) {
      soundService.playPhaseAlertSound(phase);
    }
  }

  function handleToggleVibration() {
    soundService.unlockAudio();
    if (vibrating) {
      vibrationService.stopVibration();
      soundService.stopAlertSound();
      setVibrating(false);
    } else {
      const started = vibrationService.vibratePhase(phase);
      if (!soundService.isMuted()) {
        soundService.playPhaseAlertSound(phase);
      }
      setVibrating(started);
    }
  }

  const stepPath = isStudent ? '/student/step' : '/steps';
  const routePath = isStudent
    ? '/student/route'
    : `/${user?.role || 'student'}/route`;
  const peerCheckInPath = isStudent
    ? '/student/assisted-check-in'
    : '/assisted-check-in';
  const sosPath = isStudent ? '/student/sos' : '/headcount';

  return (
    <AppShell
      title="Emergency Alert"
      subtitle="Visual, haptic, and audio alert with direct drill actions."
    >
      <section
        role="alertdialog"
        aria-live="assertive"
        aria-label={copy.title}
        className={`rounded-2xl border-2 p-6 sm:p-8 text-center space-y-5 ${copy.cardClass}`}
      >
        <div className="flex items-center justify-center gap-2.5">
          {isLive && (
            <span
              aria-hidden="true"
              className="hudyat-alert-pulse inline-block h-3.5 w-3.5 rounded-full bg-red-700"
            />
          )}
          <span
            className={`inline-block rounded-full px-4 py-1.5 text-xs font-extrabold tracking-widest uppercase ${copy.badgeClass}`}
          >
            {copy.badge}
          </span>
        </div>

        <h2 className="text-3xl font-extrabold text-slate-950">{copy.title}</h2>

        {drill && (
          <p className="text-sm font-bold text-slate-800">
            {drill.title} • Campus: {drill.campusId} • Phase: {phase.toUpperCase()}
          </p>
        )}

        <div className="mx-auto max-w-xl rounded-xl border-2 border-slate-900 bg-white p-5 text-left">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
            Immediate Safety Instructions
          </p>
          <p className="text-base font-semibold text-slate-950">{copy.instructions}</p>
        </div>

        {/* Audio & Haptic Alert Controls */}
        <div className="mx-auto max-w-xl rounded-xl border-2 border-slate-300 bg-white p-4 space-y-3">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Alert Cues — Visual &amp; Haptic Always Active
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleToggleSoundMute}
              aria-pressed={soundMuted}
              className={`hudyat-btn ${
                soundMuted ? 'hudyat-btn-primary' : 'hudyat-btn-secondary'
              }`}
            >
              {soundMuted ? 'Unmute Sound' : 'Mute Sound'}
            </button>

            <button
              type="button"
              onClick={handleToggleVibration}
              disabled={!vibrationSupported && (!audioSupported || soundMuted)}
              className="hudyat-btn hudyat-btn-secondary"
            >
              {vibrating ? 'Stop Alert Cues' : 'Replay Alert Cues'}
            </button>
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
        </div>

        {/* Consolidated, Non-Overlapping Next-Step Actions */}
        <div className="mx-auto max-w-2xl rounded-xl border-2 border-slate-900 bg-white p-5 text-left space-y-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Next Drill Steps
            </p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">
              Confirm Safety &amp; Assembly Check-In → Evacuation Route → Peer Check-In → SOS
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate(stepPath)}
              className="hudyat-btn hudyat-btn-primary sm:w-full"
            >
              Confirm Safety &amp; Assembly Check-In
            </button>

            <button
              type="button"
              onClick={() => navigate(routePath)}
              className="hudyat-btn hudyat-btn-secondary sm:w-full"
            >
              View Evacuation Route
            </button>

            <button
              type="button"
              onClick={() => navigate(peerCheckInPath)}
              className="hudyat-btn hudyat-btn-secondary sm:w-full"
            >
              {isStudent ? 'Check In a Classmate' : 'Assisted Check-In'}
            </button>

            <button
              type="button"
              onClick={() => navigate(sosPath)}
              className={`hudyat-btn sm:w-full ${
                isStudent ? 'hudyat-btn-danger' : 'hudyat-btn-secondary'
              }`}
            >
              {isStudent ? 'Send SOS' : 'Headcount Board'}
            </button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

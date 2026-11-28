import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import AlertActionGrid from '../components/student/AlertActionGrid.jsx';
import AlertPhaseCard from '../components/student/AlertPhaseCard.jsx';
import PageStack from '../components/ui/PageStack.jsx';
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
    badgeStatus: 'dch',
    cardTone: 'warning',
    title: 'EARTHQUAKE DRILL ALERT',
    instructions:
      'Drop to the floor, take cover under a sturdy desk or table, and hold on until the shaking stops.',
    hapticSummary: '3 long pulses (Drop, Cover & Hold)',
  },
  [DRILL_PHASES.EVACUATE]: {
    badge: 'EVACUATE NOW • NO ELEVATORS',
    badgeStatus: 'evacuate',
    cardTone: 'danger',
    title: 'EVACUATION PHASE ACTIVE',
    instructions:
      'Proceed calmly to your designated assembly area using stairwells only. Do not use elevators.',
    hapticSummary: '4 urgent pulses (Evacuate Now)',
  },
  [DRILL_PHASES.ENDED]: {
    badge: 'ALL CLEAR',
    badgeStatus: 'ended',
    cardTone: 'success',
    title: 'DRILL ENDED',
    instructions:
      'The drill has concluded. Follow coordinator instructions to return to rooms.',
    hapticSummary: '1 steady confirmation pulse (All Clear)',
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
      <PageStack>
        <AlertPhaseCard
          drill={drill}
          phase={phase}
          isLive={isLive}
          copy={copy}
          soundMuted={soundMuted}
          vibrating={vibrating}
          audioSupported={audioSupported}
          vibrationSupported={vibrationSupported}
          onToggleSoundMute={handleToggleSoundMute}
          onToggleVibration={handleToggleVibration}
        />

        <AlertActionGrid
          isStudent={isStudent}
          stepPath={stepPath}
          routePath={routePath}
          peerCheckInPath={peerCheckInPath}
          sosPath={sosPath}
          onNavigate={(path) => navigate(path)}
        />
      </PageStack>
    </AppShell>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../routes/authContext.js';
import {
  claimPhaseAlertTrigger,
  findActiveDrillForCampus,
  getDrillPhaseEventKey,
} from '../services/AlertCoordinator.js';
import { DrillService } from '../services/DrillService.js';
import { SoundService } from '../services/SoundService.js';
import { VibrationService } from '../services/VibrationService.js';
import { DRILL_PHASES, ROLES } from '../types/models.js';

const PHASE_BANNER_LABELS = Object.freeze({
  [DRILL_PHASES.DCH]: 'DROP, COVER & HOLD',
  [DRILL_PHASES.EVACUATE]: 'EVACUATE NOW',
});

function isAlertRoute(pathname) {
  return pathname === '/student/alert' || pathname === '/alert';
}

export default function ActiveDrillWatcher({
  drillService = DrillService,
  vibrationService = VibrationService,
  soundService = SoundService,
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drills, setDrills] = useState([]);

  const isStudent = !loading && user?.role === ROLES.STUDENT;
  const campusId = user?.campusId || 'cit-u';
  const onAlertPage = isAlertRoute(location.pathname);

  const lastAlertedKeyRef = useRef(null);
  const lastRedirectedKeyRef = useRef(null);
  const trackedActiveDrillIdRef = useRef(null);

  useEffect(() => {
    if (!isStudent) {
      lastAlertedKeyRef.current = null;
      lastRedirectedKeyRef.current = null;
      trackedActiveDrillIdRef.current = null;
      return undefined;
    }

    return drillService.subscribeToDrills((list) => {
      setDrills(Array.isArray(list) ? list : []);
    });
  }, [isStudent, drillService]);

  const activeDrill = isStudent ? findActiveDrillForCampus(drills, campusId) : null;

  // Handle active drill start, phase changes, auto-navigation, and all-clear transitions.
  useEffect(() => {
    if (!isStudent) {
      return;
    }

    if (activeDrill) {
      trackedActiveDrillIdRef.current = activeDrill.id;
      const eventKey = getDrillPhaseEventKey(activeDrill);

      if (eventKey && lastAlertedKeyRef.current !== eventKey) {
        lastAlertedKeyRef.current = eventKey;
        if (claimPhaseAlertTrigger(eventKey)) {
          vibrationService.vibratePhase(activeDrill.phase);
          soundService.playPhaseAlertSound(activeDrill.phase);
        }
      }

      if (eventKey && lastRedirectedKeyRef.current !== eventKey) {
        lastRedirectedKeyRef.current = eventKey;
        if (!onAlertPage) {
          navigate('/student/alert', {
            state: {
              drillId: activeDrill.id,
              phase: activeDrill.phase,
              autoAlert: true,
            },
          });
        }
      }
      return;
    }

    // If a previously active drill just transitioned to ENDED, fire the All Clear cues once.
    const previousDrillId = trackedActiveDrillIdRef.current;
    if (previousDrillId) {
      const endedDrill = drills.find(
        (d) => d.id === previousDrillId && d.phase === DRILL_PHASES.ENDED,
      );
      if (endedDrill) {
        const endedKey = getDrillPhaseEventKey(endedDrill);
        if (endedKey && lastAlertedKeyRef.current !== endedKey) {
          lastAlertedKeyRef.current = endedKey;
          if (claimPhaseAlertTrigger(endedKey)) {
            vibrationService.vibratePhase(DRILL_PHASES.ENDED);
            soundService.playPhaseAlertSound(DRILL_PHASES.ENDED);
          }
        }
      }
      trackedActiveDrillIdRef.current = null;
    }
  }, [
    isStudent,
    activeDrill,
    drills,
    onAlertPage,
    navigate,
    vibrationService,
    soundService,
  ]);

  if (!isStudent || !activeDrill || onAlertPage) {
    return null;
  }

  const phaseLabel =
    PHASE_BANNER_LABELS[activeDrill.phase] || activeDrill.phase.toUpperCase();
  const isEvacuate = activeDrill.phase === DRILL_PHASES.EVACUATE;

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`sticky top-0 z-50 border-b-2 text-white shadow-sm ${
        isEvacuate
          ? 'border-amber-950 bg-amber-900'
          : 'border-red-950 bg-red-800'
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2.5 text-sm font-extrabold">
          <span
            aria-hidden="true"
            className="hudyat-alert-pulse inline-block h-3 w-3 shrink-0 rounded-full bg-white"
          />
          <span>
            ACTIVE DRILL: {phaseLabel}
          </span>
        </div>

        <Link
          to="/student/alert"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border-2 border-white bg-slate-950 px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-white"
        >
          ACTIVE DRILL — Return to Alert
        </Link>
      </div>
    </div>
  );
}

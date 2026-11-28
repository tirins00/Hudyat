import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ActiveDrillBannerContext } from './layout/ActiveDrillContext.js';
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
  children,
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

  const bannerInfo = useMemo(() => {
    if (!isStudent || !activeDrill || onAlertPage) {
      return null;
    }
    const phaseLabel =
      PHASE_BANNER_LABELS[activeDrill.phase] || activeDrill.phase.toUpperCase();
    return {
      drillId: activeDrill.id,
      phase: activeDrill.phase,
      phaseLabel,
      isEvacuate: activeDrill.phase === DRILL_PHASES.EVACUATE,
    };
  }, [isStudent, activeDrill, onAlertPage]);

  // When wrapping routes, expose banner state via context so AppShell stacks it
  // cleanly below the sticky top bar and beside the desktop sidebar.
  if (children !== undefined) {
    return (
      <ActiveDrillBannerContext.Provider value={bannerInfo}>
        {children}
      </ActiveDrillBannerContext.Provider>
    );
  }

  if (!bannerInfo) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`sticky top-0 z-50 border-b-2 text-white shadow-sm ${
        bannerInfo.isEvacuate
          ? 'border-red-950 bg-red-700'
          : 'border-amber-950 bg-amber-800'
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2.5 text-sm font-extrabold">
          <span
            aria-hidden="true"
            className="hudyat-alert-pulse inline-block h-3 w-3 shrink-0 rounded-full bg-white"
          />
          <span>ACTIVE DRILL: {bannerInfo.phaseLabel}</span>
        </div>

        <Link
          to="/student/alert"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-white bg-slate-950 px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          ACTIVE DRILL — Return to Alert
        </Link>
      </div>
    </div>
  );
}

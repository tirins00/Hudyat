import { useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ActiveDrillBannerContext } from './layout/ActiveDrillContext.js';
import { useAuth } from '../routes/authContext.js';
import {
  claimPhaseAlertTrigger,
  findActiveDrillForCampus,
  getDrillPhaseEventKey,
} from '../services/AlertCoordinator.js';
import { DrillService } from '../services/DrillService.js';
import { LocalNotificationService } from '../services/LocalNotificationService.js';
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

function isNativeApp() {
  try {
    return Boolean(
      Capacitor &&
        typeof Capacitor.isNativePlatform === 'function' &&
        Capacitor.isNativePlatform(),
    );
  } catch {
    return false;
  }
}

export default function ActiveDrillWatcher({
  drillService = DrillService,
  vibrationService = VibrationService,
  soundService = SoundService,
  localNotificationService = LocalNotificationService,
  capacitorApp = CapacitorApp,
  children,
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drills, setDrills] = useState([]);
  const [foregroundResumeTick, setForegroundResumeTick] = useState(0);

  const isStudent = !loading && user?.role === ROLES.STUDENT;
  const campusId = user?.campusId || 'cit-u';
  const onAlertPage = isAlertRoute(location.pathname);

  const isAppActiveRef = useRef(true);
  const lastAlertedKeyRef = useRef(null);
  const lastForegroundAlertedKeyRef = useRef(null);
  const lastNotifiedKeyRef = useRef(null);
  const lastRedirectedKeyRef = useRef(null);
  const trackedActiveDrillIdRef = useRef(null);

  // Initialize native local notifications & listen for notification tap actions.
  useEffect(() => {
    if (!isStudent) {
      return undefined;
    }

    void localNotificationService.initLocalNotifications();

    const cleanupTap = localNotificationService.subscribeNotificationTap(
      (extra) => {
        const targetRoute = extra?.route || '/student/alert';
        navigate(targetRoute, {
          state: {
            drillId: extra?.drillId,
            phase: extra?.phase,
            fromNotification: true,
          },
        });
      },
    );

    return () => {
      void cleanupTap();
    };
  }, [isStudent, localNotificationService, navigate]);

  // Track native Capacitor app background/foreground state and document visibility.
  useEffect(() => {
    if (!isStudent) {
      return undefined;
    }

    let cancelled = false;
    let removed = false;
    let appListenerHandle = null;

    const removeAppListener = (handle) => {
      if (removed || !handle || typeof handle.remove !== 'function') {
        return undefined;
      }
      removed = true;
      return Promise.resolve(handle.remove()).catch(() => {});
    };

    if (
      isNativeApp() &&
      capacitorApp &&
      typeof capacitorApp.addListener === 'function'
    ) {
      Promise.resolve(
        capacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (cancelled) {
            return;
          }
          const active = Boolean(isActive);
          isAppActiveRef.current = active;
          if (active) {
            setForegroundResumeTick((tick) => tick + 1);
          }
        }),
      )
        .then((handle) => {
          appListenerHandle = handle;
          if (cancelled) {
            return removeAppListener(handle);
          }
          return undefined;
        })
        .catch(() => undefined);
    }

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        isAppActiveRef.current = true;
        setForegroundResumeTick((tick) => tick + 1);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      void removeAppListener(appListenerHandle);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [isStudent, capacitorApp]);

  useEffect(() => {
    if (!isStudent) {
      lastAlertedKeyRef.current = null;
      lastForegroundAlertedKeyRef.current = null;
      lastNotifiedKeyRef.current = null;
      lastRedirectedKeyRef.current = null;
      trackedActiveDrillIdRef.current = null;
      return undefined;
    }

    return drillService.subscribeToDrills((list) => {
      setDrills(Array.isArray(list) ? list : []);
    });
  }, [isStudent, drillService]);

  const activeDrill = isStudent
    ? findActiveDrillForCampus(drills, campusId)
    : null;

  // Handle active drill start, phase changes, background notifications, foreground resume, and all-clear.
  useEffect(() => {
    if (!isStudent) {
      return;
    }

    const isBackgrounded =
      !isAppActiveRef.current ||
      (typeof document !== 'undefined' && Boolean(document.hidden));

    if (activeDrill) {
      trackedActiveDrillIdRef.current = activeDrill.id;
      const eventKey = getDrillPhaseEventKey(activeDrill);

      if (eventKey) {
        if (isBackgrounded) {
          if (lastNotifiedKeyRef.current !== eventKey) {
            lastNotifiedKeyRef.current = eventKey;
            void localNotificationService.sendPhaseLocalNotification({
              drillId: activeDrill.id,
              phase: activeDrill.phase,
              title: activeDrill.title,
            });
          }

          if (lastAlertedKeyRef.current !== eventKey) {
            lastAlertedKeyRef.current = eventKey;
            if (claimPhaseAlertTrigger(eventKey)) {
              vibrationService.vibratePhase(activeDrill.phase);
              soundService.playPhaseAlertSound(activeDrill.phase);
            }
          }
          return;
        }

        // Foreground execution (initial arrival OR resumed from background)
        if (lastForegroundAlertedKeyRef.current !== eventKey) {
          const alreadyClaimedWhileBackgrounded =
            lastAlertedKeyRef.current === eventKey;
          lastAlertedKeyRef.current = eventKey;
          lastForegroundAlertedKeyRef.current = eventKey;

          if (
            alreadyClaimedWhileBackgrounded ||
            claimPhaseAlertTrigger(eventKey)
          ) {
            vibrationService.vibratePhase(activeDrill.phase);
            soundService.playPhaseAlertSound(activeDrill.phase);
          }
        }

        if (lastRedirectedKeyRef.current !== eventKey) {
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
        if (endedKey) {
          if (isBackgrounded && lastNotifiedKeyRef.current !== endedKey) {
            lastNotifiedKeyRef.current = endedKey;
            void localNotificationService.sendPhaseLocalNotification({
              drillId: endedDrill.id,
              phase: DRILL_PHASES.ENDED,
              title: endedDrill.title,
            });
          }

          if (lastAlertedKeyRef.current !== endedKey) {
            lastAlertedKeyRef.current = endedKey;
            if (!isBackgrounded) {
              lastForegroundAlertedKeyRef.current = endedKey;
            }
            if (claimPhaseAlertTrigger(endedKey)) {
              vibrationService.vibratePhase(DRILL_PHASES.ENDED);
              soundService.playPhaseAlertSound(DRILL_PHASES.ENDED);
            }
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
    foregroundResumeTick,
    navigate,
    vibrationService,
    soundService,
    localNotificationService,
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

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DrillService } from '../services/DrillService.js';
import { VibrationService } from '../services/VibrationService.js';
import { DRILL_PHASES } from '../types/models.js';

const PHASE_ALERT_COPY = {
  [DRILL_PHASES.DCH]: {
    badge: 'DROP • COVER • HOLD ON',
    title: 'EARTHQUAKE DRILL ALERT',
    instructions:
      'Drop to the floor, take cover under a sturdy desk or table, and hold on until the shaking stops.',
  },
  [DRILL_PHASES.EVACUATE]: {
    badge: 'EVACUATE NOW • NO ELEVATORS',
    title: 'EVACUATION PHASE ACTIVE',
    instructions:
      'Proceed calmly to your designated assembly area using stairwells only. Do not use elevators.',
  },
  [DRILL_PHASES.ENDED]: {
    badge: 'ALL CLEAR',
    title: 'DRILL ENDED',
    instructions: 'The drill has concluded. Follow coordinator instructions to return to rooms.',
  },
};

export default function AlertScreen({
  drillService = DrillService,
  vibrationService = VibrationService,
}) {
  const navigate = useNavigate();
  const [drill, setDrill] = useState(null);
  const [vibrating, setVibrating] = useState(false);
  const vibrationSupported = vibrationService.isSupported();

  useEffect(() => {
    return drillService.subscribeToDrills((list) => {
      setDrill(list[0] || null);
    });
  }, [drillService]);

  const phase = drill?.phase || DRILL_PHASES.DCH;
  const isLive = phase === DRILL_PHASES.DCH || phase === DRILL_PHASES.EVACUATE;
  const copy = PHASE_ALERT_COPY[phase] || PHASE_ALERT_COPY[DRILL_PHASES.DCH];

  useEffect(() => {
    if (isLive && vibrationSupported) {
      vibrationService.vibrateAlert();
    }
    return () => {
      vibrationService.stopVibration();
    };
  }, [drill?.id, phase, isLive, vibrationSupported, vibrationService]);

  function handleToggleVibration() {
    if (vibrating) {
      vibrationService.stopVibration();
      setVibrating(false);
    } else {
      setVibrating(vibrationService.vibrateAlert());
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="bg-white border-b-2 border-slate-900">
        <div className="mx-auto max-w-4xl px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold tracking-widest uppercase text-slate-700">
              HUDYAT • VISUAL &amp; HAPTIC ALERT
            </p>
            <h1 className="text-2xl font-extrabold text-slate-950">Emergency Alert</h1>
          </div>
          <Link
            to="/"
            className="rounded-lg border-2 border-slate-950 bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <section
          role="alertdialog"
          aria-live="assertive"
          aria-label={copy.title}
          className={`rounded-2xl border-2 p-8 text-center space-y-5 ${
            phase === DRILL_PHASES.ENDED
              ? 'border-emerald-800 bg-emerald-50'
              : 'border-red-700 bg-red-50'
          }`}
        >
          <span
            className={`inline-block rounded-full px-4 py-1 text-xs font-extrabold tracking-widest uppercase text-white ${
              phase === DRILL_PHASES.ENDED ? 'bg-emerald-800' : 'bg-red-700'
            }`}
          >
            {copy.badge}
          </span>

          <h2 className="text-3xl font-extrabold text-slate-950">{copy.title}</h2>

          {drill && (
            <p className="text-sm font-bold text-slate-700">
              {drill.title} • Campus: {drill.campusId} • Phase: {phase.toUpperCase()}
            </p>
          )}

          <div className="mx-auto max-w-xl rounded-xl border-2 border-slate-900 bg-white p-5 text-left">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
              Immediate Safety Instructions
            </p>
            <p className="text-base font-semibold text-slate-950">{copy.instructions}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
            <span>
              Haptic / Vibration:{' '}
              {vibrationSupported
                ? vibrating
                  ? 'Active'
                  : 'Standby'
                : 'Not supported on this device'}
            </span>
            <button
              type="button"
              onClick={handleToggleVibration}
              disabled={!vibrationSupported}
              className="rounded-lg border-2 border-slate-950 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
            >
              {vibrating ? 'Stop Vibration' : 'Test Vibration'}
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/steps')}
              className="rounded-lg bg-slate-950 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              Acknowledge &amp; Confirm Steps
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

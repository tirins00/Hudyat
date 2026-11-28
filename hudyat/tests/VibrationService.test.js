import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PHASE_VIBRATION_PATTERNS,
  VIBRATION_PATTERNS,
  VibrationServiceImpl,
  getPhaseVibrationPattern,
} from '../src/services/VibrationService.js';
import { DRILL_PHASES } from '../src/types/models.js';

describe('VibrationService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false safely when navigator.vibrate is unavailable', () => {
    const service = new VibrationServiceImpl(null);
    expect(service.isSupported()).toBe(false);
    expect(service.vibrateAlert()).toBe(false);
    expect(service.stopVibration()).toBe(false);
  });

  it('triggers predefined patterns when supported', () => {
    const calls = [];
    const service = new VibrationServiceImpl({
      vibrate(pattern) {
        calls.push(pattern);
        return true;
      },
    });

    expect(service.isSupported()).toBe(true);
    expect(service.vibrateAlert()).toBe(true);
    expect(service.vibrateStepConfirmed()).toBe(true);
    expect(service.stopVibration()).toBe(true);
    expect(calls).toEqual([
      VIBRATION_PATTERNS.ALERT,
      VIBRATION_PATTERNS.STEP_CONFIRMED,
      0,
    ]);
  });

  it('triggers distinct phase patterns via navigator.vibrate fallback', () => {
    const calls = [];
    const service = new VibrationServiceImpl({
      vibrate(pattern) {
        calls.push(pattern);
        return true;
      },
    });

    expect(service.vibratePhase(DRILL_PHASES.DCH)).toBe(true);
    expect(service.vibratePhase(DRILL_PHASES.EVACUATE)).toBe(true);
    expect(service.vibratePhase(DRILL_PHASES.ENDED)).toBe(true);

    expect(calls).toEqual([
      PHASE_VIBRATION_PATTERNS.dch,
      PHASE_VIBRATION_PATTERNS.evacuate,
      PHASE_VIBRATION_PATTERNS.ended,
    ]);
    expect(getPhaseVibrationPattern('dch')).toEqual([800, 250, 800, 250, 800]);
    expect(getPhaseVibrationPattern('evacuate')).toEqual([
      500, 200, 500, 200, 500, 200, 500,
    ]);
    expect(getPhaseVibrationPattern('ended')).toEqual([400]);
  });

  it('sequences multi-pulse phase vibrations with @capacitor/haptics and supports cancellation', () => {
    vi.useFakeTimers();
    const hapticsCalls = [];
    const mockHaptics = {
      vibrate: vi.fn(async (opts) => {
        hapticsCalls.push(opts);
      }),
    };

    const service = new VibrationServiceImpl(null, mockHaptics);
    expect(service.isSupported()).toBe(true);

    // DCH: 3 long pulses (800ms on, 250ms pause)
    expect(service.vibratePhase(DRILL_PHASES.DCH)).toBe(true);
    expect(hapticsCalls).toEqual([{ duration: 800 }]);

    vi.advanceTimersByTime(1050);
    expect(hapticsCalls).toEqual([{ duration: 800 }, { duration: 800 }]);

    vi.advanceTimersByTime(1050);
    expect(hapticsCalls).toEqual([
      { duration: 800 },
      { duration: 800 },
      { duration: 800 },
    ]);

    // EVACUATE: 4 urgent pulses (500ms on, 200ms pause), stopped after 2 pulses
    hapticsCalls.length = 0;
    expect(service.vibratePhase(DRILL_PHASES.EVACUATE)).toBe(true);
    expect(hapticsCalls).toEqual([{ duration: 500 }]);

    vi.advanceTimersByTime(700);
    expect(hapticsCalls).toEqual([{ duration: 500 }, { duration: 500 }]);

    expect(service.stopVibration()).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(hapticsCalls).toEqual([{ duration: 500 }, { duration: 500 }]);

    // ENDED: 1 steady confirmation pulse (400ms)
    hapticsCalls.length = 0;
    expect(service.vibratePhase(DRILL_PHASES.ENDED)).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(hapticsCalls).toEqual([{ duration: 400 }]);
  });
});

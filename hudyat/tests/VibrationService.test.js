import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PHASE_VIBRATION_PATTERNS,
  VIBRATION_PATTERNS,
  VibrationServiceImpl,
  getPhaseVibrationPattern,
} from '../src/services/VibrationService.js';
import { DRILL_PHASES } from '../src/types/models.js';

function getTotalDurationMs(pattern) {
  return pattern.reduce((sum, ms) => sum + ms, 0);
}

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

  it('triggers distinct phase patterns via navigator.vibrate fallback with >= 3000ms total duration', () => {
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
    expect(getPhaseVibrationPattern('dch')).toEqual([900, 250, 900, 250, 900]);
    expect(getPhaseVibrationPattern('evacuate')).toEqual([
      550, 150, 550, 150, 550, 150, 550, 150, 550,
    ]);
    expect(getPhaseVibrationPattern('ended')).toEqual([1200, 600, 1200]);

    for (const phase of [
      DRILL_PHASES.DCH,
      DRILL_PHASES.EVACUATE,
      DRILL_PHASES.ENDED,
    ]) {
      expect(getTotalDurationMs(getPhaseVibrationPattern(phase))).toBeGreaterThanOrEqual(
        3000,
      );
    }
  });

  it('sequences multi-pulse phase vibrations with @capacitor/haptics (>= 3000ms) and supports cancellation', () => {
    vi.useFakeTimers();
    const hapticsCalls = [];
    const mockHaptics = {
      vibrate: vi.fn(async (opts) => {
        hapticsCalls.push(opts);
      }),
    };

    const service = new VibrationServiceImpl(null, mockHaptics);
    expect(service.isSupported()).toBe(true);

    // DCH: 3 heavy pulses (900ms on, 250ms pause -> 3200ms total)
    expect(service.vibratePhase(DRILL_PHASES.DCH)).toBe(true);
    expect(hapticsCalls).toEqual([{ duration: 900 }]);

    vi.advanceTimersByTime(1150);
    expect(hapticsCalls).toEqual([{ duration: 900 }, { duration: 900 }]);

    vi.advanceTimersByTime(1150);
    expect(hapticsCalls).toEqual([
      { duration: 900 },
      { duration: 900 },
      { duration: 900 },
    ]);

    // EVACUATE: 5 urgent pulses (550ms on, 150ms pause -> 3350ms total), stopped after 2 pulses
    hapticsCalls.length = 0;
    expect(service.vibratePhase(DRILL_PHASES.EVACUATE)).toBe(true);
    expect(hapticsCalls).toEqual([{ duration: 550 }]);

    vi.advanceTimersByTime(700);
    expect(hapticsCalls).toEqual([{ duration: 550 }, { duration: 550 }]);

    expect(service.stopVibration()).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(hapticsCalls).toEqual([{ duration: 550 }, { duration: 550 }]);

    // ENDED: 2 steady all-clear pulses (1200ms on, 600ms pause, 1200ms on -> 3000ms total)
    hapticsCalls.length = 0;
    expect(service.vibratePhase(DRILL_PHASES.ENDED)).toBe(true);
    expect(hapticsCalls).toEqual([{ duration: 1200 }]);

    vi.advanceTimersByTime(1800);
    expect(hapticsCalls).toEqual([{ duration: 1200 }, { duration: 1200 }]);
  });
});

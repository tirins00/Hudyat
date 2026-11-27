import { describe, expect, it } from 'vitest';
import {
  VIBRATION_PATTERNS,
  VibrationServiceImpl,
} from '../src/services/VibrationService.js';

describe('VibrationService', () => {
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
});

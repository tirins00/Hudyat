/**
 * VibrationService.js
 * Safe haptic/vibration wrapper using @capacitor/haptics (sequenced multi-pulse patterns
 * on native platforms) with Web Vibration API (navigator.vibrate) fallback.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics } from '@capacitor/haptics';
import { DRILL_PHASES } from '../types/models.js';

export const VIBRATION_PATTERNS = Object.freeze({
  DCH: Object.freeze([800, 250, 800, 250, 800]),
  EVACUATE: Object.freeze([500, 200, 500, 200, 500, 200, 500]),
  ENDED: Object.freeze([400]),
  ALERT: Object.freeze([800, 250, 800, 250, 800]),
  STEP_CONFIRMED: Object.freeze([80, 60, 120]),
  SOS: Object.freeze([200, 100, 200, 100, 200, 250, 500, 100, 500, 100, 500]),
});

export const PHASE_VIBRATION_PATTERNS = Object.freeze({
  [DRILL_PHASES.DCH]: VIBRATION_PATTERNS.DCH,
  [DRILL_PHASES.EVACUATE]: VIBRATION_PATTERNS.EVACUATE,
  [DRILL_PHASES.ENDED]: VIBRATION_PATTERNS.ENDED,
});

export function getPhaseVibrationPattern(phase) {
  const key = typeof phase === 'string' ? phase.toLowerCase() : '';
  return PHASE_VIBRATION_PATTERNS[key] || VIBRATION_PATTERNS.ALERT;
}

function getDefaultHaptics() {
  try {
    if (
      Capacitor &&
      typeof Capacitor.isNativePlatform === 'function' &&
      Capacitor.isNativePlatform()
    ) {
      return Haptics;
    }
  } catch {
    // Ignore platform detection failures in non-native environments
  }
  return null;
}

function normalizePattern(pattern) {
  if (typeof pattern === 'number') {
    return pattern > 0 ? [pattern] : [];
  }
  if (Array.isArray(pattern)) {
    return pattern.map((ms) => Math.max(0, Number(ms) || 0));
  }
  return [];
}

export class VibrationServiceImpl {
  constructor(
    navigatorRef = typeof navigator !== 'undefined' ? navigator : null,
    hapticsRef = undefined,
  ) {
    this._navigator = navigatorRef;
    this._haptics = hapticsRef === undefined ? getDefaultHaptics() : hapticsRef;
    this._activeTimers = new Set();
    this._sequenceId = 0;
  }

  _hasHaptics() {
    return Boolean(this._haptics && typeof this._haptics.vibrate === 'function');
  }

  _hasNavigatorVibrate() {
    return Boolean(this._navigator && typeof this._navigator.vibrate === 'function');
  }

  _clearTimers() {
    this._sequenceId += 1;
    for (const timerId of this._activeTimers) {
      clearTimeout(timerId);
    }
    this._activeTimers.clear();
  }

  _runHapticsSequence(pattern) {
    const pulses = normalizePattern(pattern);
    if (pulses.length === 0) {
      return true;
    }

    const runId = this._sequenceId;
    let offsetMs = 0;
    let triggeredAny = false;

    for (let i = 0; i < pulses.length; i += 2) {
      const duration = pulses[i] || 0;
      const pauseAfter = pulses[i + 1] || 0;

      if (duration > 0) {
        triggeredAny = true;
        if (offsetMs === 0) {
          try {
            Promise.resolve(this._haptics.vibrate({ duration })).catch(() => {});
          } catch {
            // Swallow native haptics bridge errors
          }
        } else {
          const timerId = setTimeout(() => {
            this._activeTimers.delete(timerId);
            if (this._sequenceId !== runId) {
              return;
            }
            try {
              Promise.resolve(this._haptics.vibrate({ duration })).catch(() => {});
            } catch {
              // Swallow native haptics bridge errors
            }
          }, offsetMs);
          this._activeTimers.add(timerId);
        }
      }

      offsetMs += duration + pauseAfter;
    }

    return triggeredAny;
  }

  isSupported() {
    return this._hasHaptics() || this._hasNavigatorVibrate();
  }

  vibrate(pattern) {
    if (!this.isSupported()) {
      return false;
    }

    if (pattern === 0 || (Array.isArray(pattern) && pattern.length === 0)) {
      return this.stopVibration();
    }

    this._clearTimers();

    if (this._hasHaptics()) {
      return this._runHapticsSequence(pattern);
    }

    try {
      return Boolean(this._navigator.vibrate(pattern));
    } catch {
      return false;
    }
  }

  vibratePhase(phase) {
    return this.vibrate(getPhaseVibrationPattern(phase));
  }

  vibrateAlert(phase = null) {
    if (phase) {
      return this.vibratePhase(phase);
    }
    return this.vibrate(VIBRATION_PATTERNS.ALERT);
  }

  vibrateStepConfirmed() {
    return this.vibrate(VIBRATION_PATTERNS.STEP_CONFIRMED);
  }

  vibrateSos() {
    return this.vibrate(VIBRATION_PATTERNS.SOS);
  }

  stopVibration() {
    this._clearTimers();

    if (this._hasNavigatorVibrate()) {
      try {
        return Boolean(this._navigator.vibrate(0));
      } catch {
        return this._hasHaptics();
      }
    }

    return this._hasHaptics();
  }
}

export const VibrationService = new VibrationServiceImpl();

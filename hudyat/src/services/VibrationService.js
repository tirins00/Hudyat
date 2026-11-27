/**
 * VibrationService.js
 * Safe haptic/vibration wrapper for Web Vibration API (and Capacitor Haptics if available).
 */

export const VIBRATION_PATTERNS = Object.freeze({
  ALERT: [400, 150, 400, 150, 600],
  STEP_CONFIRMED: [80, 60, 120],
  SOS: [200, 100, 200, 100, 200, 250, 500, 100, 500, 100, 500],
});

export class VibrationServiceImpl {
  constructor(navigatorRef = typeof navigator !== 'undefined' ? navigator : null) {
    this._navigator = navigatorRef;
  }

  isSupported() {
    return Boolean(this._navigator && typeof this._navigator.vibrate === 'function');
  }

  vibrate(pattern) {
    if (!this.isSupported()) {
      return false;
    }
    try {
      return Boolean(this._navigator.vibrate(pattern));
    } catch {
      return false;
    }
  }

  vibrateAlert() {
    return this.vibrate(VIBRATION_PATTERNS.ALERT);
  }

  vibrateStepConfirmed() {
    return this.vibrate(VIBRATION_PATTERNS.STEP_CONFIRMED);
  }

  vibrateSos() {
    return this.vibrate(VIBRATION_PATTERNS.SOS);
  }

  stopVibration() {
    return this.vibrate(0);
  }
}

export const VibrationService = new VibrationServiceImpl();

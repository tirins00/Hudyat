/**
 * LocalNotificationService.js
 * Native background alert notifications via @capacitor/local-notifications.
 * All native plugin calls are guarded behind Capacitor.isNativePlatform()
 * so web browsers and Vitest safely no-op.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { DRILL_PHASES } from '../types/models.js';

export const EMERGENCY_CHANNEL_ID = 'hudyat-emergency';

export const EMERGENCY_CHANNEL_CONFIG = Object.freeze({
  id: EMERGENCY_CHANNEL_ID,
  name: 'Emergency Drill Alerts',
  description: 'High-priority campus drill phase notifications',
  importance: 5,
  visibility: 1,
  vibration: true,
});

const MAX_ANDROID_NOTIFICATION_ID = 2147483647; // 2^31 - 1 (Java 32-bit signed int max)

const PHASE_NOTIFICATION_COPY = Object.freeze({
  [DRILL_PHASES.DCH]: {
    title: 'DROP, COVER & HOLD — Emergency Drill Active',
    body: 'Drop to the floor, take cover under a sturdy desk or table, and hold on.',
  },
  [DRILL_PHASES.EVACUATE]: {
    title: 'EVACUATE NOW — Proceed to Assembly Area',
    body: 'Proceed calmly to your designated assembly area using stairs only. No elevators.',
  },
  [DRILL_PHASES.ENDED]: {
    title: 'ALL CLEAR — Drill Ended',
    body: 'The campus earthquake drill has concluded. Follow coordinator instructions.',
  },
});

/**
 * Deterministically hashes an event key (e.g. `drillId:phase`) into a positive
 * 31-bit integer in `[1, 2147483647]` suitable for Android Java `int` IDs.
 */
export function computeNotificationId(eventKey) {
  const input = String(eventKey || 'hudyat-emergency-alert');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = (hash >>> 0) % MAX_ANDROID_NOTIFICATION_ID;
  return positive === 0 ? 1 : positive;
}

export class LocalNotificationServiceImpl {
  constructor(
    pluginRef = LocalNotifications,
    capacitorRef = Capacitor,
    nowFn = () => Date.now(),
  ) {
    this._plugin = pluginRef;
    this._capacitor = capacitorRef;
    this._now = nowFn;
    this._channelCreated = false;
  }

  isNative() {
    try {
      return Boolean(
        this._capacitor &&
          typeof this._capacitor.isNativePlatform === 'function' &&
          this._capacitor.isNativePlatform(),
      );
    } catch {
      return false;
    }
  }

  async initLocalNotifications() {
    if (!this.isNative() || !this._plugin) {
      return false;
    }

    try {
      let perm =
        typeof this._plugin.checkPermissions === 'function'
          ? await this._plugin.checkPermissions()
          : { display: 'granted' };

      if (
        perm?.display !== 'granted' &&
        typeof this._plugin.requestPermissions === 'function'
      ) {
        perm = await this._plugin.requestPermissions();
      }

      if (
        !this._channelCreated &&
        typeof this._plugin.createChannel === 'function'
      ) {
        await this._plugin.createChannel(EMERGENCY_CHANNEL_CONFIG);
        this._channelCreated = true;
      }

      return perm?.display === 'granted';
    } catch {
      return false;
    }
  }

  async sendPhaseLocalNotification({ drillId, phase, title } = {}) {
    if (!this.isNative() || !this._plugin) {
      return false;
    }

    const granted = await this.initLocalNotifications();
    if (!granted || typeof this._plugin.schedule !== 'function') {
      return false;
    }

    const normalizedPhase =
      typeof phase === 'string' && phase.trim()
        ? phase.trim().toLowerCase()
        : DRILL_PHASES.DCH;
    const copy =
      PHASE_NOTIFICATION_COPY[normalizedPhase] ||
      PHASE_NOTIFICATION_COPY[DRILL_PHASES.DCH];
    const eventKey = `${drillId || 'active-drill'}:${normalizedPhase}`;
    const id = computeNotificationId(eventKey);
    const drillTitle = typeof title === 'string' ? title.trim() : '';
    const body = drillTitle ? `${drillTitle} — ${copy.body}` : copy.body;

    try {
      await this._plugin.schedule({
        notifications: [
          {
            id,
            title: copy.title,
            body,
            channelId: EMERGENCY_CHANNEL_ID,
            extra: {
              drillId: drillId || null,
              phase: normalizedPhase,
              route: '/student/alert',
            },
            schedule: {
              at: new Date(this._now() + 250),
              allowWhileIdle: true,
            },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  subscribeNotificationTap(onTap) {
    if (
      !this.isNative() ||
      !this._plugin ||
      typeof this._plugin.addListener !== 'function' ||
      typeof onTap !== 'function'
    ) {
      return async () => {};
    }

    let cancelled = false;
    let removed = false;
    let resolvedHandle = null;

    const removeHandleOnce = async (handle) => {
      if (removed || !handle || typeof handle.remove !== 'function') {
        return;
      }
      removed = true;
      try {
        await handle.remove();
      } catch {
        // Ignore listener removal errors on teardown
      }
    };

    const handlePromise = Promise.resolve(
      this._plugin.addListener('localNotificationActionPerformed', (event) => {
        if (cancelled) {
          return;
        }
        const extra = event?.notification?.extra ?? {};
        onTap(extra);
      }),
    )
      .then((handle) => {
        resolvedHandle = handle;
        if (cancelled) {
          return removeHandleOnce(handle);
        }
        return undefined;
      })
      .catch(() => undefined);

    return async () => {
      cancelled = true;
      await handlePromise;
      await removeHandleOnce(resolvedHandle);
    };
  }
}

export const LocalNotificationService = new LocalNotificationServiceImpl();

export function initLocalNotifications() {
  return LocalNotificationService.initLocalNotifications();
}

export function sendPhaseLocalNotification(payload) {
  return LocalNotificationService.sendPhaseLocalNotification(payload);
}

export function subscribeNotificationTap(onTap) {
  return LocalNotificationService.subscribeNotificationTap(onTap);
}

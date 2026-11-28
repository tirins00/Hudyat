import { describe, expect, it, vi } from 'vitest';
import {
  EMERGENCY_CHANNEL_CONFIG,
  EMERGENCY_CHANNEL_ID,
  LocalNotificationServiceImpl,
  computeNotificationId,
} from '../src/services/LocalNotificationService.js';
import { DRILL_PHASES } from '../src/types/models.js';

function createMockCapacitor(native = true) {
  return {
    isNativePlatform: vi.fn(() => native),
  };
}

function createMockPlugin({ initialDisplay = 'prompt', requestedDisplay = 'granted' } = {}) {
  const listeners = new Map();
  const removeSpy = vi.fn(async () => {});

  return {
    listeners,
    removeSpy,
    checkPermissions: vi.fn(async () => ({ display: initialDisplay })),
    requestPermissions: vi.fn(async () => ({ display: requestedDisplay })),
    createChannel: vi.fn(async () => {}),
    schedule: vi.fn(async () => ({ notifications: [] })),
    addListener: vi.fn(async (eventName, cb) => {
      listeners.set(eventName, cb);
      return { remove: removeSpy };
    }),
  };
}

describe('LocalNotificationService', () => {
  it('computes deterministic positive 31-bit integer IDs in [1, 2147483647]', () => {
    const keys = [
      'drill-1:dch',
      'drill-1:evacuate',
      'drill-1:ended',
      'drill-2026-12-03-very-long-identifier:evacuate',
      '',
    ];

    for (const key of keys) {
      const idA = computeNotificationId(key);
      const idB = computeNotificationId(key);
      expect(idA).toBe(idB);
      expect(Number.isInteger(idA)).toBe(true);
      expect(idA).toBeGreaterThan(0);
      expect(idA).toBeLessThanOrEqual(2147483647);
    }

    expect(computeNotificationId('drill-1:dch')).not.toBe(
      computeNotificationId('drill-1:evacuate'),
    );
    expect(computeNotificationId('drill-1:evacuate')).not.toBe(
      computeNotificationId('drill-1:ended'),
    );
  });

  it('safely no-ops on web / non-native platforms', async () => {
    const plugin = createMockPlugin();
    const service = new LocalNotificationServiceImpl(
      plugin,
      createMockCapacitor(false),
    );

    expect(await service.initLocalNotifications()).toBe(false);
    expect(
      await service.sendPhaseLocalNotification({
        drillId: 'drill-1',
        phase: DRILL_PHASES.DCH,
        title: 'CIT-U Drill',
      }),
    ).toBe(false);

    const onTap = vi.fn();
    const cleanup = service.subscribeNotificationTap(onTap);
    await cleanup();

    expect(plugin.checkPermissions).not.toHaveBeenCalled();
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
    expect(plugin.createChannel).not.toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(plugin.addListener).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('requests notification permissions when needed and creates the importance:5 channel once', async () => {
    const plugin = createMockPlugin({
      initialDisplay: 'prompt',
      requestedDisplay: 'granted',
    });
    const service = new LocalNotificationServiceImpl(
      plugin,
      createMockCapacitor(true),
    );

    expect(await service.initLocalNotifications()).toBe(true);
    expect(plugin.checkPermissions).toHaveBeenCalledTimes(1);
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(1);
    expect(plugin.createChannel).toHaveBeenCalledTimes(1);
    expect(plugin.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: EMERGENCY_CHANNEL_ID,
        importance: 5,
        visibility: 1,
        vibration: true,
      }),
    );
    expect(EMERGENCY_CHANNEL_CONFIG.importance).toBe(5);

    // Second init should not recreate the channel
    plugin.checkPermissions.mockResolvedValueOnce({ display: 'granted' });
    expect(await service.initLocalNotifications()).toBe(true);
    expect(plugin.createChannel).toHaveBeenCalledTimes(1);
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('schedules high-contrast payloads for dch, evacuate, and ended with allowWhileIdle and 31-bit IDs', async () => {
    const fixedNow = 1_760_000_000_000;
    const plugin = createMockPlugin({ initialDisplay: 'granted' });
    const service = new LocalNotificationServiceImpl(
      plugin,
      createMockCapacitor(true),
      () => fixedNow,
    );

    const cases = [
      {
        phase: DRILL_PHASES.DCH,
        expectedTitle: 'DROP, COVER & HOLD — Emergency Drill Active',
      },
      {
        phase: DRILL_PHASES.EVACUATE,
        expectedTitle: 'EVACUATE NOW — Proceed to Assembly Area',
      },
      {
        phase: DRILL_PHASES.ENDED,
        expectedTitle: 'ALL CLEAR — Drill Ended',
      },
    ];

    for (const { phase, expectedTitle } of cases) {
      plugin.schedule.mockClear();
      const sent = await service.sendPhaseLocalNotification({
        drillId: 'drill-42',
        phase,
        title: 'NSED Campus Drill',
      });
      expect(sent).toBe(true);
      expect(plugin.schedule).toHaveBeenCalledTimes(1);

      const scheduled = plugin.schedule.mock.calls[0][0].notifications[0];
      expect(scheduled.id).toBe(computeNotificationId(`drill-42:${phase}`));
      expect(scheduled.id).toBeGreaterThan(0);
      expect(scheduled.id).toBeLessThanOrEqual(2147483647);
      expect(scheduled.channelId).toBe(EMERGENCY_CHANNEL_ID);
      expect(scheduled.title).toBe(expectedTitle);
      expect(scheduled.body).toContain('NSED Campus Drill');
      expect(scheduled.extra).toEqual({
        drillId: 'drill-42',
        phase,
        route: '/student/alert',
      });
      expect(scheduled.schedule.allowWhileIdle).toBe(true);
      expect(scheduled.schedule.at.getTime()).toBe(fixedNow + 250);
    }
  });

  it('routes notification taps to callback with extra metadata and cleans up listener', async () => {
    const plugin = createMockPlugin({ initialDisplay: 'granted' });
    const service = new LocalNotificationServiceImpl(
      plugin,
      createMockCapacitor(true),
    );
    const onTap = vi.fn();

    const cleanup = service.subscribeNotificationTap(onTap);
    expect(plugin.addListener).toHaveBeenCalledWith(
      'localNotificationActionPerformed',
      expect.any(Function),
    );

    const handler = plugin.listeners.get('localNotificationActionPerformed');
    handler({
      notification: {
        extra: {
          drillId: 'drill-99',
          phase: DRILL_PHASES.EVACUATE,
          route: '/student/alert',
        },
      },
    });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({
      drillId: 'drill-99',
      phase: DRILL_PHASES.EVACUATE,
      route: '/student/alert',
    });

    await cleanup();
    expect(plugin.removeSpy).toHaveBeenCalledTimes(1);

    // Invoking listener after cleanup should not forward to onTap
    handler({
      notification: {
        extra: { drillId: 'drill-99', phase: DRILL_PHASES.DCH, route: '/student/alert' },
      },
    });
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});

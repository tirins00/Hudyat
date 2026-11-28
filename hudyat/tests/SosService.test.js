import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  SOS_PRESETS,
  acknowledgeSos,
  createMemorySosStore,
  resolveSos,
  sendSos,
  sortSosAlerts,
  subscribeToSosAlerts,
} from '../src/services/SosService.js';

describe('SosService', () => {
  it('creates an SOS alert with valid preset and optional note data', async () => {
    const store = createMemorySosStore();
    const t0 = Timestamp.fromMillis(1_700_000_100_000);

    const sos = await sendSos(
      {
        drillId: 'drill-1',
        uid: 'stu-ben-lim',
        nodeId: 'stair-a',
        zoneLabel: 'Stairway A',
        message: SOS_PRESETS[0].label,
        note: 'Need wheelchair assistance',
      },
      {
        store,
        now: () => t0,
        generateId: () => 'sos-1',
      },
    );

    expect(sos).toMatchObject({
      id: 'sos-1',
      drillId: 'drill-1',
      uid: 'stu-ben-lim',
      nodeId: 'stair-a',
      zoneLabel: 'Stairway A',
      message: SOS_PRESETS[0].label,
      note: 'Need wheelchair assistance',
      status: 'active',
      createdAt: t0,
    });
    expect(store.getAll('drill-1')).toHaveLength(1);
  });

  it('rejects empty or whitespace-only SOS messages', async () => {
    const store = createMemorySosStore();

    await expect(
      sendSos(
        {
          drillId: 'drill-1',
          uid: 'stu-ben-lim',
          nodeId: 'stair-a',
          message: '   ',
        },
        { store },
      ),
    ).rejects.toThrow(/message/i);

    expect(store.getAll('drill-1')).toHaveLength(0);
  });

  it('acknowledges an SOS alert and records responder UID and timestamp', async () => {
    const store = createMemorySosStore();
    const createdTs = Timestamp.fromMillis(1_700_000_100_000);
    const ackTs = Timestamp.fromMillis(1_700_000_120_000);

    await sendSos(
      {
        drillId: 'drill-1',
        uid: 'stu-eva-go',
        nodeId: 'canteen',
        message: SOS_PRESETS[1].label,
      },
      {
        store,
        now: () => createdTs,
        generateId: () => 'sos-ack-1',
      },
    );

    await acknowledgeSos('drill-1', 'sos-ack-1', 'coord-1', {
      store,
      now: () => ackTs,
    });

    const [updated] = store.getAll('drill-1');
    expect(updated).toMatchObject({
      id: 'sos-ack-1',
      status: 'acknowledged',
      acknowledgedBy: 'coord-1',
      acknowledgedAt: ackTs,
    });
  });

  it('resolves an SOS alert and records resolver UID and timestamp', async () => {
    const store = createMemorySosStore();
    const createdTs = Timestamp.fromMillis(1_700_000_100_000);
    const resolvedTs = Timestamp.fromMillis(1_700_000_200_000);

    await sendSos(
      {
        drillId: 'drill-1',
        uid: 'stu-di-uy',
        nodeId: 'eng-402',
        message: SOS_PRESETS[2].label,
      },
      {
        store,
        now: () => createdTs,
        generateId: () => 'sos-res-1',
      },
    );

    await resolveSos('drill-1', 'sos-res-1', 'teacher-1', {
      store,
      now: () => resolvedTs,
    });

    const [updated] = store.getAll('drill-1');
    expect(updated).toMatchObject({
      id: 'sos-res-1',
      status: 'resolved',
      resolvedBy: 'teacher-1',
      resolvedAt: resolvedTs,
    });
  });

  it('orders active alerts before acknowledged and resolved alerts', async () => {
    const store = createMemorySosStore();
    const t1 = Timestamp.fromMillis(1_700_000_100_000);
    const t2 = Timestamp.fromMillis(1_700_000_150_000);
    const t3 = Timestamp.fromMillis(1_700_000_200_000);

    await sendSos(
      {
        drillId: 'drill-1',
        uid: 's1',
        nodeId: 'canteen',
        message: SOS_PRESETS[0].label,
      },
      { store, now: () => t1, generateId: () => 'sos-resolved' },
    );
    await resolveSos('drill-1', 'sos-resolved', 'coord-1', { store });

    await sendSos(
      {
        drillId: 'drill-1',
        uid: 's2',
        nodeId: 'stair-a',
        message: SOS_PRESETS[1].label,
      },
      { store, now: () => t2, generateId: () => 'sos-ack' },
    );
    await acknowledgeSos('drill-1', 'sos-ack', 'coord-1', { store });

    await sendSos(
      {
        drillId: 'drill-1',
        uid: 's3',
        nodeId: 'eng-401',
        message: SOS_PRESETS[2].label,
      },
      { store, now: () => t3, generateId: () => 'sos-active' },
    );

    let received = [];
    const unsub = subscribeToSosAlerts(
      'drill-1',
      (alerts) => {
        received = alerts;
      },
      { store },
    );

    expect(received.map((a) => a.id)).toEqual([
      'sos-active',
      'sos-ack',
      'sos-resolved',
    ]);
    expect(sortSosAlerts(received).map((a) => a.status)).toEqual([
      'active',
      'acknowledged',
      'resolved',
    ]);

    unsub();
  });
});

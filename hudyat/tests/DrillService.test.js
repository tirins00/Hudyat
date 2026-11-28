import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/firebase/config.js', () => ({ db: {} }));

import {
  createDrillService,
  createInMemoryDrillStore,
} from '../src/services/DrillService.js';
import { DRILL_PHASES, RESPONSE_STATUSES } from '../src/types/models.js';

describe('DrillService', () => {
  it('manages drill lifecycle: start -> advance -> end', async () => {
    const service = createDrillService(createInMemoryDrillStore());

    const started = await service.startDrill({
      id: 'drill-test-01',
      title: 'Test Drill',
      campusId: 'cit-u',
    });
    expect(started.phase).toBe(DRILL_PHASES.DCH);

    const evacuated = await service.advanceDrillPhase('drill-test-01');
    expect(evacuated.phase).toBe(DRILL_PHASES.EVACUATE);

    const ended = await service.endDrill('drill-test-01');
    expect(ended.phase).toBe(DRILL_PHASES.ENDED);

    await expect(service.advanceDrillPhase('drill-test-01')).rejects.toThrow(/already ended/);
  });

  it('records and retrieves step responses', async () => {
    const service = createDrillService(createInMemoryDrillStore());
    const saved = await service.submitStepResponse('drill-citu-eq-01', 'stu-01', {
      displayName: 'Maria Santos',
      phase: DRILL_PHASES.EVACUATE,
      status: RESPONSE_STATUSES.EVACUATING,
      currentNodeId: 'NGE-301',
      completedSteps: ['dch'],
      source: 'qr',
    });

    expect(saved.uid).toBe('stu-01');
    expect(saved.currentNodeId).toBe('NGE-301');

    const fetched = await service.getUserResponse('drill-citu-eq-01', 'stu-01');
    expect(fetched.status).toBe(RESPONSE_STATUSES.EVACUATING);

    const verified = await service.submitStepResponse('drill-citu-eq-01', 'stu-02', {
      displayName: 'Juan Dela Cruz',
      phase: DRILL_PHASES.EVACUATE,
      status: RESPONSE_STATUSES.ARRIVED,
      nodeId: 'ASM-QUAD-01',
      qrCode: 'HUDYAT|cit-u|assembly|ASM-QUAD-01',
      verifiedQr: true,
      completedSteps: ['dch', 'stairs', 'assembly'],
      source: 'manual_code',
      method: 'manual_code',
    });
    expect(verified.nodeId).toBe('ASM-QUAD-01');
    expect(verified.currentNodeId).toBe('ASM-QUAD-01');
    expect(verified.qrCode).toBe('HUDYAT|cit-u|assembly|ASM-QUAD-01');
    expect(verified.verifiedQr).toBe(true);
    expect(verified.method).toBe('manual_code');
  });
});

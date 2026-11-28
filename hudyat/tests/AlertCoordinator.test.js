import { afterEach, describe, expect, it } from 'vitest';
import {
  claimPhaseAlertTrigger,
  findActiveDrillForCampus,
  findLatestDrillForCampus,
  getDrillPhaseEventKey,
  hasPhaseAlertTriggered,
  markPhaseAlertTriggered,
  resetPhaseAlertTracker,
  wasPhaseAlertRecentlyTriggered,
} from '../src/services/AlertCoordinator.js';
import { DRILL_PHASES } from '../src/types/models.js';

describe('AlertCoordinator', () => {
  afterEach(() => {
    resetPhaseAlertTracker();
  });

  it('selects only active (dch/evacuate) drills matching the student campus', () => {
    const drills = [
      { id: 'd-other', campusId: 'other-campus', phase: DRILL_PHASES.DCH },
      { id: 'd-ended', campusId: 'cit-u', phase: DRILL_PHASES.ENDED },
      { id: 'd-active', campusId: 'cit-u', phase: DRILL_PHASES.EVACUATE },
    ];

    expect(findActiveDrillForCampus(drills, 'cit-u')?.id).toBe('d-active');
    expect(
      findActiveDrillForCampus(
        [{ id: 'd-ended', campusId: 'cit-u', phase: DRILL_PHASES.ENDED }],
        'cit-u',
      ),
    ).toBeNull();
  });

  it('falls back to the latest ended drill for the campus when no active drill exists', () => {
    const drills = [
      { id: 'd-other', campusId: 'other', phase: DRILL_PHASES.DCH },
      { id: 'd-ended', campusId: 'cit-u', phase: DRILL_PHASES.ENDED },
    ];

    expect(findLatestDrillForCampus(drills, 'cit-u')?.id).toBe('d-ended');
  });

  it('deduplicates identical drillId:phase alert triggers across watcher and AlertScreen', () => {
    const dchKey = getDrillPhaseEventKey({ id: 'drill-1', phase: DRILL_PHASES.DCH });
    const evacKey = getDrillPhaseEventKey({ id: 'drill-1', phase: DRILL_PHASES.EVACUATE });

    expect(dchKey).toBe('drill-1:dch');
    expect(hasPhaseAlertTriggered(dchKey)).toBe(false);

    // First claim succeeds; subsequent claims for same drillId:phase return false
    expect(claimPhaseAlertTrigger(dchKey, 1000)).toBe(true);
    expect(hasPhaseAlertTriggered(dchKey)).toBe(true);
    expect(claimPhaseAlertTrigger(dchKey, 2000)).toBe(false);
    expect(claimPhaseAlertTrigger(dchKey, 60000)).toBe(false);

    // Advancing to a new phase claims cleanly
    expect(claimPhaseAlertTrigger(evacKey, 65000)).toBe(true);
    expect(claimPhaseAlertTrigger(evacKey, 66000)).toBe(false);
  });

  it('keeps time-window helper compatible for callers checking recent triggers', () => {
    const key = getDrillPhaseEventKey({ id: 'drill-2', phase: DRILL_PHASES.DCH });
    expect(wasPhaseAlertRecentlyTriggered(key, 4000, 1000)).toBe(false);

    markPhaseAlertTriggered(key, 1000);
    expect(wasPhaseAlertRecentlyTriggered(key, 4000, 2500)).toBe(true);
    expect(wasPhaseAlertRecentlyTriggered(key, 4000, 6000)).toBe(false);
  });
});

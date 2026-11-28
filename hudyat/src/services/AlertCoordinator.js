/**
 * AlertCoordinator.js
 * Shared pure helpers for selecting a campus's active drill and deduplicating
 * identical `drillId:phase` sound/vibration triggers across ActiveDrillWatcher
 * and AlertScreen.
 */

import { DRILL_PHASES } from '../types/models.js';

export function isActiveDrillPhase(phase) {
  return phase === DRILL_PHASES.DCH || phase === DRILL_PHASES.EVACUATE;
}

export function findActiveDrillForCampus(drills, campusId = 'cit-u') {
  if (!Array.isArray(drills) || drills.length === 0) {
    return null;
  }
  const normalizedCampus = (campusId || 'cit-u').trim().toLowerCase();
  return (
    drills.find((drill) => {
      const drillCampus = (drill?.campusId || 'cit-u').trim().toLowerCase();
      return drillCampus === normalizedCampus && isActiveDrillPhase(drill?.phase);
    }) || null
  );
}

export function findLatestDrillForCampus(drills, campusId = 'cit-u') {
  if (!Array.isArray(drills) || drills.length === 0) {
    return null;
  }
  const active = findActiveDrillForCampus(drills, campusId);
  if (active) {
    return active;
  }
  const normalizedCampus = (campusId || 'cit-u').trim().toLowerCase();
  const sameCampus = drills.find(
    (drill) => (drill?.campusId || 'cit-u').trim().toLowerCase() === normalizedCampus,
  );
  return sameCampus || drills[0] || null;
}

export function getDrillPhaseEventKey(drill) {
  if (!drill?.id || !drill?.phase) {
    return null;
  }
  return `${drill.id}:${drill.phase}`;
}

const triggeredKeys = new Map();

export function markPhaseAlertTriggered(eventKey, now = Date.now()) {
  if (!eventKey) {
    return;
  }
  triggeredKeys.set(eventKey, now);
}

/**
 * Atomically checks whether `eventKey` (`drillId:phase`) has already fired in this
 * session. Returns `true` only on the first call for that key, marking it claimed.
 */
export function claimPhaseAlertTrigger(eventKey, now = Date.now()) {
  if (!eventKey) {
    return false;
  }
  if (triggeredKeys.has(eventKey)) {
    return false;
  }
  triggeredKeys.set(eventKey, now);
  return true;
}

export function hasPhaseAlertTriggered(eventKey) {
  if (!eventKey) {
    return false;
  }
  return triggeredKeys.has(eventKey);
}

export function wasPhaseAlertRecentlyTriggered(eventKey, windowMs = 4000, now = Date.now()) {
  if (!eventKey || !triggeredKeys.has(eventKey)) {
    return false;
  }
  const at = triggeredKeys.get(eventKey);
  return now - at < windowMs;
}

export function resetPhaseAlertTracker() {
  triggeredKeys.clear();
}

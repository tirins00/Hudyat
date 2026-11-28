import { describe, expect, it, vi } from 'vitest';
import { SoundServiceImpl } from '../src/services/SoundService.js';
import { DRILL_PHASES } from '../src/types/models.js';

function createMockAudioContextClass({ deferResume = false } = {}) {
  const instances = [];

  class MockAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = { kind: 'destination' };
      this.oscillators = [];
      this.gains = [];
      this._resolveResume = null;

      this.resume = vi.fn(() => {
        if (deferResume) {
          return new Promise((resolve) => {
            this._resolveResume = () => {
              this.state = 'running';
              this.currentTime = 12.5;
              resolve();
            };
          });
        }
        this.state = 'running';
        this.currentTime = 10;
        return Promise.resolve();
      });

      this.createBuffer = vi.fn(() => ({ length: 1 }));
      this.createBufferSource = vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
      }));
      this.createGain = vi.fn(() => {
        const gainNode = {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        this.gains.push(gainNode);
        return gainNode;
      });
      this.createOscillator = vi.fn(() => {
        const osc = {
          type: 'sine',
          frequency: {
            value: 440,
            setValueAtTime: vi.fn((freq) => {
              osc.frequency.value = freq;
            }),
          },
          onended: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        this.oscillators.push(osc);
        return osc;
      });
      instances.push(this);
    }
  }

  return { MockAudioContext, instances };
}

function getScheduledDurationMs(ctx) {
  const starts = ctx.oscillators.map((osc) => osc.start.mock.calls[0][0]);
  const fadeEnds = ctx.gains.map((gainNode) => {
    const ramps = gainNode.gain.linearRampToValueAtTime.mock.calls;
    return ramps[ramps.length - 1][1];
  });
  const firstStart = Math.min(...starts);
  const lastEnd = Math.max(...fadeEnds);
  return Math.round((lastEnd - firstStart) * 1000);
}

describe('SoundService', () => {
  it('returns false safely when Web Audio API is unavailable', async () => {
    const service = new SoundServiceImpl(null);
    expect(service.isSupported()).toBe(false);
    expect(service.unlockAudio()).toBe(false);
    expect(await service.playPhaseAlertSound(DRILL_PHASES.DCH)).toBe(false);
  });

  it('waits for ctx.resume() before reading currentTime and applies 15ms linear fade ramps', async () => {
    const { MockAudioContext, instances } = createMockAudioContextClass({
      deferResume: true,
    });
    const service = new SoundServiceImpl(MockAudioContext);

    const playPromise = service.playPhaseAlertSound(DRILL_PHASES.DCH);
    expect(instances).toHaveLength(1);
    const ctx = instances[0];

    // No oscillators should be created while AudioContext is still suspended
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.oscillators).toHaveLength(0);

    // Resolve resume (advancing ctx.currentTime to 12.5)
    ctx._resolveResume();
    expect(await playPromise).toBe(true);

    // DCH schedules 3 dual-oscillator bursts starting at currentTime + 0.02s lookahead
    expect(ctx.oscillators).toHaveLength(6);
    const firstStart = ctx.oscillators[0].start.mock.calls[0][0];
    expect(firstStart).toBeCloseTo(12.52, 5);

    // Verify 15ms linear fade-in (0 -> peak) and 15ms linear fade-out (peak -> 0)
    const firstGain = ctx.gains[0].gain;
    expect(firstGain.setValueAtTime.mock.calls[0]).toEqual([0, firstStart]);
    expect(firstGain.linearRampToValueAtTime.mock.calls[0][1]).toBeCloseTo(
      firstStart + 0.015,
      5,
    );
    const fadeOutCall = firstGain.linearRampToValueAtTime.mock.calls[1];
    expect(fadeOutCall[0]).toBe(0);
    expect(fadeOutCall[1]).toBeCloseTo(firstStart + 0.9, 5);
  });

  it('cancels pending playback if stopAlertSound() is called before ctx.resume() resolves', async () => {
    const { MockAudioContext, instances } = createMockAudioContextClass({
      deferResume: true,
    });
    const service = new SoundServiceImpl(MockAudioContext);

    const playPromise = service.playPhaseAlertSound(DRILL_PHASES.DCH);
    service.stopAlertSound();

    instances[0]._resolveResume();
    expect(await playPromise).toBe(false);
    expect(instances[0].oscillators).toHaveLength(0);
  });

  it('unlocks AudioContext and plays distinct phase patterns spanning >= 3000ms each', async () => {
    const { MockAudioContext, instances } = createMockAudioContextClass();
    const service = new SoundServiceImpl(MockAudioContext);

    expect(service.isSupported()).toBe(true);
    expect(service.unlockAudio()).toBe(true);
    expect(instances).toHaveLength(1);
    expect(instances[0].resume).toHaveBeenCalledTimes(1);

    // DCH: 3 heavy pulsing dual-oscillator bursts (6 oscillators, 3200ms)
    expect(await service.playPhaseAlertSound(DRILL_PHASES.DCH)).toBe(true);
    const dchOscs = [...instances[0].oscillators];
    expect(dchOscs).toHaveLength(6);
    expect(dchOscs[0].frequency.value).toBe(820);
    expect(getScheduledDurationMs(instances[0])).toBeGreaterThanOrEqual(3000);
    expect(getScheduledDurationMs(instances[0])).toBe(3200);

    // EVACUATE: stops previous oscillators and plays alternating 960/640 Hz siren (5 bursts, 3350ms)
    instances[0].oscillators.length = 0;
    instances[0].gains.length = 0;
    expect(await service.playPhaseAlertSound(DRILL_PHASES.EVACUATE)).toBe(true);
    expect(dchOscs[0].stop).toHaveBeenCalled();
    const evacFreqs = instances[0].oscillators.map((o) => o.frequency.value);
    expect(evacFreqs).toEqual([960, 640, 960, 640, 960, 640, 960, 640, 960, 640]);
    expect(getScheduledDurationMs(instances[0])).toBeGreaterThanOrEqual(3000);
    expect(getScheduledDurationMs(instances[0])).toBe(3350);

    // ENDED: gentle 2-phrase ascending sine chime (6 oscillators, 3000ms)
    instances[0].oscillators.length = 0;
    instances[0].gains.length = 0;
    expect(await service.playPhaseAlertSound(DRILL_PHASES.ENDED)).toBe(true);
    expect(instances[0].oscillators).toHaveLength(6);
    expect(instances[0].oscillators.every((o) => o.type === 'sine')).toBe(true);
    expect(getScheduledDurationMs(instances[0])).toBeGreaterThanOrEqual(3000);
    expect(getScheduledDurationMs(instances[0])).toBe(3000);

    // stopAlertSound stops and disconnects all active oscillators
    const endedOscs = [...instances[0].oscillators];
    service.stopAlertSound();
    expect(endedOscs[0].stop).toHaveBeenCalled();
    expect(endedOscs[0].disconnect).toHaveBeenCalled();
  });

  it('respects mute/unmute state and notifies listeners', async () => {
    const { MockAudioContext, instances } = createMockAudioContextClass();
    const service = new SoundServiceImpl(MockAudioContext);
    const listener = vi.fn();
    const unsub = service.subscribeMute(listener);

    expect(service.isMuted()).toBe(false);
    expect(await service.playPhaseAlertSound(DRILL_PHASES.DCH)).toBe(true);
    const firstOsc = instances[0].oscillators[0];

    expect(service.toggleMuted()).toBe(true);
    expect(service.isMuted()).toBe(true);
    expect(listener).toHaveBeenCalledWith(true);
    expect(firstOsc.stop).toHaveBeenCalled();

    expect(await service.playPhaseAlertSound(DRILL_PHASES.EVACUATE)).toBe(false);

    expect(service.setMuted(false)).toBe(false);
    expect(listener).toHaveBeenCalledWith(false);
    expect(await service.playPhaseAlertSound(DRILL_PHASES.EVACUATE)).toBe(true);

    unsub();
  });
});

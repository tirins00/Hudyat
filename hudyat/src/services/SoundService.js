/**
 * SoundService.js
 * Offline-safe emergency alert audio synthesizer built on pure Web Audio API
 * (AudioContext + OscillatorNode, no external audio files).
 *
 * Always paired with visual and haptic cues — never used as a sound-only alert.
 */

import { DRILL_PHASES } from '../types/models.js';

const RAMP_SEC = 0.015; // 15ms linear fade-in and fade-out to prevent clicks/distortion
const SCHEDULE_LOOKAHEAD_SEC = 0.02;

function getDefaultAudioContextCtor() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.AudioContext || window.webkitAudioContext || null;
}

export class SoundServiceImpl {
  constructor(audioContextCtor = undefined) {
    this._audioContextCtor =
      audioContextCtor === undefined ? getDefaultAudioContextCtor() : audioContextCtor;
    this._ctx = null;
    this._unlocked = false;
    this._muted = false;
    this._muteListeners = new Set();
    this._activeNodes = new Set();
    this._activeTimers = new Set();
    this._playRequestId = 0;
  }

  isSupported() {
    return typeof this._audioContextCtor === 'function';
  }

  isMuted() {
    return this._muted;
  }

  setMuted(muted) {
    const next = Boolean(muted);
    if (this._muted === next) {
      return this._muted;
    }
    this._muted = next;
    if (next) {
      this.stopAlertSound();
    }
    for (const listener of this._muteListeners) {
      listener(this._muted);
    }
    return this._muted;
  }

  toggleMuted() {
    return this.setMuted(!this._muted);
  }

  subscribeMute(listener) {
    this._muteListeners.add(listener);
    return () => {
      this._muteListeners.delete(listener);
    };
  }

  _ensureContext() {
    if (!this.isSupported()) {
      return null;
    }
    if (!this._ctx || this._ctx.state === 'closed') {
      try {
        this._ctx = new this._audioContextCtor();
        this._unlocked = false;
      } catch {
        return null;
      }
    }
    return this._ctx;
  }

  unlockAudio() {
    const ctx = this._ensureContext();
    if (!ctx) {
      return false;
    }

    if (this._unlocked && ctx.state === 'running') {
      return true;
    }

    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        Promise.resolve(ctx.resume()).catch(() => {});
      }

      // Play a 1-sample silent buffer once to reliably unlock Android/iOS WebViews.
      if (
        !this._unlocked &&
        typeof ctx.createBuffer === 'function' &&
        typeof ctx.createBufferSource === 'function' &&
        ctx.destination
      ) {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        if (typeof source.start === 'function') {
          source.start(0);
        }
      }
      this._unlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  stopAlertSound() {
    this._playRequestId += 1;

    for (const timerId of this._activeTimers) {
      clearTimeout(timerId);
    }
    this._activeTimers.clear();

    for (const entry of this._activeNodes) {
      try {
        if (entry.osc && typeof entry.osc.stop === 'function') {
          entry.osc.stop();
        }
      } catch {
        // Ignore already-stopped oscillator errors
      }
      try {
        if (entry.osc && typeof entry.osc.disconnect === 'function') {
          entry.osc.disconnect();
        }
      } catch {
        // Ignore disconnect errors
      }
      try {
        if (entry.gain && typeof entry.gain.disconnect === 'function') {
          entry.gain.disconnect();
        }
      } catch {
        // Ignore disconnect errors
      }
    }
    this._activeNodes.clear();
  }

  _scheduleTone(ctx, { type = 'sine', frequency = 440, startTime, duration, peakGain = 0.2 }) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const endTime = startTime + duration;
    const ramp = Math.min(RAMP_SEC, duration / 2);
    const fadeOutStart = Math.max(startTime + ramp, endTime - ramp);

    osc.type = type;
    if (osc.frequency && typeof osc.frequency.setValueAtTime === 'function') {
      osc.frequency.setValueAtTime(frequency, startTime);
    } else if (osc.frequency) {
      osc.frequency.value = frequency;
    }

    if (gain.gain && typeof gain.gain.setValueAtTime === 'function') {
      gain.gain.setValueAtTime(0, startTime);
      if (typeof gain.gain.linearRampToValueAtTime === 'function') {
        gain.gain.linearRampToValueAtTime(peakGain, startTime + ramp);
        gain.gain.setValueAtTime(peakGain, fadeOutStart);
        gain.gain.linearRampToValueAtTime(0, endTime);
      } else {
        gain.gain.setValueAtTime(peakGain, startTime);
      }
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    const entry = { osc, gain };
    this._activeNodes.add(entry);

    if (typeof osc.onended !== 'undefined' || 'onended' in osc) {
      osc.onended = () => {
        this._activeNodes.delete(entry);
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // Ignore cleanup errors
        }
      };
    }

    osc.start(startTime);
    osc.stop(endTime + 0.01);
  }

  _schedulePhasePattern(ctx, phase, baseTime) {
    const normalized = typeof phase === 'string' ? phase.toLowerCase() : DRILL_PHASES.DCH;

    if (normalized === DRILL_PHASES.EVACUATE) {
      // Urgent alternating two-tone siren (960 Hz / 640 Hz): 5 pulses matching 3350ms cadence
      const pulseDur = 0.55;
      const pauseDur = 0.15;
      const halfDur = pulseDur / 2;
      for (let i = 0; i < 5; i += 1) {
        const pulseStart = baseTime + i * (pulseDur + pauseDur);
        this._scheduleTone(ctx, {
          type: 'sawtooth',
          frequency: 960,
          startTime: pulseStart,
          duration: halfDur,
          peakGain: 0.18,
        });
        this._scheduleTone(ctx, {
          type: 'sawtooth',
          frequency: 640,
          startTime: pulseStart + halfDur,
          duration: halfDur,
          peakGain: 0.18,
        });
      }
      return;
    }

    if (normalized === DRILL_PHASES.ENDED) {
      // Gentle ascending "All Clear" chime (C5 -> E5 -> G5), 2 steady phrases matching 3000ms cadence
      const phraseOffsets = [0, 1.8];
      const phraseNotes = [
        { freq: 523.25, offset: 0, dur: 0.35 },
        { freq: 659.25, offset: 0.32, dur: 0.35 },
        { freq: 783.99, offset: 0.64, dur: 0.56 },
      ];
      phraseOffsets.forEach((phraseOffset) => {
        phraseNotes.forEach((note) => {
          this._scheduleTone(ctx, {
            type: 'sine',
            frequency: note.freq,
            startTime: baseTime + phraseOffset + note.offset,
            duration: note.dur,
            peakGain: 0.18,
          });
        });
      });
      return;
    }

    // Default / DCH (Drop, Cover & Hold): 3 heavy pulsing emergency bursts matching 3200ms cadence
    const pulseDur = 0.9;
    const pauseDur = 0.25;
    for (let i = 0; i < 3; i += 1) {
      const start = baseTime + i * (pulseDur + pauseDur);
      this._scheduleTone(ctx, {
        type: 'square',
        frequency: 820,
        startTime: start,
        duration: pulseDur,
        peakGain: 0.15,
      });
      this._scheduleTone(ctx, {
        type: 'triangle',
        frequency: 615,
        startTime: start,
        duration: pulseDur,
        peakGain: 0.1,
      });
    }
  }

  async playPhaseAlertSound(phase) {
    if (this._muted) {
      return false;
    }

    const ctx = this._ensureContext();
    if (!ctx) {
      return false;
    }

    this.stopAlertSound();
    const requestId = this._playRequestId;

    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        await ctx.resume();
      }

      // Bail out cleanly if stopped, muted, or superseded while awaiting resume()
      if (requestId !== this._playRequestId || this._muted) {
        return false;
      }

      const now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
      const baseTime = now + SCHEDULE_LOOKAHEAD_SEC;
      this._schedulePhasePattern(ctx, phase, baseTime);
      return true;
    } catch {
      return false;
    }
  }
}

export const SoundService = new SoundServiceImpl();

export function unlockAudio() {
  return SoundService.unlockAudio();
}

export function playPhaseAlertSound(phase) {
  return SoundService.playPhaseAlertSound(phase);
}

export function stopAlertSound() {
  return SoundService.stopAlertSound();
}

export function isSoundMuted() {
  return SoundService.isMuted();
}

export function setSoundMuted(muted) {
  return SoundService.setMuted(muted);
}

export function toggleSoundMuted() {
  return SoundService.toggleMuted();
}

export function subscribeSoundMute(listener) {
  return SoundService.subscribeMute(listener);
}

export function isAudioSupported() {
  return SoundService.isSupported();
}

// Part 1 · Cinematic sounds. All generated in code with Web Audio: no files, no copyright.
//   alarm()          : two-tone alert (incident raised)
//   chime()          : two soft rising notes (ASTRA's safe action applied)
//   useHeartbeat()   : "lub-dub" heartbeat at the live heart rate
//   useCue()         : plays a sound once, the first time a condition becomes true
// Sound can be muted (the 🔊 button in Stage); the preference is remembered in the browser.
import { useEffect, useRef, useSyncExternalStore } from 'react';

const KEY = 'astra-sound-muted';
let muted = readMuted();
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(KEY, m ? '1' : '0');
  } catch {
    /* without storage, only for this session */
  }
  listeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
  );
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A single tone: frequency, start, duration, volume, waveform. */
function tone(a: AudioContext, freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'sine', slideTo?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

export function alarm() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  for (let i = 0; i < 3; i++) {
    tone(a, 880, t + i * 0.5, 0.22, 0.12, 'square');
    tone(a, 660, t + i * 0.5 + 0.25, 0.22, 0.12, 'square');
  }
}

export function chime() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  tone(a, 659, t, 0.6, 0.14, 'triangle');
  tone(a, 988, t + 0.18, 0.9, 0.12, 'triangle');
}

export function whoosh() {
  const a = audio();
  if (!a) return;
  tone(a, 90, a.currentTime, 1.6, 0.18, 'sawtooth', 40);
}

function beat(a: AudioContext) {
  const t = a.currentTime;
  tone(a, 62, t, 0.16, 0.5, 'sine', 40); // lub
  tone(a, 55, t + 0.18, 0.14, 0.35, 'sine', 38); // dub
}

/** While active, plays a heartbeat at the live heart rate. The rhythm changes as the heart rate changes. */
export function useHeartbeat(active: boolean, bpm: number) {
  const bpmRef = useRef(bpm);
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const loop = () => {
      const a = audio();
      if (a) beat(a);
      id = window.setTimeout(loop, 60000 / Math.max(40, Math.min(200, bpmRef.current)));
    };
    loop();
    return () => clearTimeout(id);
  }, [active]);
}

/** Plays play once, the first time when becomes true. */
export function useCue(when: boolean, play: () => void) {
  const done = useRef(false);
  useEffect(() => {
    if (when && !done.current) {
      done.current = true;
      play();
    }
  }, [when, play]);
}

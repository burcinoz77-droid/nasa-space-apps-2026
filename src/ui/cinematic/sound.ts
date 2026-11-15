// Parça 1 · Sinematik sesleri. Hepsi Web Audio ile kodda üretilir: dosya yok, telif yok.
//   alarm()          : iki tonlu uyarı (olay açıldı)
//   chime()          : yumuşak yükselen iki nota (ASTRA'nın güvenli adımı uygulandı)
//   useHeartbeat()   : canlı nabızla "küt-küt" kalp atışı
//   useCue()         : koşul ilk kez doğru olduğunda bir sesi bir kez çalar
// Ses kapatılabilir (Stage'deki 🔊 düğmesi); tercih tarayıcıda hatırlanır.
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
    /* depolama yoksa sadece bu oturum için */
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

/** Tek bir ton: frekans, başlangıç, süre, ses yüksekliği, dalga biçimi. */
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
  tone(a, 62, t, 0.16, 0.5, 'sine', 40); // küt
  tone(a, 55, t + 0.18, 0.14, 0.35, 'sine', 38); // küt
}

/** active iken canlı nabızla kalp atışı çalar. Nabız değiştikçe ritim de değişir. */
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

/** when ilk kez true olduğunda play'i bir kez çalar. */
export function useCue(when: boolean, play: () => void) {
  const done = useRef(false);
  useEffect(() => {
    if (when && !done.current) {
      done.current = true;
      play();
    }
  }, [when, play]);
}

// Parça 1 · Jüri demo turu (≈2 dk, tek tuş). Sunumda tıklama ve bekleme derdi olmasın diye.
//   Açılış : proje kartı; bu sırada simülasyon sıfırlanır ve kişisel normaller hızla öğrenilir (gerçek ilerleme).
//   Krizler: Güneş fırtınası → CO₂ arızası → EVA. Her biri kendi sinematiğiyle oynar, sonra Kokpit'te kısa duruş.
//   Kapanış: ana mesaj; senaryo "Tüm mürettebatı stabilize et"e döner.
// "Turu bitir" ile her an durur. Demo videosu da bununla tek seferde kaydedilebilir.
import { type ReactNode, useEffect, useState } from 'react';
import { controls, SCENARIO_NAMES } from '../../loop';
import { PARAMS, SIM } from '../../sim/parameters';
import { useAstra } from '../../store';
import type { ScenarioId } from '../../types';
import { alpha, COLORS } from '../theme';
import { CINEMATIC_END_EVENT, DEMO_EVENT, NAVIGATE_EVENT, runtime } from './phases';
import { Stars } from './shared';

const TOUR: { id: ScenarioId; action: string }[] = [
  { id: 'SOLAR_STORM', action: 'storm shelter' },
  { id: 'CO2_SCRUBBER_FAIL', action: 'ventilation increased' },
  { id: 'EVA_OVEREXERTION', action: 'mandatory crew rest' },
];
const CALIBRATION_TICK_MS = 100;
const INTRO_MS = 8000;
const DWELL_MS = 9000;
const OUTRO_MS = 9000;

type Stage = { kind: 'intro' } | { kind: 'dwell'; i: number } | { kind: 'outro' } | null;

class Cancelled extends Error {}

export function DemoTour() {
  const [stage, setStage] = useState<Stage>(null);
  const [abort, setAbort] = useState<AbortController | null>(null);

  useEffect(() => {
    const start = () => {
      if (abort) return;
      const ac = new AbortController();
      setAbort(ac);
      run(ac.signal, setStage)
        .catch((e) => {
          if (!(e instanceof Cancelled)) throw e;
        })
        .finally(() => {
          setStage(null);
          setAbort(null);
        });
    };
    window.addEventListener(DEMO_EVENT, start);
    return () => window.removeEventListener(DEMO_EVENT, start);
  }, [abort]);

  if (!stage) return null;
  const stop = () => abort?.abort();
  if (stage.kind === 'intro') return <Intro onStop={stop} />;
  if (stage.kind === 'outro') return <Outro onStop={stop} />;
  return <Dwell i={stage.i} onStop={stop} />;
}

async function run(signal: AbortSignal, setStage: (s: Stage) => void) {
  const normalSpeed = useAstra.getState().tickMs;
  const nav = (page: string) => window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: page }));
  runtime.tourActive = true;
  try {
    // Açılış: sıfırla, kişisel normalleri hızlı öğren
    setStage({ kind: 'intro' });
    controls.reset();
    controls.setSpeed(CALIBRATION_TICK_MS);
    const t0 = Date.now();
    await until(() => (useAstra.getState().history.elif?.length ?? 0) >= SIM.baselineWindow + 4, 20000, signal);
    controls.setSpeed(normalSpeed);
    await sleep(Math.max(0, INTRO_MS - (Date.now() - t0)), signal);

    for (let i = 0; i < TOUR.length; i++) {
      nav('kokpit');
      setStage(null);
      const ended = waitFor(CINEMATIC_END_EVENT, 90000, signal);
      controls.setScenario(TOUR[i].id);
      await ended;
      setStage({ kind: 'dwell', i });
      await sleep(DWELL_MS, signal);
    }

    controls.setScenario('NORMAL');
    setStage({ kind: 'outro' });
    await sleep(OUTRO_MS, signal);
  } finally {
    runtime.tourActive = false;
    controls.setSpeed(normalSpeed);
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new Cancelled());
    });
  });
}

async function until(ok: () => boolean, maxMs: number, signal: AbortSignal) {
  const t0 = Date.now();
  while (!ok() && Date.now() - t0 < maxMs) await sleep(150, signal);
}

function waitFor(event: string, maxMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      clearTimeout(id);
      window.removeEventListener(event, done);
      resolve();
    };
    const id = setTimeout(done, maxMs);
    window.addEventListener(event, done);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      window.removeEventListener(event, done);
      reject(new Cancelled());
    });
  });
}

// ---------- Ekranlar ----------

function StopButton({ onStop }: { onStop: () => void }) {
  return (
    <button
      onClick={onStop}
      className="rounded-full border px-4 py-1.5 text-sm backdrop-blur hover:bg-white/10"
      style={{ borderColor: alpha(COLORS.text, 0.3), color: COLORS.text }}
    >
      End tour ✕
    </button>
  );
}

function Card({ onStop, children }: { onStop: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden select-none" style={{ background: '#02040b', animation: 'tour-in .9s ease' }}>
      <Stars />
      <div className="relative z-10 max-w-4xl px-8 text-center" style={{ color: COLORS.text }}>
        {children}
      </div>
      <div className="absolute top-4 right-4 z-20">
        <StopButton onStop={onStop} />
      </div>
      <style>{'@keyframes tour-in { from { opacity: 0; } to { opacity: 1; } }'}</style>
    </div>
  );
}

function Intro({ onStop }: { onStop: () => void }) {
  const samples = useAstra((s) => s.history.elif?.length ?? 0);
  const pct = Math.min(100, (samples / SIM.baselineWindow) * 100);
  return (
    <Card onStop={onStop}>
      <div className="font-mono text-sm tracking-[0.4em]" style={{ color: COLORS.calm }}>
        NASA SPACE APPS CHALLENGE 2026
      </div>
      <div className="mt-4 text-6xl font-bold tracking-tight md:text-7xl">Orbitalis</div>
      <div className="mt-2 font-mono text-xl tracking-[0.3em]" style={{ color: COLORS.ai }}>
        ASTRA-MED OS
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed" style={{ color: COLORS.textMuted }}>
        An AI that monitors crew health on a Mars mission 25 minutes from Earth and, in a crisis,{' '}
        <b style={{ color: COLORS.text }}>takes the safe action first</b>.
      </p>
      <div className="mt-8 flex justify-center gap-10 font-mono">
        <Stat value="6" label="astronauts" />
        <Stat value={String(Object.keys(PARAMS).length)} label="sourced parameters" />
        <Stat value="3" label="realistic crises" />
      </div>
      <div className="mx-auto mt-10 max-w-md">
        <div className="mb-2 font-mono text-sm" style={{ color: COLORS.textMuted }}>
          {pct < 100 ? 'ASTRA is learning each astronaut\'s personal baseline…' : 'Personal baselines ready'} ({Math.min(samples, SIM.baselineWindow)}/{SIM.baselineWindow})
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: alpha(COLORS.text, 0.1) }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct < 100 ? COLORS.calm : COLORS.normal, transition: 'width .2s, background .5s' }} />
        </div>
      </div>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-bold">{value}</div>
      <div className="text-sm tracking-widest" style={{ color: COLORS.textMuted }}>
        {label}
      </div>
    </div>
  );
}

function Dwell({ i, onStop }: { i: number; onStop: () => void }) {
  const t = TOUR[i];
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex justify-center px-4">
      <div
        className="pointer-events-auto flex items-center gap-5 rounded-2xl border px-5 py-3 backdrop-blur"
        style={{ borderColor: alpha(COLORS.ai, 0.5), background: alpha('#02040b', 0.85), color: COLORS.text, animation: 'tour-in .6s ease' }}
      >
        <div className="flex gap-1.5">
          {TOUR.map((_, k) => (
            <span key={k} className="h-2 w-6 rounded-full" style={{ background: k <= i ? COLORS.ai : alpha(COLORS.text, 0.2) }} />
          ))}
        </div>
        <div className="text-sm">
          <div className="font-mono text-xs tracking-[0.2em]" style={{ color: COLORS.ai }}>
            DEMO {i + 1}/{TOUR.length} · {SCENARIO_NAMES[t.id].toUpperCase()}
          </div>
          <div>
            Mission Status: Layer 1 logged the incident and applied the safe action (<b>{t.action}</b>). Explanation and acknowledgement are with the crew.
          </div>
        </div>
        <StopButton onStop={onStop} />
      </div>
      <style>{'@keyframes tour-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }'}</style>
    </div>
  );
}

function Outro({ onStop }: { onStop: () => void }) {
  return (
    <Card onStop={onStop}>
      <div className="text-4xl leading-tight font-bold md:text-5xl">
        ASTRA takes the safe action first.
        <br />
        <span style={{ color: COLORS.normal }}>The final decision always stays with the crew.</span>
      </div>
      <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
        {TOUR.map((t) => (
          <div key={t.id} className="rounded-xl border px-4 py-3" style={{ borderColor: alpha(COLORS.text, 0.15), background: alpha('#ffffff', 0.03) }}>
            <div className="text-sm" style={{ color: COLORS.textMuted }}>
              {SCENARIO_NAMES[t.id]}
            </div>
            <div className="mt-1 font-semibold" style={{ color: COLORS.normal }}>
              ✓ {t.action}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 font-mono text-sm tracking-[0.3em]" style={{ color: COLORS.textMuted }}>
        ORBITALIS · ASTRA-MED OS · NASA SPACE APPS 2026
      </div>
    </Card>
  );
}

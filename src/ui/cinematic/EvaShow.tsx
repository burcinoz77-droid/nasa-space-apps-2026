// Part 1 · EVA overexertion cinematic (full screen, ~25 s, can be closed with "Skip" at any time).
//
// Heat load builds up over minutes; the simulation is sped up during the cinematic and returns to its previous speed afterwards.
//   1. Task     : Mars surface, Mert is carrying the habitat solar panel; heart rate is rising.
//   2. Heat     : the suit cannot reject the heat, core temperature rises live. → Layer 1 THERMAL incident + mandatory crew rest
//   3. Response : autonomous action "mandatory crew rest": Mert puts down the panel and walks to the habitat, values fall.
//   4. Close    : back to Mission Status.
import { useEffect, useState } from 'react';
import { ABSOLUTE_LIMITS } from '../../engine/config';
import { controls } from '../../loop';
import { useAstra } from '../../store';
import { alpha, COLORS, fmt } from '../theme';
import { Astronaut } from './Astronaut';
import { usePhases } from './phases';
import { Caption, Stage } from './shared';
import { alarm, chime, useCue, useHeartbeat } from './sound';

const ORDER = ['work', 'heat', 'response'] as const;
type Phase = (typeof ORDER)[number];
const LIMITS: Record<Phase, [number, number]> = {
  work: [5500, 5500],
  heat: [6500, 20000],
  response: [8500, 8500],
};
const FAST_TICK_MS = 300;
const REST_TICK_MS = 200;
const CAUTION = ABSOLUTE_LIMITS['resp.coreTemp_C']!.caution; // 38.5
const CRITICAL = ABSOLUTE_LIMITS['resp.coreTemp_C']!.critical; // 39.0
const REST = 37.4;
const T_MIN = 36.5;
const T_MAX = 40.5;

export function EvaShow({ onClose }: { onClose: () => void }) {
  const hr = useAstra((s) => s.telemetry.mert?.cardio.hr_bpm ?? 80);
  const temp = useAstra((s) => s.telemetry.mert?.resp.coreTemp_C ?? REST);
  const rr = useAstra((s) => s.telemetry.mert?.resp.rr_bpm ?? 16);
  const lactate = useAstra((s) => s.telemetry.mert?.biochem.sweatLactate_mM ?? 8);
  const incident = useAstra((s) => s.incidents.find((i) => i.type === 'THERMAL' && i.status !== 'resolved'));
  // Once crew rest is applied Mert cools quickly and the incident may close; the cinematic remembers this moment until the end.
  const [rested, setRested] = useState(false);
  const [peak, setPeak] = useState<'caution' | 'critical' | null>(null);
  if (incident?.autoActions.includes('MANDATORY_REST') && !rested) setRested(true);
  if (incident && peak !== 'critical' && incident.level !== peak) setPeak(incident.level);
  const resting = rested;

  useEffect(() => {
    const prev = useAstra.getState().tickMs;
    controls.setSpeed(FAST_TICK_MS);
    return () => controls.setSpeed(prev);
  }, []);

  const phase = usePhases(ORDER, LIMITS, (p) => (p === 'heat' ? resting : true), onClose);

  useEffect(() => {
    if (phase === 'response') controls.setSpeed(REST_TICK_MS);
  }, [phase]);

  useHeartbeat(phase !== 'outro', hr);
  useCue(peak !== null, alarm);
  useCue(phase === 'response' && rested, chime);

  const level = temp >= CRITICAL ? COLORS.critical : temp >= CAUTION ? COLORS.caution : COLORS.normal;
  const walking = phase === 'response' && resting;
  const heat = Math.max(0, Math.min(1, (temp - 37.8) / (CRITICAL + 0.4 - 37.8)));

  return (
    <Stage
      fading={phase === 'outro'}
      onClose={onClose}
      label="EVA overexertion cinematic"
      credit="Data: ARES-1 simulation (live, accelerated for the demo) · Heat: Stahn et al. 2017, Sci Rep · Threshold assumed"
    >
      {/* Mars surface */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: '38vh', background: 'linear-gradient(to bottom, #9a3b22 0%, #6b2414 45%, #2a0c06 100%)' }} />
      <div className="absolute inset-x-0" style={{ bottom: '38vh', height: '22vh', background: 'linear-gradient(to top, rgba(217,119,87,0.35), transparent)' }} />

      {/* Habitat */}
      <div className="absolute flex flex-col items-center" style={{ left: '36vw', bottom: '30vh' }}>
        <svg width="300" height="177" viewBox="0 0 220 130">
          <path d="M10 125 Q10 15 110 15 Q210 15 210 125 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
          <path d="M40 125 Q40 40 110 40 Q180 40 180 125" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
          <rect x="90" y="80" width="40" height="45" rx="6" fill={walking ? alpha(COLORS.normal, 0.5) : '#334155'} stroke={walking ? COLORS.normal : '#475569'} strokeWidth="2" />
          <rect x="0" y="120" width="220" height="8" rx="3" fill="#475569" />
        </svg>
        <div className="font-mono text-sm" style={{ color: walking ? COLORS.normal : COLORS.textMuted }}>
          HABITAT · cooling
        </div>
      </div>

      {/* Solar panel: first next to Mert, stays on the ground during rest */}
      <div
        className="absolute"
        style={{ left: '12vw', bottom: '30vh', transform: `rotate(${walking ? -4 : -18}deg)`, transformOrigin: 'bottom right', transition: 'transform 1s' }}
      >
        <div className="grid grid-cols-4 gap-[2px] rounded-sm border-2 p-[2px]" style={{ width: 150, height: 92, borderColor: '#94a3b8', background: '#0f172a' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }} />
          ))}
        </div>
      </div>

      {/* Mert */}
      <div
        className="absolute flex flex-col items-center"
        style={{ left: walking ? '43vw' : '22vw', bottom: '29vh', transform: `scale(${walking ? 0.62 : 1})`, transformOrigin: 'bottom center', transition: 'left 5s cubic-bezier(.4,0,.3,1) .6s, transform 5s cubic-bezier(.4,0,.3,1) .6s' }}
      >
        <HeatWaves strength={walking ? 0 : heat} />
        <Astronaut
          height={300}
          stripe={COLORS.caution}
          glow={peak && !walking ? (peak === 'critical' ? COLORS.critical : COLORS.caution) : level !== COLORS.normal ? level : undefined}
          breath={60 / Math.max(8, rr)}
          fog={heat}
        />
        <div className="mt-1 rounded-full px-3 text-base font-semibold" style={{ color: level, background: alpha('#02040b', 0.6) }}>
          Mert
        </div>
      </div>

      {/* Live values */}
      <div className="absolute flex gap-8" style={{ right: '5vw', top: '18vh', height: '56vh' }}>
        <Thermo temp={temp} level={level} />
        <div className="flex flex-col justify-end gap-5 font-mono">
          <div className="flex items-center gap-3">
            <Heart hr={hr} />
            <Big label="Heart rate" value={fmt(hr, 0)} unit="bpm" color={hr > 140 ? COLORS.critical : hr > 110 ? COLORS.caution : COLORS.text} />
          </div>
          <Big label="Breathing" value={fmt(rr, 0)} unit="/min" color={rr > 26 ? COLORS.caution : COLORS.text} />
          <Big label="Sweat lactate" value={fmt(lactate, 0)} unit="mM" color={lactate > 15 ? COLORS.caution : COLORS.text} />
        </div>
      </div>

      <Caption show={phase === 'work'} pos="top">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: COLORS.calm }}>
          MARS SURFACE · EVA · MISSION DAY 180
        </div>
        <div className="mt-2 text-2xl font-bold md:text-3xl">Mert is carrying the habitat's solar panel</div>
        <div className="mt-2 text-base" style={{ color: COLORS.textMuted }}>
          Fact: during exercise in space core temperature <b style={{ color: COLORS.text }}>can exceed 40 °C</b> (Stahn et al. 2017)
        </div>
      </Caption>

      <Caption show={phase === 'heat'} pos="top">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: COLORS.critical }}>
          HEAT LOAD · INSIDE THE SUIT
        </div>
        <div className="mt-2 text-2xl font-bold md:text-3xl">The suit can't shed the heat</div>
        <div className="mt-2 text-base" style={{ color: COLORS.textMuted }}>
          In the suit, sweat can't cool him down. Mert is focused on the task and may be the last to notice.
        </div>
      </Caption>

      <Caption show={phase === 'response'} pos="top">
        <div className="rounded-xl border px-5 py-3" style={{ borderColor: alpha(COLORS.critical, 0.6), background: alpha('#02040b', 0.8) }}>
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: COLORS.critical }}>
            ASTRA · LAYER 1 · HEAT LOAD {peak === 'critical' ? 'WARNING' : 'CAUTION'}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-lg" style={{ color: resting ? COLORS.normal : COLORS.textMuted }}>
            <span>{resting ? '✓' : '…'}</span>
            <span>
              Autonomous action: <b>mandatory crew rest</b>
            </span>
          </div>
          <div className="mt-1 text-sm" style={{ color: COLORS.textMuted }}>
            A pre-approved safe action. When to resume the task is the crew's decision.
          </div>
        </div>
      </Caption>
    </Stage>
  );
}

function Big({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div>
      <div className="text-xs tracking-widest" style={{ color: COLORS.textMuted }}>
        {label.toUpperCase()}
      </div>
      <div className="text-4xl font-bold tabular-nums" style={{ color, transition: 'color .5s' }}>
        {value}
        <span className="ml-1 text-base font-normal" style={{ color: COLORS.textMuted }}>
          {unit}
        </span>
      </div>
    </div>
  );
}

/** Heart beating at the heart rate: one beat = 60 / heart rate. */
function Heart({ hr }: { hr: number }) {
  const period = 60 / Math.max(40, hr);
  return (
    <svg width="44" height="40" viewBox="0 0 24 22" style={{ animation: `eva-beat ${period}s ease-out infinite`, transformOrigin: 'center' }}>
      <path d="M12 21 C 5 15, 0 11, 0 6 A 6 6 0 0 1 12 4 A 6 6 0 0 1 24 6 C 24 11, 19 15, 12 21 Z" fill={COLORS.critical} />
      <style>{'@keyframes eva-beat { 0% { transform: scale(1); } 15% { transform: scale(1.25); } 30% { transform: scale(0.95); } 45%, 100% { transform: scale(1); } }'}</style>
    </svg>
  );
}

/** Vertical core temperature thermometer: rest, caution and warning lines. */
function Thermo({ temp, level }: { temp: number; level: string }) {
  const pct = (v: number) => `${100 - Math.max(0, Math.min(100, ((v - T_MIN) / (T_MAX - T_MIN)) * 100))}%`;
  return (
    <div className="flex h-full items-stretch gap-3">
      <div className="relative w-14 overflow-hidden rounded-full border" style={{ borderColor: alpha(COLORS.text, 0.25), background: alpha('#ffffff', 0.04) }}>
        <div
          className="absolute right-0 bottom-0 left-0"
          style={{ top: pct(temp), background: `linear-gradient(to top, ${alpha(level, 0.95)}, ${alpha(level, 0.4)})`, transition: 'top .3s linear, background .5s' }}
        />
        {[
          [CRITICAL, COLORS.critical],
          [CAUTION, COLORS.caution],
          [REST, COLORS.normal],
        ].map(([v, c]) => (
          <div key={String(v)} className="absolute right-0 left-0 border-t-2 border-dashed" style={{ top: pct(v as number), borderColor: c as string }} />
        ))}
      </div>
      <div className="relative w-44">
        {[
          [CRITICAL, COLORS.critical, 'critical'],
          [CAUTION, COLORS.caution, 'caution'],
          [REST, COLORS.normal, 'rest'],
        ].map(([v, c, t]) => (
          <div key={String(v)} className="absolute font-mono text-sm whitespace-nowrap" style={{ top: pct(v as number), transform: 'translateY(-50%)', color: c as string }}>
            ◀ {fmt(v as number, 1)} °C {t}
          </div>
        ))}
        <div className="absolute bottom-0 left-0">
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: COLORS.textMuted }}>
            CORE
          </div>
          <div className="font-mono text-5xl font-bold tabular-nums" style={{ color: level, transition: 'color .5s' }}>
            {fmt(temp, 1)}
          </div>
          <div className="font-mono text-base" style={{ color: COLORS.text }}>
            °C · live
          </div>
        </div>
      </div>
    </div>
  );
}

/** Heat waves rising above the astronaut; strength 0–1. */
function HeatWaves({ strength }: { strength: number }) {
  return (
    <svg width="160" height="80" viewBox="0 0 160 80" className="pointer-events-none" style={{ marginBottom: -30, opacity: strength, transition: 'opacity .8s' }}>
      {[30, 65, 100, 130].map((x, i) => (
        <path
          key={x}
          d={`M${x} 78 q -10 -12 0 -24 q 10 -12 0 -24 q -10 -12 0 -24`}
          fill="none"
          stroke={i % 2 ? '#fb923c' : '#f87171'}
          strokeWidth="3"
          strokeLinecap="round"
          style={{ animation: `eva-rise 1.6s ease-in ${i * 0.35}s infinite` }}
        />
      ))}
      <style>{'@keyframes eva-rise { 0% { transform: translateY(14px); opacity: 0; } 40% { opacity: 1; } 100% { transform: translateY(-14px); opacity: 0; } }'}</style>
    </svg>
  );
}

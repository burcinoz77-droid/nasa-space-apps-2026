// Parça 1 · CO₂ temizleyici arızası sinematiği (tam ekran, ~25 sn, her an "Atla" ile kapanır).
//
// CO₂ fırtına gibi anlık değil, sessizce birikir. Sinematik süresince simülasyon 0,4 sn/ölçüm hızına
// (tepki sahnesinde 0,15 sn) alınır, bitince eski hızına döner: veri yine gerçek, sadece daha hızlı akar.
//   1. Kabin    : ARES-1 Kokpit kesiti, temizleyici çalışıyor, gösterge normal.
//   2. Arıza    : fan durur, kabin CO₂ molekülleriyle dolar, gösterge canlı yükselir. → ppCO₂ 2,3'ü geçince biter
//   3. Beden    : Kerem'in göğsü GERÇEK solunum hızıyla nefes alır; nabız ve EtCO₂ canlı. → Katman 1 kritik + havalandırma
//   4. Tepki    : otonom adım "havalandırma artırıldı": fan hızlanır, moleküller emilir, gösterge düşer.
//   5. Kapanış  : Kokpit'e döner.
import { useEffect, useRef } from 'react';
import { controls } from '../../loop';
import { PARAMS } from '../../sim/parameters';
import { useAstra } from '../../store';
import { alpha, COLORS, fmt } from '../theme';
import { Astronaut } from './Astronaut';
import { usePhases } from './phases';
import { Caption, Stage } from './shared';
import { alarm, chime, useCue, useHeartbeat } from './sound';

const ORDER = ['cabin', 'failure', 'body', 'response'] as const;
type Phase = (typeof ORDER)[number];
const LIMITS: Record<Phase, [number, number]> = {
  cabin: [4500, 4500],
  failure: [5000, 14000],
  body: [5000, 18000],
  response: [8000, 8000],
};
const FAST_TICK_MS = 400;
const VENT_TICK_MS = 150; // tepki sahnesinde: havalandırmanın 40 ölçümlük etkisi ekranda görünsün
const CAUTION = PARAMS.co2CautionLimit.value; // 2,3
const CRITICAL = PARAMS.co2CriticalLimit.value; // 3,0
const MEDIAN = PARAMS.cabinCO2Median.value; // 1,9
const GAUGE_MAX = 6;

export function Co2Show({ onClose }: { onClose: () => void }) {
  const ppco2 = useAstra((s) => s.telemetry.kerem?.env.ppCO2_mmHg ?? MEDIAN);
  const rr = useAstra((s) => s.telemetry.kerem?.resp.rr_bpm ?? 14);
  const hr = useAstra((s) => s.telemetry.kerem?.cardio.hr_bpm ?? 70);
  const etco2 = useAstra((s) => s.telemetry.kerem?.resp.etco2_mmHg ?? 38);
  const incident = useAstra((s) => s.incidents.find((i) => i.type === 'CO2' && i.status !== 'resolved'));
  const vented = Boolean(incident?.autoActions.includes('INCREASE_VENTILATION'));

  // Sinematik süresince simülasyonu hızlandır, bitince eski hızına döndür
  useEffect(() => {
    const prev = useAstra.getState().tickMs;
    controls.setSpeed(FAST_TICK_MS);
    return () => controls.setSpeed(prev);
  }, []);

  const phase = usePhases(ORDER, LIMITS, (p) => (p === 'failure' ? ppco2 > CAUTION : p === 'body' ? vented : true), onClose);

  useEffect(() => {
    if (phase === 'response') controls.setSpeed(VENT_TICK_MS);
  }, [phase]);

  useCue(phase === 'failure', alarm);
  useHeartbeat(phase === 'body' || phase === 'response', hr);
  useCue(phase === 'response' && vented, chime);

  const fan: 'run' | 'stop' | 'boost' = phase === 'cabin' ? 'run' : phase === 'response' && vented ? 'boost' : 'stop';
  const level = ppco2 >= CRITICAL ? COLORS.critical : ppco2 >= CAUTION ? COLORS.caution : COLORS.normal;

  return (
    <Stage
      fading={phase === 'outro'}
      onClose={onClose}
      label="CO₂ scrubber failure cinematic"
      credit="Data: ARES-1 simulation (live, accelerated for the demo) · Limits: NASA OCHMO-TB-004 · ISS CO₂: NASA OSDR EDA"
    >
      {/* Kabin kesiti */}
      <div className="absolute" style={{ left: '4vw', top: '18vh', width: '56vw', height: '60vh' }}>
        <Cabin ppco2={ppco2} fan={fan} rr={rr} level={level} showKerem={phase === 'body' || phase === 'response'} />
      </div>

      {/* Gösterge */}
      <div className="absolute" style={{ right: '6vw', top: '16vh', width: '22vw', height: '64vh' }}>
        <Gauge ppco2={ppco2} level={level} />
      </div>

      <Caption show={phase === 'cabin'} pos="top">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: COLORS.calm }}>
          ARES-1 · SPACECRAFT CABIN · MISSION DAY 180
        </div>
        <div className="mt-2 text-2xl font-bold md:text-3xl">CO₂ scrubber running</div>
        <div className="mt-2 text-base" style={{ color: COLORS.textMuted }}>
          Fact: the highest cabin CO₂ measured on the ISS ≈ <b style={{ color: COLORS.text }}>{fmt(PARAMS.cabinCO2FailurePeak.value, 1)} mmHg</b> (NASA OSDR EDA)
        </div>
      </Caption>

      <Caption show={phase === 'failure'} pos="top">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: COLORS.critical }}>
          FAILURE · CO₂ SCRUBBER STOPPED
        </div>
        <div className="mt-2 text-2xl font-bold md:text-3xl">CO₂ is colorless and odorless</div>
        <div className="mt-2 text-base" style={{ color: COLORS.textMuted }}>
          The crew won't notice. First signs are headache, faster breathing and loss of focus.
        </div>
      </Caption>

      <Caption show={phase === 'body'} pos="top">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: COLORS.caution }}>
          KEREM · LIVE READING
        </div>
        <div className="mt-2 text-2xl font-bold md:text-3xl">The body responds</div>
        <div className="mt-2 text-base" style={{ color: COLORS.textMuted }}>
          Kerem is twice as sensitive to CO₂ (personal trait). His chest moves at his real breathing rate.
        </div>
      </Caption>

      {/* Kerem'in canlı değerleri */}
      <Caption show={phase === 'body' || phase === 'response'} pos="bottom-left">
        <div className="flex gap-6 font-mono">
          <Vital label="Breathing" value={fmt(rr, 0)} unit="/min" color={rr > 20 ? COLORS.caution : COLORS.text} />
          <Vital label="Heart rate" value={fmt(hr, 0)} unit="bpm" color={hr > 90 ? COLORS.caution : COLORS.text} />
          <Vital label="EtCO₂" value={fmt(etco2, 0)} unit="mmHg" color={etco2 > 45 ? COLORS.caution : COLORS.text} />
        </div>
      </Caption>

      <Caption show={phase === 'response'} pos="top">
        <div className="rounded-xl border px-5 py-3" style={{ borderColor: alpha(COLORS.critical, 0.6), background: alpha('#02040b', 0.8) }}>
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: COLORS.critical }}>
            ASTRA · LAYER 1 · CO₂ {incident?.level === 'critical' ? 'WARNING' : 'CAUTION'}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-lg" style={{ color: vented ? COLORS.normal : COLORS.textMuted }}>
            <span>{vented ? '✓' : '…'}</span>
            <span>
              Autonomous action: <b>ventilation increased</b>
            </span>
          </div>
          <div className="mt-1 text-sm" style={{ color: COLORS.textMuted }}>
            A pre-approved safe action. Repairing the scrubber is the crew's decision.
          </div>
        </div>
      </Caption>
    </Stage>
  );
}

function Vital({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
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

/** Dikey ppCO₂ göstergesi: ISS medyanı, dikkat ve kritik çizgileri. */
function Gauge({ ppco2, level }: { ppco2: number; level: string }) {
  const pct = (v: number) => `${100 - Math.min(100, (v / GAUGE_MAX) * 100)}%`;
  return (
    <div className="flex h-full items-stretch gap-4">
      <div className="relative w-16 overflow-hidden rounded-full border" style={{ borderColor: alpha(COLORS.text, 0.25), background: alpha('#ffffff', 0.04) }}>
        <div
          className="absolute right-0 bottom-0 left-0"
          style={{ top: pct(ppco2), background: `linear-gradient(to top, ${alpha(level, 0.9)}, ${alpha(level, 0.4)})`, transition: 'top .4s linear, background .5s' }}
        />
        {[
          [CRITICAL, COLORS.critical],
          [CAUTION, COLORS.caution],
          [MEDIAN, COLORS.normal],
        ].map(([v, c]) => (
          <div key={String(v)} className="absolute right-0 left-0 border-t-2 border-dashed" style={{ top: pct(v as number), borderColor: c as string }} />
        ))}
      </div>
      <div className="relative flex-1">
        <div className="absolute" style={{ top: pct(CRITICAL), transform: 'translateY(-50%)' }}>
          <Tick color={COLORS.critical} text={`${fmt(CRITICAL, 1)} warning`} />
        </div>
        <div className="absolute" style={{ top: pct(CAUTION), transform: 'translateY(-50%)' }}>
          <Tick color={COLORS.caution} text={`${fmt(CAUTION, 1)} caution`} />
        </div>
        <div className="absolute" style={{ top: pct(MEDIAN), transform: 'translateY(-50%)' }}>
          <Tick color={COLORS.normal} text={`${fmt(MEDIAN, 1)} ISS median`} />
        </div>
        <div className="absolute bottom-0 left-0">
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: COLORS.textMuted }}>
            CABIN ppCO₂
          </div>
          <div className="font-mono text-6xl font-bold tabular-nums" style={{ color: level, transition: 'color .5s' }}>
            {fmt(ppco2, 1)}
          </div>
          <div className="font-mono text-base" style={{ color: COLORS.text }}>
            mmHg · live
          </div>
        </div>
      </div>
    </div>
  );
}

function Tick({ color, text }: { color: string; text: string }) {
  return (
    <span className="font-mono text-sm whitespace-nowrap" style={{ color }}>
      ◀ {text}
    </span>
  );
}

/** Kabin kesiti: 3 astronot, temizleyici (fan), CO₂ molekülleri (canvas). */
function Cabin({ ppco2, fan, rr, level, showKerem }: { ppco2: number; fan: 'run' | 'stop' | 'boost'; rr: number; level: string; showKerem: boolean }) {
  const fanColor = fan === 'stop' ? COLORS.critical : COLORS.normal;
  const spin = fan === 'run' ? '0.8s' : fan === 'boost' ? '0.18s' : '0s';
  const breath = 60 / Math.max(6, rr); // bir nefes süresi (sn), canlı solunum hızından
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 rounded-[48px] border-2" style={{ borderColor: alpha(level, 0.7), background: alpha('#0f172a', 0.85), transition: 'border-color .5s' }} />
      <Molecules ppco2={ppco2} venting={fan === 'boost'} />

      {/* Temizleyici */}
      <div className="absolute flex flex-col items-center" style={{ right: '5%', top: '10%' }}>
        <svg width="96" height="96" viewBox="-50 -50 100 100">
          <circle r="46" fill="#0b1224" stroke={fanColor} strokeWidth="3" />
          <g style={{ animation: fan === 'stop' ? 'none' : `astra-spin ${spin} linear infinite`, transformBox: 'view-box', transformOrigin: '0px 0px' }}>
            {[0, 72, 144, 216, 288].map((a) => (
              <path key={a} d="M0 0 C 8 -10, 30 -14, 36 -4 C 26 0, 10 2, 0 0" fill={fanColor} transform={`rotate(${a})`} opacity="0.85" />
            ))}
          </g>
          <circle r="6" fill={fanColor} />
        </svg>
        <div className="mt-1 text-center text-sm font-semibold" style={{ color: fanColor }}>
          CO₂ scrubber
          <br />
          <span className="font-normal">{fan === 'stop' ? 'STOPPED' : fan === 'boost' ? 'ventilation ↑' : 'running'}</span>
        </div>
      </div>

      {/* Mürettebat */}
      {[
        { name: 'Elif', x: '9%', stripe: COLORS.calm },
        { name: 'Kerem', x: '32%', stripe: COLORS.caution, kerem: true },
        { name: 'Zeynep', x: '55%', stripe: COLORS.ai },
      ].map((c) => {
        const live = c.kerem && showKerem;
        return (
          <div key={c.name} className="absolute flex flex-col items-center" style={{ left: c.x, bottom: '6%' }}>
            <Astronaut
              stripe={c.stripe}
              glow={live && level !== COLORS.normal ? level : undefined}
              breath={live ? breath : 4.3}
              fog={Math.max(0, Math.min(1, (ppco2 - MEDIAN) / (CRITICAL + 1 - MEDIAN)))}
              height={190}
            />
            <div className="mt-1 rounded-full px-2 text-sm font-semibold" style={{ color: live ? level : COLORS.text, background: alpha('#02040b', 0.6) }}>
              {c.name}
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes astra-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/** CO₂ molekülleri: sayısı ppCO₂ ile artar; havalandırmada temizleyiciye doğru emilir. */
function Molecules({ ppco2, venting }: { ppco2: number; venting: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef({ ppco2, venting });
  useEffect(() => {
    state.current = { ppco2, venting };
  }, [ppco2, venting]);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const rect = c.getBoundingClientRect();
    const W = (c.width = rect.width);
    const H = (c.height = rect.height);
    const sink = { x: W * 0.9, y: H * 0.22 };
    type M = { x: number; y: number; vx: number; vy: number };
    const ms: M[] = [];
    let raf = 0;
    const frame = () => {
      const { ppco2: p, venting: v } = state.current;
      const target = Math.max(0, Math.round((p - 1.2) * 90));
      while (ms.length < target) ms.push({ x: W * (0.05 + Math.random() * 0.8), y: H * (0.08 + Math.random() * 0.84), vx: 0, vy: 0 });
      if (ms.length > target && !v) ms.splice(0, ms.length - target);
      ctx.clearRect(0, 0, W, H);
      for (let i = ms.length - 1; i >= 0; i--) {
        const m = ms[i];
        if (v) {
          const dx = sink.x - m.x;
          const dy = sink.y - m.y;
          const d = Math.hypot(dx, dy) || 1;
          m.vx = m.vx * 0.9 + (dx / d) * 1.6;
          m.vy = m.vy * 0.9 + (dy / d) * 1.6;
          if (d < 30) ms.splice(i, 1); // temizleyiciye ulaşan molekül emilir
        } else {
          m.vx = m.vx * 0.96 + (Math.random() - 0.5) * 0.4;
          m.vy = m.vy * 0.96 + (Math.random() - 0.5) * 0.4;
        }
        m.x = Math.min(W - 8, Math.max(8, m.x + m.vx));
        m.y = Math.min(H - 8, Math.max(8, m.y + m.vy));
        // CO₂: ortada karbon (koyu), iki yanda oksijen (kırmızımsı)
        ctx.fillStyle = 'rgba(148,163,184,0.85)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(248,113,113,0.75)';
        for (const ox of [-5, 5]) {
          ctx.beginPath();
          ctx.arc(m.x + ox, m.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full rounded-[48px]" />;
}

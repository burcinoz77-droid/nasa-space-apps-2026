// Part 1 · Solar particle event cinematic (full screen, ~20 s, can be closed with "Skip" at any time).
//
// Not a show but a visualization of the data: scenes advance on the simulation's real data, not on timers
// (each scene waits for its data condition).
//   1. Flare    : REAL NASA/SDO footage (10 May 2024 X3.9, DONKI FLR 30666). A drawn Sun if the file is missing.
//   2. Transit  : particle cloud from the Sun to ARES-1.          → ends when the spacecraft dose rate triples
//   3. Impact   : live dose counter (Elif's reading, µSv/h).      → ends when Layer 1 raises the RADIATION incident
//   4. Response : Layer 1 incident + autonomous storm shelter action, the crew moves into the shelter, dose falls.
//   5. Close    : back to Mission Status; the real incident banner is there.
// Each scene also has a maximum duration: the cinematic does not get stuck even if the data is late.
//
// Trigger: index.tsx (when the scenario switches to SOLAR_STORM, or with the button in Settings).
// Imagery: NASA/SDO (public domain, credited). The NASA logo is not used.
import { useEffect, useRef, useState } from 'react';
import { PARAMS } from '../../sim/parameters';
import { useAstra } from '../../store';
import { alpha, COLORS, fmt } from '../theme';
import { Astronaut } from './Astronaut';
import { fmtMinSec, usePhases } from './phases';
import { Caption, Stage } from './shared';
import { alarm, chime, useCue, whoosh } from './sound';

const VIDEO_URL = `${import.meta.env.BASE_URL}media/sdo-x39-2024-05-10.mp4`;
const BASE_DOSE = (PARAMS.doseRateMarsTransit.value * 1000) / 24; // 76.7 µSv/h

const ORDER = ['flare', 'travel', 'impact', 'response'] as const;
type Phase = (typeof ORDER)[number];
// Scene durations (ms): [min, max]
const LIMITS: Record<Phase, [number, number]> = {
  flare: [6000, 6000],
  travel: [3500, 12000],
  impact: [3000, 9000],
  response: [6500, 6500],
};

export function StormShow({ onClose }: { onClose: () => void }) {
  const [videoOk, setVideoOk] = useState(true);
  const dose = useAstra((s) => s.telemetry.elif?.env.doseRate_uSv_h ?? BASE_DOSE);
  const surfaceDose = useAstra((s) => s.telemetry.emir?.env.doseRate_uSv_h ?? 26.7);
  const cumulative = useAstra((s) => s.telemetry.elif?.env.doseCumulative_mSv ?? 0);
  const delay = useAstra((s) => s.ship?.commDelayOneWay_s ?? 750);
  const incident = useAstra((s) => s.incidents.find((i) => i.type === 'RADIATION' && i.level === 'critical' && i.status !== 'resolved'));
  const sheltered = Boolean(incident?.autoActions.includes('RADIATION_SHELTER'));

  const phase = usePhases(ORDER, LIMITS, (p) => (p === 'travel' ? dose > BASE_DOSE * 3 : p === 'impact' ? Boolean(incident) : true), onClose);

  useCue(phase === 'travel', whoosh);
  useCue(Boolean(incident), alarm);
  useCue(phase === 'response' && sheltered, chime);

  const small = phase !== 'flare'; // the Sun shrinks into the corner
  const hot = phase === 'impact' || (phase === 'response' && !sheltered);
  const multiplier = dose / BASE_DOSE;

  return (
    <Stage
      fading={phase === 'outro'}
      onClose={onClose}
      label="Solar particle event cinematic"
      credit={`${videoOk ? 'Imagery: NASA/SDO · ' : ''}Event times: NASA DONKI · Dose: ARES-1 simulation (live)`}
    >
      <Particles active={phase !== 'flare'} shielded={phase === 'response' && sheltered} />
      {/* Sun: real SDO footage (shrinks from full screen to the left corner) */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: small ? '-9vh' : '66%', // aligned right in the first scene: so the text on the left does not cover the NASA timestamp
          top: '50%',
          width: small ? '46vh' : '84vh',
          height: small ? '46vh' : '84vh',
          transform: 'translate(' + (small ? '0' : '-50%') + ', -50%)',
          borderRadius: small ? '50%' : '2%', // square in the first scene: so NASA's date stamp is visible
          boxShadow: small ? `0 0 120px 30px ${alpha('#f59e0b', 0.35)}` : 'none',
          transition: 'all 1.6s cubic-bezier(.6,0,.2,1)',
        }}
      >
        {videoOk ? (
          <video
            src={VIDEO_URL}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoOk(false)}
            className="h-full w-full object-cover"
            style={{ transform: small ? 'scale(1.12)' : 'none', transition: 'transform 1.6s cubic-bezier(.6,0,.2,1)' }}
          />
        ) : (
          <DrawnSun />
        )}
      </div>

      {/* 1 · Flare text */}
      <Caption show={phase === 'flare'} pos="bottom-left">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: COLORS.caution }}>
          {videoOk ? 'REAL FOOTAGE · NASA/SDO · AIA 304 Å' : 'ANIMATION · DATA: NASA DONKI'}
        </div>
        <div className="mt-2 text-3xl font-bold md:text-4xl">X3.9 solar flare</div>
        <div className="mt-1 text-lg" style={{ color: COLORS.text }}>
          10 May 2024 · 06:54 UTC
        </div>
        <div className="mt-3 max-w-md text-sm" style={{ color: COLORS.textMuted }}>
          This is a real event. Our simulation replays this storm from NASA DONKI records as it hits ARES-1 on the way to Mars.
        </div>
      </Caption>

      {/* Spacecraft and Mars (from scene 2) */}
      <Ship show={small} hot={hot} sheltered={phase === 'response' && sheltered} />

      {/* 2 · Transit */}
      <Caption show={phase === 'travel'} pos="top">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: COLORS.caution }}>
          PARTICLE CLOUD INBOUND · GOES &gt;10 MeV
        </div>
        <div className="mt-2 text-2xl font-bold md:text-3xl">ARES-1, Mars orbit · Mission Day 180</div>
        <div className="mt-2 text-base" style={{ color: COLORS.textMuted }}>
          One-way light time to Earth <b style={{ color: COLORS.text }}>{fmtMinSec(delay)}</b>: by the time Mission Control's warning arrives, it is too late.
        </div>
      </Caption>

      {/* 3 · Impact: live dose counter */}
      <Caption show={phase === 'impact' || phase === 'response'} pos="top-right">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: hot ? COLORS.critical : COLORS.normal }}>
          LIVE READING · SPACECRAFT DOSE RATE
        </div>
        <div className="mt-1 font-mono text-6xl font-bold tabular-nums md:text-7xl" style={{ color: hot ? COLORS.critical : COLORS.normal, transition: 'color .6s' }}>
          {fmt(dose, 0)}
        </div>
        <div className="font-mono text-lg" style={{ color: COLORS.text }}>
          µSv/h · <b>{fmt(multiplier, 0)}×</b> normal
        </div>
        <div className="mt-2 font-mono text-sm" style={{ color: COLORS.textMuted }}>
          Mars surface (atmosphere shield): {fmt(surfaceDose, 0)} µSv/h
        </div>
        <div className="font-mono text-sm" style={{ color: COLORS.textMuted }}>
          Elif's cumulative dose: {fmt(cumulative, 1)} / 600 mSv career limit
        </div>
        {sheltered && (
          <div className="mt-2 text-sm font-semibold" style={{ color: COLORS.normal }}>
            Dose rate drops by about 70% in the shelter (assumption)
          </div>
        )}
      </Caption>

      {/* 4 · Response: Layer 1 + autonomous action */}
      <Caption show={phase === 'response'} pos="bottom-left">
        <div className="rounded-xl border p-4" style={{ borderColor: alpha(COLORS.critical, 0.6), background: alpha('#02040b', 0.75) }}>
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: COLORS.critical }}>
            ASTRA · LAYER 1 · {incident ? 'WARNING RAISED' : 'DETECTING ANOMALY'}
          </div>
          <div className="mt-1 text-xl font-bold">Radiation: dose rate far above personal baseline</div>
          <div className="mt-3 flex items-center gap-2 text-base" style={{ color: sheltered ? COLORS.normal : COLORS.textMuted }}>
            <span>{sheltered ? '✓' : '…'}</span>
            <span>
              Autonomous action: <b>storm shelter ingress</b> {sheltered ? '(started)' : '(pending)'}
            </span>
          </div>
          <div className="mt-1 text-sm" style={{ color: COLORS.textMuted }}>
            A pre-approved safe action, taken without waiting for a human. The final decision stays with the crew.
          </div>
        </div>
      </Caption>

    </Stage>
  );
}

// ---------- Pieces ----------

function DrawnSun() {
  return (
    <div
      className="h-full w-full"
      style={{
        background: 'radial-gradient(circle at 62% 58%, #fff7d6 0%, #fde047 6%, #f59e0b 22%, #c2410c 55%, #7c2d12 78%, #1c0a04 100%)',
        animation: 'astra-pulse 2.4s ease-in-out infinite',
      }}
    />
  );
}

/** ARES-1 and Mars (on the right). sheltered: the crew is in the storm shelter, the shield glows. */
const STRIPES = [COLORS.calm, COLORS.caution, COLORS.ai];

function Ship({ show, hot, sheltered }: { show: boolean; hot: boolean; sheltered: boolean }) {
  const crewColor = sheltered ? COLORS.normal : hot ? COLORS.critical : COLORS.calm;
  return (
    <div
      className="absolute"
      style={{ right: '4vw', top: '50%', width: '44vw', height: '64vh', transform: 'translateY(-50%)', opacity: show ? 1 : 0, transition: 'opacity 1.4s ease .6s' }}
    >
      <svg viewBox="0 0 600 420" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="mars" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#d97757" />
            <stop offset="55%" stopColor="#9a3b22" />
            <stop offset="100%" stopColor="#3b130a" />
          </radialGradient>
          <radialGradient id="shield" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor={COLORS.normal} stopOpacity="0" />
            <stop offset="100%" stopColor={COLORS.normal} stopOpacity="0.55" />
          </radialGradient>
        </defs>
        {/* Mars */}
        <circle cx="470" cy="300" r="120" fill="url(#mars)" />
        <circle cx="470" cy="300" r="124" fill="none" stroke="#f0a58a" strokeOpacity="0.25" strokeWidth="6" />
        {/* Surface crew */}
        {STRIPES.map((stripe, i) => (
          <g key={i} transform={`translate(${435 + i * 24 - 9} ${150 + Math.abs(i - 1) * 3})`}>
            <Astronaut height={30} stripe={stripe} glow={hot || sheltered ? crewColor : undefined} />
          </g>
        ))}
        <text x="470" y="440" textAnchor="middle" fill={COLORS.textMuted} fontSize="15">
          Surface crew · Mars surface · atmosphere shield
        </text>

        {/* ARES-1 in orbit */}
        <g transform="translate(150 130)" style={{ filter: hot ? 'drop-shadow(0 0 18px #f87171)' : 'none', transition: 'filter .5s' }}>
          <rect x="-90" y="-22" width="180" height="44" rx="14" fill="#1e293b" stroke={hot ? COLORS.critical : '#64748b'} strokeWidth="2" />
          <rect x="-150" y="-10" width="56" height="20" fill="#1e3a5f" stroke="#38bdf8" strokeWidth="1" />
          <rect x="94" y="-10" width="56" height="20" fill="#1e3a5f" stroke="#38bdf8" strokeWidth="1" />
          {/* Storm shelter compartment (water-walled) */}
          <rect x="20" y="-16" width="62" height="32" rx="8" fill={sheltered ? alpha(COLORS.normal, 0.25) : '#0f172a'} stroke={sheltered ? COLORS.normal : '#475569'} strokeDasharray="4 3" />
          <text x="51" y="40" textAnchor="middle" fill={sheltered ? COLORS.normal : COLORS.textMuted} fontSize="12">
            shelter
          </text>
          {/* Orbit crew: slides into the storm shelter */}
          {STRIPES.map((stripe, i) => (
            <g
              key={i}
              style={{
                transform: `translate(${(sheltered ? 31 + i * 20 : -64 + i * 26) - 11}px, -19px)`,
                transition: `transform 1.6s cubic-bezier(.6,0,.2,1) ${i * 0.15}s`,
              }}
            >
              <Astronaut height={38} stripe={stripe} glow={hot || sheltered ? crewColor : undefined} />
            </g>
          ))}
          {sheltered && <circle r="120" fill="url(#shield)" />}
        </g>
        <text x="150" y="80" textAnchor="middle" fill={COLORS.text} fontSize="17" fontWeight="700">
          ARES-1 · orbit crew
        </text>
      </svg>
    </div>
  );
}

/** Particles streaming from the Sun to the spacecraft. shielded: they fade before reaching the spacecraft. */
function Particles({ active, shielded }: { active: boolean; shielded: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef({ active, shielded });
  useEffect(() => {
    state.current = { active, shielded };
  }, [active, shielded]);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const W = (c.width = window.innerWidth);
    const H = (c.height = window.innerHeight);
    const sun = { x: W * 0.06, y: H * 0.5 };
    const ship = { x: W * 0.96 - W * 0.44 + (150 / 600) * W * 0.44, y: H * 0.5 - H * 0.32 + (130 / 420) * H * 0.64 };
    type P = { x: number; y: number; vx: number; vy: number; life: number };
    const ps: P[] = [];
    let raf = 0;
    const spawn = () => {
      const a = Math.atan2(ship.y - sun.y, ship.x - sun.x) + (Math.random() - 0.5) * 0.9;
      const v = 6 + Math.random() * 9;
      ps.push({ x: sun.x + Math.cos(a) * H * 0.2, y: sun.y + Math.sin(a) * H * 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 });
    };
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      if (state.current.active) for (let i = 0; i < 14; i++) spawn();
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.x += p.vx;
        p.y += p.vy;
        const d = Math.hypot(p.x - ship.x, p.y - ship.y);
        if (state.current.shielded && d < 130) p.life -= 0.25; // hits the shield and fades
        if (p.x > W + 20 || p.y < -20 || p.y > H + 20 || p.life <= 0) {
          ps.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(253, 186, 116, ${0.55 * p.life})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

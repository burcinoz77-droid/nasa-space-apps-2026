// Parça 1 · Kask vizörü (HUD): astronotun gözünün önünde ne gördüğü, canlı veriyle.
// Açmak: window.dispatchEvent(new CustomEvent(VISOR_EVENT, { detail: crewId }))  (Astronot Ekranı'ndaki düğme)
//   Sakin an : bilgiler kenarlarda, tek renk; görüşün ortası boş.
//   Olay     : o astronotu içeren Katman 1 olayı varsa kenarlar olay renginde parlar, ilgili değer büyür,
//              ortada tek cümlelik uyarı + otomatik adım + sesli karar ("onayla" gerçekten olayı onaylar).
// Gezegen ekibi: kask vizörü, Mars yüzeyi. Kokpit ekibi: AR gözlük, gemi içi.
// Kendiliğinden açılma: gezegen ekibinden birinde KRİTİK olay açılınca vizör o kişinin gözünden açılır.
// Sinematik oynuyorsa bitince açılır; jüri demo turu sırasında açılmaz.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CREW_BY_ID } from '../../crew';
import { ACTION_LABELS, INCIDENT_LABELS } from '../../engine';
import { controls } from '../../loop';
import { METRIC_BY_KEY, type MetricKey } from '../../metrics';
import { fmtMetric, fmtZ } from '../format';
import { useAstra } from '../../store';
import type { CrewId, Incident, Level } from '../../types';
import { alpha, COLORS, fmt } from '../theme';
import { CINEMATIC_END_EVENT, runtime, VISOR_EVENT } from './phases';
import { alarm, chime, useCue } from './sound';

const HUD = '#7DD3FC';
const GLOW = '0 1px 3px rgba(2,6,23,0.95), 0 0 10px rgba(2,6,23,0.7), 0 0 8px rgba(56,189,248,0.45)';
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const LEVEL_RANK: Record<Level, number> = { normal: 0, caution: 1, critical: 2 };

export function VisorHud() {
  const [crewId, setCrewId] = useState<CrewId | null>(null);
  useEffect(() => {
    const open = (e: Event) => {
      const id = (e as CustomEvent<CrewId>).detail;
      if (CREW_BY_ID[id]?.location === 'GEZEGEN') setCrewId(id); // kask yalnız uzay yürüyüşünde
    };
    window.addEventListener(VISOR_EVENT, open);
    return () => window.removeEventListener(VISOR_EVENT, open);
  }, []);

  // Kendiliğinden açılma
  const seen = useRef(new Set<string>());
  const pending = useRef<CrewId | null>(null);
  useEffect(() => {
    const unsub = useAstra.subscribe((s) => {
      if (s.incidents.length === 0) seen.current.clear(); // simülasyon sıfırlandı
      for (const i of s.incidents) {
        if (i.status !== 'open' || i.level !== 'critical' || seen.current.has(i.id)) continue;
        seen.current.add(i.id);
        const who = i.crewIds.find((id) => CREW_BY_ID[id].location === 'GEZEGEN');
        if (!who || runtime.tourActive) continue;
        if (runtime.cinematicPlaying) pending.current = who;
        else setCrewId((cur) => cur ?? who);
      }
    });
    const afterCinematic = () => {
      const who = pending.current;
      pending.current = null;
      if (who && !runtime.tourActive) setCrewId((cur) => cur ?? who);
    };
    window.addEventListener(CINEMATIC_END_EVENT, afterCinematic);
    return () => {
      unsub();
      window.removeEventListener(CINEMATIC_END_EVENT, afterCinematic);
    };
  }, []);

  if (!crewId) return null;
  return <Visor key={crewId} crewId={crewId} onClose={() => setCrewId(null)} />;
}

function Visor({ crewId, onClose }: { crewId: CrewId; onClose: () => void }) {
  const member = CREW_BY_ID[crewId];
  const surface = member.location === 'GEZEGEN';
  const t = useAstra((s) => s.telemetry[crewId]);
  const ship = useAstra((s) => s.ship);
  const incident = useAstra((s) =>
    s.incidents
      .filter((i) => i.crewIds.includes(crewId) && i.status !== 'resolved')
      .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])[0],
  );
  const [snoozed, setSnoozed] = useState<string | null>(null);
  const alert = incident && incident.id !== snoozed ? incident : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useCue(Boolean(alert && alert.status === 'open'), alarm);

  const status = useAstra((s) => s.statuses[crewId]);
  // Sapan değerler: olayın sinyalleri ve kişinin en çok sapan ölçümleri (Katman 1)
  const levelOf = (k: MetricKey): Level => {
    const hits = [...(alert?.signals ?? []), ...(status?.topSignals ?? [])].filter((s) => s.key === k);
    return hits.reduce<Level>((w, s) => (LEVEL_RANK[s.level] > LEVEL_RANK[w] ? s.level : w), 'normal');
  };
  const edge = alert ? (alert.level === 'critical' ? COLORS.critical : COLORS.caution) : null;
  const delay = ship?.commDelayOneWay_s ?? 750;

  return (
    <div
      className="fixed inset-0 z-[105] overflow-hidden select-none"
      role="dialog"
      aria-label={`${member.name} · visor view`}
      style={{ fontFamily: 'Inter, sans-serif', background: surface ? MARS_BG : CABIN_BG, animation: 'visor-in .6s ease' }}
    >
      {surface ? <MarsHorizon /> : <CabinLines />}
      {/* Vizör kenarı */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 72% 78% at 50% 50%, transparent 62%, rgba(2,6,23,0.55) 82%, rgba(2,6,23,0.97) 100%)' }} />
      {edge && (
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse 70% 76% at 50% 50%, transparent 68%, ${alpha(edge, 0.32)} 88%, transparent 100%)`, animation: 'visor-pulse 2.4s ease-in-out infinite' }}
        />
      )}

      {/* Üst: yön şeridi */}
      <div className="absolute flex flex-col items-center gap-1.5" style={{ left: '50%', top: '5vh', transform: 'translateX(-50%)', fontFamily: MONO, color: HUD, textShadow: GLOW }}>
        <div className="flex gap-8 text-sm opacity-85">
          {['K', '30', '60', 'D', '120', '150', 'G'].map((d) => (
            <span key={d} style={{ fontWeight: d === 'D' ? 700 : 400 }}>
              {d}
            </span>
          ))}
        </div>
        <div style={{ width: 420, height: 2, background: HUD, opacity: 0.6 }} />
        {surface ? (
          <div className="text-base font-bold" style={alert ? { color: COLORS.normal, textShadow: '0 0 10px rgba(52,211,153,0.7)' } : undefined}>
            ▲ HABITAT · 340 m{alert ? ' · 4 min walk' : ' · 78°'}
          </div>
        ) : (
          <div className="text-base">ARES-1 · {alert?.type === 'RADIATION' ? 'storm shelter ▲ 12 m' : 'Crew module'}</div>
        )}
      </div>

      {/* Sol üst: kimlik ve gün */}
      <Corner side="left" top="13vh" label={surface ? `HELMET VISOR · ${member.unit}` : `AR GLASSES · ${member.unit}`}>
        <span className="text-2xl font-bold">{member.name.replace('Dr. ', '')}</span>
        <span className="text-sm opacity-85">Mission Day {ship?.missionDay ?? '—'}</span>
      </Corner>

      {/* Sağ üst: Dünya ve ASTRA */}
      <Corner side="right" top="13vh" label="COMM WITH EARTH">
        <span className="text-lg font-bold">
          delay {Math.floor(delay / 60)} min {Math.round(delay % 60)} s
        </span>
        <span className="text-sm" style={{ color: '#C4B5FD', textShadow: GLOW }}>
          ● ASTRA Katman 1 · gemide, aktif
        </span>
      </Corner>

      {/* Sol: beden */}
      <div className="absolute flex flex-col gap-5" style={{ left: '7.5vw', top: '36vh' }}>
        <Reading label="HEART RATE" value={fmt(t?.cardio.hr_bpm ?? 0, 0)} unit="bpm" level={levelOf('cardio.hr_bpm')} />
        <Reading label="CORE TEMP" value={fmt(t?.resp.coreTemp_C ?? 0, 1)} unit="°C" level={levelOf('resp.coreTemp_C')} />
        <Reading label="SpO₂" value={`${fmt(t?.cardio.spo2_pct ?? 0, 0)}%`} unit="" level={levelOf('cardio.spo2_pct')} />
        <Reading label="BREATHING" value={fmt(t?.resp.rr_bpm ?? 0, 0)} unit="/min" level={levelOf('resp.rr_bpm')} />
      </div>

      {/* Sağ: ortam */}
      <div className="absolute flex flex-col items-end gap-5" style={{ right: '7.5vw', top: '36vh' }}>
        <Reading right small label="RADIATION" value={fmt(t?.env.doseRate_uSv_h ?? 0, 1)} unit="µSv/h" level={levelOf('env.doseRate_uSv_h')} />
        <Reading right small label={surface ? 'SUIT PRESSURE' : 'CABIN PRESSURE'} value={fmt(t?.env.pressure_kPa ?? 0, 1)} unit="kPa" level={levelOf('env.pressure_kPa')} />
        <Reading right small label={surface ? 'SUIT CO₂' : 'CABIN CO₂'} value={fmt(t?.env.ppCO2_mmHg ?? 0, 1)} unit="mmHg" level={levelOf('env.ppCO2_mmHg')} />
        <Reading right small label={surface ? 'SUIT O₂' : 'CABIN O₂'} value={`${fmt(t?.env.o2_pct ?? 0, 0)}%`} unit="" level={levelOf('env.o2_pct')} />
      </div>

      {alert ? <Alert incident={alert} onSnooze={() => setSnoozed(alert.id)} /> : <Reticle />}

      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 rounded-full border px-4 py-1.5 text-sm backdrop-blur hover:bg-white/10"
        style={{ borderColor: alpha(COLORS.text, 0.3), color: COLORS.text }}
      >
        Close visor ✕
      </button>
      <div className="absolute right-4 bottom-3 font-mono text-[11px]" style={{ color: alpha(COLORS.text, 0.5) }}>
        Prototype · live data from the ARES-1 simulation
      </div>
      <style>{`
        @keyframes visor-in { from { transform: scale(1.04); } to { transform: none; } }
        @keyframes visor-pulse { 0%, 100% { opacity: .65; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

function Alert({ incident, onSnooze }: { incident: Incident; onSnooze: () => void }) {
  const color = incident.level === 'critical' ? COLORS.critical : COLORS.caution;
  const acked = incident.status === 'acknowledged';
  useCue(acked, chime);
  return (
    <>
      <div
        role="alert"
        className="absolute flex flex-col gap-2.5"
        style={{
          left: '50%',
          top: '25vh',
          transform: 'translateX(-50%)',
          width: 'min(640px, 46vw)',
          padding: '20px 26px',
          borderRadius: 18,
          border: `2px solid ${acked ? COLORS.normal : color}`,
          background: 'rgba(2,6,23,0.75)',
          color: '#F8FAFC',
          transition: 'border-color .5s',
        }}
      >
        <div className="flex justify-between text-[13px] tracking-[0.2em]" style={{ fontFamily: MONO, color }}>
          <span>ASTRA · LAYER 1 · {INCIDENT_LABELS[incident.type].toUpperCase()}</span>
          <span>{incident.level === 'critical' ? 'WARNING' : 'CAUTION'}</span>
        </div>
        <div className="text-2xl leading-snug font-bold">{incident.title}</div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[15px]" style={{ fontFamily: MONO, color: '#E2E8F0' }}>
          {[...incident.signals]
            .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
            .slice(0, 3)
            .map((sg) => (
              <span key={sg.key}>
                {METRIC_BY_KEY[sg.key].label}{' '}
                <b style={{ color: sg.level === 'critical' ? COLORS.critical : sg.level === 'caution' ? COLORS.caution : '#F8FAFC' }}>{fmtMetric(sg.key, sg.value)}</b>{' '}
                <span style={{ color: '#94A3B8' }}>({fmtZ(sg.z)})</span>
              </span>
            ))}
        </div>
        {incident.autoActions.map((a) => (
          <div key={a} className="text-sm" style={{ fontFamily: MONO, color: COLORS.normal }}>
            ✓ {ACTION_LABELS[a]} · automatic
          </div>
        ))}
      </div>

      <div className="absolute flex flex-col items-center gap-2.5" style={{ left: '50%', bottom: '10vh', transform: 'translateX(-50%)', fontFamily: MONO, color: '#F8FAFC' }}>
        <span className="text-[13px] tracking-[0.2em]" style={{ color: COLORS.ai }}>
          {acked ? 'CREW ACKNOWLEDGED · LOGGED' : 'VOICE DECISION · CREW'}
        </span>
        {!acked && (
          <div className="flex gap-3.5">
            <button
              onClick={() => controls.acknowledge(incident.id)}
              className="rounded-xl px-5 py-2.5 text-[17px] hover:brightness-125"
              style={{ border: `2px solid ${COLORS.normal}`, background: alpha(COLORS.normal, 0.15) }}
            >
              "ASTRA, acknowledge"
            </button>
            <button onClick={onSnooze} className="rounded-xl px-5 py-2.5 text-[17px] hover:brightness-125" style={{ border: '2px solid #94A3B8', background: 'rgba(148,163,184,0.12)' }}>
              "Snooze 10 min"
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Corner({ side, top, label, children }: { side: 'left' | 'right'; top: string; label: string; children: ReactNode }) {
  return (
    <div
      className={`absolute flex flex-col gap-1 ${side === 'right' ? 'items-end' : ''}`}
      style={{ [side]: '10vw', top, fontFamily: MONO, color: HUD, textShadow: GLOW }}
    >
      <span className="text-[13px] tracking-[0.2em] opacity-80">{label}</span>
      {children}
    </div>
  );
}

function Reading({ label, value, unit, level, right, small }: { label: string; value: string; unit: string; level: Level; right?: boolean; small?: boolean }) {
  const hot = level !== 'normal';
  const color = level === 'critical' ? COLORS.critical : level === 'caution' ? COLORS.caution : HUD;
  return (
    <div className={`flex flex-col gap-0.5 ${right ? 'items-end' : ''}`} style={{ fontFamily: MONO, color, textShadow: hot ? `0 1px 3px rgba(2,6,23,0.95), 0 0 12px ${alpha(color, 0.8)}` : GLOW, transition: 'color .5s' }}>
      <span className="text-xs tracking-[0.2em] opacity-85">
        {label}
        {hot ? ' ↑' : ''}
      </span>
      <span className="font-bold tabular-nums" style={{ fontSize: hot ? 44 : small ? 26 : 34, transition: 'font-size .4s' }}>
        {value}
        {unit && <span className="ml-1 font-normal" style={{ fontSize: hot ? 17 : 15 }}>{unit}</span>}
      </span>
    </div>
  );
}

function Reticle() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true" className="absolute" style={{ left: 'calc(50% - 30px)', top: 'calc(50% - 30px)', opacity: 0.55 }}>
      <circle cx="30" cy="30" r="18" fill="none" stroke={HUD} strokeWidth="1.5" />
      {[
        [30, 4, 30, 16],
        [30, 44, 30, 56],
        [4, 30, 16, 30],
        [44, 30, 56, 30],
      ].map(([x1, y1, x2, y2]) => (
        <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={HUD} strokeWidth="1.5" />
      ))}
    </svg>
  );
}

const MARS_BG = 'linear-gradient(180deg, #4a261c 0%, #7d4a36 38%, #a86d4f 50%, #7a3017 52%, #4f1d0e 75%, #240b05 100%)';
const CABIN_BG = 'linear-gradient(180deg, #0b1324 0%, #111c33 45%, #0a1120 100%)';

function MarsHorizon() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="0,470 160,430 300,455 470,410 640,450 820,420 1000,452 1180,415 1440,445 1440,470" fill="#9c4a2a" opacity="0.85" />
      <polygon points="0,480 220,462 420,478 700,458 980,476 1220,460 1440,474 1440,500 0,500" fill="#7a3017" opacity="0.9" />
      <g transform="translate(1010 455)">
        <path d="M0 30 Q0 0 50 0 Q100 0 100 30 Z" fill="#cbd5e1" opacity="0.9" />
        <rect x="-4" y="28" width="108" height="5" fill="#64748b" />
      </g>
    </svg>
  );
}

function CabinLines() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 160 L460 300 L980 300 L1440 160" fill="none" stroke="#1e293b" strokeWidth="3" />
      <path d="M0 740 L460 600 L980 600 L1440 740" fill="none" stroke="#1e293b" strokeWidth="3" />
      <rect x="460" y="300" width="520" height="300" fill="#0f172a" stroke="#1e293b" strokeWidth="3" />
      <circle cx="720" cy="450" r="90" fill="#020617" stroke="#334155" strokeWidth="4" />
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={680 + ((i * 37) % 90)} cy={410 + ((i * 53) % 80)} r="1.3" fill="#fff" opacity="0.7" />
      ))}
    </svg>
  );
}

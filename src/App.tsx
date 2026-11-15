// Uygulama iskeleti: yan menü + üst bar + olay bandı + sayfa (Sahibi: Parça 3).
// Sayfa sahipleri: Kokpit/Astronot Ekranı/Astronotlar = Parça 3,
// Raporlar = Parça 2, Ayarlar = Parça 1, Görevler ve ASTRA sohbet paneli = Parça 4.
// Seçili astronot burada tutulur: Kokpit ve Astronotlar'dan tıklanınca Astronot Ekranı o kişiyle açılır.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CREW, CREW_BY_ID } from './crew';
import { controls, SCENARIO_NAMES } from './loop';
import { SIM } from './sim/parameters';
import { useAstra } from './store';
import type { CrewId, ScenarioId, Telemetry } from './types';
import { AstraChatPanel } from './ui/components/AstraChatPanel';
import { ScenarioCinematics } from './ui/cinematic';
import { DemoTour } from './ui/cinematic/DemoTour';
import { VisorHud } from './ui/cinematic/VisorHud';
import { NAVIGATE_EVENT } from './ui/cinematic/phases';
import {
  IconAstronaut,
  IconBell,
  IconCockpit,
  IconCrew,
  IconReports,
  IconReset,
  IconSettings,
  IconSignal,
  IconTasks,
  OrbitalisMark,
} from './ui/components/Icons';
import { IncidentBanner } from './ui/components/IncidentBanner';
import { SourceBadge } from './ui/components/SourceBadge';
import { fmtDelay, initials } from './ui/format';
import { AstronotEkrani } from './ui/pages/AstronotEkrani';
import { Astronotlar } from './ui/pages/Astronotlar';
import { Ayarlar } from './ui/pages/Ayarlar';
import { Gorevler } from './ui/pages/Gorevler';
import { Kokpit } from './ui/pages/Kokpit';
import { Raporlar } from './ui/pages/Raporlar';
import { alpha, COLORS, fmt } from './ui/theme';

type PageId = 'kokpit' | 'astronot' | 'astronotlar' | 'gorevler' | 'raporlar' | 'ayarlar';

const PAGES: { id: PageId; label: string; icon: () => ReactNode; subtitle: string }[] = [
  { id: 'kokpit', label: 'Mission Status', icon: IconCockpit, subtitle: 'Mission status at a glance' },
  { id: 'astronot', label: 'Astronaut View', icon: IconAstronaut, subtitle: 'All readings for one astronaut across 5 data groups' },
  { id: 'astronotlar', label: 'Crew', icon: IconCrew, subtitle: 'Orbit and surface crews' },
  { id: 'gorevler', label: 'Tasks', icon: IconTasks, subtitle: 'Today\'s EVA task and equipment check' },
  { id: 'raporlar', label: 'Reports', icon: IconReports, subtitle: 'Event log: incidents, autonomous actions, acknowledgements' },
  { id: 'ayarlar', label: 'Settings', icon: IconSettings, subtitle: 'Scenarios, sampling rate, data sources' },
];

// Üst bardaki senaryo hapları (kısa adlar); tam adlar loop.ts → SCENARIO_NAMES
// (dar ekranda, 1024 px tablet, kısa ad gösterilir)
const SCENARIO_PILLS: { id: ScenarioId; label: string; short?: string }[] = [
  { id: 'NORMAL', label: 'Nominal day', short: 'Nominal' },
  { id: 'SOLAR_STORM', label: 'Solar particle event' },
  { id: 'MARS_DAY_180', label: 'Mars day 180' },
  { id: 'CO2_SCRUBBER_FAIL', label: 'CO₂ failure' },
  { id: 'EVA_OVEREXERTION', label: 'EVA overexertion', short: 'EVA' },
];

// Konsolu kullanan kişi (profil kartı). Mürettebattan biri; gerçek bir kişi değildir.
const CONSOLE_USER: CrewId = 'elif';
const EMPTY: Telemetry[] = [];

export default function App() {
  const [page, setPage] = useState<PageId>('kokpit');
  const [crew, setCrew] = useState<CrewId>(CREW[0].id);
  const hasCritical = useAstra((s) => s.incidents.some((i) => i.level === 'critical' && i.status === 'open'));

  // Parça 1: jüri demo turu sayfayı Kokpit'e alabilsin
  useEffect(() => {
    const go = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (PAGES.some((p) => p.id === id)) setPage(id as PageId);
    };
    window.addEventListener(NAVIGATE_EVENT, go);
    return () => window.removeEventListener(NAVIGATE_EVENT, go);
  }, []);

  const openCrew = (id: CrewId) => {
    setCrew(id);
    setPage('astronot');
  };
  const current = PAGES.find((p) => p.id === page)!;

  return (
    <div className="flex h-full">
      <Sidebar page={page} onPage={setPage} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onBell={() => setPage('raporlar')} />
        <main className={`relative min-h-0 flex-1 overflow-auto px-5 pt-3 pb-24 ${hasCritical ? 'astra-critical-edge' : ''}`}>
          <IncidentBanner onOpenCrew={openCrew} />
          <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold">{current.label}</h1>
            <span className="text-sm text-slate-400">{current.subtitle}</span>
          </div>
          {page === 'kokpit' && <Kokpit onOpenCrew={openCrew} onOpenReports={() => setPage('raporlar')} />}
          {page === 'astronot' && <AstronotEkrani crewId={crew} onSelect={setCrew} />}
          {page === 'astronotlar' && <Astronotlar onOpenCrew={openCrew} />}
          {page === 'gorevler' && <Gorevler />}
          {page === 'raporlar' && <Raporlar crewId={crew} />}
          {page === 'ayarlar' && <Ayarlar />}
        </main>
      </div>
      <AstraChatPanel />
      {/* Parça 1: senaryo değişince o senaryonun tam ekran sinematiği (Atla ile kapanır) */}
      <ScenarioCinematics />
      <DemoTour />
      <VisorHud />
    </div>
  );
}

// ---------- Yan menü ----------
function Sidebar({ page, onPage }: { page: PageId; onPage: (p: PageId) => void }) {
  const delay = useAstra((s) => s.ship?.commDelayOneWay_s);
  const openCount = useAstra((s) => s.incidents.filter((i) => i.status !== 'resolved').length);
  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-space-border bg-space-panel px-3 py-4 min-[1180px]:w-[232px]">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span style={{ color: COLORS.calm }}>
          <OrbitalisMark />
        </span>
        <div className="min-w-0">
          <div className="text-xl leading-tight font-bold tracking-tight">Orbitalis</div>
          <div className="font-mono text-sm tracking-wider whitespace-nowrap min-[1180px]:tracking-widest" style={{ color: COLORS.calm }}>
            ASTRA-MED OS
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Sayfalar">
        {PAGES.map((p) => {
          const on = p.id === page;
          return (
            <button
              key={p.id}
              onClick={() => onPage(p.id)}
              aria-current={on ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] ${on ? 'bg-calm/15 font-semibold text-calm ring-1 ring-calm/50' : 'text-slate-300 hover:bg-white/5'}`}
            >
              {p.icon()}
              <span className="min-w-0 flex-1 truncate">{p.label}</span>
              {p.id === 'raporlar' && openCount > 0 && <span className="rounded-full bg-white/10 px-2 font-mono text-sm text-slate-200">{openCount}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-xl border border-space-border bg-space-bg/60 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.calm }}>
            <IconSignal /> Comm with Earth
          </div>
          <div className="mt-1 text-sm text-slate-400">delay · one way</div>
          <div className="font-mono text-lg font-semibold whitespace-nowrap text-white">{fmtDelay(delay)}</div>
          <div className="text-sm text-slate-400">round trip {delay ? fmtDelay(delay * 2) : '—'}</div>
          <div className="mt-1.5">
            <SourceBadge param="commDelayDemo" />
          </div>
        </div>
        <button
          onClick={() => controls.reset()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-space-border px-2 py-2 text-sm whitespace-nowrap text-slate-300 hover:bg-white/5"
        >
          <IconReset /> Reset simulation
        </button>
      </div>
    </aside>
  );
}

// ---------- Üst bar ----------
function TopBar({ onBell }: { onBell: () => void }) {
  const { scenario, day, open, critical } = useAstra(
    useShallow((s) => {
      const active = s.incidents.filter((i) => i.status !== 'resolved');
      return {
        scenario: s.ship?.scenario,
        day: s.ship?.missionDay,
        open: active.length,
        critical: active.some((i) => i.level === 'critical'),
      };
    }),
  );
  const samples = useAstra((s) => (s.history[CREW[0].id] ?? EMPTY).length);
  const calibrating = samples < SIM.baselineWindow;
  const bellColor = critical ? COLORS.critical : open ? COLORS.caution : COLORS.textMuted;
  const me = CREW_BY_ID[CONSOLE_USER];

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-space-border bg-space-panel/70 px-5 py-2.5">
      <div className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-3">
        <ScenarioMenu scenario={scenario} />
        <Clock day={day} calibration={calibrating ? `${samples}/${SIM.baselineWindow}` : undefined} />
        <button
          onClick={onBell}
          className="relative rounded-xl p-2 hover:bg-white/5"
          style={{ color: bellColor }}
          aria-label={`${open} open incidents${critical ? ', warning active' : ''}. Open Reports`}
          title="Open incidents"
        >
          <IconBell />
          {open > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-sm leading-none font-bold text-space-bg"
              style={{ backgroundColor: bellColor }}
            >
              {open}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2 rounded-xl border border-space-border bg-space-bg/60 py-1 pr-1 pl-1 min-[1180px]:pr-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm font-bold"
            style={{ color: COLORS.calm, backgroundColor: alpha(COLORS.calm, 0.15) }}
          >
            {initials(CONSOLE_USER)}
          </span>
          <div className="hidden leading-tight min-[1180px]:block">
            <div className="text-sm font-semibold">{me.name}</div>
            <div className="text-sm text-slate-400">
              {me.role} · {me.unit}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/** Senaryo seçimi: gerçek görev konsolunda olmayacağı için küçük, sönük bir "Simülasyon ▾" menüsünde durur. */
function ScenarioMenu({ scenario }: { scenario: ScenarioId | undefined }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const current = SCENARIO_PILLS.find((p) => p.id === scenario);
  const active = scenario && scenario !== 'NORMAL';
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Simulation scenario (demo)"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-white/5"
        style={{ color: active ? COLORS.caution : COLORS.textMuted }}
      >
        <span className="hidden min-[1180px]:inline">Simulation:</span>
        <span className={active ? 'font-semibold' : ''}>{current?.short ?? current?.label ?? '—'}</span>
        <span aria-hidden="true" className="text-xs">
          ▾
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-64 rounded-xl border border-space-border bg-space-panel p-1 shadow-xl">
          <div className="px-3 pt-2 pb-1 text-xs text-slate-500">Simulation scenario (demo)</div>
          {SCENARIO_PILLS.map((p) => {
            const on = scenario === p.id;
            return (
              <button
                key={p.id}
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  controls.setScenario(p.id);
                  setOpen(false);
                }}
                title={SCENARIO_NAMES[p.id]}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${on ? 'bg-calm/15 font-semibold text-calm' : 'text-slate-300 hover:bg-white/5'}`}
              >
                {p.label}
                {on && <span aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Canlı saat ayrı bileşen: her saniye sadece bu kısım yeniden çizilir. */
function Clock({ day, calibration }: { day: number | undefined; calibration?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-base font-semibold tabular-nums">{now.toLocaleTimeString('en-GB')}</div>
      {calibration ? (
        <div
          className="text-sm whitespace-nowrap"
          style={{ color: COLORS.calm }}
          title="Layer 1 builds personal baselines over the first 30 readings; start a scenario after that."
        >
          ◌ Baseline {calibration}
        </div>
      ) : (
        <div className="text-sm whitespace-nowrap" style={{ color: COLORS.normal }}>
          ● Live · Day {fmt(day)}
        </div>
      )}
    </div>
  );
}

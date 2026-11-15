// Uygulama iskeleti (Sahibi: Parça 3): solda NASA mavisi dar menü, üstte ortak bilgi bandı, altında sayfa.
// Sayfa sahipleri: Kokpit konsolu = Parça 3, Raporlar = Parça 2, Ayarlar = Parça 1, Görevler ve ASTRA sohbet = Parça 4.
// Üst bant NASA-STD-3001'in "ortak alan" kuralına göre her sayfada aynı yerde: sayfa adı, saat, konum, Dünya bağlantısı,
// gecikme, açık olaylar. Seçili astronot burada tutulur: konsolda, Raporlar'da ve olay bandında aynı kişi seçilidir.
import { type ReactNode, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CREW, CREW_BY_ID } from './crew';
import { controls, SCENARIO_NAMES } from './loop';
import { SIM } from './sim/parameters';
import { useAstra } from './store';
import type { CrewId, ScenarioId, Telemetry } from './types';
import { ScenarioCinematics } from './ui/cinematic';
import { DemoTour } from './ui/cinematic/DemoTour';
import { NAVIGATE_EVENT } from './ui/cinematic/phases';
import { VisorHud } from './ui/cinematic/VisorHud';
import { AstraChatPanel } from './ui/components/AstraChatPanel';
import { IconBell, IconCockpit, IconReports, IconReset, IconSettings, IconTasks, OrbitalisMark } from './ui/components/Icons';
import { IncidentBanner } from './ui/components/IncidentBanner';
import { SourceBadge } from './ui/components/SourceBadge';
import { fmtDelay, initials } from './ui/format';
import { Ayarlar } from './ui/pages/Ayarlar';
import { Gorevler } from './ui/pages/Gorevler';
import { Kokpit } from './ui/pages/Kokpit';
import { Raporlar } from './ui/pages/Raporlar';
import { COLORS, fmt } from './ui/theme';

type PageId = 'kokpit' | 'gorevler' | 'raporlar' | 'ayarlar';

const PAGES: { id: PageId; label: string; title: string; icon: () => ReactNode }[] = [
  { id: 'kokpit', label: 'Console', title: 'Crew Health Console', icon: IconCockpit },
  { id: 'gorevler', label: 'Tasks', title: 'Tasks · EVA and equipment', icon: IconTasks },
  { id: 'raporlar', label: 'Reports', title: 'Reports · event log', icon: IconReports },
  { id: 'ayarlar', label: 'Settings', title: 'Settings · scenarios and sources', icon: IconSettings },
];

const SCENARIOS: ScenarioId[] = ['NORMAL', 'SOLAR_STORM', 'MARS_DAY_180', 'CO2_SCRUBBER_FAIL', 'EVA_OVEREXERTION'];

// Konsolu kullanan kişi: ekibin sağlık sorumlusu. Mürettebattan biri; gerçek bir kişi değildir.
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
    setPage('kokpit');
  };
  const current = PAGES.find((p) => p.id === page)!;
  const isConsole = page === 'kokpit';

  return (
    <div className="flex h-full">
      <Rail page={page} onPage={setPage} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={current.title} onBell={() => setPage('raporlar')} />
        <main
          className={`relative flex min-h-0 flex-1 flex-col overflow-auto px-4 pt-3 ${isConsole ? 'pb-4' : 'pb-24'} ${hasCritical ? 'astra-critical-edge' : ''}`}
        >
          <IncidentBanner onOpenCrew={openCrew} dense={isConsole} />
          {page === 'kokpit' && <Kokpit crewId={crew} onSelect={setCrew} />}
          {page === 'gorevler' && <Gorevler />}
          {page === 'raporlar' && <Raporlar crewId={crew} />}
          {page === 'ayarlar' && <Ayarlar />}
        </main>
      </div>
      {/* Konsolda ASTRA sohbeti "Ana istasyon" panelinin içinde; diğer sayfalarda Parça 4'ün yüzen paneli */}
      {!isConsole && <AstraChatPanel />}
      {/* Parça 1: senaryo değişince o senaryonun tam ekran sinematiği (Atla ile kapanır) */}
      <ScenarioCinematics />
      <DemoTour />
      {/* Parça 1: kask vizörü (HUD), seçili astronotun başlığındaki düğmeyle açılır */}
      <VisorHud />
    </div>
  );
}

// ---------- Sol menü (NASA amblem mavisi) ----------
function Rail({ page, onPage }: { page: PageId; onPage: (p: PageId) => void }) {
  const openCount = useAstra((s) => s.incidents.filter((i) => i.status !== 'resolved').length);
  const item = (p: (typeof PAGES)[number]) => {
    const on = p.id === page;
    return (
      <button
        key={p.id}
        onClick={() => onPage(p.id)}
        aria-current={on ? 'page' : undefined}
        className={`relative flex w-full flex-col items-center gap-1 rounded-md px-1 py-2.5 text-sm transition-colors ${
          on ? 'bg-space-bg font-semibold text-white' : 'text-slate-200 hover:bg-white/10'
        }`}
      >
        {on && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-white" aria-hidden />}
        {p.icon()}
        <span className="leading-none">{p.label}</span>
        {p.id === 'raporlar' && openCount > 0 && (
          <span className="absolute top-1 right-2 min-w-5 rounded-full bg-white px-1 text-center font-mono text-sm leading-5 font-medium text-chrome">
            {openCount}
          </span>
        )}
      </button>
    );
  };
  return (
    <aside className="flex w-[88px] shrink-0 flex-col items-center gap-1 bg-chrome px-2 py-3" aria-label="Pages">
      <div className="mb-3 flex flex-col items-center gap-1 text-white" title="Orbitalis · ASTRA-MED OS">
        <OrbitalisMark size={34} />
        <span className="font-display text-sm leading-none font-bold">Orbitalis</span>
      </div>
      <nav className="flex w-full flex-col gap-1">{PAGES.filter((p) => p.id !== 'ayarlar').map(item)}</nav>
      <div className="mt-auto flex w-full flex-col gap-1">
        {item(PAGES.find((p) => p.id === 'ayarlar')!)}
        <button
          onClick={() => controls.reset()}
          className="flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 text-sm text-slate-200 hover:bg-white/10"
          title="Reset simulation"
        >
          <IconReset />
          <span className="leading-none">Reset</span>
        </button>
      </div>
    </aside>
  );
}

// ---------- Üst bant: ortak alan ----------
function Field({ label, children, mono = false, className = '' }: { label: string; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={`min-w-0 leading-tight ${className}`}>
      <div className="text-sm whitespace-nowrap text-slate-300">{label}</div>
      <div className={`text-base whitespace-nowrap text-white ${mono ? 'font-mono' : 'font-medium'}`}>{children}</div>
    </div>
  );
}

function TopBar({ title, onBell }: { title: string; onBell: () => void }) {
  const { scenario, day, delay, linked, open, critical } = useAstra(
    useShallow((s) => {
      const active = s.incidents.filter((i) => i.status !== 'resolved');
      return {
        scenario: s.ship?.scenario,
        day: s.ship?.missionDay,
        delay: s.ship?.commDelayOneWay_s,
        linked: !!s.ship,
        open: active.length,
        critical: active.some((i) => i.level === 'critical'),
      };
    }),
  );
  const samples = useAstra((s) => (s.history[CREW[0].id] ?? EMPTY).length);
  const calibrating = samples < SIM.baselineWindow;
  const me = CREW_BY_ID[CONSOLE_USER];

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/15 bg-chrome px-5 py-2">
      <div className="min-w-0 leading-tight">
        <h1 className="truncate text-lg font-bold text-white">{title}</h1>
        <div className="text-sm whitespace-nowrap text-slate-300">ARES-1 · ASTRA-MED OS</div>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-1">
        <Clock day={day} calibration={calibrating ? `${samples}/${SIM.baselineWindow}` : undefined} />
        <Field label="Location" className="hidden min-[1180px]:block">
          Mars orbit
        </Field>
        <Field label="Ground link">
          <span style={{ color: linked ? COLORS.normal : COLORS.offline }}>{linked ? '● AOS' : '○ LOS'}</span>
        </Field>
        <Field label="One-way light time" mono>
          <span className="flex items-center gap-2">
            {fmtDelay(delay)}
            <span className="hidden font-sans min-[1380px]:inline">
              <SourceBadge param="commDelayDemo" />
            </span>
          </span>
        </Field>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {/* Senaryo seçimi gerçek konsolda olmaz: sönük "Simülasyon" menüsü (Azra, PR #22). Senaryo aktifken sarı. */}
        <label className="flex items-center gap-2 text-sm text-slate-300" title="Simulation scenario (demo)">
          <span className="hidden min-[1180px]:inline">Simulation</span>
          <select
            value={scenario ?? 'NORMAL'}
            onChange={(e) => controls.setScenario(e.target.value as ScenarioId)}
            className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-sm"
            style={{ color: scenario && scenario !== 'NORMAL' ? COLORS.caution : COLORS.textMuted }}
            aria-label="Simulation scenario"
          >
            {SCENARIOS.map((id) => (
              <option key={id} value={id} className="bg-space-bg">
                {SCENARIO_NAMES[id]}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={onBell}
          className="relative rounded-md p-2 hover:bg-white/10"
          style={{ color: critical ? COLORS.critical : open ? COLORS.caution : COLORS.text }}
          aria-label={`${open} open event${open === 1 ? '' : 's'}${critical ? ', warning active' : ''}. Open Reports`}
          title="Open events"
        >
          <IconBell />
          {open > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-sm leading-none font-medium"
              style={critical ? { backgroundColor: COLORS.alarm, color: COLORS.text } : { backgroundColor: COLORS.caution, color: COLORS.bg }}
            >
              {open}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2" title={`${me.name} · ${me.role}`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-mono text-sm font-medium text-chrome">
            {initials(CONSOLE_USER)}
          </span>
          <div className="hidden leading-tight min-[1600px]:block">
            <div className="text-sm font-semibold text-white">{me.name}</div>
            <div className="text-sm text-slate-300">Crew Medical Officer</div>
          </div>
        </div>
      </div>
    </header>
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
    <div className="min-w-0 leading-tight">
      <div className="text-sm whitespace-nowrap text-slate-300">
        {calibration ? (
          <span title="Layer 1 sets personal baselines over the first 30 samples; start a scenario after that.">Time · baseline {calibration}</span>
        ) : (
          <>Time · Mission Day {fmt(day)}</>
        )}
      </div>
      <div className="font-mono text-base text-white tabular-nums">{now.toLocaleTimeString('en-GB')}</div>
    </div>
  );
}

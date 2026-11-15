// Uygulama iskeleti: yan menü + üst bar + olay bandı + sayfa (Sahibi: Parça 3).
// Sayfa sahipleri: Kokpit/Mürettebat = Parça 3,
// Raporlar = Parça 2, Ayarlar = Parça 1, Görevler ve ASTRA sohbet paneli = Parça 4.
// Seçili astronot burada tutulur: Kokpit'ten bir kişiye tıklanınca Mürettebat sayfası o kişiyle açılır.
// Sade gezinme: 5 sayfa, her birinin altında ne işe yaradığını söyleyen kısa bir satır.
import { type ReactNode, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CREW, CREW_BY_ID } from './crew';
import { controls, SCENARIO_NAMES } from './loop';
import { SIM } from './sim/parameters';
import { useAstra } from './store';
import type { CrewId, ScenarioId, Telemetry } from './types';
import { AstraChatPanel } from './ui/components/AstraChatPanel';
import { ScenarioCinematics } from './ui/cinematic';
import { IconBell, IconCockpit, IconCrew, IconReports, IconReset, IconSettings, IconSignal, IconTasks, OrbitalisMark } from './ui/components/Icons';
import { IncidentBanner } from './ui/components/IncidentBanner';
import { SourceBadge } from './ui/components/SourceBadge';
import { fmtDelay, initials } from './ui/format';
import { AstronotEkrani } from './ui/pages/AstronotEkrani';
import { Ayarlar } from './ui/pages/Ayarlar';
import { Gorevler } from './ui/pages/Gorevler';
import { Kokpit } from './ui/pages/Kokpit';
import { Raporlar } from './ui/pages/Raporlar';
import { alpha, COLORS, fmt } from './ui/theme';

type PageId = 'kokpit' | 'murettebat' | 'gorevler' | 'raporlar' | 'ayarlar';

const PAGES: { id: PageId; label: string; hint: string; icon: () => ReactNode; subtitle: string }[] = [
  { id: 'kokpit', label: 'Kokpit', hint: 'Genel durum', icon: IconCockpit, subtitle: 'Görevin tek bakışta özeti' },
  { id: 'murettebat', label: 'Mürettebat', hint: 'Kişi kişi sağlık', icon: IconCrew, subtitle: 'Bir astronot seçin: vücut haritası ve tüm ölçümler' },
  { id: 'gorevler', label: 'Görevler', hint: 'EVA ve ekipman', icon: IconTasks, subtitle: 'Günün EVA görevi ve ekipman kontrolü' },
  { id: 'raporlar', label: 'Raporlar', hint: 'Olay kaydı', icon: IconReports, subtitle: 'Olaylar, otonom adımlar, onaylar' },
  { id: 'ayarlar', label: 'Ayarlar', hint: 'Senaryo, kaynaklar', icon: IconSettings, subtitle: 'Senaryolar, örnekleme hızı, veri kaynakları' },
];

// Üst bardaki senaryo hapları (kısa adlar); tam adlar loop.ts → SCENARIO_NAMES
// (dar ekranda, 1024 px tablet, kısa ad gösterilir)
const SCENARIO_PILLS: { id: ScenarioId; label: string; short?: string }[] = [
  { id: 'NORMAL', label: 'Normal gün', short: 'Normal' },
  { id: 'SOLAR_STORM', label: 'Güneş fırtınası' },
  { id: 'MARS_DAY_180', label: 'Mars 180. gün' },
  { id: 'CO2_SCRUBBER_FAIL', label: 'CO₂ arızası' },
  { id: 'EVA_OVEREXERTION', label: 'EVA aşırı efor', short: 'EVA efor' },
];

// Konsolu kullanan kişi (profil kartı). Mürettebattan biri; gerçek bir kişi değildir.
const CONSOLE_USER: CrewId = 'elif';
const EMPTY: Telemetry[] = [];

export default function App() {
  const [page, setPage] = useState<PageId>('kokpit');
  const [crew, setCrew] = useState<CrewId>(CREW[0].id);
  const hasCritical = useAstra((s) => s.incidents.some((i) => i.level === 'critical' && i.status === 'open'));

  const openCrew = (id: CrewId) => {
    setCrew(id);
    setPage('murettebat');
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
          {page === 'murettebat' && <AstronotEkrani crewId={crew} onSelect={setCrew} />}
          {page === 'gorevler' && <Gorevler />}
          {page === 'raporlar' && <Raporlar crewId={crew} />}
          {page === 'ayarlar' && <Ayarlar />}
        </main>
      </div>
      <AstraChatPanel />
      {/* Parça 1: senaryo değişince o senaryonun tam ekran sinematiği (Atla ile kapanır) */}
      <ScenarioCinematics />
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
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${on ? 'bg-calm text-space-bg shadow-lg shadow-calm/20' : 'text-slate-200 hover:bg-white/8'}`}
            >
              {p.icon()}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base leading-tight font-semibold">{p.label}</span>
                <span className={`block truncate text-sm leading-tight ${on ? 'text-space-bg/80' : 'text-slate-400'}`}>{p.hint}</span>
              </span>
              {p.id === 'raporlar' && openCount > 0 && (
                <span className={`rounded-full px-2 font-mono text-sm ${on ? 'bg-space-bg/20 text-space-bg' : 'bg-white/10 text-slate-100'}`}>{openCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-xl border border-space-border bg-space-bg/60 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.calm }}>
            <IconSignal /> Dünya bağlantısı
          </div>
          <div className="mt-1 text-sm text-slate-400">gecikme · tek yön</div>
          <div className="font-mono text-lg font-semibold whitespace-nowrap text-white">{fmtDelay(delay)}</div>
          <div className="text-sm text-slate-400">gidiş-dönüş {delay ? fmtDelay(delay * 2) : '—'}</div>
          <div className="mt-1.5">
            <SourceBadge param="commDelayDemo" />
          </div>
        </div>
        <button
          onClick={() => controls.reset()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-space-border px-2 py-2 text-sm whitespace-nowrap text-slate-300 hover:bg-white/5"
        >
          <IconReset /> Simülasyonu sıfırla
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
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1" role="group" aria-label="Senaryo">
        {SCENARIO_PILLS.map((p) => {
          const on = scenario === p.id;
          return (
            <button
              key={p.id}
              onClick={() => controls.setScenario(p.id)}
              aria-pressed={on}
              aria-label={p.label}
              title={SCENARIO_NAMES[p.id]}
              className={`rounded-full px-2.5 py-1 text-sm whitespace-nowrap min-[1180px]:px-3 ${on ? 'bg-calm font-semibold text-space-bg shadow-md shadow-calm/25' : 'bg-white/8 text-slate-200 hover:bg-white/15'}`}
            >
              {p.short ? (
                <>
                  <span className="min-[1180px]:hidden">{p.short}</span>
                  <span className="hidden min-[1180px]:inline">{p.label}</span>
                </>
              ) : (
                p.label
              )}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Clock day={day} calibration={calibrating ? `${samples}/${SIM.baselineWindow}` : undefined} />
        <button
          onClick={onBell}
          className="relative rounded-xl p-2 hover:bg-white/5"
          style={{ color: bellColor }}
          aria-label={`${open} açık olay${critical ? ', kritik var' : ''}. Raporlar'ı aç`}
          title="Açık olaylar"
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

/** Canlı saat ayrı bileşen: her saniye sadece bu kısım yeniden çizilir. */
function Clock({ day, calibration }: { day: number | undefined; calibration?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-base font-semibold tabular-nums">{now.toLocaleTimeString('tr-TR')}</div>
      {calibration ? (
        <div
          className="text-sm whitespace-nowrap"
          style={{ color: COLORS.calm }}
          title="Katman 1 kişisel baseline'ı ilk 30 ölçümde kurar; senaryoyu bundan sonra başlatın."
        >
          ◌ Baseline {calibration}
        </div>
      ) : (
        <div className="text-sm whitespace-nowrap" style={{ color: COLORS.normal }}>
          ● Canlı · Gün {fmt(day)}
        </div>
      )}
    </div>
  );
}

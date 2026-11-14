// Parça 3 · Kokpit: görevin tek bakışta özeti, görev kontrol konsolu düzeninde.
//  1. Durum şeridi: mürettebat, ortalama sağlık (trendiyle), görev durumu, görev günü
//  2. Mürettebat tablosu (nabız trendi, SpO₂, çekirdek ısı, sağlık) · yörünge ekranı (gemi ve EVA bölgesi)
//  3. Ortam: kabin ve EVA giysileri yan yana · son kayıtlar
// Tüm sayılar canlı veriden (useAstra); renkler theme.ts'ten; her sayı sütununun kaynak rozeti var.
import { type ReactNode, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CREW } from '../../crew';
import { readMetric, type MetricKey } from '../../metrics';
import { PARAMS } from '../../sim/parameters';
import { useAstra } from '../../store';
import type { CrewId, CrewLocation, CrewStatus, LedgerEntry, Level, Telemetry } from '../../types';
import { LevelBadge } from '../components/LevelBadge';
import { OrbitalDisplay } from '../components/OrbitalDisplay';
import { SourceBadge } from '../components/SourceBadge';
import { TrendLine } from '../components/Sparkline';
import { averageScore, fmtMetric, fmtUnit, initials, signalLevel } from '../format';
import { UI_PARAMS } from '../params';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL, scoreLevel, worstLevel } from '../theme';

const EMPTY: Telemetry[] = [];
const TEAMS: { loc: CrewLocation; title: string; where: string }[] = [
  { loc: 'KOKPIT', title: 'Kokpit ekibi', where: 'Mars yörüngesinde, gemi içinde' },
  { loc: 'GEZEGEN', title: 'Gezegen ekibi', where: 'Mars yüzeyinde, EVA giysisiyle' },
];
const idsOf = (loc: CrewLocation) => CREW.filter((m) => m.location === loc).map((m) => m.id);

// Ortalama sağlık trendi: store sağlık skoru geçmişi tutmaz; burada son 120 ölçüm biriktirilir.
// Modül düzeyinde: sayfa değişince sıfırlanmaz; simülasyon sıfırlanınca (ship = null) temizlenir.
const avgTrend: number[] = [];
let avgTrendT = 0;
function useAverageTrend(avg: number | undefined, t: number | undefined) {
  useEffect(() => {
    if (t === undefined) {
      avgTrend.length = 0;
      avgTrendT = 0;
      return;
    }
    if (avg === undefined || t === avgTrendT) return;
    avgTrend.push(avg);
    if (avgTrend.length > 120) avgTrend.shift();
    avgTrendT = t;
  }, [avg, t]);
  return avgTrend;
}

const teamLevel = (statuses: Partial<Record<CrewId, CrewStatus>>, ids: CrewId[]): Level | undefined =>
  ids.some((id) => statuses[id]) ? worstLevel(...ids.map((id) => statuses[id]?.level)) : undefined;

export function Kokpit({ onOpenCrew, onOpenReports }: { onOpenCrew: (id: CrewId) => void; onOpenReports?: () => void }) {
  const { ship, statuses } = useAstra(useShallow((s) => ({ ship: s.ship, statuses: s.statuses })));
  const shipLevel = teamLevel(statuses, idsOf('KOKPIT'));
  const surfaceLevel = teamLevel(statuses, idsOf('GEZEGEN'));

  return (
    <div className="space-y-4">
      <StatusStrip />

      <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]">
        <Panel title="Mürettebat" meta={<span className="text-slate-400">ayrıntı için kişiye tıklayın</span>}>
          <CrewBoard onOpenCrew={onOpenCrew} />
        </Panel>

        <Panel title="Yörünge" meta={<span className="text-slate-400">ARES-1 · Gün {fmt(ship?.missionDay)}</span>} flush>
          <div className="astra-scope flex flex-1 flex-col rounded-b-xl">
            <OrbitalDisplay markers={{ ship: shipLevel, surface: surfaceLevel }} />
            <div className="grid grid-cols-2 gap-px border-t border-space-border bg-space-border">
              <TeamMarker glyph="◆" title="ARES-1" sub="Kokpit ekibi" level={shipLevel} />
              <TeamMarker glyph="■" title="EVA bölgesi" sub="Gezegen ekibi" level={surfaceLevel} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)]">
        <Panel title="Yaşam ortamı" meta={<span className="text-slate-400">ekip ortalaması</span>}>
          <EnvironmentTable />
        </Panel>
        <Panel
          title="Son kayıtlar"
          meta={
            onOpenReports && (
              <button type="button" onClick={onOpenReports} className="rounded-md px-2 py-0.5 text-calm hover:bg-calm/10">
                Tüm kayıtlar
              </button>
            )
          }
        >
          <RecentLog />
        </Panel>
      </div>
    </div>
  );
}

// ---------- Ortak panel ----------
function Panel({ title, meta, children, flush = false }: { title: string; meta?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-space-border bg-space-panel" aria-label={title}>
      <header className="flex items-center justify-between gap-3 border-b border-space-border px-4 py-2.5">
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {meta && <div className="text-sm">{meta}</div>}
      </header>
      <div className={`flex flex-1 flex-col ${flush ? '' : 'p-4 pt-3'}`}>{children}</div>
    </section>
  );
}

// ---------- 1. Durum şeridi ----------
function StatusStrip() {
  const { ship, statuses, telemetry, incidents } = useAstra(
    useShallow((s) => ({ ship: s.ship, statuses: s.statuses, telemetry: s.telemetry, incidents: s.incidents })),
  );
  const live = CREW.filter((m) => telemetry[m.id]).length;
  const rest = CREW.filter((m) => statuses[m.id]?.restRequired).length;
  const avg = averageScore(
    statuses,
    CREW.map((m) => m.id),
  );
  const avgLevel = scoreLevel(avg);
  const trend = useAverageTrend(avg, ship?.t);
  const open = incidents.filter((i) => i.status !== 'resolved');
  const critical = open.filter((i) => i.level === 'critical');
  const missionLevel: Level = critical.length ? 'critical' : open.length ? 'caution' : 'normal';
  const day = ship?.missionDay;
  const total = UI_PARAMS.missionDurationDays.value;
  const progress = day ? day / total : 0;

  return (
    <section
      className="grid grid-cols-2 overflow-hidden rounded-xl border border-space-border bg-space-panel min-[1180px]:grid-cols-[1fr_1.25fr_1.25fr_1.15fr]"
      aria-label="Görev durumu özeti"
    >
      <Cell i={0} label="Mürettebat">
        <div className="flex items-baseline gap-2">
          <Big color={live === CREW.length ? COLORS.text : COLORS.offline}>
            {live}/{CREW.length}
          </Big>
          <span className="text-slate-300">çevrimiçi</span>
        </div>
        <Sub>{rest ? `${rest} kişi zorunlu dinlenmede` : '3 yörüngede, 3 yüzeyde'}</Sub>
      </Cell>

      <Cell i={1} label="Ortalama sağlık" right={<LevelBadge level={avgLevel} />}>
        <div className="flex items-end justify-between gap-3">
          <Big color={avgLevel ? LEVEL_COLOR[avgLevel] : COLORS.offline}>%{fmt(avg)}</Big>
          <TrendLine values={trend} color={avgLevel ? LEVEL_COLOR[avgLevel] : COLORS.calm} width={120} height={30} minSpan={20} />
        </div>
        <Sub>6 kişinin Katman 1 skoru</Sub>
      </Cell>

      <Cell i={2} label="Görev durumu" right={<LevelBadge level={missionLevel} />}>
        <div className="truncate font-mono text-[26px] leading-tight font-semibold" style={{ color: LEVEL_COLOR[missionLevel] }}>
          {critical.length ? 'Müdahale gerekiyor' : 'Devam ediyor'}
        </div>
        <Sub>
          {critical.length ? `${critical.length} kritik olay onay bekliyor` : open.length ? `${open.length} dikkat bildirimi izleniyor` : 'Açık olay yok'}
        </Sub>
      </Cell>

      <Cell i={3} label="Görev günü" right={<SourceBadge param="missionDurationDays" />}>
        <div className="flex items-baseline gap-2">
          <Big>{fmt(day)}</Big>
          <span className="text-slate-300">/ ~{fmt(total)} gün</span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Görev ilerlemesi"
        >
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: COLORS.calm }} />
        </div>
        <Sub>Görevin %{fmt(progress * 100)}'si tamamlandı</Sub>
      </Cell>
    </section>
  );
}

// Hücre kenarları: genişte 4 sütun (aralarda dikey çizgi), tablette 2×2 (ortada artı şeklinde çizgi)
const CELL_BORDER = ['border-r max-[1179px]:border-b', 'min-[1180px]:border-r max-[1179px]:border-b', 'border-r', ''];

function Cell({ i, label, right, children }: { i: number; label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className={`min-w-0 border-space-border px-4 py-3 ${CELL_BORDER[i]}`}>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-400">
        <span className="truncate">{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function Big({ children, color = COLORS.text }: { children: ReactNode; color?: string }) {
  return (
    <span className="font-mono text-[34px] leading-none font-semibold" style={{ color }}>
      {children}
    </span>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <div className="mt-1.5 truncate text-sm text-slate-400">{children}</div>;
}

// ---------- 2a. Mürettebat tablosu ----------
// Dar tabloda (tablet, 1280 px'de yan panelle) nabız trendi gizlenir ve ad sütunu genişler
const COLS =
  'grid grid-cols-[minmax(0,1.95fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,0.95fr)] @[520px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1.35fr)_minmax(0,0.6fr)_minmax(0,0.75fr)_minmax(0,1fr)] items-center gap-x-3';

function CrewBoard({ onOpenCrew }: { onOpenCrew: (id: CrewId) => void }) {
  const statuses = useAstra((s) => s.statuses);
  return (
    <div className="@container -mx-1">
      <div className={`${COLS} px-2 pb-2 text-sm text-slate-400`}>
        <span>Astronot</span>
        <span>Nabız</span>
        <span>SpO₂</span>
        <span className="truncate" title="Çekirdek vücut sıcaklığı">
          Sıcaklık
        </span>
        <span className="text-right">Sağlık</span>
      </div>
      {TEAMS.map((team) => {
        const ids = idsOf(team.loc);
        const avg = averageScore(statuses, ids);
        const l = scoreLevel(avg);
        return (
          <div key={team.loc} className="mb-1 last:mb-0">
            <div className="flex items-baseline justify-between gap-2 border-t border-space-border px-2 pt-2 pb-1">
              <span className="min-w-0 truncate">
                <span className="font-semibold text-slate-100">{team.title}</span>
                <span className="ml-2 text-sm text-slate-400">{team.where}</span>
              </span>
              <span className="shrink-0 font-mono text-sm" style={{ color: l ? LEVEL_COLOR[l] : COLORS.offline }}>
                ortalama %{fmt(avg)}
              </span>
            </div>
            {ids.map((id) => (
              <CrewRow key={id} id={id} onOpen={() => onOpenCrew(id)} />
            ))}
          </div>
        );
      })}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-space-border px-2 pt-2 text-sm text-slate-400">
        <span className="flex items-center gap-1.5">
          Nabız <SourceBadge metric="cardio.hr_bpm" />
        </span>
        <span className="flex items-center gap-1.5">
          SpO₂ <SourceBadge metric="cardio.spo2_pct" />
        </span>
        <span className="flex items-center gap-1.5">
          Sıcaklık <SourceBadge metric="resp.coreTemp_C" />
        </span>
      </div>
    </div>
  );
}

function CrewRow({ id, onOpen }: { id: CrewId; onOpen: () => void }) {
  const member = CREW.find((m) => m.id === id)!;
  const st = useAstra((s) => s.statuses[id]);
  const t = useAstra((s) => s.telemetry[id]);
  const hist = useAstra((s) => s.history[id] ?? EMPTY);
  const c = st ? LEVEL_COLOR[st.level] : COLORS.offline;
  const off = (k: MetricKey) => {
    const l = signalLevel(st, k);
    return l && l !== 'normal' ? LEVEL_COLOR[l] : undefined;
  };
  const hrColor = off('cardio.hr_bpm');

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${COLS} w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-calm`}
      aria-label={`${member.name}: astronot ekranını aç`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold"
          style={{ color: c, backgroundColor: alpha(c, 0.12), boxShadow: `inset 0 0 0 2px ${alpha(c, st && st.level !== 'normal' ? 0.9 : 0.45)}` }}
          aria-hidden
        >
          {initials(id)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-100">{member.name.replace(/^Dr\.\s*/, '')}</span>
          <span className="block truncate text-sm text-slate-400">
            {member.role}, {member.unit}
            {st?.restRequired ? ', dinlenmede' : ''}
          </span>
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="w-[62px] shrink-0 font-mono text-lg font-semibold" style={{ color: hrColor ?? COLORS.text }}>
          {t ? fmt(t.cardio.hr_bpm) : '—'}
          <span className="ml-0.5 font-sans text-sm font-normal text-slate-400">bpm</span>
        </span>
        <span className="hidden min-w-0 @[520px]:block">
          <TrendLine values={hist.map((x) => x.cardio.hr_bpm)} color={hrColor ?? alpha(COLORS.calm, 0.9)} width={72} height={24} minSpan={24} />
        </span>
      </span>
      <span className="font-mono text-lg" style={{ color: off('cardio.spo2_pct') ?? COLORS.text }}>
        {t ? fmtMetric('cardio.spo2_pct', t.cardio.spo2_pct) : '—'}
      </span>
      <span className="font-mono text-lg whitespace-nowrap" style={{ color: off('resp.coreTemp_C') ?? COLORS.text }}>
        {t ? fmtMetric('resp.coreTemp_C', t.resp.coreTemp_C) : '—'}
      </span>
      <span className="flex flex-col items-end">
        <span className="font-mono text-lg leading-tight font-semibold" style={{ color: c }}>
          %{fmt(st?.healthScore)}
        </span>
        <span className="font-mono text-sm whitespace-nowrap" style={{ color: c }}>
          {st ? `${LEVEL_ICON[st.level]} ${LEVEL_LABEL[st.level]}` : '—'}
        </span>
      </span>
    </button>
  );
}

// ---------- 2b. Yörünge ekranının alt göstergesi ----------
function TeamMarker({ glyph, title, sub, level }: { glyph: string; title: string; sub: string; level: Level | undefined }) {
  const c = level ? LEVEL_COLOR[level] : COLORS.offline;
  return (
    <div className="flex min-w-0 items-center gap-3 bg-space-panel px-4 py-2.5">
      <span className="text-lg leading-none" style={{ color: c }} aria-hidden>
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-100">{title}</span>
        <span className="block truncate text-sm text-slate-400">{sub}</span>
      </span>
      <LevelBadge level={level} />
    </div>
  );
}

// ---------- 3a. Yaşam ortamı: kabin ve EVA giysileri ----------
const ENV_ROWS: { key: MetricKey; label: string; limit?: (v: number) => Level }[] = [
  {
    key: 'env.ppCO2_mmHg',
    label: 'CO₂ kısmi basıncı',
    limit: (v) => (v > PARAMS.co2CriticalLimit.value ? 'critical' : v > PARAMS.co2CautionLimit.value ? 'caution' : 'normal'),
  },
  { key: 'env.o2_pct', label: 'Oksijen' },
  { key: 'env.pressure_kPa', label: 'Basınç' },
  { key: 'env.doseRate_uSv_h', label: 'Radyasyon doz hızı' },
];

function teamAverage(telemetry: Partial<Record<CrewId, Telemetry>>, ids: CrewId[], key: MetricKey): number | undefined {
  const vals = ids
    .map((id) => telemetry[id])
    .filter((t): t is Telemetry => !!t)
    .map((t) => readMetric(t, key));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
}

function EnvironmentTable() {
  const { telemetry, statuses } = useAstra(useShallow((s) => ({ telemetry: s.telemetry, statuses: s.statuses })));
  const cabin = idsOf('KOKPIT');
  const suits = idsOf('GEZEGEN');
  const cell = (ids: CrewId[], row: (typeof ENV_ROWS)[number]) => {
    const v = teamAverage(telemetry, ids, row.key);
    const fromSignals = worstLevel(...ids.map((id) => signalLevel(statuses[id], row.key)));
    const level = worstLevel(fromSignals, v !== undefined && row.limit ? row.limit(v) : undefined);
    const color = level !== 'normal' ? LEVEL_COLOR[level] : COLORS.text;
    return (
      <span className="flex min-w-0 flex-col items-start gap-0.5 @[640px]:flex-row @[640px]:items-center @[640px]:gap-2">
        <span className="font-mono text-lg whitespace-nowrap" style={{ color }}>
          {level !== 'normal' && <span className="mr-1 text-sm">{LEVEL_ICON[level]}</span>}
          {fmtMetric(row.key, v)}
        </span>
        <SourceBadge metric={row.key} crewId={ids[0]} />
      </span>
    );
  };
  return (
    <div className="@container">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.25fr)] gap-x-3 pb-2 text-sm text-slate-400">
        <span>Ölçüm</span>
        <span>Kabin, Kokpit</span>
        <span>Giysiler, Gezegen</span>
      </div>
      {ENV_ROWS.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.25fr)] items-center gap-x-3 border-t border-space-border/70 py-2"
        >
          <span className="truncate text-slate-300">{row.label}</span>
          {cell(cabin, row)}
          {cell(suits, row)}
        </div>
      ))}
      <div className="mt-2 text-sm text-slate-400">
        CO₂ sınırları: dikkat {fmtUnit(PARAMS.co2CautionLimit.value, 'mmHg', 1)}, kritik {fmtUnit(PARAMS.co2CriticalLimit.value, 'mmHg', 1)}
      </div>
    </div>
  );
}

// ---------- 3b. Son kayıtlar ----------
const KIND: Record<LedgerEntry['kind'], { text: string; color: string }> = {
  INCIDENT_OPENED: { text: 'Olay', color: COLORS.caution },
  INCIDENT_RESOLVED: { text: 'Çözüldü', color: COLORS.normal },
  AUTO_ACTION: { text: 'Otonom adım', color: COLORS.calm },
  ACK: { text: 'Onay', color: COLORS.calm },
  SCENARIO: { text: 'Senaryo', color: COLORS.calm },
  SYSTEM: { text: 'Sistem', color: COLORS.offline },
};

function RecentLog() {
  const ledger = useAstra((s) => s.ledger);
  const incidents = useAstra((s) => s.incidents);
  const rows = ledger.slice(0, 6);
  if (!rows.length) return <p className="text-sm text-slate-400">Henüz kayıt yok. Katman 1 ilk ölçümleri topluyor.</p>;
  return (
    <ol className="space-y-1.5">
      {rows.map((e) => {
        const inc = e.incidentId ? incidents.find((i) => i.id === e.incidentId) : undefined;
        const k = KIND[e.kind];
        const color = e.kind === 'INCIDENT_OPENED' && inc ? LEVEL_COLOR[inc.level] : k.color;
        return (
          <li key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-l-2 pl-3" style={{ borderColor: color }}>
            <span className="font-mono text-sm text-slate-400">{new Date(e.at).toLocaleTimeString('tr-TR')}</span>
            <span className="min-w-0">
              <span className="text-sm font-semibold" style={{ color }}>
                {k.text}
              </span>
              <span className="block truncate text-sm text-slate-200" title={e.text}>
                {e.text}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

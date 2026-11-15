// Parça 3 · Astronot Ekranı: seçili astronotun 5 veri grubundaki tüm ölçümleri.
// Solda 2B vücut haritası, sağda sağlık kartı ve stres faktörleri, altta sekmeler
// (Genel bakış / Sağlık / Performans / Çevre). Her sayının yanında birimi ve kaynak rozeti var.
import { type ReactNode, useMemo, useState } from 'react';
import { CREW, CREW_BY_ID } from '../../crew';
import { GROUP_NAMES, METRIC_BY_KEY, METRICS, readMetric, type MetricInfo, type MetricKey } from '../../metrics';
import { normalRangeFor, PARAMS } from '../../sim/parameters';
import { useAstra } from '../../store';
import type { CrewId, CrewStatus, Level, MetricScore, Telemetry } from '../../types';
import { REGIONS, type TabId } from '../bodyRegions';
import { BodyMap } from '../components/BodyMap';
import { Card } from '../components/Card';
import { LevelBadge } from '../components/LevelBadge';
import { SourceBadge } from '../components/SourceBadge';
import { Sparkline, TrendLine } from '../components/Sparkline';
import { domainLevel, fmtMetric, fmtUnit, fmtZ, initials, LOCATION_LONG, signalLevel } from '../format';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL, worstLevel } from '../theme';

const EMPTY: Telemetry[] = [];

const TABS: { id: TabId; label: string; groups: MetricInfo['group'][] }[] = [
  { id: 'genel', label: 'Genel bakış', groups: [] },
  { id: 'saglik', label: 'Sağlık', groups: [1, 2, 3] },
  { id: 'performans', label: 'Performans', groups: [4] },
  { id: 'cevre', label: 'Çevre', groups: [5] },
];

const levelColor = (l: Level | undefined) => (l ? LEVEL_COLOR[l] : COLORS.text);

export function AstronotEkrani({ crewId, onSelect }: { crewId: CrewId; onSelect: (id: CrewId) => void }) {
  const t = useAstra((s) => s.telemetry[crewId]);
  const st = useAstra((s) => s.statuses[crewId]);
  const statuses = useAstra((s) => s.statuses);
  const incidents = useAstra((s) => s.incidents);
  const [tab, setTab] = useState<TabId>('genel');
  const member = CREW_BY_ID[crewId];
  const mine = incidents.filter((i) => i.status !== 'resolved' && i.crewIds.includes(crewId));

  const tabLevel = (id: TabId): Level | undefined => {
    if (!st) return undefined;
    if (id === 'genel') return st.level;
    if (id === 'saglik') return worstLevel(domainLevel(st, 'cardio'), domainLevel(st, 'resp'), domainLevel(st, 'biochem'));
    if (id === 'performans') return domainLevel(st, 'cog');
    return domainLevel(st, 'env');
  };

  return (
    <div className="space-y-4">
      {/* Astronot hap düğmeleri */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Astronot seç">
        {CREW.map((m) => {
          const l = statuses[m.id]?.level;
          const on = m.id === crewId;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(m.id)}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${on ? 'bg-calm/20 font-semibold text-calm ring-1 ring-calm' : 'bg-white/5 text-slate-200 hover:bg-white/10'}`}
            >
              <span style={{ color: l ? LEVEL_COLOR[l] : COLORS.offline }} aria-label={l ? LEVEL_LABEL[l] : 'veri yok'}>
                {l ? LEVEL_ICON[l] : '●'}
              </span>
              {m.name.replace(/^Dr\.\s*/, '')}
            </button>
          );
        })}
      </div>

      {/* Kişi başlığı */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-space-border bg-space-panel px-4 py-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-mono text-lg font-bold"
          style={{
            color: levelColor(st?.level),
            backgroundColor: alpha(levelColor(st?.level), 0.14),
            boxShadow: `inset 0 0 0 2px ${alpha(levelColor(st?.level), 0.6)}`,
          }}
          aria-hidden
        >
          {initials(crewId)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-bold">{member.name}</div>
          <div className="text-sm text-slate-400">
            {member.role} · {member.unit} · {LOCATION_LONG[member.location]} · {member.sensitivity}
          </div>
        </div>
        {st?.restRequired && (
          <span className="rounded-full px-3 py-1 text-sm font-semibold" style={{ color: COLORS.calm, backgroundColor: alpha(COLORS.calm, 0.12) }}>
            ✓ Zorunlu dinlenme · otomatik
          </span>
        )}
        <LevelBadge level={st?.level} pill />
      </div>

      {mine.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mine.map((i) => (
            <span
              key={i.id}
              className="max-w-full truncate rounded-lg px-3 py-1 text-sm"
              style={{ color: LEVEL_COLOR[i.level], backgroundColor: alpha(LEVEL_COLOR[i.level], 0.1) }}
            >
              {LEVEL_ICON[i.level]} {i.title}
              {i.status === 'acknowledged' ? ' · onaylandı' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <Card title="Vücut haritası" right={<span className="text-sm text-slate-400">bölgeye tıkla</span>}>
          <BodyMap status={st} onRegion={(r) => setTab(REGIONS.find((x) => x.id === r)!.tab)} />
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <HealthCard crewId={crewId} t={t} st={st} />
          <div className="grid grid-cols-2 gap-4">
            <RadiationCard crewId={crewId} t={t} st={st} />
            <Co2Card crewId={crewId} t={t} />
            <SleepCard crewId={crewId} t={t} st={st} />
            <PvtCard crewId={crewId} t={t} st={st} />
          </div>
        </div>
      </div>

      {/* Sekmeler */}
      <Card>
        <div className="mb-3 flex flex-wrap gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label="Ölçüm grupları">
          {TABS.map((x) => {
            const l = tabLevel(x.id);
            const on = tab === x.id;
            return (
              <button
                key={x.id}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(x.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${on ? 'bg-calm/20 font-semibold text-calm ring-1 ring-calm/50' : 'text-slate-300 hover:bg-white/5'}`}
              >
                {x.label}
                {l && l !== 'normal' && (
                  <span style={{ color: LEVEL_COLOR[l] }} aria-label={LEVEL_LABEL[l]}>
                    {LEVEL_ICON[l]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {tab === 'genel' ? <Overview crewId={crewId} st={st} /> : <GroupTables crewId={crewId} t={t} st={st} groups={TABS.find((x) => x.id === tab)!.groups} />}
      </Card>
    </div>
  );
}

// ---------- Sağlık kartı ----------
function Vital({ crewId, t, st, k, label }: { crewId: CrewId; t: Telemetry | undefined; st: CrewStatus | undefined; k: MetricKey; label: string }) {
  const l = signalLevel(st, k);
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.03] px-3 py-2">
      <div className="truncate text-sm text-slate-400">{label}</div>
      <div className="font-mono text-xl font-bold whitespace-nowrap tabular-nums" style={{ color: l && l !== 'normal' ? LEVEL_COLOR[l] : COLORS.text }}>
        {t ? fmtMetric(k, readMetric(t, k)) : '—'}
        {l && l !== 'normal' && <span className="ml-1 text-sm">{LEVEL_ICON[l]}</span>}
      </div>
      <div className="mt-1">
        <SourceBadge metric={k} crewId={crewId} />
      </div>
      <RangeNote crewId={crewId} k={k} value={t ? readMetric(t, k) : undefined} block />
    </div>
  );
}

/** Resmi normal aralık: değer aralıktaysa ✓ (uyarı verilmez), dışındaysa ! (kişisel normalden sapma değerlendirilir). */
function RangeNote({ crewId, k, value, block }: { crewId: CrewId; k: MetricKey; value: number | undefined; block?: boolean }) {
  const r = normalRangeFor(k, CREW_BY_ID[crewId].location);
  if (!r || value === undefined) return null;
  const inside = value >= r[0] && value <= r[1];
  const d = (n: number) => fmt(n, Number.isInteger(n) ? 0 : 1);
  const text = r[0] === 0 ? `≤ ${d(r[1])}` : `${d(r[0])}–${d(r[1])}`;
  return (
    <span
      className={`${block ? 'mt-1 block' : 'ml-1.5'} text-xs whitespace-nowrap`}
      style={{ color: inside ? COLORS.normal : COLORS.caution }}
      title={
        inside
          ? 'Resmi kaynağın normal aralığında: bu değer için uyarı verilmez (kaynak rozetine bakın).'
          : 'Resmi normal aralığın dışında: kişisel normalden sapma değerlendirilir.'
      }
    >
      normal {text} {inside ? '✓' : '!'}
    </span>
  );
}

function HealthCard({ crewId, t, st }: { crewId: CrewId; t: Telemetry | undefined; st: CrewStatus | undefined }) {
  const hist = useAstra((s) => s.history[crewId] ?? EMPTY);
  const hrMean = useMemo(() => (hist.length ? hist.reduce((a, x) => a + x.cardio.hr_bpm, 0) / hist.length : undefined), [hist]);
  const c = levelColor(st?.level);
  return (
    <Card title="Sağlık" right={<LevelBadge level={st?.level} />}>
      <div className="@container">
        <div className="grid grid-cols-1 items-end gap-3 @[480px]:grid-cols-[auto_minmax(0,1fr)] @[480px]:gap-x-6">
          <div>
            <div className="text-sm text-slate-400">Sağlık skoru</div>
            <div className="font-mono text-4xl leading-none font-bold tabular-nums" style={{ color: c }}>
              %{fmt(st?.healthScore)}
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-2">
            <Vital crewId={crewId} t={t} st={st} k="cardio.hr_bpm" label="Nabız" />
            <Vital crewId={crewId} t={t} st={st} k="resp.coreTemp_C" label="Sıcaklık" />
            <Vital crewId={crewId} t={t} st={st} k="cardio.spo2_pct" label="SpO₂" />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-sm text-slate-400">
          <span>Nabız · son {hist.length} ölçüm</span>
          <span>kesikli çizgi: ortalama {fmtUnit(hrMean, 'bpm')}</span>
        </div>
        <Sparkline crewId={crewId} metric="cardio.hr_bpm" height={56} reference={hrMean} color={st?.level === 'critical' ? COLORS.critical : COLORS.calm} />
      </div>
    </Card>
  );
}

// ---------- Stres faktörleri ----------
function FactorCard({ title, level, children }: { title: string; level: Level | undefined; children: ReactNode }) {
  const c = level ? LEVEL_COLOR[level] : COLORS.offline;
  return (
    <div
      className="min-w-0 rounded-2xl border border-space-border bg-space-panel p-3"
      style={{ borderTop: `3px solid ${level && level !== 'normal' ? c : COLORS.border}` }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-slate-300">{title}</h3>
        {level && level !== 'normal' && (
          <span className="font-mono text-sm font-semibold" style={{ color: c }}>
            {LEVEL_ICON[level]} {LEVEL_LABEL[level]}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** Ölçekli çubuk: değer, eşik çizgileri. */
function Bar({
  value,
  max,
  color,
  marks = [],
}: {
  value: number | undefined;
  max: number;
  color: string;
  marks?: { at: number; color: string; label: string }[];
}) {
  const pct = value === undefined ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="relative mt-2 h-2.5 rounded-full bg-white/10" role="presentation">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      {marks.map((m) => (
        <span
          key={m.label}
          className="absolute -top-1 h-[18px] w-0.5 rounded"
          style={{ left: `${Math.min(100, (m.at / max) * 100)}%`, backgroundColor: m.color }}
          title={m.label}
        />
      ))}
    </div>
  );
}

function RadiationCard({ crewId, t, st }: { crewId: CrewId; t: Telemetry | undefined; st: CrewStatus | undefined }) {
  const limit = PARAMS.careerDoseLimit.value;
  const warn = limit * 0.8;
  const cum = t?.env.doseCumulative_mSv;
  const cumLevel: Level | undefined = cum === undefined ? undefined : cum >= limit ? 'critical' : cum >= warn ? 'caution' : 'normal';
  const rateLevel = signalLevel(st, 'env.doseRate_uSv_h');
  const level = worstLevel(rateLevel, cumLevel);
  return (
    <FactorCard title="Radyasyon" level={level}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-sm text-slate-400">Doz hızı</span>
        <SourceBadge metric="env.doseRate_uSv_h" crewId={crewId} />
      </div>
      <div className="font-mono text-xl font-bold tabular-nums" style={{ color: rateLevel && rateLevel !== 'normal' ? LEVEL_COLOR[rateLevel] : COLORS.text }}>
        {t ? fmtMetric('env.doseRate_uSv_h', t.env.doseRate_uSv_h) : '—'}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-sm text-slate-400">Toplam doz</span>
        <SourceBadge param="careerDoseLimit" />
      </div>
      <div className="font-mono text-sm tabular-nums">
        <span className="text-base font-bold" style={{ color: cumLevel && cumLevel !== 'normal' ? LEVEL_COLOR[cumLevel] : COLORS.text }}>
          {fmt(cum)}
        </span>{' '}
        / {fmt(limit)} mSv
      </div>
      <Bar
        value={cum}
        max={limit}
        color={cumLevel && cumLevel !== 'normal' ? LEVEL_COLOR[cumLevel] : COLORS.calm}
        marks={[{ at: warn, color: COLORS.caution, label: `%80 = ${fmt(warn)} mSv (dikkat)` }]}
      />
    </FactorCard>
  );
}

function Co2Card({ crewId, t }: { crewId: CrewId; t: Telemetry | undefined }) {
  const v = t?.env.ppCO2_mmHg;
  const cau = PARAMS.co2CautionLimit.value;
  const crit = PARAMS.co2CriticalLimit.value;
  const level: Level | undefined = v === undefined ? undefined : v > crit ? 'critical' : v > cau ? 'caution' : 'normal';
  const where = CREW_BY_ID[crewId].location === 'KOKPIT' ? 'Kabin' : 'Giysi içi';
  return (
    <FactorCard title={`${where} CO₂`} level={level}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-sm text-slate-400">ppCO₂</span>
        <SourceBadge metric="env.ppCO2_mmHg" crewId={crewId} />
      </div>
      <div className="font-mono text-xl font-bold tabular-nums" style={{ color: level && level !== 'normal' ? LEVEL_COLOR[level] : COLORS.text }}>
        {fmtMetric('env.ppCO2_mmHg', v)}
      </div>
      <Bar
        value={v}
        max={6}
        color={level && level !== 'normal' ? LEVEL_COLOR[level] : COLORS.calm}
        marks={[
          { at: cau, color: COLORS.caution, label: `${fmt(cau, 1)} mmHg dikkat` },
          { at: crit, color: COLORS.critical, label: `${fmt(crit, 1)} mmHg kritik` },
        ]}
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm text-slate-400">
        <span className="whitespace-nowrap">
          ▲ {fmt(cau, 1)} · ■ {fmt(crit, 1)} mmHg
        </span>
        <SourceBadge param="co2CriticalLimit" />
      </div>
    </FactorCard>
  );
}

function SleepCard({ crewId, t, st }: { crewId: CrewId; t: Telemetry | undefined; st: CrewStatus | undefined }) {
  const l = worstLevel(
    signalLevel(st, 'env.sleepLastNight_h'),
    signalLevel(st, 'env.remPct'),
    signalLevel(st, 'env.swsPct'),
    signalLevel(st, 'env.circadianShift_h'),
  );
  const sl = signalLevel(st, 'env.sleepLastNight_h');
  return (
    <FactorCard title="Uyku" level={l}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-sm text-slate-400">Dün gece</span>
        <SourceBadge metric="env.sleepLastNight_h" crewId={crewId} />
      </div>
      <div className="font-mono text-xl font-bold tabular-nums" style={{ color: sl && sl !== 'normal' ? LEVEL_COLOR[sl] : COLORS.text }}>
        {fmtMetric('env.sleepLastNight_h', t?.env.sleepLastNight_h)}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 text-sm">
        <span className="text-slate-400">REM</span>
        <span className="text-right font-mono">{fmtMetric('env.remPct', t?.env.remPct)}</span>
        <span className="text-slate-400">Derin uyku</span>
        <span className="text-right font-mono">{fmtMetric('env.swsPct', t?.env.swsPct)}</span>
      </div>
      <div className="mt-1 text-sm text-slate-400">uzay ort. {fmtUnit(PARAMS.sleepInSpaceMean.value, 'sa', 1)}</div>
    </FactorCard>
  );
}

function PvtCard({ crewId, t, st }: { crewId: CrewId; t: Telemetry | undefined; st: CrewStatus | undefined }) {
  const l = worstLevel(signalLevel(st, 'cog.pvtMeanRt_ms'), signalLevel(st, 'cog.pvtLapses'));
  const rl = signalLevel(st, 'cog.pvtMeanRt_ms');
  return (
    <FactorCard title="Tepki testi (PVT)" level={l}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-sm text-slate-400">Ort. tepki</span>
        <SourceBadge metric="cog.pvtMeanRt_ms" crewId={crewId} />
      </div>
      <div className="font-mono text-xl font-bold tabular-nums" style={{ color: rl && rl !== 'normal' ? LEVEL_COLOR[rl] : COLORS.text }}>
        {fmtMetric('cog.pvtMeanRt_ms', t?.cog.pvtMeanRt_ms)}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
        <span className="text-slate-400">Dikkat kaybı</span>
        <span className="font-mono whitespace-nowrap">{fmtMetric('cog.pvtLapses', t?.cog.pvtLapses)}</span>
      </div>
      <div className="mt-1">
        <SourceBadge metric="cog.pvtLapses" />
      </div>
      <div className="mt-1 text-sm text-slate-400">dinlenmiş ~{fmtUnit(PARAMS.pvtMeanRtRested.value, 'ms')}</div>
    </FactorCard>
  );
}

// ---------- Sekmeler ----------
function Overview({ crewId, st }: { crewId: CrewId; st: CrewStatus | undefined }) {
  const hist = useAstra((s) => s.history[crewId] ?? EMPTY);
  if (!st || !st.topSignals.length) return <p className="text-sm text-slate-400">Kişisel baseline kuruluyor; en çok sapan ölçümler birazdan görünür.</p>;
  const allNormal = st.topSignals.every((s) => s.level === 'normal');
  return (
    <div>
      <p className="mb-3 text-sm text-slate-400">
        {allNormal
          ? 'Tüm ölçümler kişisel normal aralığında. Aşağıda kişisel normalden en çok uzaklaşan 3 ölçüm var.'
          : 'Katman 1, kişisel normaline göre en çok sapan 3 ölçümü gösteriyor. Uyarıyı sadece Katman 1 açar.'}
      </p>
      <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
        {st.topSignals.map((s) => (
          <SignalCard key={s.key} s={s} crewId={crewId} series={hist.map((x) => readMetric(x, s.key))} />
        ))}
      </div>
    </div>
  );
}

function SignalCard({ s, crewId, series }: { s: MetricScore; crewId: CrewId; series: number[] }) {
  const m = METRIC_BY_KEY[s.key];
  const c = LEVEL_COLOR[s.level];
  return (
    <div className="min-w-0 rounded-xl border border-space-border bg-white/[0.02] p-3" style={{ borderLeft: `4px solid ${c}` }}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-medium text-slate-200">{m.label}</span>
        <LevelBadge level={s.level} />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: s.level === 'normal' ? COLORS.text : c }}>
          {fmtMetric(s.key, s.value)}
        </span>
        <SourceBadge metric={s.key} crewId={crewId} />
      </div>
      <div className="mt-1 text-sm text-slate-400">
        kişisel normal {fmtMetric(s.key, s.mean)}
        {s.key !== 'env.doseCumulative_mSv' && <> · sapma {fmtZ(s.z)}</>}
      </div>
      <div className="mt-2">
        <TrendLine values={series} color={s.level === 'normal' ? COLORS.calm : c} width={220} height={32} />
      </div>
    </div>
  );
}

function GroupTables({ crewId, t, st, groups }: { crewId: CrewId; t: Telemetry | undefined; st: CrewStatus | undefined; groups: MetricInfo['group'][] }) {
  const hist = useAstra((s) => s.history[crewId] ?? EMPTY);
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <h3 className="mb-1 text-sm font-semibold tracking-wide text-slate-300">
            Veri grubu {g} · {GROUP_NAMES[g]}
          </h3>
          <div className="grid grid-cols-1 gap-x-6 min-[1400px]:grid-cols-2">
            {g === 1 && t && (
              <Row
                label="EKG ritmi"
                value={t.cardio.ecg_rhythm === 'sinus' ? 'Sinüs ritmi' : 'Düzensiz'}
                level={t.cardio.ecg_rhythm === 'irregular' ? 'caution' : undefined}
                badge={<SourceBadge param="ecgIrregularThreshold" />}
              />
            )}
            {METRICS.filter((m) => m.group === g).map((m) => {
              const l = signalLevel(st, m.key);
              return (
                <Row
                  key={m.key}
                  label={m.label}
                  note={<RangeNote crewId={crewId} k={m.key} value={t ? readMetric(t, m.key) : undefined} />}
                  value={t ? fmtMetric(m.key, readMetric(t, m.key)) : '—'}
                  level={l}
                  daily={m.cadence === 'daily'}
                  trend={
                    <TrendLine
                      values={hist.map((x) => readMetric(x, m.key))}
                      color={l && l !== 'normal' ? LEVEL_COLOR[l] : COLORS.calm}
                      width={72}
                      height={22}
                    />
                  }
                  badge={<SourceBadge metric={m.key} crewId={crewId} />}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({
  label,
  value,
  level,
  trend,
  badge,
  daily,
  note,
}: {
  label: string;
  note?: ReactNode;
  value: string;
  level?: Level;
  trend?: ReactNode;
  badge?: ReactNode;
  daily?: boolean;
}) {
  const off = level && level !== 'normal';
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-space-border/70 py-1.5">
      <span className="min-w-0 flex-1 truncate text-sm text-slate-300" title={label}>
        {label}
        {daily && <span className="ml-1.5 text-slate-500">· günlük</span>}
        {note}
      </span>
      <span className="hidden min-[1000px]:block">{trend}</span>
      <span
        className="w-[124px] shrink-0 text-right font-mono text-sm font-semibold whitespace-nowrap tabular-nums"
        style={{ color: off ? LEVEL_COLOR[level] : COLORS.text }}
      >
        {off && <span className="mr-1">{LEVEL_ICON[level]}</span>}
        {value}
      </span>
      <span className="flex w-[130px] shrink-0 justify-end">{badge}</span>
    </div>
  );
}

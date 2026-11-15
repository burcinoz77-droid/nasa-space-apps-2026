// Parça 3 · Mürettebat sayfası (eski "Astronot Ekranı" + "Astronotlar" tek sayfada).
// Üstte altı astronot kartı (kişi seçici, ekip ekip), altında seçili kişinin vücut haritası ve bölgesinin tüm
// ölçümleri (solda), sağlık kartı ve stres faktörleri (sağda). Ayrı sekme yok: bütün ölçümler bölge panelinde.
// Her sayının yanında birimi ve kaynak rozeti var.
import { type ReactNode, useMemo } from 'react';
import { CREW, CREW_BY_ID } from '../../crew';
import { readMetric, type MetricKey } from '../../metrics';
import { PARAMS } from '../../sim/parameters';
import { useAstra } from '../../store';
import type { CrewId, CrewLocation, CrewStatus, Level, Telemetry } from '../../types';
import { BodyPanel } from '../components/BodyPanel';
import { Card } from '../components/Card';
import { LevelBadge } from '../components/LevelBadge';
import { RangeNote } from '../components/RangeNote';
import { SourceBadge } from '../components/SourceBadge';
import { Sparkline } from '../components/Sparkline';
import { fmtMetric, fmtUnit, initials, LOCATION_LONG, signalLevel } from '../format';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON, LEVEL_LABEL, worstLevel } from '../theme';

const EMPTY: Telemetry[] = [];

const levelColor = (l: Level | undefined) => (l ? LEVEL_COLOR[l] : COLORS.text);

const TEAMS: { loc: CrewLocation; title: string }[] = [
  { loc: 'KOKPIT', title: 'Kokpit ekibi · yörüngede' },
  { loc: 'GEZEGEN', title: 'Gezegen ekibi · yüzeyde' },
];

export function AstronotEkrani({ crewId, onSelect }: { crewId: CrewId; onSelect: (id: CrewId) => void }) {
  const t = useAstra((s) => s.telemetry[crewId]);
  const st = useAstra((s) => s.statuses[crewId]);
  const incidents = useAstra((s) => s.incidents);
  const member = CREW_BY_ID[crewId];
  const mine = incidents.filter((i) => i.status !== 'resolved' && i.crewIds.includes(crewId));

  return (
    <div className="space-y-4">
      <CrewPicker selected={crewId} onSelect={onSelect} />

      {/* Seçili kişi */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-space-border bg-space-panel px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-xl font-bold">{member.name}</div>
          <div className="text-sm text-slate-400">
            {member.role} · {member.unit} · {LOCATION_LONG[member.location]} · {member.sensitivity}
          </div>
        </div>
        {st?.restRequired && (
          <span className="rounded-full px-3 py-1 text-sm font-semibold" style={{ color: COLORS.calm, backgroundColor: alpha(COLORS.calm, 0.14) }}>
            ✓ Zorunlu dinlenme · otomatik
          </span>
        )}
        <LevelBadge level={st?.level} pill />
        {mine.length > 0 && (
          <div className="flex w-full flex-wrap gap-2">
            {mine.map((i) => (
              <span
                key={i.id}
                className="max-w-full truncate rounded-lg px-3 py-1 text-sm"
                style={{ color: LEVEL_COLOR[i.level], backgroundColor: alpha(LEVEL_COLOR[i.level], 0.12) }}
              >
                {LEVEL_ICON[i.level]} {i.title}
                {i.status === 'acknowledged' ? ' · onaylandı' : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <Card title="Vücut haritası ve ölçümler" right={<span className="text-sm text-slate-400">bölge seçin</span>}>
          <BodyPanel key={crewId} crewId={crewId} status={st} t={t} />
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
    </div>
  );
}

/** Altı astronot, ekip ekip. Kart = kişi seçici: ad, skor, seviye. Seçili kart parlak mavi. */
function CrewPicker({ selected, onSelect }: { selected: CrewId; onSelect: (id: CrewId) => void }) {
  const statuses = useAstra((s) => s.statuses);
  return (
    <div className="grid grid-cols-1 gap-3 min-[1180px]:grid-cols-2" role="tablist" aria-label="Astronot seç">
      {TEAMS.map((team) => (
        <div key={team.loc} className="min-w-0">
          <div className="mb-1.5 text-sm font-semibold text-slate-300">{team.title}</div>
          <div className="grid grid-cols-3 gap-2">
            {CREW.filter((m) => m.location === team.loc).map((m) => {
              const st = statuses[m.id];
              const l = st?.level;
              const c = l ? LEVEL_COLOR[l] : COLORS.offline;
              const on = m.id === selected;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => onSelect(m.id)}
                  className={`flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    on ? 'bg-calm text-space-bg shadow-lg shadow-calm/25' : 'bg-space-panel text-slate-100 ring-1 ring-space-border hover:bg-white/10'
                  }`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold"
                    style={{
                      color: on ? COLORS.bg : c,
                      backgroundColor: on ? alpha(COLORS.bg, 0.12) : alpha(c, 0.14),
                      boxShadow: `inset 0 0 0 2px ${on ? COLORS.bg : c}`,
                    }}
                    aria-hidden
                  >
                    {initials(m.id)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm leading-tight font-semibold">{m.name.replace(/^Dr\.\s*/, '')}</span>
                    <span className="flex items-center gap-1.5 font-mono text-sm leading-tight">
                      <span style={{ color: on ? COLORS.bg : c }} aria-label={l ? LEVEL_LABEL[l] : 'veri yok'}>
                        {l ? LEVEL_ICON[l] : '●'}
                      </span>
                      <span className={on ? '' : 'text-slate-300'}>%{fmt(st?.healthScore)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
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

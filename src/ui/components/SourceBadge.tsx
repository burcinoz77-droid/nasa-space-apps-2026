// Part 3 · Source badge. Sits next to every number: NASA-STD-3001 / OSDR / DONKI / peer-reviewed study / Assumption.
// Clean look: a small gray ⓘ; hovering shows the source name, clicking opens the source link in a new tab.
// Assumptions are shown with a small gray "assumption" label.
//   <SourceBadge metric="env.ppCO2_mmHg" />          the parameter the metric is based on (sourceForMetric)
//   <SourceBadge param="careerDoseLimit" />          a PARAMS key directly
//   <SourceBadge metric="env.doseRate_uSv_h" crewId="mert" />  surface dose rate source for the surface crew
import { CREW_BY_ID } from '../../crew';
import type { MetricKey } from '../../metrics';
import { PARAMS, sourceForMetric, type Param, type ParamKey } from '../../sim/parameters';
import type { CrewId } from '../../types';
import { UI_PARAMS } from '../params';
import { alpha, COLORS } from '../theme';

type UiParamKey = keyof typeof UI_PARAMS;

/** "Norsk et al. 2015, J Physiol" -> "Norsk 2015"; NASA sources by their short name. */
function shortSource(p: Param): string {
  if (p.assumption) return 'Assumption';
  const s = p.source;
  if (/NASA-STD-3001|OCHMO/.test(s)) return 'NASA-STD-3001';
  if (/Apollo/.test(s)) return 'NASA Apollo';
  if (/Artemis I/.test(s)) return 'NASA Artemis I';
  if (/^NIH/.test(s)) return 'NIH';
  if (/^ISS noise/.test(s)) return 'ISS noise';
  const fr = s.match(/^Frontiers.*?(\d{4})/);
  if (fr) return `Frontiers ${fr[1]}`;
  if (/OSDR/.test(s)) return 'OSDR';
  if (/DONKI/.test(s)) return 'DONKI';
  if (/Curiosity RAD/.test(s)) return 'Curiosity RAD';
  if (/NASA HRP/.test(s)) return 'NASA HRP';
  if (/DRA 5\.0/.test(s)) return 'NASA DRA 5.0';
  if (/NTRS/.test(s)) return 'NASA NTRS';
  if (/JEMS/.test(s)) return 'JEMS';
  if (/^Sweat biomarker/.test(s)) return 'Sweat table';
  const m = s.match(/^([A-ZÇĞİÖŞÜ][\p{L}-]+)(?:\s+et al\.)?\s+(\d{4})/u);
  if (m) return `${m[1]} ${m[2]}`;
  return s.length > 18 ? `${s.slice(0, 17)}…` : s;
}

function resolve(metric?: MetricKey, param?: ParamKey | UiParamKey, crewId?: CrewId): Param | undefined {
  if (param) return (PARAMS as Record<string, Param>)[param] ?? (UI_PARAMS as Record<string, Param>)[param];
  if (!metric) return undefined;
  // The dose rate comes from a different measurement depending on the person's location: orbit = Mars cruise (RAD), surface = Mars surface (RAD)
  if (metric === 'env.doseRate_uSv_h' && crewId && CREW_BY_ID[crewId].location === 'GEZEGEN') return PARAMS.doseRateMarsSurface;
  if (metric === 'env.pressure_kPa' || metric === 'env.o2_pct') {
    if (crewId && CREW_BY_ID[crewId].location === 'GEZEGEN') return PARAMS.suitPressure;
    return PARAMS.cabinPressure;
  }
  return sourceForMetric(metric, crewId ? CREW_BY_ID[crewId].location : undefined);
}

export function SourceBadge({ metric, param, crewId }: { metric?: MetricKey; param?: ParamKey | UiParamKey; crewId?: CrewId }) {
  const p = resolve(metric, param, crewId);
  if (!p) return null;
  const label = shortSource(p);
  const title = p.assumption
    ? `Assumption: no NASA or peer-reviewed source${p.url ? ` (context: ${p.source})` : ''}. ${p.label}`
    : `Source: ${label} · ${p.source} — ${p.label}. Click to open the source.`;
  // Clean look: a small gray ⓘ for a sourced number, a small gray "assumption" label for an assumption (no border).
  // The source name shows on hover; clicking opens the source in a new tab.
  if (p.assumption)
    return (
      <span className="shrink-0 font-sans text-xs whitespace-nowrap italic" style={{ color: alpha(COLORS.textMuted, 0.75) }} title={title}>
        assumption
      </span>
    );
  const cls = 'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-sans text-[11px] leading-none transition-colors';
  const style = { color: alpha(COLORS.textMuted, 0.7), boxShadow: `inset 0 0 0 1px ${alpha(COLORS.textMuted, 0.35)}` };
  const mark = (
    <span aria-hidden="true" className="font-semibold">
      i
    </span>
  );
  if (!p.url)
    return (
      <span className={cls} style={style} title={title} aria-label={title}>
        {mark}
      </span>
    );
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noreferrer"
      className={`${cls} hover:!text-calm hover:!shadow-[inset_0_0_0_1px_currentColor]`}
      style={style}
      title={title}
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
    >
      {mark}
    </a>
  );
}

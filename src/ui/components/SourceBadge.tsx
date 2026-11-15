// Parça 3 · Kaynak rozeti. Her sayının yanında durur: NASA-STD-3001 / OSDR / DONKI / hakemli çalışma / Varsayım.
// Tıklayınca PARAMS'taki kaynak linki yeni sekmede açılır. Varsayımlar gri (veri yok / kaynak yok rengi).
//   <SourceBadge metric="env.ppCO2_mmHg" />          ölçümün dayandığı parametre (sourceForMetric)
//   <SourceBadge param="careerDoseLimit" />          doğrudan bir PARAMS anahtarı
//   <SourceBadge metric="env.doseRate_uSv_h" crewId="mert" />  Gezegen ekibinde yüzey doz hızı kaynağı
import { CREW_BY_ID } from '../../crew';
import type { MetricKey } from '../../metrics';
import { PARAMS, sourceForMetric, type Param, type ParamKey } from '../../sim/parameters';
import type { CrewId } from '../../types';
import { UI_PARAMS } from '../params';
import { alpha, COLORS } from '../theme';

type UiParamKey = keyof typeof UI_PARAMS;

/** "Norsk vd. 2015, J Physiol" -> "Norsk 2015"; NASA kaynakları kısa adıyla. */
function shortSource(p: Param): string {
  if (p.assumption) return 'Varsayım';
  const s = p.source;
  if (/NASA-STD-3001|OCHMO/.test(s)) return 'NASA-STD-3001';
  if (/Apollo/.test(s)) return 'NASA Apollo';
  if (/Artemis I/.test(s)) return 'NASA Artemis I';
  if (/^NIH/.test(s)) return 'NIH';
  if (/^ISS gürültü/.test(s)) return 'ISS gürültü';
  const fr = s.match(/^Frontiers.*?(\d{4})/);
  if (fr) return `Frontiers ${fr[1]}`;
  if (/OSDR/.test(s)) return 'OSDR';
  if (/DONKI/.test(s)) return 'DONKI';
  if (/Curiosity RAD/.test(s)) return 'Curiosity RAD';
  if (/NASA HRP/.test(s)) return 'NASA HRP';
  if (/DRA 5\.0/.test(s)) return 'NASA DRA 5.0';
  if (/NTRS/.test(s)) return 'NASA NTRS';
  if (/JEMS/.test(s)) return 'JEMS';
  if (/^Ter biyobelirte/.test(s)) return 'Ter tablosu';
  const m = s.match(/^([A-ZÇĞİÖŞÜ][\p{L}-]+)(?:\s+vd\.)?\s+(\d{4})/u);
  if (m) return `${m[1]} ${m[2]}`;
  return s.length > 18 ? `${s.slice(0, 17)}…` : s;
}

function resolve(metric?: MetricKey, param?: ParamKey | UiParamKey, crewId?: CrewId): Param | undefined {
  if (param) return (PARAMS as Record<string, Param>)[param] ?? (UI_PARAMS as Record<string, Param>)[param];
  if (!metric) return undefined;
  // Doz hızı kişinin yerine göre farklı ölçümden gelir: Kokpit = Mars yolu (RAD), Gezegen = Mars yüzeyi (RAD)
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
  const color = p.assumption ? COLORS.offline : COLORS.calm;
  const title = p.assumption
    ? `Varsayım: NASA ya da hakemli bir kaynağı yok${p.url ? ` (bağlam: ${p.source})` : ''}. ${p.label}`
    : `Kaynak: ${p.source} — ${p.label}. Tıklayınca kaynak açılır.`;
  const cls = 'inline-flex shrink-0 items-center rounded-md px-1.5 py-px font-sans text-sm leading-5 font-medium whitespace-nowrap';
  const style = { color, backgroundColor: alpha(color, 0.1), boxShadow: `inset 0 0 0 1px ${alpha(color, 0.35)}` };
  if (!p.url)
    return (
      <span className={cls} style={style} title={title}>
        {label}
      </span>
    );
  return (
    <a href={p.url} target="_blank" rel="noreferrer" className={`${cls} hover:brightness-125`} style={style} title={title} onClick={(e) => e.stopPropagation()}>
      {label}
    </a>
  );
}

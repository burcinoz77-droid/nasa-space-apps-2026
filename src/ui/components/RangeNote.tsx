// Resmi normal aralık göstergesi (Azra, PR #18): ölçüm resmi kaynağın aralığındaysa ✓ (uyarı verilmez),
// dışındaysa ! (kişisel normalden sapma değerlendirilir). Parça 3 sadeleştirmesinde ortak bileşene taşındı;
// Konsolun seçili astronot sütununda hem temel değerlerde hem bölge ayrıntısındaki her satırda kullanılır.
import { CREW_BY_ID } from '../../crew';
import type { MetricKey } from '../../metrics';
import { normalRangeFor } from '../../sim/parameters';
import type { CrewId } from '../../types';
import { COLORS, fmt } from '../theme';

export function RangeNote({ crewId, k, value, block }: { crewId: CrewId; k: MetricKey; value: number | undefined; block?: boolean }) {
  const r = normalRangeFor(k, CREW_BY_ID[crewId].location);
  if (!r || value === undefined) return null;
  const inside = value >= r[0] && value <= r[1];
  const d = (n: number) => fmt(n, Number.isInteger(n) ? 0 : 1);
  const text = r[0] === 0 ? `≤ ${d(r[1])}` : `${d(r[0])}–${d(r[1])}`;
  return (
    <span
      className={`${block ? 'mt-1 block' : 'ml-1.5'} text-sm whitespace-nowrap`}
      style={{ color: inside ? COLORS.normal : COLORS.caution }}
      title={
        inside
          ? 'Within the official reference range: no alert for this value (see the source badge).'
          : 'Outside the official reference range: deviation from the personal baseline is assessed.'
      }
    >
      ref {text} {inside ? '✓' : '!'}
    </span>
  );
}

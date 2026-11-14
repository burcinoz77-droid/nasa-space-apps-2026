// Parça 3 · Mini grafik. İki çeşit:
//  - Sparkline: Recharts ile, kartlardaki nabız grafiği gibi az sayıda yer için.
//  - TrendLine: saf SVG, tablo satırlarında onlarca tane çizilebilsin diye hafif.
// Seçicide her seferinde yeni [] döndürmeyin; sonsuz render olur. EMPTY sabitini kullanın.
import { useMemo } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, YAxis } from 'recharts';
import { readMetric, type MetricKey } from '../../metrics';
import { useAstra } from '../../store';
import type { CrewId, Telemetry } from '../../types';
import { COLORS } from '../theme';

const EMPTY: Telemetry[] = [];

/** Bir astronotun son ölçümlerinden tek bir ölçümün serisi. */
function useMetricSeries(crewId: CrewId, key: MetricKey): number[] {
  const hist = useAstra((s) => s.history[crewId] ?? EMPTY);
  return useMemo(() => hist.map((t) => readMetric(t, key)), [hist, key]);
}

export function Sparkline({
  crewId,
  metric = 'cardio.hr_bpm',
  color = COLORS.calm,
  height = 40,
  reference,
}: {
  crewId: CrewId;
  metric?: MetricKey;
  color?: string;
  height?: number;
  reference?: number; // kişisel normal gibi yatay çizgi
}) {
  const series = useMetricSeries(crewId, metric);
  const data = useMemo(() => series.map((v) => ({ v })), [series]);
  if (data.length < 2)
    return (
      <div style={{ height }} className="flex items-center text-sm text-slate-500">
        Veri toplanıyor…
      </div>
    );
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={['auto', 'auto']} />
          {reference !== undefined && <ReferenceLine y={reference} stroke={COLORS.textMuted} strokeDasharray="3 3" strokeOpacity={0.6} />}
          <Line dataKey="v" dot={false} stroke={color} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Hafif SVG trend çizgisi (son 60 ölçüm). */
export function TrendLine({ values, color = COLORS.calm, width = 96, height = 24 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const pts = values.slice(-60);
  if (pts.length < 2) return <svg width={width} height={height} aria-hidden />;
  let lo = Math.min(...pts);
  let hi = Math.max(...pts);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - lo) / (hi - lo)) * (height - 4);
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join('');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

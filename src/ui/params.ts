// Parça 3 · Sadece arayüzde kullanılan, kaynaklı sabitler. Biçim PARAMS ile aynı (src/sim/parameters.ts);
// Parça 1 isterse bunları PARAMS'a taşıyabilir, SourceBadge ikisini de okur.
import type { Param } from '../sim/parameters';

export const UI_PARAMS = {
  // Kokpit'teki görev ilerleme halkası: konjonksiyon sınıfı Mars görevi ~180 gün gidiş + ~540 gün Mars + ~180 gün dönüş
  missionDurationDays: {
    label: 'Toplam görev süresi (konjonksiyon sınıfı Mars görevi)',
    value: 900,
    unit: 'gün (yaklaşık)',
    source: 'NASA Mars DRA 5.0 (Drake 2009)',
    url: 'https://ntrs.nasa.gov/api/citations/20090010571/downloads/20090010571.pdf',
  },
} satisfies Record<string, Param>;

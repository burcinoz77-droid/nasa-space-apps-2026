// Simülasyondaki her sabit burada, yanında kaynağıyla. (Sahibi: Parça 1)
// Arayüz bu kaynak linklerini "kaynak rozeti" olarak gösterir.
// "Varsayım" etiketli sayılar NASA kaynağında yoktur; jüriye öyle söylenir.

export interface Param {
  value: number;
  unit: string;
  source: string; // kısa ad
  url?: string;
  assumption?: boolean;
}

export const PARAMS = {
  // Radyasyon
  doseRateMarsTransit: { value: 1.84, unit: 'mSv/gün', source: 'Curiosity RAD, Zeitlin vd. 2013 (SwRI)', url: 'https://www.swri.org/newsroom/press-releases/swri-led-team-calculates-the-radiation-exposure-associated-trip-mars' },
  doseRateMarsSurface: { value: 0.64, unit: 'mSv/gün', source: 'Curiosity RAD, Hassler vd. 2013 (Space.com)', url: 'https://www.space.com/23875-mars-radiation-life-manned-mission.html' },
  careerDoseLimit: { value: 600, unit: 'mSv', source: 'NASA-STD-3001 (OCHMO radyasyon özeti)', url: 'https://www.nasa.gov/sites/default/files/atoms/files/radiation_protection_technical_brief_ochmo.pdf' },
  // İletişim
  commDelayMin: { value: 180, unit: 's (tek yön)', source: 'NASA Mars Relay Network', url: 'https://science.nasa.gov/?p=434038' },
  commDelayMax: { value: 1344, unit: 's (tek yön)', source: 'NASA Mars Relay Network', url: 'https://science.nasa.gov/?p=434038' },
  // Kabin ve giysi atmosferi
  cabinPressure: { value: 101.3, unit: 'kPa', source: 'ISS/Shuttle 14.7 psia, %21 O₂ (NASA NTRS)', url: 'https://ntrs.nasa.gov/api/citations/20240004074/downloads/SHOP%20-%20Variable%20Pressure%20Suit_v2.pdf' },
  suitPressure: { value: 29.6, unit: 'kPa', source: 'EVA giysisi 4.3 psia, %100 O₂ (NASA NTRS)', url: 'https://ntrs.nasa.gov/api/citations/20230007781/downloads/Regulators_ICES2023_Final.pdf' },
  cabinCO2Median: { value: 1.9, unit: 'mmHg', source: 'OSDR EDA, ISS RR-19 medyan 2.516 ppm', url: 'https://visualization.osdr.nasa.gov/eda/' },
  // Kalp-damar
  bpDropInSpace: { value: 8, unit: 'mmHg (sistolik)', source: 'Norsk vd. 2015, J Physiol', url: 'https://pmc.ncbi.nlm.nih.gov/articles/4324706/' },
  hrvRmssdMean: { value: 42, unit: 'ms (SD 15)', source: 'Nunan vd. 2010, kısa süreli HRV normları', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5624990/table/T6' },
  // Sıcaklık
  coreTempRiseInSpace: { value: 1.0, unit: '°C', source: 'Stahn vd. 2017, Sci Rep', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5701078' },
  // Uyku ve bilişsel
  sleepInSpaceMean: { value: 6.09, unit: 'sa', source: 'Barger vd. 2014, Lancet Neurology (ISS)', url: 'https://www.eurekalert.org/news-releases/595450' },
  pvtLapseThreshold: { value: 355, unit: 'ms', source: 'Basner vd. 2011, PVT-B (NASA Reaction Self Test)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197' },
  // Varsayımlar (kaynağı yok; ekranda "Varsayım" rozeti)
  gsrBaseline: { value: 4, unit: 'µS', source: 'Varsayım', assumption: true },
  vocIndexBaseline: { value: 20, unit: '/100', source: 'Varsayım', assumption: true },
} satisfies Record<string, Param>;

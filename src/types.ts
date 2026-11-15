// ============================================================================
// ORTAK VERİ SÖZLEŞMESİ — dört parçanın tek buluşma noktası
// ----------------------------------------------------------------------------
// KURAL: Alan EKLEMEK serbest. Alan SİLMEK, ADINI veya BİRİMİNİ değiştirmek
// yasak; gerekiyorsa önce ekip grubuna yazın, herkes onaylasın.
// Birim her zaman alan adının sonunda yazar: hr_bpm, doseRate_uSv_h ...
// ============================================================================

// ---------- Mürettebat ----------
export type CrewId = 'elif' | 'kerem' | 'zeynep' | 'emir' | 'deniz' | 'mert';
export type CrewLocation = 'KOKPIT' | 'GEZEGEN'; // Kokpit = yörüngedeki gemi, Gezegen = Mars yüzeyi (EVA)

export interface CrewMember {
  id: CrewId;
  name: string; // "Dr. Elif Yılmaz"
  role: string; // "Komutan", "Uçuş Mühendisi", "Görev Uzmanı · Jeolog"
  location: CrewLocation;
  unit: string; // "IVA-01" (gemi içi) | "xEMU-01" (uzay giysisi)
  sensitivity: string; // kartta görünen kişisel risk notu
}

// ---------- Veri grubu 1 · Kalp-damar ----------
export interface Cardio {
  hr_bpm: number; // nabız
  hrv_rmssd_ms: number; // kalp hızı değişkenliği (RMSSD)
  ecg_rhythm: 'sinus' | 'irregular'; // EKG ritmi
  ecg_ectopic_per_min: number; // dakikadaki erken/düzensiz atım
  bp_sys_mmHg: number; // sistolik tansiyon
  bp_dia_mmHg: number; // diyastolik tansiyon
  spo2_pct: number; // kandaki oksijen doygunluğu
}

// ---------- Veri grubu 2 · Solunum ve metabolik ----------
export interface Respiratory {
  rr_bpm: number; // solunum sayısı (nefes/dk)
  minuteVent_L_min: number; // dakika ventilasyonu
  etco2_mmHg: number; // soluk sonu CO2
  coreTemp_C: number; // çekirdek vücut sıcaklığı
  skinTemp_C: number; // deri sıcaklığı
  gsr_uS: number; // galvanik deri tepkisi (mikrosiemens)
}

// ---------- Veri grubu 3 · Biyokimyasal ----------
export interface Biochem {
  vocOxStressIndex: number; // nefeste uçucu bileşik (VOC) oksidatif stres indeksi, 0-100 (varsayım ölçeği)
  sweatCortisol_ng_mL: number; // terde kortizol
  sweatLactate_mM: number; // terde laktat
  sweatSodium_mM: number; // terde sodyum (elektrolit)
}

// ---------- Veri grubu 4 · Psikolojik ve bilişsel ----------
export interface Cognitive {
  pvtMeanRt_ms: number; // PVT-B ortalama tepki süresi
  pvtLapses: number; // PVT-B dikkat kaybı sayısı (tepki >= 355 ms)
  bsi18_gsi: number; // BSI-18 genel şiddet skoru, 0-72
  panasPositive: number; // PANAS olumlu duygu, 10-50
  panasNegative: number; // PANAS olumsuz duygu, 10-50
  speechStrainIndex: number; // konuşma analizi zorlanma indeksi, 0-100 (varsayım ölçeği)
  pupilDiameter_mm: number; // göz bebeği çapı
  pupilLatency_ms: number; // ışığa göz bebeği tepki gecikmesi
}

// ---------- Veri grubu 5 · Çevre ve dış etkenler ----------
export interface Environment {
  doseRate_uSv_h: number; // anlık radyasyon doz hızı
  doseCumulative_mSv: number; // görev boyu toplam doz
  ppCO2_mmHg: number; // kabin ya da giysi içi CO2 kısmi basıncı
  o2_pct: number; // kabin ya da giysi içi O2 yüzdesi
  pressure_kPa: number; // kabin ya da giysi basıncı
  sleepLastNight_h: number; // dün gece uyku süresi
  remPct: number; // REM uykusu oranı
  swsPct: number; // derin (yavaş dalga) uyku oranı
  circadianShift_h: number; // sirkadiyen ritim kayması (saat)
  ambientTemp_C: number; // kabin ya da giysi içi ortam sıcaklığı
  humidity_pct: number; // kabin ya da giysi içi bağıl nem
  noise_dBA: number; // astronotun maruz kaldığı gürültü (kişisel gürültü dozimetresi)
}

// Bir astronotun bir andaki tüm ölçümleri (Parça 1 üretir, herkes okur)
export interface Telemetry {
  crewId: CrewId;
  t: number; // ölçüm zamanı, ms (Date.now() ile aynı ölçek)
  missionDay: number;
  cardio: Cardio;
  resp: Respiratory;
  biochem: Biochem;
  cog: Cognitive;
  env: Environment;
}

// ---------- Gemi ve senaryo (Parça 1 üretir) ----------
export type ScenarioId =
  | 'NORMAL'
  | 'SOLAR_STORM'
  | 'MARS_DAY_180'
  | 'CO2_SCRUBBER_FAIL'
  | 'EVA_OVEREXERTION';

export interface ShipState {
  t: number;
  missionDay: number;
  scenario: ScenarioId;
  commDelayOneWay_s: number; // Dünya-Mars tek yön gecikme (180-1340 s)
  activeEvents: string[]; // örn. ['SPE_ONSET'] — ekranda bilgi olarak
}

export interface Simulation {
  tick(): { ship: ShipState; telemetry: Telemetry[] };
  setScenario(id: ScenarioId): void;
  /** Katman 1 otonom adım uyguladığında çağrılır: sığınak dozu düşürür, havalandırma CO2'yi, dinlenme yorgunluğu. */
  onAutoAction(action: AutoAction): void;
  reset(): void;
}

// ---------- Katman 1 çıktısı (Parça 2 üretir) ----------
export type Level = 'normal' | 'caution' | 'critical';
export type Domain = 'cardio' | 'resp' | 'biochem' | 'cog' | 'env';
export type MetricKey = import('./metrics').MetricKey;

export interface MetricScore {
  key: MetricKey;
  value: number;
  mean: number; // kişisel baseline ortalaması
  sd: number; // kişisel baseline standart sapması
  z: number; // (value - mean) / sd
  streak: number; // eşiği üst üste kaç ölçümdür aşıyor
  level: Level;
}

export interface CrewStatus {
  crewId: CrewId;
  level: Level;
  healthScore: number; // 0-100, ekrandaki "%87"
  domainScores: Record<Domain, number>; // 0-100
  topSignals: MetricScore[]; // en çok sapan 3 ölçüm
  restRequired: boolean; // zorunlu dinlenme verildi mi
}

export type IncidentType =
  | 'RADIATION'
  | 'CO2'
  | 'CARDIO'
  | 'HYPOXIA'
  | 'THERMAL'
  | 'FATIGUE'
  | 'STRESS'
  | 'MULTI';

export type AutoActionType = 'RADIATION_SHELTER' | 'INCREASE_VENTILATION' | 'MANDATORY_REST';

/** Önceden onaylı güvenli adım (sadece bu üç tür). Her biri olay kaydına da yazılır. */
export interface AutoAction {
  type: AutoActionType;
  crewIds: CrewId[];
  at: number;
  reason: string; // "Doz hızı 3 ölçümdür kritik"
  incidentId: string;
}

export interface Incident {
  id: string;
  type: IncidentType;
  level: Exclude<Level, 'normal'>;
  crewIds: CrewId[];
  openedAt: number;
  title: string; // "Elif: uyku + tepki süresi + ruh hali birlikte düşüyor"
  signals: MetricScore[];
  autoActions: AutoActionType[];
  status: 'open' | 'acknowledged' | 'resolved';
}

export interface LedgerEntry {
  id: string;
  at: number;
  kind: 'INCIDENT_OPENED' | 'INCIDENT_RESOLVED' | 'AUTO_ACTION' | 'ACK' | 'SCENARIO' | 'SYSTEM';
  text: string; // Türkçe, ekranda aynen görünür
  incidentId?: string;
  crewIds?: CrewId[];
}

export interface DetectorOutput {
  statuses: Record<CrewId, CrewStatus>;
  incidents: Incident[]; // tüm olaylar (açık + kapanmış), en yeni başta
  newLedger: LedgerEntry[]; // bu adımda oluşan kayıtlar
  newActions: AutoAction[]; // bu adımda başlatılan otonom adımlar (loop.ts simülasyona iletir)
}

export interface Detector {
  process(ship: ShipState, telemetry: Telemetry[]): DetectorOutput;
  acknowledge(incidentId: string): LedgerEntry | null; // insan onayı
  reset(): void;
}

// ---------- Katman 2 (Parça 4) ----------
export type AstraMode = 'chat' | 'incident';

export interface AstraRequest {
  mode: AstraMode;
  question: string;
  context: Record<string, unknown>; // src/ai/context.ts hazırlar
}

export interface AstraAnswer {
  text: string;
  source: 'claude' | 'gemini' | 'fallback' | 'cache';
  verified: boolean; // cevaptaki tüm sayılar veride var mı (src/ai/verify.ts)
  latencyMs: number;
  tools?: string[]; // ASTRA'nın cevap için çağırdığı araçlar, ekranda gösterilir (Parça 4 ekledi)
  fallbackReason?: 'connection' | 'safety'; // yedek cevabın sebebi: bağlantı yok mu, güvenlik süzgeci mi (Parça 4 ekledi)
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'astra';
  text: string;
  at: number;
  answer?: AstraAnswer;
}

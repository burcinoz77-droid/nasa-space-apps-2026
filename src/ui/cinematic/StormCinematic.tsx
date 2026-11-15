// Parça 1 · Güneş fırtınası sinematiği (tam ekran, ~20 sn, her an "Atla" ile kapanır).
//
// Gösteri değil, verinin görselleştirmesi: sahneler zamanlayıcıyla değil, simülasyonun gerçek
// durumuyla ilerler.
//   1. Patlama  : GERÇEK NASA/SDO görüntüsü (10 Mayıs 2024 X3.9, DONKI FLR 30666). Dosya yoksa çizilmiş Güneş.
//   2. Yolculuk : parçacık bulutu Güneş'ten ARES-1'e.          → Kokpit doz hızı 3 katına çıkınca biter
//   3. Çarpma   : canlı doz sayacı (Elif'in ölçümü, µSv/sa).    → Katman 1 RADYASYON olayı açılınca biter
//   4. Tepki    : Katman 1 olayı + otonom sığınak adımı, mürettebat sığınağa geçer, doz düşer.
//   5. Kapanış  : Kokpit'e döner; gerçek olay bandı orada.
// Her sahnenin bir de üst süre sınırı var: veri gecikse bile sinematik takılmaz.
//
// Tetikleme: senaryo SOLAR_STORM'a geçince kendiliğinden oynar. Tekrar oynatmak için:
//   window.dispatchEvent(new Event(CINEMATIC_EVENT))  (Ayarlar'daki düğme bunu yapar)
// Görüntü: NASA/SDO (kamu malı, kaynak gösterilir). NASA logosu kullanılmaz.
import { useEffect, useRef, useState } from 'react';
import { useAstra } from '../../store';
import { PARAMS } from '../../sim/parameters';
import { alpha, COLORS, fmt } from '../theme';

export const CINEMATIC_EVENT = 'astra:storm-cinematic';
const VIDEO_URL = `${import.meta.env.BASE_URL}media/sdo-x39-2024-05-10.mp4`;
const BASE_DOSE = (PARAMS.doseRateMarsTransit.value * 1000) / 24; // 76,7 µSv/sa

type Phase = 'flare' | 'travel' | 'impact' | 'response' | 'outro';

// Sahne süreleri (ms): [en az, en çok]
const LIMITS: Record<Exclude<Phase, 'outro'>, [number, number]> = {
  flare: [6000, 6000],
  travel: [3500, 12000],
  impact: [3000, 9000],
  response: [6500, 6500],
};

export function StormCinematic() {
  const [run, setRun] = useState(0); // 0 = kapalı; her oynatmada artar
  const scenario = useAstra((s) => s.ship?.scenario);
  const prev = useRef(scenario);

  useEffect(() => {
    if (scenario === 'SOLAR_STORM' && prev.current !== 'SOLAR_STORM') setRun((r) => r + 1);
    prev.current = scenario;
  }, [scenario]);

  useEffect(() => {
    const replay = () => setRun((r) => r + 1);
    window.addEventListener(CINEMATIC_EVENT, replay);
    return () => window.removeEventListener(CINEMATIC_EVENT, replay);
  }, []);

  if (!run) return null;
  return <Show key={run} onClose={() => setRun(0)} />;
}

function Show({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('flare');
  const [videoOk, setVideoOk] = useState(true);
  const phaseStart = useRef(0);
  useEffect(() => {
    phaseStart.current = performance.now();
  }, []);
  const dose = useAstra((s) => s.telemetry.elif?.env.doseRate_uSv_h ?? BASE_DOSE);
  const surfaceDose = useAstra((s) => s.telemetry.emir?.env.doseRate_uSv_h ?? 26.7);
  const cumulative = useAstra((s) => s.telemetry.elif?.env.doseCumulative_mSv ?? 0);
  const delay = useAstra((s) => s.ship?.commDelayOneWay_s ?? 750);
  const incident = useAstra((s) => s.incidents.find((i) => i.type === 'RADIATION' && i.level === 'critical' && i.status !== 'resolved'));
  const sheltered = Boolean(incident?.autoActions.includes('RADIATION_SHELTER'));

  // Sahne geçişleri: veri koşulu + en az / en çok süre
  useEffect(() => {
    const id = setInterval(() => {
      const t = performance.now() - phaseStart.current;
      const go = (next: Phase) => {
        phaseStart.current = performance.now();
        setPhase(next);
      };
      if (phase === 'outro') return;
      const [min, max] = LIMITS[phase];
      if (t < min) return;
      if (phase === 'flare') go('travel');
      else if (phase === 'travel' && (dose > BASE_DOSE * 3 || t >= max)) go('impact');
      else if (phase === 'impact' && (incident || t >= max)) go('response');
      else if (phase === 'response') go('outro');
    }, 150);
    return () => clearInterval(id);
  }, [phase, dose, incident]);

  useEffect(() => {
    if (phase !== 'outro') return;
    const id = setTimeout(onClose, 1200);
    return () => clearTimeout(id);
  }, [phase, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const small = phase !== 'flare'; // Güneş köşeye küçülür
  const hot = phase === 'impact' || (phase === 'response' && !sheltered);
  const multiplier = dose / BASE_DOSE;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      style={{ background: '#02040b', opacity: phase === 'outro' ? 0 : 1, transition: 'opacity 1.1s ease' }}
      role="dialog"
      aria-label="Güneş fırtınası sinematiği"
    >
      <Stars />
      <Particles active={phase !== 'flare'} shielded={phase === 'response' && sheltered} />

      {/* Güneş: gerçek SDO görüntüsü (tam ekrandan sol köşeye küçülür) */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: small ? '-9vh' : '50%',
          top: small ? '50%' : '50%',
          width: small ? '46vh' : '92vh',
          height: small ? '46vh' : '92vh',
          transform: 'translate(' + (small ? '0' : '-50%') + ', -50%)',
          borderRadius: '50%',
          boxShadow: `0 0 120px 30px ${alpha('#f59e0b', small ? 0.35 : 0.2)}`,
          transition: 'all 1.6s cubic-bezier(.6,0,.2,1)',
        }}
      >
        {videoOk ? (
          <video
            src={VIDEO_URL}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setVideoOk(false)}
            className="h-full w-full object-cover"
            style={{ transform: 'scale(1.12)' }}
          />
        ) : (
          <DrawnSun />
        )}
      </div>

      {/* 1 · Patlama yazısı */}
      <Caption show={phase === 'flare'} pos="bottom-left">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: COLORS.caution }}>
          {videoOk ? 'GERÇEK GÖRÜNTÜ · NASA/SDO' : 'CANLANDIRMA · VERİ: NASA DONKI'}
        </div>
        <div className="mt-2 text-3xl font-bold md:text-4xl">X3.9 güneş patlaması</div>
        <div className="mt-1 text-lg" style={{ color: COLORS.text }}>
          10 Mayıs 2024 · 06.54 UTC
        </div>
        <div className="mt-3 max-w-md text-sm" style={{ color: COLORS.textMuted }}>
          Bu gerçek olay. Simülasyonumuz NASA DONKI kayıtlarındaki bu fırtınanın, Mars yolundaki ARES-1'e çarptığı anı canlandırıyor.
        </div>
      </Caption>

      {/* Gemi ve Mars (2. sahneden itibaren) */}
      <Ship show={small} hot={hot} sheltered={phase === 'response' && sheltered} />

      {/* 2 · Yolculuk */}
      <Caption show={phase === 'travel'} pos="top">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: COLORS.caution }}>
          PARÇACIK BULUTU YOLDA · GOES &gt;10 MeV
        </div>
        <div className="mt-2 text-2xl font-bold md:text-3xl">ARES-1, Mars yörüngesi · görevin 180. günü</div>
        <div className="mt-2 text-base" style={{ color: COLORS.textMuted }}>
          Dünya'ya mesaj gecikmesi <b style={{ color: COLORS.text }}>{fmtMinSec(delay)}</b>: yer kontrolün uyarısı geldiğinde iş işten geçmiş olur.
        </div>
      </Caption>

      {/* 3 · Çarpma: canlı doz sayacı */}
      <Caption show={phase === 'impact' || phase === 'response'} pos="top-right">
        <div className="font-mono text-xs tracking-[0.3em]" style={{ color: hot ? COLORS.critical : COLORS.normal }}>
          CANLI ÖLÇÜM · KOKPİT DOZ HIZI
        </div>
        <div className="mt-1 font-mono text-6xl font-bold tabular-nums md:text-7xl" style={{ color: hot ? COLORS.critical : COLORS.normal, transition: 'color .6s' }}>
          {fmt(dose, 0)}
        </div>
        <div className="font-mono text-lg" style={{ color: COLORS.text }}>
          µSv/sa · normalin <b>{fmt(multiplier, 0)}</b> katı
        </div>
        <div className="mt-2 font-mono text-sm" style={{ color: COLORS.textMuted }}>
          Mars yüzeyi (atmosfer kalkanı): {fmt(surfaceDose, 0)} µSv/sa
        </div>
        <div className="font-mono text-sm" style={{ color: COLORS.textMuted }}>
          Elif'in toplam dozu: {fmt(cumulative, 1)} / 600 mSv kariyer limiti
        </div>
        {sheltered && (
          <div className="mt-2 text-sm font-semibold" style={{ color: COLORS.normal }}>
            Sığınakta doz hızı yaklaşık %70 düşer (varsayım)
          </div>
        )}
      </Caption>

      {/* 4 · Tepki: Katman 1 + otonom adım */}
      <Caption show={phase === 'response'} pos="bottom-left">
        <div className="rounded-xl border p-4" style={{ borderColor: alpha(COLORS.critical, 0.6), background: alpha('#02040b', 0.75) }}>
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: COLORS.critical }}>
            ASTRA · KATMAN 1 · {incident ? 'KRİTİK OLAY AÇILDI' : 'ANOMALİ TESPİT EDİLİYOR'}
          </div>
          <div className="mt-1 text-xl font-bold">Radyasyon: doz hızı kişisel normalin çok üstünde</div>
          <div className="mt-3 flex items-center gap-2 text-base" style={{ color: sheltered ? COLORS.normal : COLORS.textMuted }}>
            <span>{sheltered ? '✓' : '…'}</span>
            <span>
              Otonom adım: <b>radyasyon sığınağına geçiş</b> {sheltered ? '(başlatıldı)' : '(bekleniyor)'}
            </span>
          </div>
          <div className="mt-1 text-sm" style={{ color: COLORS.textMuted }}>
            İnsan onayı beklemeden, önceden onaylı güvenli adım. Son karar mürettebatta.
          </div>
        </div>
      </Caption>

      {/* Atla */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full border px-4 py-1.5 text-sm backdrop-blur hover:bg-white/10"
        style={{ borderColor: alpha(COLORS.text, 0.3), color: COLORS.text }}
      >
        Atla ✕
      </button>
      <div className="absolute right-4 bottom-3 font-mono text-[11px]" style={{ color: alpha(COLORS.text, 0.45) }}>
        {videoOk ? 'Görüntü: NASA/SDO · ' : ''}Olay zamanları: NASA DONKI · Doz: ARES-1 simülasyonu (canlı)
      </div>
    </div>
  );
}

// ---------- Parçalar ----------

function Caption({ show, pos, children }: { show: boolean; pos: 'top' | 'bottom-left' | 'top-right'; children: React.ReactNode }) {
  const place: React.CSSProperties =
    pos === 'top'
      ? { top: '7vh', left: '50%', transform: `translate(-50%, ${show ? 0 : -12}px)`, textAlign: 'center' }
      : pos === 'bottom-left'
        ? { bottom: '8vh', left: '5vw', transform: `translateY(${show ? 0 : 12}px)` }
        : { top: '6vh', right: '5vw', transform: `translateY(${show ? 0 : -12}px)`, textAlign: 'right' };
  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{ ...place, opacity: show ? 1 : 0, transition: 'opacity .7s ease, transform .7s ease', color: COLORS.text, textShadow: '0 2px 12px #000' }}
    >
      {children}
    </div>
  );
}

function DrawnSun() {
  return (
    <div
      className="h-full w-full"
      style={{
        background: 'radial-gradient(circle at 62% 58%, #fff7d6 0%, #fde047 6%, #f59e0b 22%, #c2410c 55%, #7c2d12 78%, #1c0a04 100%)',
        animation: 'astra-pulse 2.4s ease-in-out infinite',
      }}
    />
  );
}

/** ARES-1 ve Mars (sağ tarafta). sheltered: mürettebat sığınakta, kalkan parlar. */
function Ship({ show, hot, sheltered }: { show: boolean; hot: boolean; sheltered: boolean }) {
  const crewColor = sheltered ? COLORS.normal : hot ? COLORS.critical : COLORS.calm;
  return (
    <div
      className="absolute"
      style={{ right: '4vw', top: '50%', width: '44vw', height: '64vh', transform: 'translateY(-50%)', opacity: show ? 1 : 0, transition: 'opacity 1.4s ease .6s' }}
    >
      <svg viewBox="0 0 600 420" className="h-full w-full overflow-visible">
        <defs>
          <radialGradient id="mars" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#d97757" />
            <stop offset="55%" stopColor="#9a3b22" />
            <stop offset="100%" stopColor="#3b130a" />
          </radialGradient>
          <radialGradient id="shield" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor={COLORS.normal} stopOpacity="0" />
            <stop offset="100%" stopColor={COLORS.normal} stopOpacity="0.55" />
          </radialGradient>
        </defs>
        {/* Mars */}
        <circle cx="470" cy="300" r="120" fill="url(#mars)" />
        <circle cx="470" cy="300" r="124" fill="none" stroke="#f0a58a" strokeOpacity="0.25" strokeWidth="6" />
        {/* Gezegen ekibi (yüzey) */}
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={420 + i * 22} cy={198 + Math.abs(i - 1) * 4} r="5" fill={crewColor} />
        ))}
        <text x="470" y="440" textAnchor="middle" fill={COLORS.textMuted} fontSize="15">
          Gezegen ekibi · yüzey · atmosfer kalkanı
        </text>

        {/* Yörüngedeki ARES-1 */}
        <g transform="translate(150 130)" style={{ filter: hot ? 'drop-shadow(0 0 18px #f87171)' : 'none', transition: 'filter .5s' }}>
          <rect x="-90" y="-22" width="180" height="44" rx="14" fill="#1e293b" stroke={hot ? COLORS.critical : '#64748b'} strokeWidth="2" />
          <rect x="-150" y="-10" width="56" height="20" fill="#1e3a5f" stroke="#38bdf8" strokeWidth="1" />
          <rect x="94" y="-10" width="56" height="20" fill="#1e3a5f" stroke="#38bdf8" strokeWidth="1" />
          {/* Sığınak bölmesi (su duvarlı) */}
          <rect x="20" y="-16" width="62" height="32" rx="8" fill={sheltered ? alpha(COLORS.normal, 0.25) : '#0f172a'} stroke={sheltered ? COLORS.normal : '#475569'} strokeDasharray="4 3" />
          <text x="51" y="40" textAnchor="middle" fill={sheltered ? COLORS.normal : COLORS.textMuted} fontSize="12">
            sığınak
          </text>
          {/* Kokpit ekibi: sığınağa kayar */}
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              r="6"
              fill={crewColor}
              style={{
                transform: `translate(${sheltered ? 36 + i * 15 : -62 + i * 22}px, 0px)`,
                transition: `transform 1.6s cubic-bezier(.6,0,.2,1) ${i * 0.15}s, fill .5s`,
              }}
            />
          ))}
          {sheltered && <circle r="120" fill="url(#shield)" />}
        </g>
        <text x="150" y="80" textAnchor="middle" fill={COLORS.text} fontSize="17" fontWeight="700">
          ARES-1 · Kokpit ekibi
        </text>
      </svg>
    </div>
  );
}

/** Yıldız alanı (bir kez çizilir). */
function Stars() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.6})`;
      const r = Math.random() * 1.3;
      ctx.beginPath();
      ctx.arc(Math.random() * c.width, Math.random() * c.height, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

/** Güneş'ten gemiye akan parçacıklar. shielded: gemiye ulaşmadan sönerler. */
function Particles({ active, shielded }: { active: boolean; shielded: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef({ active, shielded });
  useEffect(() => {
    state.current = { active, shielded };
  }, [active, shielded]);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const W = (c.width = window.innerWidth);
    const H = (c.height = window.innerHeight);
    const sun = { x: W * 0.06, y: H * 0.5 };
    const ship = { x: W * 0.96 - W * 0.44 + (150 / 600) * W * 0.44, y: H * 0.5 - H * 0.32 + (130 / 420) * H * 0.64 };
    type P = { x: number; y: number; vx: number; vy: number; life: number };
    const ps: P[] = [];
    let raf = 0;
    const spawn = () => {
      const a = Math.atan2(ship.y - sun.y, ship.x - sun.x) + (Math.random() - 0.5) * 0.9;
      const v = 6 + Math.random() * 9;
      ps.push({ x: sun.x + Math.cos(a) * H * 0.2, y: sun.y + Math.sin(a) * H * 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 });
    };
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      if (state.current.active) for (let i = 0; i < 14; i++) spawn();
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.x += p.vx;
        p.y += p.vy;
        const d = Math.hypot(p.x - ship.x, p.y - ship.y);
        if (state.current.shielded && d < 130) p.life -= 0.25; // kalkana çarpıp söner
        if (p.x > W + 20 || p.y < -20 || p.y > H + 20 || p.life <= 0) {
          ps.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(253, 186, 116, ${0.55 * p.life})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

function fmtMinSec(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m} dk ${r} sn`;
}

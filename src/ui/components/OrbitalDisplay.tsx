// Parça 3 · Kokpit'in yörünge ekranı: tel çerçeve Mars (ortografik izdüşüm), ARES-1'in yörüngesi ve
// Gezegen ekibinin EVA bölgesi. Görev kontrol konsolundaki vektör ekranlar gibi: çizgi, ızgara, işaret.
// Renk = anlam: gemi işareti Kokpit ekibinin, yüzey işareti Gezegen ekibinin en kötü seviyesiyle boyanır;
// KRİTİK'te işaret nabız gibi atar. Gezegen kırmızı değil (kırmızı kritik için ayrıldı).
// Canvas'a çizilir; React her karede yeniden çizmez. prefers-reduced-motion'da sabit kare çizilir.
import { useEffect, useRef } from 'react';
import type { Level } from '../../types';
import { alpha, COLORS, LEVEL_COLOR } from '../theme';

const DEG = Math.PI / 180;
// EVA bölgesi (kurgusal koordinat; ekranda sayı olarak gösterilmez)
const SITE = { lat: 18 * DEG, lon: 77 * DEG };
// Yüzeyde birkaç krater halkası: gezegene doku verir, karikatür olmadan
const CRATERS = [
  { lat: -22, lon: 40, r: 9 },
  { lat: 35, lon: 110, r: 6 },
  { lat: -5, lon: 95, r: 4 },
  { lat: 48, lon: 30, r: 5 },
  { lat: -40, lon: 120, r: 7 },
  { lat: 8, lon: 15, r: 3.5 },
];
const TILT = 22 * DEG; // bakış açısı: ekvatorun biraz üstünden
const INCLINATION = 28 * DEG; // yörünge eğikliği (görsel)
const ORBIT_K = 1.32; // yörünge yarıçapı / gezegen yarıçapı (görsel)

export interface OrbitalMarkers {
  ship: Level | undefined; // Kokpit ekibinin en kötü seviyesi
  surface: Level | undefined; // Gezegen ekibinin en kötü seviyesi
}

type Vec = { x: number; y: number; z: number }; // z > 0: izleyiciye bakan yüz

/** Küre üstündeki (enlem, boylam) noktayı bakış uzayına çevirir: önce boylam dönmesi, sonra eğiklik. */
function sphere(lat: number, lon: number, rot: number): Vec {
  const l = lon - rot;
  const x = Math.cos(lat) * Math.sin(l);
  const y0 = Math.sin(lat);
  const z0 = Math.cos(lat) * Math.cos(l);
  return { x, y: y0 * Math.cos(TILT) - z0 * Math.sin(TILT), z: y0 * Math.sin(TILT) + z0 * Math.cos(TILT) };
}

/** Yörüngedeki açı θ → bakış uzayı (yörünge gezegenle dönmez). */
function orbitPoint(theta: number): Vec {
  const x = ORBIT_K * Math.cos(theta);
  const yo = ORBIT_K * Math.sin(theta) * Math.sin(INCLINATION);
  const zo = ORBIT_K * Math.sin(theta) * Math.cos(INCLINATION);
  return { x, y: yo * Math.cos(TILT) - zo * Math.sin(TILT), z: yo * Math.sin(TILT) + zo * Math.cos(TILT) };
}

/** Bakış uzayındaki nokta gezegenin arkasında mı kalıyor? */
const hidden = (p: Vec) => p.z < 0 && p.x * p.x + p.y * p.y < 1;

function readFont(canvas: HTMLCanvasElement) {
  const ff = getComputedStyle(canvas).fontFamily || 'sans-serif';
  return (weight: number, size: number) => `${weight} ${size}px ${ff}`;
}

/** height verilmezse kapsayıcının kalan yüksekliğini doldurur (en az 280 px). */
export function OrbitalDisplay({ markers, height }: { markers: OrbitalMarkers; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markersRef = useRef(markers);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const font = readFont(canvas);
    let w = 0;
    let h = 0;
    let raf = 0;
    const t0 = performance.now();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = wrap.clientWidth;
      h = wrap.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const { ship, surface } = markersRef.current;
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.5;
      const cy = h * 0.52;
      const R = Math.min(w / (2 * ORBIT_K + 0.35), h / 2.25);
      const P = (p: Vec) => [cx + p.x * R, cy - p.y * R] as const;
      // Gezegen yavaşça sağa sola salınır: EVA bölgesi hep görünür kalır
      const rot = SITE.lon + (still ? -0.35 : Math.sin(t / 14) * 0.75 - 0.2);

      // --- Atmosfer halesi ve gövde
      const halo = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.22);
      halo.addColorStop(0, alpha(COLORS.calm, 0.22));
      halo.addColorStop(1, alpha(COLORS.calm, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2);
      ctx.fill();

      const body = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, alpha(COLORS.calm, 0.16));
      body.addColorStop(0.7, alpha(COLORS.panel, 0.95));
      body.addColorStop(1, COLORS.bg);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // --- Yörüngenin arka yarısı (gezegenin arkasında kalan kısım)
      const N = 180;
      const theta = still ? 2.2 : t * 0.32;
      const strokeOrbit = (front: boolean) => {
        ctx.beginPath();
        let pen = false;
        for (let i = 0; i <= N; i++) {
          const p = orbitPoint((i / N) * Math.PI * 2);
          const show = front ? p.z >= 0 || !hidden(p) : p.z < 0;
          const [x, y] = P(p);
          if (show) {
            if (pen) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
            pen = true;
          } else pen = false;
        }
        ctx.stroke();
      };
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = alpha(COLORS.calm, 0.18);
      strokeOrbit(false);

      // --- Izgara: meridyenler ve paraleller (ön yüz parlak, arka yüz çizilmez)
      const line = (pts: Vec[], a: number) => {
        ctx.strokeStyle = alpha(COLORS.calm, a);
        ctx.beginPath();
        let pen = false;
        for (const p of pts) {
          const [x, y] = P(p);
          if (p.z > 0) {
            if (pen) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
            pen = true;
          } else pen = false;
        }
        ctx.stroke();
      };
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      for (let lon = 0; lon < 360; lon += 20) {
        const pts: Vec[] = [];
        for (let lat = -90; lat <= 90; lat += 3) pts.push(sphere(lat * DEG, lon * DEG, rot));
        line(pts, lon % 60 === 0 ? 0.32 : 0.14);
      }
      for (let lat = -60; lat <= 60; lat += 20) {
        const pts: Vec[] = [];
        for (let lon = 0; lon <= 360; lon += 3) pts.push(sphere(lat * DEG, lon * DEG, rot));
        line(pts, lat === 0 ? 0.42 : 0.14);
      }
      // Kraterler
      ctx.lineWidth = 1;
      for (const c of CRATERS) {
        const pts: Vec[] = [];
        for (let a = 0; a <= 360; a += 15) {
          const lat = c.lat + c.r * Math.sin(a * DEG);
          const lon = c.lon + (c.r * Math.cos(a * DEG)) / Math.max(0.2, Math.cos(c.lat * DEG));
          pts.push(sphere(lat * DEG, lon * DEG, rot));
        }
        line(pts, 0.28);
      }

      // --- Gece yarısı: sağ alttan koyulaşan gölge (gün-gece sınırı)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      const night = ctx.createLinearGradient(cx - R * 0.2, cy - R * 0.6, cx + R, cy + R * 0.5);
      night.addColorStop(0, alpha(COLORS.bg, 0));
      night.addColorStop(0.55, alpha(COLORS.bg, 0.55));
      night.addColorStop(1, alpha(COLORS.bg, 0.9));
      ctx.fillStyle = night;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();

      // Gezegen kenarı
      ctx.strokeStyle = alpha(COLORS.calm, 0.65);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // --- Yüzey işareti: Gezegen ekibi (EVA)
      const site = sphere(SITE.lat, SITE.lon, rot);
      const [sx, sy] = P(site);
      drawMarker(ctx, sx, sy, surface, t, still, 'square');
      label(ctx, font, sx, sy, 'Surface team · EVA', surface, w, 'below');

      // --- Yörüngenin ön yarısı, gemi ve iz
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = alpha(COLORS.calm, 0.45);
      strokeOrbit(true);
      ctx.setLineDash([]);
      // Geminin arkasındaki parlak iz
      const trail = 26;
      for (let i = trail; i > 0; i--) {
        const a = orbitPoint(theta - i * 0.6 * DEG * 3);
        const b = orbitPoint(theta - (i - 1) * 0.6 * DEG * 3);
        if (hidden(a) || hidden(b)) continue;
        const [ax, ay] = P(a);
        const [bx, by] = P(b);
        ctx.strokeStyle = alpha(COLORS.calm, 0.75 * (1 - i / trail));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      const sp = orbitPoint(theta);
      if (!hidden(sp)) {
        const [px, py] = P(sp);
        drawMarker(ctx, px, py, ship, t, still, 'diamond');
        label(ctx, font, px, py, 'ARES-1', ship, w, py < cy ? 'above' : 'below');
      }

      if (!still) raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (still) draw(performance.now());
    });
    ro.observe(wrap);
    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    start();
    // Hareketsiz modda: yazı tipi yüklenince ve işaret seviyesi değişince bir kez yeniden çiz
    const redraw = () => still && draw(performance.now());
    document.fonts?.ready.then(redraw);
    canvas.addEventListener('redraw', redraw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('redraw', redraw);
    };
  }, []);

  // Seviye değişince çizim döngüsü yeni rengi okusun; hareketsiz modda bir kez yeniden çiz
  useEffect(() => {
    markersRef.current = markers;
    canvasRef.current?.dispatchEvent(new Event('redraw'));
  }, [markers]);

  return (
    <div ref={wrapRef} className={`relative w-full ${height ? '' : 'min-h-[280px] flex-1'}`} style={height ? { height } : undefined}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 font-sans"
        role="img"
        aria-label={`Mars orbit display. ARES-1 ship: ${markers.ship ?? 'no data'}. Surface team EVA zone: ${markers.surface ?? 'no data'}.`}
      />
    </div>
  );
}

function levelColor(level: Level | undefined) {
  return level ? LEVEL_COLOR[level] : COLORS.offline;
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, level: Level | undefined, t: number, still: boolean, shape: 'square' | 'diamond') {
  const c = levelColor(level);
  // KRİTİK: genişleyen halka (dikkat çeker); diğerlerinde sakin halka
  if (level === 'critical' && !still) {
    const k = (t % 1.4) / 1.4;
    ctx.strokeStyle = alpha(c, 0.8 * (1 - k));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 8 + k * 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = alpha(c, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = c;
  ctx.beginPath();
  if (shape === 'diamond') {
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 6, y);
  } else {
    ctx.rect(x - 4.5, y - 4.5, 9, 9);
  }
  ctx.closePath();
  ctx.fill();
}

function label(
  ctx: CanvasRenderingContext2D,
  font: (w: number, s: number) => string,
  x: number,
  y: number,
  text: string,
  level: Level | undefined,
  w: number,
  where: 'above' | 'below',
) {
  ctx.font = font(600, 14);
  const tw = ctx.measureText(text).width;
  const pad = 6;
  let lx = x + 16;
  if (lx + tw + pad * 2 > w - 4) lx = x - 16 - tw - pad * 2;
  const ly = where === 'above' ? y - 30 : y + 14;
  // ince bağlantı çizgisi
  ctx.strokeStyle = alpha(COLORS.text, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + (lx > x ? 8 : -8), y + (where === 'above' ? -8 : 8));
  ctx.lineTo(lx > x ? lx : lx + tw + pad * 2, ly + 11);
  ctx.stroke();
  ctx.fillStyle = alpha(COLORS.bg, 0.82);
  ctx.strokeStyle = alpha(levelColor(level), 0.6);
  ctx.beginPath();
  ctx.roundRect(lx, ly, tw + pad * 2, 22, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.text;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, lx + pad, ly + 11.5);
}

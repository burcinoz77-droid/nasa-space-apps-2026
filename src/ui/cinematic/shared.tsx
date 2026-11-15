// Parça 1 · Sinematiklerin ortak parçaları: çerçeve, yıldız alanı, alt yazı kutusu, sahne makinesi.
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { alpha, COLORS } from '../theme';

/** Tam ekran çerçeve: koyu arka plan, yıldızlar, Atla düğmesi, Esc, alt kaynak satırı, kapanışta solma. */
export function Stage({ fading, onClose, credit, label, children }: { fading: boolean; onClose: () => void; credit: string; label: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      style={{ background: '#02040b', opacity: fading ? 0 : 1, transition: 'opacity 1.1s ease' }}
      role="dialog"
      aria-label={label}
    >
      <Stars />
      {children}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 rounded-full border px-4 py-1.5 text-sm backdrop-blur hover:bg-white/10"
        style={{ borderColor: alpha(COLORS.text, 0.3), color: COLORS.text }}
      >
        Atla ✕
      </button>
      <div className="absolute right-4 bottom-3 z-20 font-mono text-[11px]" style={{ color: alpha(COLORS.text, 0.45) }}>
        {credit}
      </div>
    </div>
  );
}

export function Caption({ show, pos, children }: { show: boolean; pos: 'top' | 'bottom-left' | 'top-right'; children: ReactNode }) {
  const place: CSSProperties =
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

/** Yıldız alanı (bir kez çizilir). */
export function Stars() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.6})`;
      ctx.beginPath();
      ctx.arc(Math.random() * c.width, Math.random() * c.height, Math.random() * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

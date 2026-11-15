// Parça 3 · Konsol paneli. Paneller 1 px aralıklı ızgarada yan yana durur (gölge yok, kart yok); her panelin
// görünür bir başlığı var (NASA-STD-3001: her ekranın kalıcı, benzersiz bir başlığı olmalı). Gövde kendi içinde kayar.
import type { ReactNode } from 'react';

export type Area = 'mis' | 'ai' | 'med' | 'det' | 'crew' | 'earth';

export function Tile({
  area,
  title,
  meta,
  header,
  children,
  bodyClass = 'p-3',
}: {
  area: Area;
  title: string;
  meta?: ReactNode;
  header?: ReactNode; // başlık satırının yerine (örn. sekmeler); title yine erişilebilir ad olur
  children: ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col bg-space-panel" style={{ gridArea: area }} data-area={area} aria-label={title}>
      {header ?? (
        <header className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-space-border px-3 py-2">
          <h2 className="truncate text-[15px] font-semibold text-white">{title}</h2>
          {meta && <div className="flex shrink-0 items-center gap-2 text-sm text-slate-400">{meta}</div>}
        </header>
      )}
      <div className={`tile-body min-h-0 flex-1 overflow-auto ${bodyClass}`}>{children}</div>
    </section>
  );
}

/** Sekmeli panel başlığı: sekmeler başlığın kendisidir. */
export function TabHeader<T extends string>({
  tabs,
  value,
  onChange,
  label,
  right,
}: {
  tabs: { id: T; label: string; badge?: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex min-h-11 shrink-0 items-stretch justify-between gap-2 border-b border-space-border px-1.5">
      <div className="flex min-w-0 items-stretch" role="tablist" aria-label={label}>
        {tabs.map((t) => {
          const on = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t.id)}
              className={`relative flex items-center gap-1.5 px-2.5 text-sm whitespace-nowrap transition-colors ${on ? 'font-semibold text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t.label}
              {t.badge}
              {on && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-calm" aria-hidden />}
            </button>
          );
        })}
      </div>
      {right && <div className="flex shrink-0 items-center pr-1.5">{right}</div>}
    </header>
  );
}

/** Etiket solda, değer sağda (NASA-STD-3001: etiket değerin solunda). */
export function Row({ label, children, sub, mono = false }: { label: string; children: ReactNode; sub?: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-space-border/60 py-1.5 last:border-b-0">
      <span className="shrink-0 text-sm text-slate-400">{label}</span>
      <span className="min-w-0 text-right">
        <span className={`text-base text-white ${mono ? 'font-mono' : 'font-medium'}`}>{children}</span>
        {sub && <span className="block text-sm text-slate-400">{sub}</span>}
      </span>
    </div>
  );
}

// Uygulama iskeleti: yan menü + üst bar + sayfa (Sahibi: Parça 3).
// Sayfa sahipleri: Kokpit/Astronot Ekranı/Astronotlar = Parça 3,
// Raporlar = Parça 2, Ayarlar = Parça 1, Görevler ve ASTRA sohbet paneli = Parça 4.
import { useEffect, useState } from 'react';
import { AstraChatPanel } from './ui/components/AstraChatPanel';
import { AstronotEkrani } from './ui/pages/AstronotEkrani';
import { Astronotlar } from './ui/pages/Astronotlar';
import { Ayarlar } from './ui/pages/Ayarlar';
import { Gorevler } from './ui/pages/Gorevler';
import { Kokpit } from './ui/pages/Kokpit';
import { Raporlar } from './ui/pages/Raporlar';
import { SCENARIO_NAMES } from './loop';
import { useAstra } from './store';

const PAGES = {
  kokpit: { label: 'Kokpit', el: <Kokpit /> },
  astronot: { label: 'Astronot Ekranı', el: <AstronotEkrani /> },
  astronotlar: { label: 'Astronotlar', el: <Astronotlar /> },
  gorevler: { label: 'Görevler', el: <Gorevler /> },
  raporlar: { label: 'Raporlar', el: <Raporlar /> },
  ayarlar: { label: 'Ayarlar', el: <Ayarlar /> },
} as const;
type PageId = keyof typeof PAGES;

export default function App() {
  const [page, setPage] = useState<PageId>('kokpit');
  const ship = useAstra((s) => s.ship);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-full">
      <aside className="flex w-60 flex-col gap-1 border-r border-space-border bg-space-panel p-4">
        <div className="mb-6">
          <div className="text-xl font-bold">Orbitalis</div>
          <div className="font-mono text-xs tracking-widest text-calm">ASTRA-MED OS</div>
        </div>
        {(Object.keys(PAGES) as PageId[]).map((id) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`rounded-lg px-3 py-2 text-left ${page === id ? 'bg-calm/15 text-calm ring-1 ring-calm/50' : 'text-slate-300 hover:bg-white/5'}`}
          >
            {PAGES[id].label}
          </button>
        ))}
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{PAGES[page].label}</h1>
          <div className="flex items-center gap-4 font-mono text-sm text-slate-300">
            <span>Görev günü {ship?.missionDay ?? '—'}</span>
            <span>Senaryo: {ship ? SCENARIO_NAMES[ship.scenario] : '—'}</span>
            <span>Dünya gecikmesi: {ship ? Math.round(ship.commDelayOneWay_s / 60) : '—'} dk (tek yön)</span>
            <span className="text-safe">● Canlı {now.toLocaleTimeString('tr-TR')}</span>
          </div>
        </header>
        {PAGES[page].el}
      </main>
      <AstraChatPanel />
    </div>
  );
}

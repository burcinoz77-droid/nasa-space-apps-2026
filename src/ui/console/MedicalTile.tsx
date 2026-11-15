// Parça 3 · Konsol: "Revir" paneli, üç sekme.
//  İlaç durumu: kitteki ilaçlar ve kalan miktar (eşiğin altı sarı).
//  Teşhisler  : uçuş cerrahının Dünya'dan gönderdiği teşhisler + ASTRA'nın bulguları (bulgu teşhis değildir).
//  Tedavi     : otomatik güvenli adımlar (Katman 1) ve cerrahın talimatları; uygulanınca ilaç stoktan düşer.
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ACTION_LABELS } from '../../engine';
import { useAstra } from '../../store';
import { type GroundMessage, useEarth } from '../earthLink';
import { firstName } from '../format';
import { GROUND, MED_BY_ID, MED_KIT, MED_SOURCE } from '../medical';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON } from '../theme';
import { TabHeader, Tile } from './Tile';

type TabId = 'ilac' | 'teshis' | 'tedavi';
const time = (ms: number) => new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export function MedicalTile() {
  const [tab, setTab] = useState<TabId>('ilac');
  const stock = useEarth((s) => s.stock);
  const messages = useEarth((s) => s.messages);
  const orders = messages.filter((m): m is GroundMessage => m.kind === 'ground' && !!m.diagnosis);
  const pending = orders.filter((m) => !m.applied).length;
  const low = MED_KIT.filter((m) => stock[m.id] <= m.min).length;

  const dot = (n: number, color: string) =>
    n > 0 ? (
      <span className="rounded-full px-1.5 font-mono text-sm leading-5" style={{ color: COLORS.bg, backgroundColor: color }}>
        {n}
      </span>
    ) : null;

  return (
    <Tile
      area="med"
      title="Revir"
      bodyClass="p-0"
      header={
        <TabHeader<TabId>
          label="Revir"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'ilac', label: 'İlaç durumu', badge: dot(low, COLORS.caution) },
            { id: 'teshis', label: 'Teşhisler' },
            { id: 'tedavi', label: 'Tedavi', badge: dot(pending, COLORS.calm) },
          ]}
        />
      }
    >
      {tab === 'ilac' && <Medicines />}
      {tab === 'teshis' && <Diagnoses orders={orders} />}
      {tab === 'tedavi' && <Treatments orders={orders} />}
    </Tile>
  );
}

function Medicines() {
  const stock = useEarth((s) => s.stock);
  return (
    <>
      <ul>
        {MED_KIT.map((m) => {
          const n = stock[m.id];
          const lowStock = n <= m.min;
          const c = lowStock ? COLORS.caution : COLORS.calm;
          return (
            <li key={m.id} className="flex items-center gap-3 border-b border-space-border/60 px-3 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{m.name}</span>
                <span className="block truncate text-sm text-slate-400">{m.use}</span>
              </span>
              <span className="w-[92px] shrink-0 text-right">
                <span className="font-mono text-base" style={{ color: lowStock ? COLORS.caution : COLORS.text }}>
                  {lowStock && '▲ '}
                  {fmt(n)} <span className="text-sm text-slate-400">{m.unit}</span>
                </span>
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                  <span className="block h-full" style={{ width: `${Math.min(100, (n / m.full) * 100)}%`, backgroundColor: c }} />
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="px-3 py-2 text-sm text-slate-400">
        ▲ eşiğin altında, ikmal planlanmalı. Kit içeriği:{' '}
        <a href={MED_SOURCE.url} target="_blank" rel="noreferrer" className="text-calm underline-offset-2 hover:underline" title={MED_SOURCE.note}>
          {MED_SOURCE.label}
        </a>
        ; miktarlar senaryo varsayımı.
      </p>
    </>
  );
}

function Diagnoses({ orders }: { orders: GroundMessage[] }) {
  const findings = useAstra(useShallow((s) => s.incidents.filter((i) => i.status !== 'resolved')));
  return (
    <div className="space-y-3 p-3">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-slate-300">
          {GROUND.role} · {GROUND.station}
        </h3>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400">Henüz teşhis yok. Durum bildirmek için "Ana istasyon" panelinden uçuş cerrahına yazın.</p>
        ) : (
          <ul className="space-y-1.5">
            {[...orders].reverse().map((m) => (
              <li key={m.id} className="rounded-md bg-white/[0.04] px-2.5 py-1.5 text-sm">
                <span className="font-semibold text-white">{m.crewId ? firstName(m.crewId) : 'Ekip'}</span>
                <span className="text-slate-400"> · {time(m.at)}</span>
                <span className="block text-slate-200">{m.diagnosis}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-ai">✦ ASTRA bulguları · teşhis değildir</h3>
        {findings.length === 0 ? (
          <p className="text-sm text-slate-400">Açık bulgu yok.</p>
        ) : (
          <ul className="space-y-1">
            {findings.map((i) => (
              <li key={i.id} className="flex gap-2 text-sm">
                <span style={{ color: LEVEL_COLOR[i.level] }} aria-hidden>
                  {LEVEL_ICON[i.level]}
                </span>
                <span className="text-slate-200">{i.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Treatments({ orders }: { orders: GroundMessage[] }) {
  const auto = useAstra(useShallow((s) => s.incidents.filter((i) => i.status !== 'resolved' && i.autoActions.length > 0)));
  const stock = useEarth((s) => s.stock);
  const applyOrder = useEarth((s) => s.applyOrder);
  return (
    <div className="space-y-3 p-3">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-slate-300">Uçuş cerrahının talimatları</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400">Talimat yok.</p>
        ) : (
          <ul className="space-y-2">
            {[...orders].reverse().map((m) => {
              const med = m.med ? MED_BY_ID[m.med] : undefined;
              return (
                <li key={m.id} className="rounded-md px-2.5 py-2 text-sm" style={{ backgroundColor: alpha(COLORS.calm, 0.07) }}>
                  <p className="text-slate-100">{m.text}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {med && (
                      <span className="rounded px-2 py-0.5 font-mono" style={{ color: COLORS.calm, backgroundColor: alpha(COLORS.calm, 0.12) }}>
                        {med.name} · kalan {fmt(stock[med.id])} {med.unit}
                      </span>
                    )}
                    {m.applied ? (
                      <span className="ml-auto" style={{ color: COLORS.normal }}>
                        ✓ uygulandı
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => applyOrder(m.id)}
                        className="ml-auto rounded px-2.5 py-0.5 font-semibold text-white ring-1 ring-calm hover:bg-calm/15"
                      >
                        Uygulandı olarak işaretle
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-1 text-sm font-semibold text-slate-300">Otomatik güvenli adımlar · Katman 1</h3>
        {auto.length === 0 ? (
          <p className="text-sm text-slate-400">Şu an uygulanan otomatik adım yok.</p>
        ) : (
          <ul className="space-y-1">
            {auto.map((i) =>
              i.autoActions.map((a) => (
                <li key={`${i.id}-${a}`} className="text-sm text-slate-200">
                  <span style={{ color: COLORS.calm }}>✓ {ACTION_LABELS[a]}</span> · {i.crewIds.map(firstName).join(', ')}
                </li>
              )),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

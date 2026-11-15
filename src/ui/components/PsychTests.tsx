// Parça 4 · Astronot Ekranı "Testler" sekmesi: psikolojik durum, ASTRA'nın test önerileri, üç resmi test ve geçmiş.
// Test soruları instruments.ts'teki resmi maddelerdir (NASA-TLX, Samn-Perelli) ve PVT-B Basner vd. 2011'e göre çalışır.
// Bu sekme uyarı açmaz. PVT-B sonucu telemetriye yazılır; uyarı gerekiyorsa onu Katman 1 açar.
import { useEffect, useRef, useState } from 'react';
import { shortName } from '../../ai/labels';
import { dueTests, psychState, type DueTest } from '../../psych/analysis';
import { LICENSED_NOTE_LONG, PVT, SP_LEVELS, SP_PROMPT, TEST_INFO, TEST_SOURCES, TLX_ITEMS, TLX_PROMPT, TLX_STEP, type TestKind, type TlxKey } from '../../psych/instruments';
import { rawTlx, scorePvt, spLabel, tlxHighest, type PvtScore } from '../../psych/scoring';
import { activePvt, missionAgo, useTests, type TestResult } from '../../psych/store';
import { useAstra } from '../../store';
import type { CrewId } from '../../types';
import { alpha, COLORS, fmt, LEVEL_COLOR, LEVEL_ICON } from '../theme';
import { LevelBadge } from './LevelBadge';

type Active = { kind: TestKind; demo?: boolean } | null;

/** Astronot Ekranı key={crewId} ile çağırır: başka astronota geçince açık test kapanır (sonuç yanlış kişiye yazılmaz). */
export function PsychTestsPanel({ crewId }: { crewId: CrewId }) {
  const [active, setActive] = useState<Active>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const a = useAstra((s) => s);
  const ts = useTests((s) => s);
  const due = dueTests(crewId, a, ts);
  const ps = psychState(crewId, a, ts);
  const add = useTests((s) => s.add);

  const finish = (r: TestResult) => {
    setActive(null);
    setSaved(r.id);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Testleri <b className="text-slate-200">{shortName(crewId)}</b> yapıyor kabul edilir. Sorular resmi ölçeklerden alınmıştır; yapay zekâ soru yazmaz. ASTRA hangi testin ne zaman
        yapılacağını önerir ve sonuçları analiz eder.
      </p>

      <div className="grid grid-cols-1 gap-4 min-[1100px]:grid-cols-2">
        <StateCard ps={ps} />
        <DueCard due={due} onStart={(kind) => setActive({ kind })} disabled={!!active} />
      </div>

      {active ? (
        <div className="rounded-2xl border border-calm/40 bg-calm/5 p-4">
          {active.kind === 'SP' && <SpForm onCancel={() => setActive(null)} onSave={(puan) => finish(add({ kind: 'SP', puan }, crewId))} />}
          {active.kind === 'TLX' && <TlxForm onCancel={() => setActive(null)} onSave={(ratings) => finish(add({ kind: 'TLX', ratings, raw: rawTlx(ratings) }, crewId))} />}
          {active.kind === 'PVT' && (
            <PvtRunner
              demo={!!active.demo}
              onCancel={() => setActive(null)}
              onDone={(score, durationS) => finish(add({ kind: 'PVT', ...score, demo: !!active.demo, durationS }, crewId))}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-400">Test başlat:</span>
          {(['SP', 'TLX', 'PVT'] as TestKind[]).map((k) => (
            <button key={k} onClick={() => setActive({ kind: k })} className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10">
              {TEST_INFO[k].ad} · {TEST_INFO[k].sure}
            </button>
          ))}
          <button
            onClick={() => setActive({ kind: 'PVT', demo: true })}
            className="rounded-full px-3 py-1.5 text-sm text-slate-400 ring-1 ring-white/10 hover:bg-white/5"
            title="Kısa deneme: sonucu kaydedilir ama Katman 1'e gitmez (geçerli PVT-B 3 dakikadır)."
          >
            PVT denemesi · 30 sn
          </button>
        </div>
      )}

      {saved && !active && <SavedNote id={saved} />}
      <History crewId={crewId} />
      <Sources />
    </div>
  );
}

// ---------------------------------------------------------------- Psikolojik durum
function StateCard({ ps }: { ps: ReturnType<typeof psychState> }) {
  return (
    <div className="rounded-2xl border border-space-border bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">Psikolojik durum</h3>
        <LevelBadge level={ps.seviye} pill />
      </div>
      <p className="mb-3 text-sm text-slate-300">{ps.ozet}</p>
      <ul className="space-y-2">
        {ps.etkenler.map((f) => (
          <li key={f.ad} className="rounded-xl bg-white/[0.03] px-3 py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm text-slate-400">{f.ad}</span>
              <span className="font-mono text-sm font-semibold" style={{ color: f.seviye === 'normal' ? COLORS.text : LEVEL_COLOR[f.seviye] }}>
                {f.seviye !== 'normal' && `${LEVEL_ICON[f.seviye]} `}
                {f.deger}
              </span>
            </div>
            {(f.not || f.varsayim) && (
              <div className="mt-0.5 text-xs text-slate-500">
                {f.not}
                {f.varsayim && <span className="ml-1 text-caution/80">· eşik varsayım</span>}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Bu kart uyarı açmaz; uyarıyı Katman 1 açar. Öz bildirim testleri teşhis değildir.</p>
    </div>
  );
}

// ---------------------------------------------------------------- ASTRA'nın önerileri
function DueCard({ due, onStart, disabled }: { due: DueTest[]; onStart: (k: TestKind) => void; disabled: boolean }) {
  return (
    <div className="rounded-2xl border border-ai/30 bg-ai/5 p-4">
      <h3 className="mb-2 font-semibold text-ai">ASTRA'nın test önerileri</h3>
      {due.length === 0 ? (
        <p className="text-sm text-slate-300">Şu an bekleyen test yok; testler güncel.</p>
      ) : (
        <ul className="space-y-2">
          {due.map((d) => (
            <li key={d.kind} className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{TEST_INFO[d.kind].ad}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={
                      d.oncelik === 'öncelikli'
                        ? { color: COLORS.caution, backgroundColor: alpha(COLORS.caution, 0.12) }
                        : { color: COLORS.textMuted, backgroundColor: 'rgba(255,255,255,0.05)' }
                    }
                  >
                    {d.oncelik}
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-slate-400">
                  {d.neden}
                  {d.kaynak && (
                    <>
                      {' '}
                      <a href={d.kaynak.url} target="_blank" rel="noreferrer" className="text-calm underline-offset-2 hover:underline">
                        kaynak
                      </a>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => onStart(d.kind)}
                disabled={disabled}
                className="shrink-0 rounded-full bg-calm/20 px-3 py-1 text-sm font-semibold text-calm ring-1 ring-calm/50 hover:bg-calm/30 disabled:opacity-40"
              >
                Başlat
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Rutin plan: her test 4 görev gününde bir (ISS'te Reaction Self Test sıklığı). Kısa uyku ya da Katman 1 bilişsel sapması varsa öncelikli.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Samn-Perelli
function SpForm({ onSave, onCancel }: { onSave: (puan: number) => void; onCancel: () => void }) {
  const [puan, setPuan] = useState<number | null>(null);
  return (
    <div>
      <FormHead kind="SP" />
      <p className="mb-3 text-slate-200">{SP_PROMPT}</p>
      <div className="grid gap-2" role="radiogroup" aria-label="Samn-Perelli yorgunluk ölçeği">
        {SP_LEVELS.map((l) => (
          <button
            key={l.puan}
            role="radio"
            aria-checked={puan === l.puan}
            onClick={() => setPuan(l.puan)}
            className={`flex items-baseline gap-3 rounded-xl px-3 py-2 text-left ${puan === l.puan ? 'bg-calm/20 ring-1 ring-calm' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}
          >
            <span className="w-5 font-mono font-bold text-calm">{l.puan}</span>
            <span>
              {l.tr}
              <span className="block text-xs text-slate-500">{l.en}</span>
            </span>
          </button>
        ))}
      </div>
      <FormButtons canSave={puan !== null} onSave={() => puan !== null && onSave(puan)} onCancel={onCancel} />
    </div>
  );
}

// ---------------------------------------------------------------- NASA-TLX
function TlxForm({ onSave, onCancel }: { onSave: (r: Record<TlxKey, number>) => void; onCancel: () => void }) {
  const [vals, setVals] = useState<Partial<Record<TlxKey, number>>>({});
  const done = TLX_ITEMS.every((i) => vals[i.key] !== undefined);
  return (
    <div>
      <FormHead kind="TLX" />
      <p className="mb-3 text-slate-200">{TLX_PROMPT}</p>
      <div className="grid gap-3 min-[900px]:grid-cols-2">
        {TLX_ITEMS.map((i) => {
          const v = vals[i.key];
          return (
            <label key={i.key} className="block rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{i.ad}</span>
                <span className="font-mono text-calm">{v ?? '—'}</span>
              </div>
              <div className="text-sm text-slate-300">{i.soru}</div>
              <div className="text-xs text-slate-500">
                {i.en}: {i.soruEn}
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={TLX_STEP}
                value={v ?? 50}
                onChange={(e) => setVals((p) => ({ ...p, [i.key]: Number(e.target.value) }))}
                onClick={(e) => setVals((p) => ({ ...p, [i.key]: Number((e.target as HTMLInputElement).value) }))}
                className={`mt-2 w-full ${v === undefined ? 'opacity-40' : ''}`}
                style={{ accentColor: COLORS.calm }}
                aria-label={i.ad}
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>{i.alt}</span>
                <span>{i.ust}</span>
              </div>
            </label>
          );
        })}
      </div>
      {!done && <p className="mt-2 text-xs text-slate-500">Her ölçeği en az bir kez işaretleyin (0–100, 5'er adım).</p>}
      <FormButtons canSave={done} onSave={() => done && onSave(vals as Record<TlxKey, number>)} onCancel={onCancel} />
    </div>
  );
}

// ---------------------------------------------------------------- PVT-B
type Phase = 'ready' | 'wait' | 'stim' | 'feedback' | 'early' | 'aborted';

function PvtRunner({ demo, onDone, onCancel }: { demo: boolean; onDone: (s: PvtScore, durationS: number) => void; onCancel: () => void }) {
  const durationS: number = demo ? PVT.demoDurationS : PVT.durationS;
  const [phase, setPhase] = useState<Phase>('ready');
  const [counter, setCounter] = useState(0);
  const [left, setLeft] = useState(durationS);
  const r = useRef({ rts: [] as number[], falseStarts: 0, startAt: 0, stimAt: 0, timer: 0, timeout: 0, raf: 0, tick: 0, phase: 'ready' as Phase });

  const go = (p: Phase) => {
    r.current.phase = p;
    setPhase(p);
  };
  const clearAll = () => {
    const c = r.current;
    window.clearTimeout(c.timer);
    window.clearTimeout(c.timeout);
    window.clearInterval(c.tick);
    cancelAnimationFrame(c.raf);
  };
  const elapsedS = () => (performance.now() - r.current.startAt) / 1000;
  const finish = () => {
    clearAll();
    onDone(scorePvt(r.current.rts, r.current.falseStarts), durationS);
  };
  // Uyaranlar arası 1–4 sn: tepkiden sonra 1 sn gösterim + 0–3 sn rastgele bekleme (Basner vd. 2011)
  const randomWait = (min: number) => min + Math.random() * (PVT.maxDelayMs - PVT.minDelayMs);
  const schedule = (delay: number) => {
    if (elapsedS() >= durationS) return finish();
    go('wait');
    r.current.timer = window.setTimeout(showStim, delay);
  };
  const showStim = () => {
    const c = r.current;
    c.stimAt = performance.now();
    go('stim');
    const loop = () => {
      setCounter(Math.round(performance.now() - c.stimAt));
      c.raf = requestAnimationFrame(loop);
    };
    c.raf = requestAnimationFrame(loop);
    c.timeout = window.setTimeout(() => record(PVT.timeoutMs), PVT.timeoutMs);
  };
  const record = (rt: number) => {
    const c = r.current;
    cancelAnimationFrame(c.raf);
    window.clearTimeout(c.timeout);
    c.rts.push(rt);
    setCounter(Math.round(rt));
    go('feedback');
    c.timer = window.setTimeout(() => schedule(randomWait(0)), PVT.feedbackMs);
  };
  const respond = () => {
    const c = r.current;
    if (c.phase === 'stim') return record(performance.now() - c.stimAt);
    if (c.phase === 'wait') {
      // Uyarandan önce basma: erken basma sayılır, deneme yeniden başlar
      window.clearTimeout(c.timer);
      c.falseStarts++;
      go('early');
      c.timer = window.setTimeout(() => schedule(randomWait(0)), PVT.feedbackMs);
    }
  };
  const start = () => {
    const c = r.current;
    c.rts = [];
    c.falseStarts = 0;
    c.startAt = performance.now();
    c.tick = window.setInterval(() => setLeft(Math.max(0, Math.ceil(durationS - elapsedS()))), 250);
    schedule(randomWait(PVT.minDelayMs));
  };

  // Boşluk tuşu ile tepki; sekme değişirse test geçersiz olur
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const p = r.current.phase;
      if (p === 'wait' || p === 'stim' || p === 'feedback' || p === 'early') {
        e.preventDefault();
        respond();
      }
    };
    const onHide = () => {
      if (document.hidden && r.current.phase !== 'ready' && r.current.phase !== 'aborted') {
        clearAll();
        go('aborted');
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      clearAll();
    };
    // respond ve clearAll ref üzerinden çalışır; bir kez bağlanır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = phase !== 'ready' && phase !== 'aborted';
  return (
    <div>
      <FormHead kind="PVT" />
      {demo && (
        <p className="mb-2 text-sm" style={{ color: COLORS.caution }}>
          Deneme (30 sn): geçerli bir PVT-B değildir; sonucu kaydedilir ama Katman 1'e gitmez.
        </p>
      )}
      {phase === 'ready' && (
        <div className="space-y-2 text-sm text-slate-300">
          <p>Kutuda sayaç belirince olabildiğince hızlı tıklayın ya da boşluk tuşuna basın. Sayaç görünmeden basmayın. Süre: {durationS} sn.</p>
          <p className="text-xs text-slate-500">
            Not: Tarayıcı, ekran ve fare gecikmesi tepki süresini gerçek PVT cihazına göre biraz uzatabilir. Test sırasında sekmeyi değiştirirseniz test geçersiz olur.
          </p>
          <div className="flex gap-2 pt-1">
            <button onClick={start} className="rounded-full bg-calm/20 px-4 py-1.5 font-semibold text-calm ring-1 ring-calm/50 hover:bg-calm/30">
              Başla
            </button>
            <button onClick={onCancel} className="rounded-full px-4 py-1.5 text-slate-300 hover:bg-white/5">
              Vazgeç
            </button>
          </div>
        </div>
      )}
      {running && (
        <div>
          <div className="mb-2 flex justify-between text-sm text-slate-400">
            <span>Kalan: {left} sn</span>
            <span>Tepki: {r.current.rts.length}</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            aria-label="PVT tepki alanı: sayaç görününce tıklayın"
            onPointerDown={(e) => {
              e.preventDefault();
              respond();
            }}
            className="flex h-48 cursor-pointer items-center justify-center rounded-2xl border-2 select-none"
            style={{ borderColor: phase === 'early' ? COLORS.caution : COLORS.border, backgroundColor: '#05081a' }}
          >
            {phase === 'stim' && <span className="font-mono text-6xl font-bold tabular-nums" style={{ color: COLORS.caution }}>{counter}</span>}
            {phase === 'feedback' && <span className="font-mono text-5xl font-bold tabular-nums" style={{ color: counter >= PVT.lapseMs ? COLORS.caution : COLORS.calm }}>{counter} ms</span>}
            {phase === 'early' && <span className="text-xl font-semibold" style={{ color: COLORS.caution }}>Erken basıldı</span>}
            {phase === 'wait' && <span className="text-sm text-slate-600">bekleyin…</span>}
          </div>
          <button
            onClick={() => {
              clearAll();
              onCancel();
            }}
            className="mt-2 rounded-full px-3 py-1 text-sm text-slate-400 hover:bg-white/5"
          >
            Testi iptal et
          </button>
        </div>
      )}
      {phase === 'aborted' && (
        <div className="space-y-2 text-sm">
          <p style={{ color: COLORS.caution }}>Sekme değiştiği için test yarıda kaldı; sonuç kaydedilmedi.</p>
          <button onClick={onCancel} className="rounded-full px-3 py-1 text-slate-300 hover:bg-white/5">
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ortak parçalar
function FormHead({ kind }: { kind: TestKind }) {
  const info = TEST_INFO[kind];
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-lg font-semibold">{info.ad}</h3>
      <span className="text-xs text-slate-500">
        {info.olcer} · kaynak:{' '}
        {info.kaynaklar.map((k, i) => (
          <span key={k.url}>
            {i > 0 && ', '}
            <a href={k.url} target="_blank" rel="noreferrer" className="text-calm underline-offset-2 hover:underline">
              {k.ad.split(',')[0]}
            </a>
          </span>
        ))}
      </span>
    </div>
  );
}

function FormButtons({ canSave, onSave, onCancel }: { canSave: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="mt-3 flex gap-2">
      <button
        onClick={onSave}
        disabled={!canSave}
        className="rounded-full bg-calm/20 px-4 py-1.5 font-semibold text-calm ring-1 ring-calm/50 hover:bg-calm/30 disabled:opacity-40"
      >
        Kaydet
      </button>
      <button onClick={onCancel} className="rounded-full px-4 py-1.5 text-slate-300 hover:bg-white/5">
        Vazgeç
      </button>
    </div>
  );
}

function resultText(r: TestResult): string {
  if (r.kind === 'SP') return `${r.puan}/7 · ${spLabel(r.puan)}`;
  if (r.kind === 'TLX') {
    const top = tlxHighest(r.ratings);
    return `${fmt(r.raw, 1)}/100 · en yüksek: ${top.ad} ${top.puan}`;
  }
  return `ort. ${r.meanRt_ms} ms · medyan ${r.medianRt_ms} ms · ${r.lapses} dikkat kaybı · ${r.falseStarts} erken basma${r.demo ? ' · deneme' : ''}`;
}

function SavedNote({ id }: { id: string }) {
  const r = useTests((s) => s.results.find((x) => x.id === id));
  if (!r) return null;
  const toLayer1 = r.kind === 'PVT' && !r.demo;
  return (
    <div className="rounded-xl px-3 py-2 text-sm" style={{ color: COLORS.normal, backgroundColor: alpha(COLORS.normal, 0.08) }}>
      ✓ Kaydedildi: {TEST_INFO[r.kind].ad} — {resultText(r)}.{' '}
      {toLayer1 ? 'Sonuç 1 görev günü boyunca Katman 1\'e gidiyor; psikolojik durum güncellendi.' : r.kind === 'PVT' ? 'Deneme olduğu için Katman 1\'e gitmedi.' : 'Psikolojik durum güncellendi.'}
    </div>
  );
}

function History({ crewId }: { crewId: CrewId }) {
  const results = useTests((s) => s.results);
  const tick = useTests((s) => s.tick);
  const mine = results.filter((r) => r.crewId === crewId).slice(-10).reverse();
  const pvt = activePvt(crewId);
  if (!mine.length) return <p className="text-sm text-slate-500">Henüz test sonucu yok.</p>;
  return (
    <div>
      <h3 className="mb-2 font-semibold">Test geçmişi</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-normal">Test</th>
              <th className="py-1 pr-3 font-normal">Sonuç</th>
              <th className="py-1 font-normal">Görev zamanı</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  {TEST_INFO[r.kind].kisa}
                  {pvt?.id === r.id && <span className="ml-1 text-xs text-calm">· Katman 1'de</span>}
                </td>
                <td className="py-1.5 pr-3 font-mono">{resultText(r)}</td>
                <td className="py-1.5 whitespace-nowrap text-slate-400">{missionAgo(r.tick, tick)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Sources() {
  return (
    <div className="text-xs text-slate-500">
      Kaynaklar:{' '}
      {Object.values(TEST_SOURCES).map((s, i) => (
        <span key={s.url}>
          {i > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noreferrer" className="text-calm/80 underline-offset-2 hover:underline">
            {s.ad}
          </a>
        </span>
      ))}
      . Türkçe metinler ekibin çevirisidir (resmi Türkçe sürüm değildir). PANAS (telifli) ve BSI-18 (ticari) test olarak kullanılmadı; {LICENSED_NOTE_LONG}
    </div>
  );
}

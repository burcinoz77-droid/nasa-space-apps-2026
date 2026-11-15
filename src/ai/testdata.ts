// Parça 4 · Psikolojik test sonuçlarının ASTRA'ya giden kopyası (araçlar ve kısa özet).
// Tüm puanlar ve değişimler burada KODLA hesaplanır; model yeni sayı üretmez, sadece bunları okur.
import { CREW, CREW_IDS } from '../crew';
import { crewComparison, dueTests, psychState, ROUTINE_TICKS, SHORT_SLEEP_H, SP_CAUTION, SP_CRITICAL, TLX_CAUTION, TLX_NAMES } from '../psych/analysis';
import { PVT, TEST_INFO, TEST_SOURCES } from '../psych/instruments';
import { spLabel, tlxHighest } from '../psych/scoring';
import { activePvt, DAY_TICKS, hoursAgo, PVT_HOLD_TICKS, resultsOf, useTests } from '../psych/store';
import { useAstra, type AstraState } from '../store';
import type { CrewId, Level } from '../types';
import { LEVEL_TR, shortName } from './labels';

const KEEP = 5; // test başına en fazla son 5 sonuç
const LEVEL: Record<Level, string> = LEVEL_TR;
const days = (ticks: number) => Math.round(ticks / DAY_TICKS);

function crewTests(id: CrewId, a: AstraState) {
  const ts = useTests.getState();
  const sp = resultsOf(id, 'SP', ts.results).slice(0, KEEP);
  const tlx = resultsOf(id, 'TLX', ts.results).slice(0, KEEP);
  const pvt = resultsOf(id, 'PVT', ts.results).slice(0, KEEP);
  const ps = psychState(id, a, ts);
  const diff = (x: number | undefined, y: number | undefined) => (x === undefined || y === undefined ? undefined : Math.round((x - y) * 10) / 10);
  return {
    ad: shortName(id),
    psikolojikDurum: {
      seviye: LEVEL[ps.seviye],
      ozet: ps.ozet,
      etkenler: ps.etkenler.map((f) => ({ ad: f.ad, deger: f.deger, seviye: LEVEL[f.seviye], ...(f.not ? { not: f.not } : {}), ...(f.varsayim ? { esik: 'varsayım' } : {}) })),
    },
    sonuclar: {
      yorgunluk_SamnPerelli: sp.map((r) => ({ puan: r.puan, ifade: spLabel(r.puan), once_saat: hoursAgo(r.tick, ts.tick) })),
      isYuku_NasaTlx: tlx.map((r) => {
        const top = tlxHighest(r.ratings);
        return {
          toplam: r.raw,
          altOlcekler: Object.fromEntries(Object.entries(r.ratings).map(([k, v]) => [TLX_NAMES[k], v])),
          enYuksekAltOlcek: `${top.ad} (${top.puan})`,
          once_saat: hoursAgo(r.tick, ts.tick),
        };
      }),
      tepki_PvtB: pvt.map((r) => ({
        ortalama_ms: r.meanRt_ms,
        medyan_ms: r.medianRt_ms,
        dikkatKaybi: r.lapses,
        erkenBasma: r.falseStarts,
        tepkiSayisi: r.responses,
        once_saat: hoursAgo(r.tick, ts.tick),
      })),
    },
    degisim: {
      yorgunluk_basamak: diff(sp[0]?.puan, sp[1]?.puan),
      isYuku_puan: diff(tlx[0]?.raw, tlx[1]?.raw),
      pvtOrtalama_ms: diff(pvt[0]?.meanRt_ms, pvt[1]?.meanRt_ms),
      pvtDikkatKaybi: diff(pvt[0]?.lapses, pvt[1]?.lapses),
    },
    katman1eGidenPvt: activePvt(id, ts) ? 'evet: son PVT-B sonucu simüle değerin yerine Katman 1\'e gidiyor' : 'hayır: son 1 görev gününde PVT-B yok, simüle değer kullanılıyor',
    bekleyenTestler: dueTests(id, a, ts).map((d) => ({ test: TEST_INFO[d.kind].ad, oncelik: d.oncelik, neden: d.neden })),
  };
}

/** Araçların okuduğu tam test verisi (src/ai/tooldata.ts -> toolData.testler). */
export function buildTestData(a: AstraState = useAstra.getState()) {
  const cmp = crewComparison(CREW_IDS);
  return {
    aciklama:
      'Psikolojik testler: Samn-Perelli yorgunluk ölçeği (1–7, yüksek = daha yorgun, öz bildirim), NASA-TLX iş yükü (Raw TLX 0–100, altı alt ölçeğin ortalaması, yüksek = daha yüksek yük, öz bildirim) ve PVT-B tepki testi (3 dk, nesnel). Puanları kod hesaplar. Test soruları resmi maddelerdir; yapay zekâ yazmaz.',
    kurallar: {
      rutin: `Her test ${days(ROUTINE_TICKS)} görev gününde bir (ISS'te Reaction Self Test sıklığı, Jones vd. 2022).`,
      kisaUyku: `Dün gece uyku ${SHORT_SLEEP_H} saatten azsa ve son 24 görev saatinde yapılmadıysa yorgunluk ve PVT-B öncelikli (Jones vd. 2022).`,
      bilisselSapma: "Katman 1 bilişsel ölçümlerde sapma görürse yorgunluk ve PVT-B öncelikli (proje kuralı).",
      isYukuTetik: 'Gezegen yüzeyindeki (EVA) ya da açık olaydaki kişiye NASA-TLX öncelikli (varsayım kuralı).',
      yorgunlukEsigi: `Samn-Perelli ${SP_CAUTION}–${SP_CRITICAL - 1} dikkat, ${SP_CRITICAL} kritik (varsayım; ölçek ifadelerine göre).`,
      isYukuEsigi: `NASA-TLX'in resmi eşiği yok; ${TLX_CAUTION} ve üzeri dikkat (varsayım).`,
      pvt: `PVT-B'de ${PVT.lapseMs} ms ve üzeri tepki dikkat kaybıdır, ${PVT.falseStartMs} ms'den kısa tepki erken basmadır (Basner vd. 2011). Ölçülen PVT-B sonucu ${days(PVT_HOLD_TICKS)} görev günü boyunca Katman 1'e gider; PVT seviyesini Katman 1 belirler.`,
      not: 'Öz bildirim testleri teşhis değildir. Uyarıyı yalnızca Katman 1 açar.',
    },
    kisiler: Object.fromEntries(CREW.map((m) => [m.id, crewTests(m.id, a)])),
    karsilastirma: {
      enYorgundanBaslayarak: cmp.yorgunluk.map((r) => ({ ad: shortName(r.id), puan: r.puan })),
      enYuksekIsYukundenBaslayarak: cmp.isYuku.map((r) => ({ ad: shortName(r.id), puan: r.puan })),
      enYavasTepkidenBaslayarak: cmp.tepki.map((r) => ({ ad: shortName(r.id), ortalama_ms: r.ortalama_ms, dikkatKaybi: r.dikkatKaybi })),
      sonDortGundeTestYapmayanlar: cmp.testYapmayanlar.map(shortName),
    },
    kaynaklar: Object.values(TEST_SOURCES),
  };
}

/** Bağlama (sistem istemi) giden kısa özet: kişi başına seviye, son puanlar, bekleyen test sayısı. */
export function testSummary(a: AstraState = useAstra.getState()) {
  const ts = useTests.getState();
  return Object.fromEntries(
    CREW.map((m) => {
      const ps = psychState(m.id, a, ts);
      const sp = resultsOf(m.id, 'SP', ts.results)[0];
      const tlx = resultsOf(m.id, 'TLX', ts.results)[0];
      const pvt = resultsOf(m.id, 'PVT', ts.results)[0];
      const due = dueTests(m.id, a, ts);
      return [
        shortName(m.id),
        {
          psikolojikDurum: LEVEL[ps.seviye],
          ...(sp ? { sonYorgunluk_1_7: sp.puan } : {}),
          ...(tlx ? { sonIsYuku_0_100: tlx.raw } : {}),
          ...(pvt ? { sonPvt: { ortalama_ms: pvt.meanRt_ms, dikkatKaybi: pvt.lapses } } : {}),
          ...(due.length ? { bekleyenTest: due.map((d) => `${TEST_INFO[d.kind].kisa} (${d.oncelik})`) } : {}),
        },
      ];
    }),
  );
}

// Parça 4 · Sohbetin kalıcılığı: panel kapatılıp açılınca ya da sayfa yenilenince aynı sohbet devam eder.
// Sohbet ortak durumun chat alanında (Katman 2'nin alanı) durur; bu dosya onu tarayıcıda (localStorage) saklar.
// "Sohbeti sıfırla" düğmesi resetChat() çağırır. Not: "Simülasyonu sıfırla" sohbeti de temizler.
import { useAstra } from '../store';
import type { ChatMessage } from '../types';
import { clearAstraCache } from './client';

const STORAGE_KEY = 'astra-sohbet-v1';
const MAX_SAVED = 50;

/** Tarayıcı deposu; yoksa ya da kapalıysa (gizli mod, test ortamı) undefined. */
function storage(): Storage | undefined {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    ls?.getItem(STORAGE_KEY);
    return ls;
  } catch {
    return undefined;
  }
}

let started = false;
export function startChatPersistence() {
  if (started) return;
  started = true;
  const ls = storage();
  if (!ls) return;
  try {
    const saved = JSON.parse(ls.getItem(STORAGE_KEY) ?? '[]') as ChatMessage[];
    if (Array.isArray(saved) && saved.length && useAstra.getState().chat.length === 0) {
      useAstra.setState({ chat: saved.slice(-MAX_SAVED) });
    }
  } catch {
    // bozuk kayıt: yok say
  }
  useAstra.subscribe((s, prev) => {
    if (s.chat === prev.chat) return;
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(s.chat.slice(-MAX_SAVED)));
    } catch {
      // depo dolu ya da kapalı: sohbet yine bellekte devam eder
    }
  });
}
startChatPersistence();

/** Sohbeti temizler: ekrandaki mesajlar, kayıtlı sohbet ve aynı soru önbelleği. */
export function resetChat() {
  useAstra.setState({ chat: [] });
  clearAstraCache();
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // önemli değil
  }
}

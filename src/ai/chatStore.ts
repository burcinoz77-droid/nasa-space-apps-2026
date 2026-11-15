// Part 4 · Chat persistence: the same chat continues when the panel is closed and reopened or the page is reloaded.
// The chat lives in the chat field of the shared state (Layer 2's field); this file saves it in the browser (localStorage).
// The "Reset chat" button calls resetChat(). Note: "Reset simulation" clears the chat too.
import { useAstra } from '../store';
import type { ChatMessage } from '../types';
import { clearAstraCache } from './client';

const STORAGE_KEY = 'astra-sohbet-v1';
const MAX_SAVED = 50;

/** Browser storage; undefined if missing or disabled (private mode, test environment). */
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
    // corrupt record: ignore
  }
  useAstra.subscribe((s, prev) => {
    if (s.chat === prev.chat) return;
    try {
      ls.setItem(STORAGE_KEY, JSON.stringify(s.chat.slice(-MAX_SAVED)));
    } catch {
      // storage full or disabled: the chat still continues in memory
    }
  });
}
startChatPersistence();

/** Clears the chat: on-screen messages, the saved chat and the same-question cache. */
export function resetChat() {
  useAstra.setState({ chat: [] });
  clearAstraCache();
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // not important
  }
}

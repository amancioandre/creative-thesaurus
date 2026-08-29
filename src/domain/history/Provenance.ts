import type { History, HistoryEntry } from "./History";

/**
 * Where a word came from: the history entries whose pick is this word,
 * the ones from `notePath` first, newest first. Case-insensitive, so a
 * capitalised pick at a sentence start still resolves.
 */
export function picksFor(h: History, word: string, notePath: string | null = null): HistoryEntry[] {
  const w = word.trim().toLowerCase();
  if (!w) return [];
  const hits = h.entries.filter((e) => e.picked?.toLowerCase() === w);
  if (!notePath) return hits;
  return [...hits.filter((e) => e.note === notePath), ...hits.filter((e) => e.note !== notePath)];
}

import type { LookupResult } from "./Suggestion";

/** A persisted answer: when it was last used (for eviction) and what it was. */
export interface CachedResult {
  readonly at: string;
  readonly result: LookupResult;
}

export interface ResultCache {
  readonly version: 1;
  readonly entries: Readonly<Record<string, CachedResult>>;
}

export const EMPTY_CACHE: ResultCache = { version: 1, entries: {} };
export const DEFAULT_CACHE_SIZE = 2000;

/** Records a use — a new answer or a hit — and evicts the least recently used beyond `max`. */
export function touchCache(c: ResultCache, key: string, result: LookupResult, at: string, max = DEFAULT_CACHE_SIZE): ResultCache {
  const entries: Record<string, CachedResult> = { ...c.entries, [key]: { at, result } };
  const keys = Object.keys(entries);
  if (keys.length > max) {
    keys.sort((a, b) => Date.parse(entries[a]!.at) - Date.parse(entries[b]!.at));
    for (const k of keys.slice(0, keys.length - max)) delete entries[k];
  }
  return { version: 1, entries };
}

/** Whatever was on disk becomes a cache of well-formed results; anything else is dropped. */
export function normalizeCache(raw: unknown): ResultCache {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const src = (r.entries && typeof r.entries === "object" ? r.entries : {}) as Record<string, unknown>;
  const entries: Record<string, CachedResult> = {};
  for (const [key, v] of Object.entries(src)) {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const result = o.result as Partial<LookupResult> | undefined;
    if (typeof o.at !== "string" || Number.isNaN(Date.parse(o.at)) || !result || typeof result !== "object") continue;
    const q = result.query;
    if (!q || typeof q.text !== "string" || typeof q.key !== "string" || !Array.isArray(result.groups) || !Array.isArray(result.sources)) continue;
    entries[key] = { at: o.at, result: { query: { text: q.text, key: q.key, isPhrase: q.text.includes(" ") }, groups: result.groups, notes: Array.isArray(result.notes) ? result.notes : [], sources: result.sources, errors: [] } };
  }
  return { version: 1, entries };
}

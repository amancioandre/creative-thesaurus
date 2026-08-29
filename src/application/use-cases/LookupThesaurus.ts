import type { Query } from "../../domain/thesaurus/Query";
import { EMPTY_CACHE, touchCache, type ResultCache } from "../../domain/thesaurus/ResultCache";
import { mergeSuggestions, type LookupResult, type SourceError, type Suggestion } from "../../domain/thesaurus/Suggestion";
import type { CacheRepository } from "../ports/CacheRepository";
import type { SuggestionSource } from "../ports/SuggestionSource";

export interface LookupOptions {
  /** The sources to ask right now — resolved at call time so a settings change takes effect on the next lookup. */
  readonly sources: () => readonly SuggestionSource[];
  readonly maxPerGroup: () => number;
  /** Answers kept between sessions. Optional: without it the cache is per session. */
  readonly store?: CacheRepository;
  readonly cacheSize?: number;
  readonly now?: () => Date;
}

/**
 * Asks every enabled source in parallel, tolerates any of them failing
 * (a dead Ollama must not hide Datamuse's answer), merges what came back
 * into ordered groups, and remembers complete answers — keyed by query,
 * sources and their settings, so a different model is a different entry.
 * An answer with a failed source is shown but never cached: the next call
 * gets another chance at the full one.
 */
export class LookupThesaurus {
  private cache: ResultCache | null = null;
  private loading: Promise<ResultCache> | null = null;
  private readonly cacheSize: number;

  constructor(private readonly options: LookupOptions) {
    this.cacheSize = options.cacheSize ?? 2000;
  }

  /** Stable, cheap content hash (FNV-1a) — a cache key, not a checksum. */
  static keyFor(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return `${text.length}:${(h >>> 0).toString(16)}`;
  }

  async execute(query: Query, signal: AbortSignal): Promise<LookupResult> {
    const sources = this.options.sources();
    const names = sources.map((s) => s.name);
    if (sources.length === 0) throw new Error("No source is enabled — turn on Datamuse or a local model in Creative Thesaurus settings.");
    const key = `${sources.map((s) => s.name + (s.variant ? `[${s.variant}]` : "")).join(",")}|${this.options.maxPerGroup()}|${LookupThesaurus.keyFor(query.key)}`;
    const cache = await this.load();
    const hit = cache.entries[key];
    if (hit) {
      this.remember(key, hit.result);
      return hit.result;
    }

    const settled = await Promise.allSettled(sources.map((s) => s.suggest(query, signal)));
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    const suggestions: Suggestion[] = [];
    const notes: string[] = [];
    const errors: SourceError[] = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") { suggestions.push(...r.value.suggestions); notes.push(...(r.value.notes ?? [])); }
      else errors.push({ source: names[i]!, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    });
    if (errors.length === sources.length) throw new Error(errors.map((e) => e.message).join("; "));

    const result: LookupResult = { query, groups: mergeSuggestions(query, suggestions, this.options.maxPerGroup()), notes, sources: names, errors };
    if (errors.length === 0) this.remember(key, result);
    return result;
  }

  /** Forget every remembered answer, on disk too. */
  async invalidate(): Promise<void> {
    this.cache = EMPTY_CACHE;
    await this.options.store?.save(EMPTY_CACHE);
  }

  private load(): Promise<ResultCache> {
    if (this.cache) return Promise.resolve(this.cache);
    this.loading ??= (this.options.store?.load() ?? Promise.resolve(EMPTY_CACHE)).catch(() => EMPTY_CACHE).then((c) => (this.cache = c));
    return this.loading;
  }

  private remember(key: string, result: LookupResult): void {
    this.cache = touchCache(this.cache ?? EMPTY_CACHE, key, result, (this.options.now ?? (() => new Date()))().toISOString(), this.cacheSize);
    void this.options.store?.save(this.cache).catch(() => undefined);
  }
}

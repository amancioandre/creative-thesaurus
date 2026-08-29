import { appendEntry, EMPTY_HISTORY, recordPick, removeEntry, type History, type HistoryEntry } from "../../domain/history/History";
import type { LookupResult } from "../../domain/thesaurus/Suggestion";
import type { HistoryRepository } from "../ports/HistoryRepository";

export interface RecordOptions {
  readonly enabled: () => boolean;
  readonly maxEntries: () => number;
  readonly now?: () => Date;
  /** Fired after every change, for the history pane. */
  readonly onChange?: (h: History) => void;
}

/**
 * Keeps the history: one entry per completed lookup, the pick added when the
 * writer inserts a word. Loaded lazily, written through on every change
 * (lookups are rare events; a write each is fine).
 */
export class RecordLookup {
  private history: History | null = null;
  private loading: Promise<History> | null = null;

  constructor(private readonly repo: HistoryRepository, private readonly options: RecordOptions) {}

  get current(): History {
    return this.history ?? EMPTY_HISTORY;
  }

  async load(): Promise<History> {
    if (this.history) return this.history;
    this.loading ??= this.repo.load().catch(() => EMPTY_HISTORY).then((h) => (this.history = h));
    return this.loading;
  }

  async lookedUp(result: LookupResult, notePath: string): Promise<void> {
    if (!this.options.enabled()) return;
    const entry: HistoryEntry = {
      at: (this.options.now ?? (() => new Date()))().toISOString(),
      query: result.query.text,
      note: notePath,
      sources: result.sources,
      count: result.groups.reduce((n, g) => n + g.items.length, 0),
    };
    await this.update((h) => appendEntry(h, entry, this.options.maxEntries()));
  }

  async picked(query: string, notePath: string, word: string): Promise<void> {
    if (!this.options.enabled()) return;
    await this.update((h) => recordPick(h, query, notePath, word));
  }

  async remove(at: string, query: string): Promise<void> {
    await this.update((h) => removeEntry(h, at, query));
  }

  async clear(): Promise<void> {
    await this.update(() => EMPTY_HISTORY);
  }

  private async update(edit: (h: History) => History): Promise<void> {
    const before = await this.load();
    const next = edit(before);
    if (next === before) return;
    this.history = next;
    await this.repo.save(next);
    this.options.onChange?.(next);
  }
}

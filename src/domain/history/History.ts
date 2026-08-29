/** One `/thesaurus::` call, as recorded. */
export interface HistoryEntry {
  /** ISO timestamp. */
  readonly at: string;
  readonly query: string;
  /** Vault path of the note the command was typed in; empty when unknown. */
  readonly note: string;
  readonly sources: readonly string[];
  /** Suggestions found, across groups. */
  readonly count: number;
  /** What the writer inserted, once they did. */
  readonly picked?: string;
}

export interface History {
  readonly version: 1;
  /** Newest first. */
  readonly entries: readonly HistoryEntry[];
}

export const EMPTY_HISTORY: History = { version: 1, entries: [] };

/**
 * Newest first; trimmed to `max`. Looking the same thing up again straight
 * away — the cursor returning to a command, a re-run from the pane — is one
 * event, not two: the newest entry is refreshed rather than repeated.
 */
export function appendEntry(h: History, entry: HistoryEntry, max: number): History {
  const [top, ...rest] = h.entries;
  const same = top && top.query.toLowerCase() === entry.query.toLowerCase() && top.note === entry.note;
  const merged = same ? { ...entry, ...(top.picked && !entry.picked ? { picked: top.picked } : {}) } : entry;
  return { version: 1, entries: [merged, ...(same ? rest : h.entries)].slice(0, Math.max(1, max)) };
}

/** Marks the most recent entry for this query (in this note) with what was picked. */
export function recordPick(h: History, query: string, note: string, picked: string): History {
  const i = h.entries.findIndex((e) => e.query === query && e.note === note);
  if (i === -1) return h;
  const entries = h.entries.slice();
  entries[i] = { ...entries[i]!, picked };
  return { version: 1, entries };
}

export function removeEntry(h: History, at: string, query: string): History {
  return { version: 1, entries: h.entries.filter((e) => !(e.at === at && e.query === query)) };
}

/** What a persisted (possibly hand-edited) object becomes: only well-formed entries, newest first. */
export function normalizeHistory(raw: unknown): History {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.entries) ? r.entries : [];
  const entries: HistoryEntry[] = [];
  for (const item of list) {
    const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    if (typeof o.at !== "string" || typeof o.query !== "string" || !o.query.trim() || Number.isNaN(Date.parse(o.at))) continue;
    entries.push({
      at: o.at,
      query: o.query,
      note: typeof o.note === "string" ? o.note : "",
      sources: Array.isArray(o.sources) ? o.sources.filter((s): s is string => typeof s === "string") : [],
      count: typeof o.count === "number" && Number.isFinite(o.count) && o.count >= 0 ? Math.floor(o.count) : 0,
      ...(typeof o.picked === "string" && o.picked ? { picked: o.picked } : {}),
    });
  }
  entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { version: 1, entries };
}

/** Distinct queries, most recent first — the writer's own vocabulary of doubts. */
export function distinctQueries(h: History): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of h.entries) { const k = e.query.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(e.query); } }
  return out;
}

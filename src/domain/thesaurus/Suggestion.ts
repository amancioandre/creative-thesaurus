import type { Query } from "./Query";

/** How a suggestion relates to the query. Groups render in this order. */
export const SUGGESTION_KINDS = ["synonym", "alternative", "antonym", "related"] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export const KIND_LABELS: Readonly<Record<SuggestionKind, string>> = {
  synonym: "Synonyms",
  alternative: "Other ways to say it",
  antonym: "Antonyms",
  related: "Related",
};

export interface Suggestion {
  readonly word: string;
  readonly kind: SuggestionKind;
  /** Which source said it: "datamuse", "ollama:qwen2.5:7b"… */
  readonly source: string;
  /** Higher is better. Sources scale differently; merge normalises per source. */
  readonly score: number;
  /** Register, nuance, a warning — what a non-native speaker needs to choose well. */
  readonly note?: string;
  /** Part of speech, when known: "n", "v", "adj", "adv". */
  readonly pos?: string;
}

export interface SuggestionGroup {
  readonly kind: SuggestionKind;
  readonly items: readonly Suggestion[];
}

export interface SourceError {
  readonly source: string;
  readonly message: string;
}

/** The complete answer to one lookup. */
export interface LookupResult {
  readonly query: Query;
  readonly groups: readonly SuggestionGroup[];
  /** Free text from a model: an example sentence, a caution about usage. */
  readonly notes: readonly string[];
  readonly sources: readonly string[];
  readonly errors: readonly SourceError[];
}

export const isEmptyResult = (r: LookupResult): boolean => r.groups.length === 0 && r.notes.length === 0;

/**
 * Merges what every source said into ordered groups: same word from two
 * sources becomes one entry that keeps the note (a model's) and the best
 * normalised score; the query itself never appears; each group is capped.
 */
export function mergeSuggestions(query: Query, all: readonly Suggestion[], maxPerGroup: number): SuggestionGroup[] {
  const maxBySource = new Map<string, number>();
  for (const s of all) maxBySource.set(s.source, Math.max(maxBySource.get(s.source) ?? 0, s.score));
  const norm = (s: Suggestion) => { const m = maxBySource.get(s.source) ?? 0; return m > 0 ? s.score / m : 0; };

  const groups: SuggestionGroup[] = [];
  for (const kind of SUGGESTION_KINDS) {
    const merged = new Map<string, { s: Suggestion; score: number; sources: number }>();
    for (const s of all) {
      if (s.kind !== kind) continue;
      const word = s.word.trim();
      const key = word.toLowerCase();
      if (!word || key === query.key) continue;
      const score = norm(s);
      const prev = merged.get(key);
      if (!prev) { merged.set(key, { s: { ...s, word }, score, sources: 1 }); continue; }
      merged.set(key, {
        s: { ...prev.s, note: prev.s.note ?? s.note, pos: prev.s.pos ?? s.pos, source: `${prev.s.source}+${s.source}` },
        score: Math.max(prev.score, score),
        sources: prev.sources + 1,
      });
    }
    // Agreement between sources outranks either source's own confidence.
    const items = [...merged.values()].sort((a, b) => b.sources - a.sources || b.score - a.score).slice(0, maxPerGroup).map((m) => ({ ...m.s, score: m.score }));
    if (items.length) groups.push({ kind, items });
  }
  return groups;
}

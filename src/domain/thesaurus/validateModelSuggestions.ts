import type { Query } from "./Query";
import type { Suggestion, SuggestionKind } from "./Suggestion";

export interface ModelReading {
  readonly suggestions: Suggestion[];
  readonly notes: string[];
}

const MAX_ITEMS = 12;
const MAX_WORD = 80;
const MAX_NOTE = 240;

/**
 * A model's answer is untrusted data. Only strings survive, trimmed and
 * capped; the query itself and empty words are dropped; free text (an
 * example, a caution) comes back as notes. Nothing here is ever HTML.
 */
export function validateModelSuggestions(raw: unknown, query: Query, source: string): ModelReading {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();

  const take = (list: unknown, kind: SuggestionKind, wordKey: string) => {
    if (!Array.isArray(list)) return;
    let rank = list.length;
    for (const item of list.slice(0, MAX_ITEMS)) {
      const o = (item && typeof item === "object" ? item : { [wordKey]: item }) as Record<string, unknown>;
      const word = clean(o[wordKey], MAX_WORD);
      const key = `${kind}:${word.toLowerCase()}`;
      if (!word || word.toLowerCase() === query.key || seen.has(key)) { rank--; continue; }
      seen.add(key);
      const register = clean(o.register, 24);
      const note = clean(o.note, MAX_NOTE);
      const text = [register && register !== "neutral" ? register : "", note].filter(Boolean).join(" — ");
      suggestions.push({ word, kind, source, score: rank--, ...(text ? { note: text } : {}) });
    }
  };
  take(r.synonyms, "synonym", "word");
  take(r.alternatives, "alternative", "phrase");
  take(r.antonyms, "antonym", "word");

  const notes: string[] = [];
  const example = clean(r.example, MAX_NOTE);
  const caution = clean(r.caution, MAX_NOTE);
  if (example) notes.push(`e.g. ${example}`);
  if (caution) notes.push(caution);
  return { suggestions, notes };
}

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

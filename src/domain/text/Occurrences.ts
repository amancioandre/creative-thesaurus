/** One place a term appears: 0-based line, character offset within the line, and a short context. */
export interface Occurrence {
  readonly line: number;
  readonly ch: number;
  readonly snippet: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SNIPPET = 36;

/** Whole-word, case-insensitive matches of `term` (a word or a phrase) in `text`, in document order. */
export function findOccurrences(text: string, term: string, max = 200): Occurrence[] {
  const t = term.trim();
  if (!t) return [];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(t).replace(/\s+/g, "\\s+")}(?![\\p{L}\\p{N}])`, "giu");
  const out: Occurrence[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length && out.length < max; i++) {
    const line = lines[i]!;
    for (const m of line.matchAll(re)) {
      const from = Math.max(0, m.index - SNIPPET), to = Math.min(line.length, m.index + m[0].length + SNIPPET);
      out.push({ line: i, ch: m.index, snippet: `${from > 0 ? "…" : ""}${line.slice(from, to).trim()}${to < line.length ? "…" : ""}` });
      if (out.length >= max) break;
    }
  }
  return out;
}

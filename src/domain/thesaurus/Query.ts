/**
 * What the writer asked about. Whitespace is collapsed, surrounding
 * punctuation and quotes dropped, case kept for display but the key is
 * lowercased so "Quiet" and "quiet" share a cache entry.
 */
export interface Query {
  /** As typed, tidied. */
  readonly text: string;
  /** Cache/history key. */
  readonly key: string;
  readonly isPhrase: boolean;
}

const EDGE_PUNCT = /^[\s"'“”‘’«»(\[{.,;:!?…-]+|[\s"'“”‘’«»)\]}.,;:!?…-]+$/g;

export function parseQuery(raw: string): Query | null {
  const text = raw.replace(/\s+/g, " ").replace(EDGE_PUNCT, "").trim();
  if (!text) return null;
  if (text.length > 120) return null;
  return { text, key: text.toLowerCase(), isPhrase: text.includes(" ") };
}

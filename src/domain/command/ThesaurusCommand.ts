import { parseQuery, type Query } from "../thesaurus/Query";

/**
 * A command typed inline — `/thesaurus::word or phrase` — located on one
 * line. Offsets are characters within that line. `from` is the start of
 * the trigger, `to` is where the query ends (the cursor), so replacing
 * `[from, to)` with a pick removes the whole command.
 */
export interface ThesaurusCommand {
  readonly trigger: string;
  readonly from: number;
  readonly to: number;
  /** Raw text after the trigger, untrimmed. */
  readonly raw: string;
  /** Null while only the trigger has been typed. */
  readonly query: Query | null;
}

/**
 * Finds the command the cursor is inside: the last trigger on the line
 * that starts at or before the cursor, with everything up to the cursor as
 * the query. Text after the cursor is left alone so a writer can invoke
 * the thesaurus in the middle of a sentence. Triggers are tried in the
 * given order (longest first, see normalizeTriggers), so `/thesaurus::`
 * wins over `/th::` when both would match.
 */
export function findCommand(line: string, cursor: number, triggers: readonly string[]): ThesaurusCommand | null {
  const head = line.slice(0, Math.max(0, Math.min(cursor, line.length)));
  let best: ThesaurusCommand | null = null;
  for (const trigger of triggers) {
    const at = head.lastIndexOf(trigger);
    if (at === -1) continue;
    if (best && at <= best.from) continue;
    const raw = head.slice(at + trigger.length);
    if (/\S\s{2,}/.test(raw)) continue; // two spaces after the query: the writer moved on
    best = { trigger, from: at, to: head.length, raw, query: parseQuery(raw) };
  }
  return best;
}

/** The word under the cursor (letters, digits, apostrophes, hyphens), for the explicit command when no trigger was typed. */
export function wordAt(line: string, cursor: number): { from: number; to: number; text: string } | null {
  const isWord = (c: string) => /[\p{L}\p{N}'’-]/u.test(c);
  let from = Math.min(cursor, line.length), to = from;
  while (from > 0 && isWord(line[from - 1]!)) from--;
  while (to < line.length && isWord(line[to]!)) to++;
  if (from === to) return null;
  return { from, to, text: line.slice(from, to) };
}

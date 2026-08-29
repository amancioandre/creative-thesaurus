import { EMPTY_HISTORY, normalizeHistory, type History } from "./History";

/**
 * The history as a markdown note inside the vault, so it follows the writer
 * to every device: front matter flags, a line for a human who opens it, a
 * readable list, then one JSON block that is the source of truth.
 * Markdown is the one file type every sync method carries.
 */
export const HISTORY_FLAG = "creative-thesaurus-history";
export const HISTORY_VERSION = 1;

export function serializeHistoryNote(h: History): string {
  const lines = h.entries.slice(0, 200).map((e) => `- ${e.at.slice(0, 16).replace("T", " ")} — **${e.query}**${e.picked ? ` → ${e.picked}` : ""}${e.note ? ` ([[${e.note.replace(/\.md$/i, "")}]])` : ""}`);
  return [
    "---",
    `${HISTORY_FLAG}: ${HISTORY_VERSION}`,
    "---",
    "Creative Thesaurus history: every `/thesaurus::` call, newest first. Kept as a note so it syncs with the vault. The list is for reading; the JSON block below is what the plugin reads. Deleting the note starts afresh.",
    "",
    ...(lines.length ? lines : ["_No lookups yet._"]),
    "",
    "```json",
    JSON.stringify(h),
    "```",
    "",
  ].join("\n");
}

const BLOCK = /```json\s*\n([\s\S]*?)\n```/;

export function parseHistoryNote(markdown: string): History {
  const m = BLOCK.exec(markdown);
  if (!m) return EMPTY_HISTORY;
  try {
    return normalizeHistory(JSON.parse(m[1]!));
  } catch {
    return EMPTY_HISTORY;
  }
}

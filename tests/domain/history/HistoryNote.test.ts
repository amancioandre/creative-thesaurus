import { describe, it, expect } from "vitest";
import { parseHistoryNote, serializeHistoryNote, HISTORY_FLAG } from "../../../src/domain/history/HistoryNote";
import { appendEntry, EMPTY_HISTORY } from "../../../src/domain/history/History";

describe("HistoryNote", () => {
  const h = appendEntry(EMPTY_HISTORY, { at: "2026-08-29T10:05:00.000Z", query: "quiet", note: "Novel/Ch 1.md", sources: ["datamuse"], count: 4, picked: "hushed" }, 10);
  it("round-trips through a markdown note with a readable list and a JSON block", () => {
    const md = serializeHistoryNote(h);
    expect(md).toContain(`${HISTORY_FLAG}: 1`);
    expect(md).toContain("- 2026-08-29 10:05 — **quiet** → hushed ([[Novel/Ch 1]])");
    expect(parseHistoryNote(md)).toEqual(h);
  });
  it("says so when empty and is empty for a note without a block or with a broken one", () => {
    expect(serializeHistoryNote(EMPTY_HISTORY)).toContain("_No lookups yet._");
    expect(parseHistoryNote("# nothing")).toEqual(EMPTY_HISTORY);
    expect(parseHistoryNote("```json\n{oops\n```")).toEqual(EMPTY_HISTORY);
  });
});

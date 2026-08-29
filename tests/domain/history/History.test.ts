import { describe, it, expect } from "vitest";
import { appendEntry, distinctQueries, EMPTY_HISTORY, normalizeHistory, recordPick, removeEntry, type HistoryEntry } from "../../../src/domain/history/History";

const e = (query: string, at = "2026-08-29T10:00:00.000Z", note = "a.md"): HistoryEntry => ({ at, query, note, sources: ["datamuse"], count: 3 });

describe("History", () => {
  it("appends newest first and trims to the cap", () => {
    let h = appendEntry(EMPTY_HISTORY, e("one"), 2);
    h = appendEntry(h, e("two"), 2);
    h = appendEntry(h, e("three"), 2);
    expect(h.entries.map((x) => x.query)).toEqual(["three", "two"]);
  });
  it("refreshes the newest entry instead of repeating it when the same query comes straight back, keeping the pick", () => {
    let h = appendEntry(EMPTY_HISTORY, e("quiet", "2026-08-29T09:00:00.000Z"), 10);
    h = recordPick(h, "quiet", "a.md", "hushed");
    h = appendEntry(h, e("Quiet"), 10);
    expect(h.entries).toHaveLength(1);
    expect(h.entries[0]).toMatchObject({ query: "Quiet", at: "2026-08-29T10:00:00.000Z", picked: "hushed" });
    h = appendEntry(h, e("quiet", "2026-08-29T11:00:00.000Z", "b.md"), 10);
    expect(h.entries).toHaveLength(2);
  });
  it("records the pick on the latest matching entry only", () => {
    let h = appendEntry(EMPTY_HISTORY, e("quiet", "2026-08-29T09:00:00.000Z", "b.md"), 10);
    h = appendEntry(h, e("quiet"), 10);
    h = recordPick(h, "quiet", "a.md", "silent");
    expect(h.entries[0]!.picked).toBe("silent");
    expect(h.entries[1]!.picked).toBeUndefined();
    expect(recordPick(h, "nope", "a.md", "x")).toBe(h);
  });
  it("removes one entry by time and query", () => {
    const h = appendEntry(EMPTY_HISTORY, e("quiet"), 10);
    expect(removeEntry(h, "2026-08-29T10:00:00.000Z", "quiet").entries).toEqual([]);
  });
  it("normalises persisted data: drops malformed entries, sorts newest first", () => {
    const h = normalizeHistory({ entries: [{ at: "2026-01-01T00:00:00Z", query: "old" }, { at: "bad", query: "x" }, { query: "no time" }, { at: "2026-02-01T00:00:00Z", query: "new", note: 5, sources: ["d", 1], count: -2, picked: "" }, 7] });
    expect(h.entries.map((x) => x.query)).toEqual(["new", "old"]);
    expect(h.entries[0]).toEqual({ at: "2026-02-01T00:00:00Z", query: "new", note: "", sources: ["d"], count: 0 });
    expect(normalizeHistory(null)).toEqual(EMPTY_HISTORY);
  });
  it("lists distinct queries, most recent first", () => {
    let h = appendEntry(EMPTY_HISTORY, e("quiet"), 10);
    h = appendEntry(h, e("Loud"), 10);
    h = appendEntry(h, e("QUIET"), 10);
    expect(distinctQueries(h)).toEqual(["QUIET", "Loud"]);
  });
});

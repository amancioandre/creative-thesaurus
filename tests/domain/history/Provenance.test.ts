import { describe, it, expect } from "vitest";
import { picksFor } from "../../../src/domain/history/Provenance";
import { appendEntry, EMPTY_HISTORY } from "../../../src/domain/history/History";

const h = [
  { at: "2026-08-27T10:00:00.000Z", query: "lookup", note: "b.md", sources: [], count: 1, picked: "search" },
  { at: "2026-08-28T10:00:00.000Z", query: "quiet", note: "a.md", sources: [], count: 1, picked: "Search" },
  { at: "2026-08-29T10:00:00.000Z", query: "quiet", note: "c.md", sources: [], count: 1 },
].reduce((acc, e) => appendEntry(acc, e, 10), EMPTY_HISTORY);

describe("picksFor", () => {
  it("returns entries whose pick is the word, the given note's first, newest first", () => {
    expect(picksFor(h, "search", "b.md").map((e) => e.note)).toEqual(["b.md", "a.md"]);
    expect(picksFor(h, "SEARCH").map((e) => e.at)).toEqual(["2026-08-28T10:00:00.000Z", "2026-08-27T10:00:00.000Z"]);
  });
  it("is empty for a word never picked or an empty word", () => {
    expect(picksFor(h, "quiet")).toEqual([]);
    expect(picksFor(h, " ")).toEqual([]);
  });
});

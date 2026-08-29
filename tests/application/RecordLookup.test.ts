import { describe, it, expect } from "vitest";
import { RecordLookup } from "../../src/application/use-cases/RecordLookup";
import type { HistoryRepository } from "../../src/application/ports/HistoryRepository";
import { EMPTY_HISTORY, type History } from "../../src/domain/history/History";
import { parseQuery } from "../../src/domain/thesaurus/Query";
import type { LookupResult } from "../../src/domain/thesaurus/Suggestion";

const result = (text: string): LookupResult => ({ query: parseQuery(text)!, groups: [{ kind: "synonym", items: [{ word: "x", kind: "synonym", source: "d", score: 1 }, { word: "y", kind: "synonym", source: "d", score: 1 }] }], notes: [], sources: ["d"], errors: [] });

function repo(initial: History = EMPTY_HISTORY) {
  const r: HistoryRepository & { saved: History[]; loads: number } = { saved: [], loads: 0, load: async () => { r.loads++; return initial; }, save: async (h) => { r.saved.push(h); } };
  return r;
}

describe("RecordLookup", () => {
  it("records a lookup with count, note and time; then the pick", async () => {
    const r = repo();
    const changes: History[] = [];
    const uc = new RecordLookup(r, { enabled: () => true, maxEntries: () => 10, now: () => new Date("2026-08-29T10:00:00Z"), onChange: (h) => changes.push(h) });
    await uc.lookedUp(result("quiet"), "a.md");
    await uc.picked("quiet", "a.md", "x");
    expect(uc.current.entries).toEqual([{ at: "2026-08-29T10:00:00.000Z", query: "quiet", note: "a.md", sources: ["d"], count: 2, picked: "x" }]);
    expect(r.saved).toHaveLength(2);
    expect(changes).toHaveLength(2);
    expect(r.loads).toBe(1);
  });
  it("does nothing while history is off, and skips a save when nothing changed", async () => {
    const r = repo();
    const uc = new RecordLookup(r, { enabled: () => false, maxEntries: () => 10 });
    await uc.lookedUp(result("quiet"), "a.md");
    expect(r.saved).toEqual([]);
    const on = new RecordLookup(r, { enabled: () => true, maxEntries: () => 10 });
    await on.picked("never", "a.md", "x");
    expect(r.saved).toEqual([]);
  });
  it("removes and clears", async () => {
    const r = repo();
    const uc = new RecordLookup(r, { enabled: () => true, maxEntries: () => 10, now: () => new Date("2026-08-29T10:00:00Z") });
    await uc.lookedUp(result("a"), "");
    await uc.lookedUp(result("b"), "");
    await uc.remove("2026-08-29T10:00:00.000Z", "a");
    expect(uc.current.entries.map((e) => e.query)).toEqual(["b"]);
    await uc.clear();
    expect(uc.current).toEqual(EMPTY_HISTORY);
  });
  it("survives a repository that cannot load", async () => {
    const broken: HistoryRepository = { load: async () => { throw new Error("no vault"); }, save: async () => undefined };
    expect(await new RecordLookup(broken, { enabled: () => true, maxEntries: () => 10 }).load()).toEqual(EMPTY_HISTORY);
  });
});

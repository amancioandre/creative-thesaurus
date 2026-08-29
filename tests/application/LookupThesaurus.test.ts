import { describe, it, expect } from "vitest";
import { LookupThesaurus } from "../../src/application/use-cases/LookupThesaurus";
import type { SuggestionSource } from "../../src/application/ports/SuggestionSource";
import { parseQuery } from "../../src/domain/thesaurus/Query";
import type { CacheRepository } from "../../src/application/ports/CacheRepository";
import { EMPTY_CACHE, type ResultCache } from "../../src/domain/thesaurus/ResultCache";

function store(initial: ResultCache = EMPTY_CACHE) {
  const r: CacheRepository & { saved: ResultCache[] } = { saved: [], load: async () => initial, save: async (c) => { r.saved.push(c); } };
  return r;
}

const q = parseQuery("quiet")!;
const src = (name: string, words: string[], fail = false, notes: string[] = []): SuggestionSource & { calls: number } => {
  const s = {
    name, calls: 0,
    async suggest() { s.calls++; if (fail) throw new Error(`${name} down`); return { suggestions: words.map((w, i) => ({ word: w, kind: "synonym" as const, source: name, score: words.length - i })), notes }; },
  };
  return s;
};
const sig = () => new AbortController().signal;

describe("LookupThesaurus", () => {
  it("asks every source, merges, and reports which sources answered", async () => {
    const a = src("a", ["silent", "hushed"]), b = src("b", ["still"], false, ["e.g. x"]);
    const r = await new LookupThesaurus({ sources: () => [a, b], maxPerGroup: () => 8 }).execute(q, sig());
    expect(r.groups[0]!.items.map((i) => i.word)).toEqual(["silent", "still", "hushed"]); // each source's best is 1.0
    expect(r.sources).toEqual(["a", "b"]);
    expect(r.notes).toEqual(["e.g. x"]);
    expect(r.errors).toEqual([]);
  });
  it("tolerates one source failing and names it", async () => {
    const r = await new LookupThesaurus({ sources: () => [src("a", ["silent"]), src("ollama", [], true)], maxPerGroup: () => 8 }).execute(q, sig());
    expect(r.groups[0]!.items).toHaveLength(1);
    expect(r.errors).toEqual([{ source: "ollama", message: "ollama down" }]);
  });
  it("throws when every source fails, and when none is enabled", async () => {
    await expect(new LookupThesaurus({ sources: () => [src("a", [], true)], maxPerGroup: () => 8 }).execute(q, sig())).rejects.toThrow("a down");
    await expect(new LookupThesaurus({ sources: () => [], maxPerGroup: () => 8 }).execute(q, sig())).rejects.toThrow(/No source/);
  });
  it("caches by query, source set and source variant until invalidated", async () => {
    const a = src("a", ["x"]);
    let list: SuggestionSource[] = [a];
    const uc = new LookupThesaurus({ sources: () => list, maxPerGroup: () => 8 });
    await uc.execute(q, sig());
    await uc.execute(parseQuery("QUIET")!, sig());
    expect(a.calls).toBe(1);
    list = [a, src("b", ["y"])];
    await uc.execute(q, sig());
    expect(a.calls).toBe(2);
    list = [Object.assign(a, { variant: "pt" })];
    await uc.execute(q, sig());
    expect(a.calls).toBe(3);
    await uc.invalidate();
    await uc.execute(q, sig());
    expect(a.calls).toBe(4);
  });
  it("evicts the least recently used result beyond cacheSize", async () => {
    const a = src("a", ["x"]);
    let t = 0;
    const uc = new LookupThesaurus({ sources: () => [a], maxPerGroup: () => 8, cacheSize: 2, now: () => new Date(t++ * 1000) });
    for (const w of ["p", "q", "r", "p"]) await uc.execute(parseQuery(w)!, sig());
    expect(a.calls).toBe(4);
  });
  it("never caches an answer with a failed source, so the next call tries again", async () => {
    const a = src("a", ["x"]), bad = src("ollama", [], true);
    const uc = new LookupThesaurus({ sources: () => [a, bad], maxPerGroup: () => 8 });
    await uc.execute(q, sig());
    await uc.execute(q, sig());
    expect(a.calls).toBe(2);
  });
  it("loads answers from the store, serves them without asking a source, and writes new ones through", async () => {
    const a = src("a", ["x"]);
    const first = new LookupThesaurus({ sources: () => [a], maxPerGroup: () => 8, store: store(), now: () => new Date("2026-08-29T10:00:00Z") });
    const r1 = await first.execute(q, sig());
    const s = (first as unknown as { options: { store: ReturnType<typeof store> } }).options.store;
    expect(s.saved).toHaveLength(1);
    const second = new LookupThesaurus({ sources: () => [a], maxPerGroup: () => 8, store: store(s.saved[0]) });
    expect(await second.execute(q, sig())).toEqual(r1);
    expect(a.calls).toBe(1);
    const broken: CacheRepository = { load: async () => { throw new Error("disk"); }, save: async () => { throw new Error("disk"); } };
    expect((await new LookupThesaurus({ sources: () => [a], maxPerGroup: () => 8, store: broken }).execute(q, sig())).sources).toEqual(["a"]);
  });
  it("rejects with AbortError when the signal was aborted meanwhile", async () => {
    const c = new AbortController();
    const slow: SuggestionSource = { name: "s", suggest: async () => { c.abort(); return { suggestions: [] }; } };
    await expect(new LookupThesaurus({ sources: () => [slow], maxPerGroup: () => 8 }).execute(q, c.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});

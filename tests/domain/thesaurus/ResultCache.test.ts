import { describe, it, expect } from "vitest";
import { EMPTY_CACHE, normalizeCache, touchCache } from "../../../src/domain/thesaurus/ResultCache";
import { parseQuery } from "../../../src/domain/thesaurus/Query";
import type { LookupResult } from "../../../src/domain/thesaurus/Suggestion";

const result = (t: string): LookupResult => ({ query: parseQuery(t)!, groups: [], notes: [], sources: ["d"], errors: [] });

describe("ResultCache", () => {
  it("keeps the most recently used entries up to the cap", () => {
    let c = touchCache(EMPTY_CACHE, "a", result("a"), "2026-01-01T00:00:00Z", 2);
    c = touchCache(c, "b", result("b"), "2026-01-02T00:00:00Z", 2);
    c = touchCache(c, "a", result("a"), "2026-01-03T00:00:00Z", 2);
    c = touchCache(c, "c", result("c"), "2026-01-04T00:00:00Z", 2);
    expect(Object.keys(c.entries).sort()).toEqual(["a", "c"]);
  });
  it("normalises what was on disk and drops errors and malformed entries", () => {
    const c = normalizeCache({ entries: { ok: { at: "2026-01-01T00:00:00Z", result: { ...result("in the end"), errors: [{ source: "x", message: "y" }] } }, bad: { at: "nope", result: result("x") }, worse: { at: "2026-01-01T00:00:00Z", result: { query: 3 } }, 4: null } });
    expect(Object.keys(c.entries)).toEqual(["ok"]);
    expect(c.entries.ok!.result.errors).toEqual([]);
    expect(c.entries.ok!.result.query.isPhrase).toBe(true);
    expect(normalizeCache("junk")).toEqual(EMPTY_CACHE);
  });
});

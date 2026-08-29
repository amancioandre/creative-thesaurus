import { describe, it, expect } from "vitest";
import { DatamuseSource } from "../../../src/infrastructure/datamuse/DatamuseSource";
import { parseQuery } from "../../../src/domain/thesaurus/Query";
import { FakeHttp, type Call } from "../llm/fixtures";

const sig = () => new AbortController().signal;
const param = (c: Call) => { const u = new URL(c.url); return { path: u.pathname, p: Object.fromEntries(u.searchParams) }; };
const words = (list: Array<[string, number, string[]?]>) => list.map(([word, score, tags]) => ({ word, score, ...(tags ? { tags } : {}) }));

describe("DatamuseSource", () => {
  it("asks for synonyms, antonyms and related words of a word, in parallel, with parts of speech", async () => {
    const http = new FakeHttp((c) => {
      const { p } = param(c);
      if (p.rel_syn) return { status: 200, json: words([["silent", 900, ["syn", "adj"]], ["hushed", 800, ["syn", "adj", "n"]]]) };
      if (p.rel_ant) return { status: 200, json: words([["loud", 500, ["adj"]]]) };
      return { status: 200, json: words([["library", 100]]) };
    });
    const out = await new DatamuseSource(http, { max: 5 }).suggest(parseQuery("quiet")!, sig());
    expect(http.calls.map((c) => param(c).path)).toEqual(["/words", "/words", "/words"]);
    expect(param(http.calls[0]!).p).toEqual({ rel_syn: "quiet", md: "p", max: "5" });
    expect(out.suggestions).toEqual([
      { word: "silent", kind: "synonym", source: "datamuse", score: 900, pos: "adj" },
      { word: "hushed", kind: "synonym", source: "datamuse", score: 800, pos: "adj" },
      { word: "loud", kind: "antonym", source: "datamuse", score: 500, pos: "adj" },
      { word: "library", kind: "related", source: "datamuse", score: 100 },
    ]);
  });
  it("asks means-like for a phrase and files the answers as alternatives", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: words([["ultimately", 10]]) }));
    const out = await new DatamuseSource(http).suggest(parseQuery("in the end")!, sig());
    expect(http.calls).toHaveLength(1);
    expect(param(http.calls[0]!).p.ml).toBe("in the end");
    expect(out.suggestions[0]).toMatchObject({ word: "ultimately", kind: "alternative" });
  });
  it("falls back to means-like when a word has no strict relations", async () => {
    const http = new FakeHttp((c) => ({ status: 200, json: param(c).p.ml ? words([["near", 1]]) : [] }));
    const out = await new DatamuseSource(http).suggest(parseQuery("zorp")!, sig());
    expect(http.calls).toHaveLength(4);
    expect(out.suggestions.map((s) => [s.word, s.kind])).toEqual([["near", "synonym"]]);
  });
  it("sends the key when configured and honours a custom base url", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: [] }));
    await new DatamuseSource(http, { apiKey: "abc", baseUrl: "http://proxy/" }).suggest(parseQuery("in the end")!, sig());
    expect(http.calls[0]!.url.startsWith("http://proxy/words?")).toBe(true);
    expect(param(http.calls[0]!).p.key).toBe("abc");
  });
  it("keeps the answers that arrived when one call fails, and throws only when all do", async () => {
    const flaky = new FakeHttp((c) => (param(c).p.rel_ant ? { status: 500, json: null } : { status: 200, json: words([["x", 1]]) }));
    const out = await new DatamuseSource(flaky).suggest(parseQuery("quiet")!, sig());
    expect(out.suggestions.map((s) => s.kind)).toEqual(["synonym", "related"]);
    await expect(new DatamuseSource(new FakeHttp(() => ({ status: 503, json: null }))).suggest(parseQuery("quiet")!, sig())).rejects.toThrow(/HTTP 503/);
    await expect(new DatamuseSource(new FakeHttp(() => ({ status: 200, json: { nope: 1 } }))).suggest(parseQuery("quiet")!, sig())).rejects.toThrow(/unexpected/);
  });
});

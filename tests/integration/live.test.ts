import { describe, it, expect } from "vitest";
import type { HttpClient } from "../../src/application/ports/HttpClient";
import { DatamuseSource } from "../../src/infrastructure/datamuse/DatamuseSource";
import { OllamaThesaurusSource } from "../../src/infrastructure/llm/OllamaThesaurusSource";
import { LookupThesaurus } from "../../src/application/use-cases/LookupThesaurus";
import { parseQuery } from "../../src/domain/thesaurus/Query";

/**
 * Talks to the real services. Run with:
 *   DATAMUSE_LIVE=1 npx vitest run tests/integration
 *   OLLAMA_LIVE=1 [OLLAMA_MODEL=qwen2.5:7b] npx vitest run tests/integration
 * Skipped otherwise so the suite stays hermetic.
 */
const datamuseLive = process.env.DATAMUSE_LIVE === "1";
const ollamaLive = process.env.OLLAMA_LIVE === "1";
const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

const fetchHttp: HttpClient = {
  async getJson(url, headers, signal) { const r = await fetch(url, { headers, signal }); return { status: r.status, json: await r.json() }; },
  async postJson(url, body, headers, signal) { const r = await fetch(url, { method: "POST", body: JSON.stringify(body), headers, signal }); return { status: r.status, json: await r.json() }; },
};

describe.skipIf(!datamuseLive)("Datamuse live", () => {
  it("finds synonyms and antonyms for a word, and rewordings for a phrase", async () => {
    const src = new DatamuseSource(fetchHttp);
    const word = await src.suggest(parseQuery("quiet")!, new AbortController().signal);
    expect(word.suggestions.some((s) => s.kind === "synonym")).toBe(true);
    expect(word.suggestions.some((s) => s.kind === "antonym")).toBe(true);
    const phrase = await src.suggest(parseQuery("in the end")!, new AbortController().signal);
    expect(phrase.suggestions.every((s) => s.kind === "alternative")).toBe(true);
    console.log("\nquiet →", word.suggestions.slice(0, 6).map((s) => `${s.word} (${s.kind})`).join(", "));
  }, 30_000);
});

describe.skipIf(!ollamaLive)(`Ollama live (${model})`, () => {
  it("returns validated suggestions with register notes within a sane time", async () => {
    const src = new OllamaThesaurusSource(fetchHttp, { baseUrl: "http://localhost:11434", model, explainIn: "" });
    const t0 = performance.now();
    const out = await new LookupThesaurus({ sources: () => [src], maxPerGroup: () => 8 }).execute(parseQuery("quiet")!, new AbortController().signal);
    console.log(`\n${model}: ${out.groups.map((g) => `${g.kind}×${g.items.length}`).join(" ")} in ${Math.round(performance.now() - t0)} ms`);
    for (const g of out.groups) for (const s of g.items) console.log(`  [${g.kind}] ${s.word} — ${s.note ?? ""}`);
    for (const n of out.notes) console.log(`  ${n}`);
    expect(out.groups.find((g) => g.kind === "synonym")!.items.length).toBeGreaterThanOrEqual(3);
    expect(out.groups[0]!.items.some((s) => s.note)).toBe(true);
  }, 120_000);
});

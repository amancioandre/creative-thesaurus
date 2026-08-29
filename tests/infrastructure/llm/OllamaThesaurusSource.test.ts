import { describe, it, expect } from "vitest";
import { OllamaThesaurusSource } from "../../../src/infrastructure/llm/OllamaThesaurusSource";
import { THESAURUS_RULEBOOK } from "../../../src/infrastructure/llm/prompts/thesaurusRulebook";
import { parseQuery } from "../../../src/domain/thesaurus/Query";
import { FakeHttp, OLLAMA_OK } from "./fixtures";

const q = parseQuery("quiet")!;
const sig = () => new AbortController().signal;

describe("OllamaThesaurusSource", () => {
  it("posts the rulebook, the word, the language to explain in and a JSON schema; no streaming; temperature 0", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: OLLAMA_OK }));
    const src = new OllamaThesaurusSource(http, { baseUrl: "http://localhost:11434/", model: "qwen2.5:7b", explainIn: "Portuguese" });
    expect(src.name).toBe("ollama:qwen2.5:7b");
    const out = await src.suggest(q, sig());
    const call = http.calls[0]!;
    expect(call.url).toBe("http://localhost:11434/api/chat");
    const body = call.body as { model: string; stream: boolean; format: { required: string[] }; options: { temperature: number }; messages: Array<{ role: string; content: string }> };
    expect(body.model).toBe("qwen2.5:7b");
    expect(body.stream).toBe(false);
    expect(body.options.temperature).toBe(0);
    expect(body.messages[0]).toEqual({ role: "system", content: THESAURUS_RULEBOOK });
    expect(body.messages[1]!.content).toBe("Word: <<<quiet>>>\nExplain in: Portuguese");
    expect(body.format.required).toEqual(["synonyms", "alternatives", "antonyms", "example", "caution"]);
    expect(out.suggestions.map((s) => s.word)).toEqual(["silent", "hushed", "keep it down", "loud"]);
    expect(out.notes).toEqual(["e.g. The house was silent."]);
  });
  it("says Phrase for a phrase and defaults to English", async () => {
    const http = new FakeHttp(() => ({ status: 200, json: OLLAMA_OK }));
    await new OllamaThesaurusSource(http, { baseUrl: "x", model: "m" }).suggest(parseQuery("in the end")!, sig());
    expect((http.calls[0]!.body as { messages: Array<{ content: string }> }).messages[1]!.content).toBe("Phrase: <<<in the end>>>\nExplain in: English");
  });
  it("strips <think> blocks and fences", async () => {
    const content = "<think>hm</think>```json\n" + JSON.stringify({ synonyms: [{ word: "still", register: "neutral", note: "" }] }) + "\n```";
    const out = await new OllamaThesaurusSource(new FakeHttp(() => ({ status: 200, json: { message: { content } } })), { baseUrl: "x", model: "m" }).suggest(q, sig());
    expect(out.suggestions.map((s) => s.word)).toEqual(["still"]);
  });
  it("throws descriptively on HTTP errors and on non-JSON content", async () => {
    await expect(new OllamaThesaurusSource(new FakeHttp(() => ({ status: 404, json: { error: "model 'nope' not found" } })), { baseUrl: "x", model: "nope" }).suggest(q, sig())).rejects.toThrow(/nope/);
    await expect(new OllamaThesaurusSource(new FakeHttp(() => ({ status: 500, json: null })), { baseUrl: "x", model: "m" }).suggest(q, sig())).rejects.toThrow(/HTTP 500/);
    await expect(new OllamaThesaurusSource(new FakeHttp(() => ({ status: 200, json: { message: { content: "no" } } })), { baseUrl: "x", model: "m" }).suggest(q, sig())).rejects.toThrow(/JSON/);
  });
});

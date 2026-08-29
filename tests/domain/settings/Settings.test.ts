import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_TRIGGERS, llmConfigEquals, normalizeNotePath, normalizeSettings, normalizeTriggers, sourcesEqual, textToTriggers, triggersToText } from "../../../src/domain/settings/Settings";

describe("normalizeSettings", () => {
  it("returns defaults for nothing, garbage, or the wrong types", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ enabled: "yes", idleMs: "slow", datamuse: 3, llm: null, history: [] })).toEqual(DEFAULT_SETTINGS);
  });
  it("keeps valid values, clamps numbers and drops unknown keys", () => {
    const s = normalizeSettings({ enabled: false, idleMs: 99999, maxPerGroup: 1, datamuse: { enabled: false, apiKey: " k " }, llm: { provider: "ollama", ollamaModel: "llama3", explainIn: " Português " }, history: { notePath: "notes/hist", maxEntries: 2 }, bogus: 1 });
    expect(s.enabled).toBe(false);
    expect(s.idleMs).toBe(3000);
    expect(s.maxPerGroup).toBe(3);
    expect(s.datamuse).toEqual({ enabled: false, apiKey: "k" });
    expect(s.llm).toEqual({ provider: "ollama", ollamaUrl: DEFAULT_SETTINGS.llm.ollamaUrl, ollamaModel: "llama3", explainIn: "Português" });
    expect(s.history).toEqual({ enabled: true, inVaultNote: false, notePath: "notes/hist.md", maxEntries: 50 });
    expect(normalizeSettings({ history: { inVaultNote: true } }).history.inVaultNote).toBe(true);
    expect("bogus" in s).toBe(false);
  });
  it("reads the search scope, defaulting to the story", () => {
    expect(normalizeSettings({ searchScope: "vault" }).searchScope).toBe("vault");
    expect(normalizeSettings({ searchScope: "galaxy" }).searchScope).toBe("story");
  });
  it("rejects unknown providers", () => {
    expect(normalizeSettings({ llm: { provider: "claude" } }).llm.provider).toBe("off");
  });
});

describe("normalizeTriggers", () => {
  it("sorts longest first, trims, dedupes, drops whitespace and one-character triggers", () => {
    expect(normalizeTriggers(["/th::", " /thesaurus:: ", "/th::", "a", "bad one", 3])).toEqual(["/thesaurus::", "/th::"]);
  });
  it("falls back to defaults when nothing usable is left", () => {
    expect(normalizeTriggers([])).toEqual(DEFAULT_TRIGGERS);
    expect(normalizeTriggers("")).toEqual(DEFAULT_TRIGGERS);
  });
  it("accepts the settings box text", () => {
    expect(normalizeTriggers("/syn::\n/thesaurus::")).toEqual(["/thesaurus::", "/syn::"]);
    expect(triggersToText(["/a::", "/b::"])).toBe("/a::\n/b::");
    expect(textToTriggers("/a::, /b::\n\n")).toEqual(["/a::", "/b::"]);
  });
});

describe("normalizeNotePath", () => {
  it("tidies a vault path and appends .md", () => {
    expect(normalizeNotePath(" \\Creative//History ")).toBe("Creative/History.md");
    expect(normalizeNotePath("x.MD")).toBe("x.MD");
    expect(normalizeNotePath("folder/")).toBeNull();
    expect(normalizeNotePath(4)).toBeNull();
  });
});

describe("equality helpers", () => {
  it("tell when the model or the source set changed", () => {
    const a = DEFAULT_SETTINGS;
    expect(llmConfigEquals(a.llm, { ...a.llm })).toBe(true);
    expect(llmConfigEquals(a.llm, { ...a.llm, explainIn: "pt" })).toBe(false);
    expect(sourcesEqual(a, { ...a, idleMs: 1 })).toBe(true);
    expect(sourcesEqual(a, { ...a, datamuse: { ...a.datamuse, enabled: false } })).toBe(false);
    expect(sourcesEqual(a, { ...a, maxPerGroup: 4 })).toBe(false);
  });
});

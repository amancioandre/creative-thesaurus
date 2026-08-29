import { describe, it, expect } from "vitest";
import { validateModelSuggestions } from "../../../src/domain/thesaurus/validateModelSuggestions";
import { parseQuery } from "../../../src/domain/thesaurus/Query";

const q = parseQuery("quiet")!;

describe("validateModelSuggestions", () => {
  it("maps synonyms, alternatives and antonyms with register and note, ranked in the model's order", () => {
    const r = validateModelSuggestions({
      synonyms: [{ word: "silent", register: "neutral", note: "No sound at all." }, { word: "hushed", register: "literary", note: "Deliberately lowered." }],
      alternatives: [{ phrase: "keep it down", note: "Informal request." }],
      antonyms: [{ word: "loud", note: "" }],
      example: "The house was silent.",
      caution: "“Quiet” is not a verb in most contexts.",
    }, q, "ollama:m");
    expect(r.suggestions.map((s) => [s.word, s.kind, s.score])).toEqual([["silent", "synonym", 2], ["hushed", "synonym", 1], ["keep it down", "alternative", 1], ["loud", "antonym", 1]]);
    expect(r.suggestions[0]!.note).toBe("No sound at all.");
    expect(r.suggestions[1]!.note).toBe("literary — Deliberately lowered.");
    expect(r.suggestions[3]!.note).toBeUndefined();
    expect(r.suggestions.every((s) => s.source === "ollama:m")).toBe(true);
    expect(r.notes).toEqual(["e.g. The house was silent.", "“Quiet” is not a verb in most contexts."]);
  });
  it("drops the query itself, blanks, duplicates and non-strings; accepts bare strings", () => {
    const r = validateModelSuggestions({ synonyms: ["Quiet", "", 4, "still", { word: "still" }, { word: "  calm  " }], antonyms: null }, q, "m");
    expect(r.suggestions.map((s) => s.word)).toEqual(["still", "calm"]);
  });
  it("caps lengths and survives garbage", () => {
    expect(validateModelSuggestions(null, q, "m")).toEqual({ suggestions: [], notes: [] });
    const r = validateModelSuggestions({ synonyms: [{ word: "x".repeat(200), note: "y".repeat(500) }], example: "z".repeat(500) }, q, "m");
    expect(r.suggestions[0]!.word).toHaveLength(80);
    expect(r.suggestions[0]!.note).toHaveLength(240);
    expect(r.notes[0]!.length).toBeLessThanOrEqual(245);
  });
});

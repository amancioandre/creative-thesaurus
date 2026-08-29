import { describe, it, expect } from "vitest";
import { isEmptyResult, mergeSuggestions, type Suggestion } from "../../../src/domain/thesaurus/Suggestion";
import { parseQuery } from "../../../src/domain/thesaurus/Query";

const q = parseQuery("quiet")!;
const s = (word: string, kind: Suggestion["kind"], source: string, score: number, note?: string): Suggestion => ({ word, kind, source, score, ...(note ? { note } : {}) });

describe("mergeSuggestions", () => {
  it("groups by kind in a fixed order and drops empty groups", () => {
    const groups = mergeSuggestions(q, [s("loud", "antonym", "d", 1), s("silent", "synonym", "d", 1)], 8);
    expect(groups.map((g) => g.kind)).toEqual(["synonym", "antonym"]);
  });
  it("merges the same word from two sources, keeping the note and counting agreement first", () => {
    const groups = mergeSuggestions(q, [s("hushed", "synonym", "datamuse", 100), s("silent", "synonym", "datamuse", 90), s("Silent", "synonym", "ollama", 3, "literary"), s("still", "synonym", "ollama", 5)], 8);
    const words = groups[0]!.items.map((i) => i.word);
    expect(words[0]).toBe("silent");
    expect(groups[0]!.items[0]).toMatchObject({ note: "literary", source: "datamuse+ollama" });
    expect(words).toEqual(["silent", "hushed", "still"]);
  });
  it("normalises scores per source so a 40-million Datamuse score does not bury a rank-5 model pick", () => {
    const groups = mergeSuggestions(q, [s("a", "synonym", "datamuse", 40_000_000), s("b", "synonym", "ollama", 5), s("c", "synonym", "datamuse", 1)], 8);
    expect(groups[0]!.items.map((i) => i.word)).toEqual(["a", "b", "c"]);
  });
  it("never suggests the query itself or blank words, and caps each group", () => {
    const groups = mergeSuggestions(q, [s("Quiet", "synonym", "d", 9), s("  ", "synonym", "d", 8), s("a", "synonym", "d", 3), s("b", "synonym", "d", 2), s("c", "synonym", "d", 1)], 2);
    expect(groups[0]!.items.map((i) => i.word)).toEqual(["a", "b"]);
  });
  it("is empty for nothing", () => {
    expect(mergeSuggestions(q, [], 8)).toEqual([]);
    expect(isEmptyResult({ query: q, groups: [], notes: [], sources: [], errors: [] })).toBe(true);
    expect(isEmptyResult({ query: q, groups: [], notes: ["x"], sources: [], errors: [] })).toBe(false);
  });
});

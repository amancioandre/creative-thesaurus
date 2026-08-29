import { describe, it, expect } from "vitest";
import { findOccurrences } from "../../../src/domain/text/Occurrences";

describe("findOccurrences", () => {
  it("finds whole words, case-insensitively, with line, offset and a snippet", () => {
    const hits = findOccurrences("A search here.\nResearch is not it; Search is.\nsearching no", "search");
    expect(hits.map((h) => [h.line, h.ch])).toEqual([[0, 2], [1, 20]]);
    expect(hits[0]!.snippet).toBe("A search here.");
  });
  it("matches phrases across flexible whitespace and escapes regex characters", () => {
    expect(findOccurrences("in  the end. (in the end)", "in the end")).toHaveLength(2);
    expect(findOccurrences("a.b and axb", "a.b")).toHaveLength(1);
  });
  it("respects the cap and empty terms", () => {
    expect(findOccurrences("x x x", "x", 2)).toHaveLength(2);
    expect(findOccurrences("x", " ")).toEqual([]);
  });
  it("truncates long lines around the hit", () => {
    const line = `${"a ".repeat(40)}quiet${" b".repeat(40)}`;
    const [h] = findOccurrences(line, "quiet");
    expect(h!.snippet.startsWith("…")).toBe(true);
    expect(h!.snippet.endsWith("…")).toBe(true);
    expect(h!.snippet).toContain("quiet");
  });
});

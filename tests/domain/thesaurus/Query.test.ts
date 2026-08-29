import { describe, it, expect } from "vitest";
import { parseQuery } from "../../../src/domain/thesaurus/Query";

describe("parseQuery", () => {
  it("tidies whitespace and edge punctuation, keeps case for display, lowercases the key", () => {
    expect(parseQuery("  Quiet, ")).toEqual({ text: "Quiet", key: "quiet", isPhrase: false });
    expect(parseQuery("“in   the  end”")).toEqual({ text: "in the end", key: "in the end", isPhrase: true });
  });
  it("keeps inner punctuation", () => {
    expect(parseQuery("rock 'n' roll")?.text).toBe("rock 'n' roll");
    expect(parseQuery("self-aware")?.text).toBe("self-aware");
  });
  it("is null for nothing, punctuation only, or a paragraph", () => {
    expect(parseQuery("")).toBeNull();
    expect(parseQuery(" ... ")).toBeNull();
    expect(parseQuery("x".repeat(121))).toBeNull();
  });
});

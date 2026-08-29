import { describe, it, expect } from "vitest";
import { findCommand, wordAt } from "../../../src/domain/command/ThesaurusCommand";

const T = ["/thesaurus::", "/th::"];

describe("findCommand", () => {
  it("finds the trigger before the cursor and takes everything up to the cursor as the query", () => {
    const line = "She was /thesaurus::quiet";
    const c = findCommand(line, line.length, T)!;
    expect(c).toMatchObject({ trigger: "/thesaurus::", from: 8, to: line.length, raw: "quiet" });
    expect(c.query).toEqual({ text: "quiet", key: "quiet", isPhrase: false });
  });
  it("accepts phrases with spaces", () => {
    const line = "/th::in the end";
    expect(findCommand(line, line.length, T)!.query?.text).toBe("in the end");
  });
  it("has a null query while only the trigger has been typed", () => {
    expect(findCommand("/thesaurus::", 12, T)!.query).toBeNull();
    expect(findCommand("/thesaurus:: ", 13, T)!.query).toBeNull();
  });
  it("ignores text after the cursor so the command can sit mid-sentence", () => {
    const line = "the /th::quiet house";
    const c = findCommand(line, 14, T)!;
    expect(c.raw).toBe("quiet");
    expect(c.to).toBe(14);
  });
  it("uses the last trigger before the cursor", () => {
    const line = "/th::one and /th::two";
    expect(findCommand(line, line.length, T)!.query?.text).toBe("two");
    expect(findCommand(line, 8, T)!.query?.text).toBe("one");
  });
  it("prefers the longer trigger when triggers overlap", () => {
    const line = "/thesaurus::x";
    expect(findCommand(line, line.length, ["/th::", "/thesaurus::"])!.trigger).toBe("/thesaurus::");
  });
  it("is null when the cursor is before the trigger or there is none", () => {
    expect(findCommand("abc /th::x", 2, T)).toBeNull();
    expect(findCommand("plain prose", 5, T)).toBeNull();
  });
  it("stands down after two spaces: the writer has moved on", () => {
    expect(findCommand("/th::quiet  and then", 20, T)).toBeNull();
    expect(findCommand("/th::quiet ", 11, T)).not.toBeNull();
  });
});

describe("wordAt", () => {
  it("returns the word around the cursor, with apostrophes and hyphens", () => {
    expect(wordAt("the well-known don't", 6)).toEqual({ from: 4, to: 14, text: "well-known" });
    expect(wordAt("the well-known don't", 17)).toEqual({ from: 15, to: 20, text: "don't" });
    expect(wordAt("é útil", 3)).toEqual({ from: 2, to: 6, text: "útil" });
  });
  it("is null between words, and takes the word the cursor touches at either end", () => {
    expect(wordAt("a  b", 2)).toBeNull();
    expect(wordAt("a b", 1)?.text).toBe("a");
    expect(wordAt("a b", 2)?.text).toBe("b");
  });
});

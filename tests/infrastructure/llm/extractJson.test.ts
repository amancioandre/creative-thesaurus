import { describe, it, expect } from "vitest";
import { extractJson } from "../../../src/infrastructure/llm/extractJson";

describe("extractJson", () => {
  it("parses a bare object, one in fences, one after a <think> block, one in prose", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('<think>{not this}</think>{"a":2}')).toEqual({ a: 2 });
    expect(extractJson('Sure! {"a":3} Hope this helps.')).toEqual({ a: 3 });
  });
  it("is null for no object or a broken one", () => {
    expect(extractJson("nothing")).toBeNull();
    expect(extractJson("{oops")).toBeNull();
  });
});

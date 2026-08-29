import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { commandAtCursor, explicitTarget } from "../../../src/infrastructure/codemirror/commandAtCursor";
import { settingsFacet } from "../../../src/infrastructure/codemirror/settingsFacet";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/Settings";

const state = (doc: string, anchor: number, head = anchor) => EditorState.create({ doc, selection: { anchor, head }, extensions: [settingsFacet.of(DEFAULT_SETTINGS)] });

describe("commandAtCursor", () => {
  it("returns absolute offsets for a command on the second line", () => {
    const doc = "first line\nShe was /th::quiet";
    const t = commandAtCursor(state(doc, doc.length))!;
    expect(t).toMatchObject({ from: 19, to: doc.length, typed: true });
    expect(t.query?.text).toBe("quiet");
  });
  it("is null on a plain line", () => {
    expect(commandAtCursor(state("plain", 3))).toBeNull();
  });
});

describe("explicitTarget", () => {
  it("prefers the typed command, then a single-line selection, then the word under the cursor", () => {
    expect(explicitTarget(state("/th::x", 6))?.typed).toBe(true);
    const sel = explicitTarget(state("a quiet house", 2, 7))!;
    expect(sel).toMatchObject({ from: 2, to: 7, typed: false });
    expect(sel.query?.text).toBe("quiet");
    const word = explicitTarget(state("a quiet house", 4))!;
    expect(word).toMatchObject({ from: 2, to: 7 });
    expect(word.query?.text).toBe("quiet");
  });
  it("falls back to the word at the head of a multi-line selection, and is null between words", () => {
    expect(explicitTarget(state("a\nb", 0, 3))).toMatchObject({ from: 2, to: 3, typed: false });
    expect(explicitTarget(state("a  b", 2))).toBeNull();
  });
});

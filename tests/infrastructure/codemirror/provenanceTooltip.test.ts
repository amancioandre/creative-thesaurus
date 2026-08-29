import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { provenanceAt, renderProvenance } from "../../../src/infrastructure/codemirror/provenanceTooltip";

const entry = { at: "2026-08-29T10:00:00.000Z", query: "lookup", note: "a.md", sources: ["d"], count: 3, picked: "search" };
const opts = { picksFor: (w: string) => (w.toLowerCase() === "search" ? [entry] : []), pathOf: () => "a.md" };
const doc = "A search here.\nAnother search, and a Search.";

describe("provenanceAt", () => {
  it("describes a picked word under the cursor with its other occurrences in the note", () => {
    const p = provenanceAt(EditorState.create({ doc }), 3, opts)!;
    expect(p).toMatchObject({ from: 2, to: 8, word: "search" });
    expect(p.entries).toEqual([entry]);
    expect(p.elsewhere.map((o) => [o.line, o.ch])).toEqual([[1, 8], [1, 22]]);
  });
  it("is null on a word that was never picked, or on whitespace", () => {
    expect(provenanceAt(EditorState.create({ doc }), 10, opts)).toBeNull();
    expect(provenanceAt(EditorState.create({ doc }), 1, opts)).toBeNull();
  });
});

describe("renderProvenance", () => {
  it("shows original → picked, the date, and clickable hits, as text nodes", () => {
    const p = provenanceAt(EditorState.create({ doc }), 3, { ...opts, picksFor: () => [{ ...entry, query: "<b>x</b>" }] })!;
    const revealed: number[][] = [];
    const dom = renderProvenance(p, (line, ch) => revealed.push([line, ch]));
    expect(dom.querySelector("b")).toBeNull();
    expect(dom.querySelector(".cts-provenance-was")?.textContent).toBe("<b>x</b>");
    expect(dom.querySelector(".cts-provenance-now")?.textContent).toBe("search");
    expect(dom.querySelector(".cts-provenance-meta")?.textContent).toBe("looked up 2026-08-29");
    expect(dom.querySelector(".cts-provenance-title")?.textContent).toBe("Also in this note (2)");
    dom.querySelectorAll<HTMLElement>(".cts-provenance-hit")[1]!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(revealed).toEqual([[1, 22]]);
  });
});

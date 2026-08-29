import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LookupThesaurus } from "../../../src/application/use-cases/LookupThesaurus";
import type { SuggestionSource } from "../../../src/application/ports/SuggestionSource";
import { closePopup, lookupNow, popupField, thesaurusExtension } from "../../../src/infrastructure/codemirror/thesaurusExtension";
import type { LookupResult } from "../../../src/domain/thesaurus/Suggestion";
import { mount, type Harness } from "./helpers";

const timers = { set: (fn: () => void, ms: number) => window.setTimeout(fn, ms), clear: (id: number) => window.clearTimeout(id) };
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

function fakeSource(delay = 20): SuggestionSource & { calls: string[]; fail: boolean } {
  const s = {
    name: "fake", calls: [] as string[], fail: false,
    async suggest(q: { text: string }, signal: AbortSignal) {
      s.calls.push(q.text);
      await new Promise<void>((res, rej) => { const t = setTimeout(res, delay); signal.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("aborted", "AbortError")); }); });
      if (s.fail) throw new Error("fake down");
      return { suggestions: [{ word: `${q.text}-1`, kind: "synonym" as const, source: "fake", score: 2, note: "first" }, { word: `${q.text}-2`, kind: "synonym" as const, source: "fake", score: 1 }, { word: "opp", kind: "antonym" as const, source: "fake", score: 1 }], notes: ["e.g. an example"] };
    },
  };
  return s;
}

describe("thesaurusExtension", () => {
  let h: Harness;
  let source: ReturnType<typeof fakeSource>;
  let results: LookupResult[];
  let picks: Array<[string, string]>;
  let errors: unknown[];

  beforeEach(() => {
    vi.useFakeTimers();
    source = fakeSource();
    results = []; picks = []; errors = [];
  });
  afterEach(() => { h?.destroy(); vi.useRealTimers(); });

  const ext = () => thesaurusExtension({ lookup: new LookupThesaurus({ sources: () => [source], maxPerGroup: () => 8 }), timers, idleMs: 100, onResult: (r) => results.push(r), onPick: (q, w) => picks.push([q, w]), onError: (e) => errors.push(e) });

  it("opens a box with the results after the writer pauses on a typed command", async () => {
    h = mount("She was ", ext());
    h.moveCursor(8);
    h.type("/thesaurus::quiet");
    await tick(50);
    expect(h.popup()).toBeNull();
    expect(source.calls).toEqual([]);
    await tick(55);
    expect(h.popup()?.textContent).toContain("looking up…");
    await tick(30);
    const box = h.popup()!;
    expect(source.calls).toEqual(["quiet"]);
    expect(box.classList.contains("cm-tooltip")).toBe(true); // the box is the tooltip element itself; styles.css themes `.cm-tooltip.cts-popup`
    expect(box.querySelector(".cts-popup-query")?.textContent).toBe("quiet");
    expect(Array.from(box.querySelectorAll(".cts-word")).map((e) => e.textContent)).toEqual(["quiet-1", "quiet-2", "opp"]);
    expect(box.querySelector(".cts-note")?.textContent).toBe("first");
    expect(box.querySelector(".cts-notes")?.textContent).toContain("an example");
    expect(box.querySelector(".is-selected .cts-word")?.textContent).toBe("quiet-1");
    expect(results).toHaveLength(1);
  });

  it("debounces while typing and never shows an answer to an older query", async () => {
    h = mount("", ext());
    h.type("/th::qui");
    await tick(60);
    h.type("et");
    await tick(150);
    expect(source.calls).toEqual(["quiet"]);
    expect(h.popup()?.querySelector(".cts-popup-query")?.textContent).toBe("quiet");
    h.type("ly");
    await tick(0);
    expect(h.popup()).toBeNull();
    await tick(150);
    expect(source.calls).toEqual(["quiet", "quietly"]);
  });

  it("closes when the cursor leaves the command and does nothing while the trigger alone is typed", async () => {
    h = mount("above\n", ext());
    h.moveCursor(6);
    h.type("/th::");
    await tick(200);
    expect(source.calls).toEqual([]);
    h.type("quiet");
    await tick(150);
    expect(h.popup()).not.toBeNull();
    h.moveCursor(0);
    await tick(0);
    expect(h.popup()).toBeNull();
  });

  it("walks the list with the arrows, inserts with Enter, replacing the whole command", async () => {
    h = mount("She was /th::quiet here", ext());
    h.moveCursor(18);
    h.type("");
    await tick(150);
    expect(h.key("ArrowDown")).toBe(true);
    expect(h.popup()?.querySelector(".is-selected .cts-word")?.textContent).toBe("quiet-2");
    h.key("ArrowUp"); h.key("ArrowUp");
    expect(h.popup()?.querySelector(".is-selected .cts-word")?.textContent).toBe("opp");
    expect(h.key("Enter")).toBe(true);
    expect(h.view.state.doc.toString()).toBe("She was opp here");
    expect(h.view.state.selection.main.head).toBe(11);
    expect(h.popup()).toBeNull();
    expect(picks).toEqual([["quiet", "opp"]]);
  });

  it("inserts on click too", async () => {
    h = mount("/th::quiet", ext());
    h.moveCursor(10); h.type("");
    await tick(150);
    h.popup()!.querySelectorAll<HTMLElement>(".cts-item")[1]!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(h.view.state.doc.toString()).toBe("quiet-2");
    expect(picks).toEqual([["quiet", "quiet-2"]]);
  });

  it("Escape closes the box and keeps it closed until the query changes; keys fall through when closed", async () => {
    h = mount("/th::quiet", ext());
    h.moveCursor(10); h.type("");
    await tick(150);
    expect(h.key("Escape")).toBe(true);
    expect(h.popup()).toBeNull();
    expect(h.key("ArrowDown")).toBe(false);
    expect(h.key("Enter")).toBe(false);
    expect(h.key("Escape")).toBe(false);
    h.moveCursor(5); h.moveCursor(10);
    await tick(150);
    expect(h.popup()).toBeNull();
    h.type("ly");
    await tick(150);
    expect(h.popup()?.querySelector(".cts-popup-query")?.textContent).toBe("quietly");
  });

  it("shows the error in the box and reports it once", async () => {
    source.fail = true;
    h = mount("/th::quiet", ext());
    h.moveCursor(10); h.type("");
    await tick(150);
    expect(h.popup()?.querySelector(".cts-popup-error")?.textContent).toContain("fake down");
    expect(errors).toHaveLength(1);
    expect(h.key("Enter")).toBe(false);
  });

  it("says when nothing was found", async () => {
    source.suggest = async () => ({ suggestions: [] });
    h = mount("/th::zzz", ext());
    h.moveCursor(8); h.type("");
    await tick(150);
    expect(h.popup()?.querySelector(".cts-popup-empty")?.textContent).toContain("zzz");
  });

  it("looks up the word under the cursor on lookupNow and replaces that word on pick", async () => {
    h = mount("a quiet house", ext());
    h.moveCursor(4);
    h.view.dispatch({ effects: lookupNow.of(null) });
    await tick(0);
    expect(h.popup()?.textContent).toContain("looking up…");
    await tick(20);
    expect(source.calls).toEqual(["quiet"]);
    h.key("Enter");
    expect(h.view.state.doc.toString()).toBe("a quiet-1 house");
  });

  it("does nothing when the plugin is off, and drops the box when the source set changes", async () => {
    h = mount("/th::quiet", ext(), { enabled: false });
    h.moveCursor(10); h.type("");
    await tick(150);
    expect(source.calls).toEqual([]);
    h.setSettings({ enabled: true });
    await tick(150);
    expect(h.popup()).not.toBeNull();
    h.setSettings({ maxPerGroup: 3 });
    await tick(0);
    expect(h.popup()).toBeNull();
  });

  it("uses the idle time from settings when none is injected", async () => {
    h = mount("/th::quiet", thesaurusExtension({ lookup: new LookupThesaurus({ sources: () => [source], maxPerGroup: () => 8 }), timers }), { idleMs: 300 });
    h.moveCursor(10); h.type("");
    await tick(200);
    expect(source.calls).toEqual([]);
    await tick(150);
    expect(source.calls).toEqual(["quiet"]);
    h.setSettings({ idleMs: 200 });
    h.type("x");
    await tick(250);
    expect(source.calls).toEqual(["quiet", "quietx"]);
  });

  it("maps the box's span through edits elsewhere and honours closePopup", async () => {
    h = mount("/th::quiet", ext());
    h.moveCursor(10); h.type("");
    await tick(150);
    h.view.dispatch({ changes: { from: 0, insert: "x " } });
    expect(h.view.state.field(popupField)?.from).toBe(2);
    h.view.dispatch({ effects: closePopup.of(null) });
    expect(h.view.state.field(popupField)).toBeNull();
  });
});

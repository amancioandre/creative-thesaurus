import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { HISTORY_VIEW_TYPE, HistoryView, storyName, type HistorySource } from "../../../src/infrastructure/obsidian/views/HistoryView";
import { appendEntry, EMPTY_HISTORY, type History, type HistoryEntry } from "../../../src/domain/history/History";
import { parseQuery } from "../../../src/domain/thesaurus/Query";
import type { LookupResult } from "../../../src/domain/thesaurus/Suggestion";

const result = (text: string): LookupResult => ({ query: parseQuery(text)!, groups: [{ kind: "synonym", items: [{ word: "<b>silent</b>", kind: "synonym", source: "d", score: 1, note: "<i>x</i>", pos: "adj" }] }], notes: ["e.g. <img src=x>"], sources: ["datamuse", "ollama:m"], errors: [{ source: "ollama:m", message: "down" }] });

describe("HistoryView", () => {
  let history: History;
  let inserted: string[];
  let opened: string[];
  let looked: string[];
  let revealed: Array<[string, number, number]>;
  let activeStory: string | null;
  let source: HistorySource;
  let view: HistoryView;

  beforeEach(() => {
    history = appendEntry(appendEntry(EMPTY_HISTORY, { at: "2026-08-28T09:00:00.000Z", query: "loud", note: "", sources: ["d"], count: 1 }, 10), { at: "2026-08-29T10:05:00.000Z", query: "quiet", note: "Novel/Ch 1.md", sources: ["d"], count: 4, picked: "hushed" }, 10);
    inserted = []; opened = []; looked = []; revealed = []; activeStory = null;
    source = {
      history: () => history,
      lookup: async (q) => { looked.push(q); return result(q); },
      insert: (w) => inserted.push(w),
      openNote: (p) => opened.push(p),
      remove: async (e: HistoryEntry) => { history = { version: 1, entries: history.entries.filter((x) => x !== e) }; },
      clear: async () => { history = EMPTY_HISTORY; },
      occurrences: async (term) => ({ story: "Novel/", notes: [{ path: "Novel/Ch 1.md", hits: [{ line: 3, ch: 4, snippet: `a ${term} room` }, { line: 9, ch: 0, snippet: `${term} again` }] }, { path: "Novel/Ch 2.md", hits: [{ line: 0, ch: 0, snippet: term }] }] }),
      activeStory: () => activeStory,
      storyOf: (path) => (path.startsWith("Novel/") ? "Novel/" : null),
      reveal: (path, line, ch) => revealed.push([path, line, ch]),
    };
    view = new HistoryView(new WorkspaceLeaf(), source);
  });

  it("has a stable type and title", () => {
    expect(view.getViewType()).toBe(HISTORY_VIEW_TYPE);
    expect(view.getDisplayText()).toMatch(/history/i);
  });
  it("lists entries newest first, grouped by day, with the pick and the note", () => {
    view.refresh();
    const days = Array.from(view.contentEl.querySelectorAll(".cts-history-day")).map((e) => e.textContent);
    expect(days).toEqual(["2026-08-29", "2026-08-28"]);
    const rows = view.contentEl.querySelectorAll<HTMLElement>(".cts-history-entry");
    expect(rows[0]!.querySelector(".cts-history-query")?.textContent).toBe("quiet");
    expect(rows[0]!.querySelector(".cts-history-picked")?.textContent).toBe("→ hushed");
    expect(rows[0]!.querySelector(".cts-history-note")?.textContent).toBe("Ch 1");
    rows[0]!.querySelector<HTMLElement>(".cts-history-note")!.click();
    expect(opened).toEqual(["Novel/Ch 1.md"]);
  });
  it("re-runs a lookup in a drawer right under the clicked entry, toggled by a second click, and inserts a suggestion on click, all as text", async () => {
    view.refresh();
    const rows = view.contentEl.querySelectorAll<HTMLElement>(".cts-history-entry");
    rows[1]!.click();
    await Promise.resolve(); await Promise.resolve();
    expect(looked).toEqual(["loud"]);
    expect(rows[1]!.nextElementSibling?.classList.contains("cts-history-drawer")).toBe(true);
    rows[0]!.click();
    await Promise.resolve(); await Promise.resolve();
    expect(looked).toEqual(["loud", "quiet"]);
    expect(view.contentEl.querySelectorAll(".cts-history-drawer")).toHaveLength(1);
    const res = rows[0]!.nextElementSibling!;
    expect(res.classList.contains("cts-history-drawer")).toBe(true);
    expect(view.contentEl.querySelector(".cts-history-result:not(.cts-history-drawer)")?.childElementCount).toBe(0);
    expect(res.querySelector("b")).toBeNull();
    expect(res.querySelector("img")).toBeNull();
    expect(res.querySelector(".cts-word")?.textContent).toBe("<b>silent</b>");
    expect(res.querySelector(".cts-popup-warning")?.textContent).toBe("ollama:m: down");
    res.querySelector<HTMLElement>(".cts-item")!.click();
    expect(inserted).toEqual(["<b>silent</b>"]);
    res.querySelector<HTMLElement>(".cts-history-close")!.click();
    expect(view.contentEl.querySelector(".cts-history-drawer")).toBeNull();
    rows[0]!.click(); await Promise.resolve(); await Promise.resolve();
    rows[0]!.click();
    expect(view.contentEl.querySelector(".cts-history-drawer")).toBeNull();
  });
  it("uses icon buttons with labels for close, remove and clear", () => {
    view.refresh();
    expect(view.contentEl.querySelector(".cts-history-clear")?.getAttribute("data-icon")).toBe("trash-2");
    expect(view.contentEl.querySelector(".cts-history-remove")?.getAttribute("aria-label")).toBe("Remove quiet from history");
  });
  it("filters the list and looks up the filter on Enter", async () => {
    view.refresh();
    const input = view.contentEl.querySelector<HTMLInputElement>(".cts-history-filter")!;
    input.value = "lou"; input.dispatchEvent(new Event("input"));
    expect(view.contentEl.querySelectorAll(".cts-history-entry")).toHaveLength(1);
    input.value = "murmur"; input.dispatchEvent(new Event("input"));
    expect(view.contentEl.querySelector(".cts-history-hint")?.textContent).toMatch(/Enter/);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await Promise.resolve(); await Promise.resolve();
    expect(looked).toEqual(["murmur"]);
  });
  it("removes one entry and clears all", async () => {
    view.refresh();
    view.contentEl.querySelector<HTMLElement>(".cts-history-remove")!.click();
    await Promise.resolve(); await Promise.resolve();
    expect(view.contentEl.querySelectorAll(".cts-history-entry")).toHaveLength(1);
    view.contentEl.querySelector<HTMLElement>(".cts-history-clear")!.click();
    await Promise.resolve(); await Promise.resolve();
    expect(view.contentEl.querySelector(".cts-history-hint")?.textContent).toMatch(/No lookups yet/);
  });
  it("has a close button on the lookup panel that empties it and aborts a lookup in flight", async () => {
    view.refresh();
    const res = view.contentEl.querySelector<HTMLElement>(".cts-history-result")!;
    await view.runLookup(res, "quiet");
    expect(res.querySelector(".cts-word")).not.toBeNull();
    res.querySelector<HTMLElement>(".cts-history-close")!.click();
    expect(res.childElementCount).toBe(0);
    let aborted = false;
    source.lookup = (_q, signal) => new Promise((_, rej) => signal.addEventListener("abort", () => { aborted = true; rej(new DOMException("aborted", "AbortError")); }));
    void view.runLookup(res, "slow");
    res.querySelector<HTMLElement>(".cts-history-close")!.click();
    expect(aborted).toBe(true);
    expect(res.childElementCount).toBe(0);
  });
  describe("hover card", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());
    const flush = async () => { await vi.advanceTimersByTimeAsync(400); await vi.advanceTimersByTimeAsync(0); };
    it("shows original → picked and where the picked word appears, after a pause; leaves hide it", async () => {
      view.refresh();
      const row = view.contentEl.querySelector<HTMLElement>(".cts-history-entry")!;
      row.dispatchEvent(new Event("mouseenter"));
      expect(row.querySelector(".cts-hover")).toBeNull();
      await flush();
      const card = row.querySelector(".cts-hover")!;
      expect(card.querySelector(".cts-provenance-was")?.textContent).toBe("quiet");
      expect(card.querySelector(".cts-provenance-now")?.textContent).toBe("hushed");
      expect(card.querySelector(".cts-provenance-title")?.textContent).toBe("“hushed” appears 3 times in 2 notes in Novel");
      expect(Array.from(card.querySelectorAll(".cts-history-note")).map((a) => a.textContent)).toEqual(["Ch 1", "Ch 2"]);
      card.querySelectorAll<HTMLElement>(".cts-provenance-hit")[1]!.click();
      expect(revealed).toEqual([["Novel/Ch 1.md", 9, 0]]);
      row.dispatchEvent(new Event("mouseleave"));
      expect(row.querySelector(".cts-hover")).toBeNull();
    });
    it("says so when nothing was picked, and does not search", async () => {
      view.refresh();
      const row = view.contentEl.querySelectorAll<HTMLElement>(".cts-history-entry")[1]!;
      row.dispatchEvent(new Event("mouseenter"));
      await flush();
      expect(row.querySelector(".cts-hover .cts-provenance-meta")?.textContent).toContain("nothing picked");
      expect(row.querySelector(".cts-provenance-title")).toBeNull();
    });
  });
  it("filters to the active note's story with the toggle, which is disabled outside any story", () => {
    view.refresh();
    const off = view.contentEl.querySelector<HTMLButtonElement>(".cts-history-scope")!;
    expect(off.disabled).toBe(true);
    expect(view.contentEl.querySelectorAll(".cts-history-entry")).toHaveLength(2);
    activeStory = "Novel/";
    view.refresh();
    const on = view.contentEl.querySelector<HTMLButtonElement>(".cts-history-scope")!;
    expect(on.disabled).toBe(false);
    expect(on.classList.contains("is-active")).toBe(true);
    expect(Array.from(view.contentEl.querySelectorAll(".cts-history-query")).map((e) => e.textContent)).toEqual(["quiet"]);
    on.click();
    expect(view.contentEl.querySelectorAll(".cts-history-entry")).toHaveLength(2);
    expect(view.contentEl.querySelector(".cts-history-scope")?.classList.contains("is-active")).toBe(false);
  });
  it("names a story from its scope", () => {
    expect(storyName("Novel/Part 2/")).toBe("Part 2");
    expect(storyName("Poems/Ode.md")).toBe("Ode");
    expect(storyName("")).toBe("the vault root");
  });
  it("shows a lookup error", async () => {
    source.lookup = async () => { throw new Error("Datamuse: HTTP 503"); };
    view.refresh();
    await view.runLookup(view.contentEl.querySelector<HTMLElement>(".cts-history-result")!, "x");
    expect(view.contentEl.querySelector(".cts-history-error")?.textContent).toContain("503");
  });
});

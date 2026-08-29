import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import type { History, HistoryEntry } from "../../../domain/history/History";
import { parseQuery } from "../../../domain/thesaurus/Query";
import { isEmptyResult, KIND_LABELS, type LookupResult } from "../../../domain/thesaurus/Suggestion";
import type { Occurrence } from "../../../domain/text/Occurrences";

/** Where a term appears in one note. */
export interface NoteHits {
  readonly path: string;
  readonly hits: readonly Occurrence[];
}

export interface Search {
  /** The story that was searched (a folder prefix or note path), or null for the vault / no story. */
  readonly story: string | null;
  readonly notes: readonly NoteHits[];
}

export const HISTORY_VIEW_TYPE = "creative-thesaurus-history";

export interface HistorySource {
  history(): History;
  /** Re-run a lookup for the pane. */
  lookup(query: string, signal: AbortSignal): Promise<LookupResult>;
  /** Insert a word at the cursor of the active editor. */
  insert(word: string): void;
  openNote(path: string): void;
  remove(entry: HistoryEntry): Promise<void>;
  clear(): Promise<void>;
  /** Every note the term appears in, within the story of `anchor` (the note it was typed in), that note first. */
  occurrences(term: string, anchor: string): Promise<Search>;
  /** The story the active note belongs to, or null; entries are filtered to it when "this story" is on. */
  activeStory(): string | null;
  storyOf(path: string): string | null;
  /** Opens a note with the cursor on a hit. */
  reveal(path: string, line: number, ch: number): void;
}

const HOVER_DELAY = 350;

/**
 * The right-pane history: every command call, newest first. Click an entry
 * to run it again here; click a suggestion to put it at the cursor. Every
 * string from a model or an API goes in as a text node — never innerHTML.
 */
export class HistoryView extends ItemView {
  private inflight: AbortController | null = null;
  private filter = "";
  /** Only the entries typed in the active note's story. */
  private thisStory = true;

  constructor(leaf: WorkspaceLeaf, private readonly source: HistorySource) {
    super(leaf);
  }

  getViewType(): string {
    return HISTORY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Thesaurus history";
  }

  getIcon(): string {
    return "book-a";
  }

  async onOpen(): Promise<void> {
    this.refresh();
  }

  async onClose(): Promise<void> {
    this.inflight?.abort();
  }

  refresh(): void {
    this.inflight?.abort();
    this.inflight = null;
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: "cts-history" });
    const head = root.createDiv({ cls: "cts-history-head" });
    const search = head.createEl("input", { cls: "cts-history-filter", attr: { type: "search", placeholder: "Filter or look up…", "aria-label": "Filter history or look up a word" } });
    search.value = this.filter;
    const story = this.source.activeStory();
    const scope = head.createEl("button", { text: "This story", cls: `cts-history-scope${this.thisStory && story ? " is-active" : ""}`, attr: { "aria-label": "Show only lookups made in the active note's story", "aria-pressed": String(this.thisStory && !!story) } });
    if (!story) { scope.disabled = true; scope.title = "The active note is not in a story (a Creative Writer project)."; }
    else scope.title = `Story: ${storyName(story)}`;
    scope.addEventListener("click", () => { this.thisStory = !this.thisStory; this.refresh(); });
    const clearBtn = iconButton(head, "trash-2", "Clear history", "cts-history-clear");
    clearBtn.addEventListener("click", () => void this.source.clear().then(() => this.refresh()));
    const results = root.createDiv({ cls: "cts-history-result" });
    const list = root.createDiv({ cls: "cts-history-list" });

    search.addEventListener("input", () => { this.filter = search.value; this.renderList(list); });
    search.addEventListener("keydown", (e) => { if (e.key === "Enter" && search.value.trim()) void this.runLookup(results, search.value); });
    this.renderList(list, results);
  }

  private renderList(list: HTMLElement, results?: HTMLElement): void {
    list.empty();
    const q = this.filter.trim().toLowerCase();
    const story = this.thisStory ? this.source.activeStory() : null;
    const entries = this.source.history().entries
      .filter((e) => story === null || (e.note !== "" && this.source.storyOf(e.note) === story))
      .filter((e) => !q || e.query.toLowerCase().includes(q) || (e.picked ?? "").toLowerCase().includes(q));
    if (entries.length === 0) {
      list.createEl("p", { text: q ? "No lookup matches. Press Enter to look it up." : story !== null ? `No lookups in ${storyName(story)} yet.` : "No lookups yet. Type /thesaurus::word in a note.", cls: "cts-history-hint" });
      return;
    }
    let lastDay = "";
    for (const e of entries) {
      const day = e.at.slice(0, 10);
      if (day !== lastDay) { list.createDiv({ text: day, cls: "cts-history-day" }); lastDay = day; }
      const row = list.createDiv({ cls: "cts-history-entry" });
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      const main = row.createDiv({ cls: "cts-history-main" });
      main.createSpan({ text: e.query, cls: "cts-history-query" });
      if (e.picked) main.createSpan({ text: `→ ${e.picked}`, cls: "cts-history-picked" });
      const meta = row.createDiv({ cls: "cts-history-meta" });
      meta.createSpan({ text: e.at.slice(11, 16) });
      meta.createSpan({ text: `${e.count} found` });
      if (e.note) {
        const link = meta.createEl("a", { text: e.note.replace(/^.*\//, "").replace(/\.md$/i, ""), cls: "cts-history-note" });
        link.addEventListener("click", (ev) => { ev.stopPropagation(); this.source.openNote(e.note); });
      }
      const del = iconButton(meta, "trash-2", `Remove ${e.query} from history`, "cts-history-remove");
      del.addEventListener("click", (ev) => { ev.stopPropagation(); void this.source.remove(e).then(() => this.refresh()); });
      // The lookup opens right under the entry, so a long list keeps its scroll position.
      const run = () => {
        const open = this.contentEl.querySelector<HTMLElement>(".cts-history-drawer");
        const mine = open?.previousElementSibling === row;
        open?.remove();
        if (mine) return;
        const drawer = document.createElement("div");
        drawer.className = "cts-history-result cts-history-drawer";
        row.after(drawer);
        void this.runLookup(drawer, e.query);
      };
      row.addEventListener("click", run);
      this.hoverCard(row, e);
      row.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); run(); } });
    }
  }

  async runLookup(container: HTMLElement, raw: string): Promise<void> {
    const query = parseQuery(raw);
    if (!query) return;
    this.inflight?.abort();
    const controller = new AbortController();
    this.inflight = controller;
    container.empty();
    const head = container.createDiv({ cls: "cts-history-result-head" });
    head.createSpan({ text: `Looking up “${query.text}”…`, cls: "cts-history-hint" });
    this.closeButton(head);
    try {
      const result = await this.source.lookup(query.text, controller.signal);
      if (controller.signal.aborted) return;
      this.showResult(container, result);
    } catch (e) {
      if (controller.signal.aborted) return;
      container.empty();
      container.createEl("p", { text: e instanceof Error ? e.message : String(e), cls: "cts-history-error" });
    } finally {
      if (this.inflight === controller) this.inflight = null;
    }
  }

  showResult(container: HTMLElement, result: LookupResult): void {
    container.empty();
    const head = container.createDiv({ cls: "cts-history-result-head" });
    head.createSpan({ text: result.query.text, cls: "cts-popup-query" });
    head.createSpan({ text: result.sources.join(" · "), cls: "cts-popup-status" });
    this.closeButton(head);
    if (isEmptyResult(result)) container.createEl("p", { text: "Nothing found.", cls: "cts-history-hint" });
    for (const g of result.groups) {
      const group = container.createDiv({ cls: `cts-group cts-group-${g.kind}` });
      group.createDiv({ text: KIND_LABELS[g.kind], cls: "cts-group-title" });
      const ul = group.createEl("ul", { cls: "cts-list" });
      for (const s of g.items) {
        const li = ul.createEl("li", { cls: "cts-item" });
        li.setAttribute("role", "button");
        li.setAttribute("tabindex", "0");
        const row = li.createDiv({ cls: "cts-item-row" });
        row.createSpan({ text: s.word, cls: "cts-word" });
        if (s.pos) row.createSpan({ text: s.pos, cls: "cts-pos" });
        if (s.note) li.createDiv({ text: s.note, cls: "cts-note" });
        li.addEventListener("click", () => this.source.insert(s.word));
        li.addEventListener("keydown", (ev) => { if (ev.key === "Enter") this.source.insert(s.word); });
      }
    }
    for (const e of result.errors) container.createDiv({ text: `${e.source}: ${e.message}`, cls: "cts-popup-warning" });
    if (result.notes.length) {
      const notes = container.createDiv({ cls: "cts-notes" });
      for (const n of result.notes) notes.createEl("p", { text: n, cls: "cts-note-line" });
    }
  }

  /** The lookup panel is a scratch area: one click, and it is gone. */
  private closeButton(parent: HTMLElement): void {
    const btn = iconButton(parent, "x", "Close lookup", "cts-history-close");
    btn.addEventListener("click", () => {
      this.inflight?.abort(); this.inflight = null;
      const panel = parent.closest<HTMLElement>(".cts-history-result");
      if (panel?.classList.contains("cts-history-drawer")) panel.remove(); else panel?.empty();
    });
  }

  /** Hovering an entry: original → picked, and every note the picked word appears in, with the lines. */
  private hoverCard(row: HTMLElement, e: HistoryEntry): void {
    let timer: number | null = null;
    let card: HTMLElement | null = null;
    let generation = 0;
    const hide = () => { if (timer !== null) window.clearTimeout(timer); timer = null; generation++; card?.remove(); card = null; };
    const show = async () => {
      const gen = ++generation;
      card = row.createDiv({ cls: "cts-hover" });
      const head = card.createDiv({ cls: "cts-provenance-head" });
      head.createSpan({ text: e.query, cls: "cts-provenance-was" });
      if (e.picked) { head.createSpan({ text: "→", cls: "cts-provenance-arrow" }); head.createSpan({ text: e.picked, cls: "cts-provenance-now" }); }
      card.createDiv({ text: `looked up ${e.at.slice(0, 10)}${e.note ? ` in ${e.note.replace(/^.*\//, "").replace(/\.md$/i, "")}` : ""}${e.picked ? "" : " · nothing picked"}`, cls: "cts-provenance-meta" });
      if (!e.picked) return;
      const term = e.picked;
      const body = card.createDiv({ cls: "cts-hover-body" });
      body.createDiv({ text: "Searching notes…", cls: "cts-provenance-meta" });
      const search: Search = await this.source.occurrences(term, e.note).catch(() => ({ story: null, notes: [] }));
      if (gen !== generation || !card) return;
      body.empty();
      const notes = search.notes;
      let total = 0;
      for (const x of notes) total += x.hits.length;
      const where = search.story !== null ? ` in ${storyName(search.story)}` : "";
      body.createDiv({ text: total ? `“${term}” appears ${total} time${total === 1 ? "" : "s"} in ${notes.length} note${notes.length === 1 ? "" : "s"}${where}` : `“${term}” is not in any note${where} now`, cls: "cts-provenance-title" });
      for (const n of notes.slice(0, 6)) {
        const note = body.createDiv({ cls: "cts-provenance-note" });
        const name = note.createEl("a", { text: n.path.replace(/^.*\//, "").replace(/\.md$/i, ""), cls: "cts-history-note" });
        name.addEventListener("click", (ev) => { ev.stopPropagation(); this.source.openNote(n.path); });
        const ul = note.createEl("ul", { cls: "cts-provenance-list" });
        for (const o of n.hits.slice(0, 5)) {
          const li = ul.createEl("li", { cls: "cts-provenance-hit" });
          li.createSpan({ text: `${o.line + 1}`, cls: "cts-provenance-line" });
          li.createSpan({ text: o.snippet, cls: "cts-provenance-snippet" });
          li.addEventListener("click", (ev) => { ev.stopPropagation(); this.source.reveal(n.path, o.line, o.ch); });
        }
        if (n.hits.length > 5) note.createDiv({ text: `+${n.hits.length - 5} more`, cls: "cts-provenance-meta" });
      }
    };
    row.addEventListener("mouseenter", () => { hide(); timer = window.setTimeout(() => { timer = null; void show(); }, HOVER_DELAY); });
    row.addEventListener("mouseleave", hide);
  }
}

/** An Obsidian icon button (lucide), `aria-label` for screen readers and the tooltip. */
function iconButton(parent: HTMLElement, icon: string, label: string, cls: string): HTMLButtonElement {
  const btn = parent.createEl("button", { cls: `clickable-icon cts-icon-button ${cls}`, attr: { "aria-label": label, title: label } });
  setIcon(btn, icon);
  return btn;
}

/** "Novel/Part 2/" → "Part 2"; "Poems/Ode.md" → "Ode"; "" → "the vault root". */
export function storyName(story: string): string {
  if (story === "") return "the vault root";
  const parts = story.replace(/\/$/, "").split("/");
  return parts[parts.length - 1]!.replace(/\.md$/i, "");
}

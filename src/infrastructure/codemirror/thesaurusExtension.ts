import { Prec, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, showTooltip, ViewPlugin, type Tooltip, type ViewUpdate } from "@codemirror/view";
import type { Timers } from "../../application/ports/Timers";
import { LookupThesaurus } from "../../application/use-cases/LookupThesaurus";
import { ScheduleLookup } from "../../application/use-cases/ScheduleLookup";
import { sourcesEqual } from "../../domain/settings/Settings";
import { isEmptyResult, KIND_LABELS, type LookupResult, type Suggestion } from "../../domain/thesaurus/Suggestion";
import { commandAtCursor, explicitTarget, type LookupTarget } from "./commandAtCursor";
import { settingsChanged, settingsFacet } from "./settingsFacet";
import { windowTimers } from "./windowTimers";

export interface PopupState {
  readonly from: number;
  readonly to: number;
  readonly key: string;
  readonly queryText: string;
  readonly status: "loading" | "ready" | "error";
  readonly result: LookupResult | null;
  readonly error: string | null;
  /** Index into `flatItems(result)`. */
  readonly selected: number;
}

export interface ThesaurusOptions {
  readonly lookup: LookupThesaurus;
  readonly onResult?: (result: LookupResult, view: EditorView) => void;
  readonly onPick?: (query: string, word: string, view: EditorView) => void;
  readonly onError?: (error: unknown) => void;
  readonly timers?: Timers;
  /** Overrides the setting; tests use it. */
  readonly idleMs?: number;
}

export const setPopup = StateEffect.define<PopupState | null>();
export const moveSelection = StateEffect.define<number>();
/** Dispatch to look up the command, selection or word at the cursor right now. */
export const lookupNow = StateEffect.define<null>();
/** Dispatch to close the box; it stays closed until the query changes. */
export const closePopup = StateEffect.define<null>();

export const popupField = StateField.define<PopupState | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setPopup)) value = e.value;
      else if (e.is(closePopup)) value = null;
      else if (e.is(moveSelection) && value?.result) {
        const n = flatItems(value.result).length;
        if (n) value = { ...value, selected: (value.selected + e.value + n) % n };
      }
    }
    if (value && tr.docChanged) value = { ...value, from: tr.changes.mapPos(value.from, 1), to: tr.changes.mapPos(value.to, 1) };
    return value;
  },
});

/** Every suggestion in display order — what the arrow keys walk. */
export function flatItems(result: LookupResult): Suggestion[] {
  return result.groups.flatMap((g) => g.items);
}

/** Replaces the command (or the word it was run on) with the pick and closes the box. */
export function pick(view: EditorView, word: string): boolean {
  const popup = view.state.field(popupField);
  if (!popup) return false;
  const target: LookupTarget | null = commandAtCursor(view.state);
  const from = target ? target.from : popup.from;
  const to = target ? target.to : popup.to;
  view.dispatch({ changes: { from, to, insert: word }, selection: { anchor: from + word.length }, effects: setPopup.of(null), userEvent: "input.complete" });
  return true;
}

function renderPopup(view: EditorView, p: PopupState, onPick: (word: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "cts-popup";
  const head = root.appendChild(document.createElement("div"));
  head.className = "cts-popup-head";
  head.appendChild(text("span", "cts-popup-query", p.queryText));
  if (p.status === "loading") head.appendChild(text("span", "cts-popup-status", "looking up…"));
  else if (p.result) head.appendChild(text("span", "cts-popup-status", p.result.sources.join(" · ")));

  if (p.status === "error") root.appendChild(text("div", "cts-popup-error", p.error ?? "Lookup failed."));
  if (p.status === "ready" && p.result) {
    if (isEmptyResult(p.result)) root.appendChild(text("div", "cts-popup-empty", `Nothing found for “${p.queryText}”.`));
    let index = 0;
    for (const g of p.result.groups) {
      const group = root.appendChild(document.createElement("div"));
      group.className = `cts-group cts-group-${g.kind}`;
      group.appendChild(text("div", "cts-group-title", KIND_LABELS[g.kind]));
      const list = group.appendChild(document.createElement("ul"));
      list.className = "cts-list";
      for (const s of g.items) {
        const i = index++;
        const li = list.appendChild(document.createElement("li"));
        li.className = `cts-item${i === p.selected ? " is-selected" : ""}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", String(i === p.selected));
        const row = li.appendChild(document.createElement("div"));
        row.className = "cts-item-row";
        row.appendChild(text("span", "cts-word", s.word));
        if (s.pos) row.appendChild(text("span", "cts-pos", s.pos));
        if (s.note) li.appendChild(text("div", "cts-note", s.note));
        // mousedown, not click: the editor must keep focus so the replacement lands and typing continues.
        li.addEventListener("mousedown", (e) => { e.preventDefault(); onPick(s.word); });
      }
    }
    for (const e of p.result.errors) root.appendChild(text("div", "cts-popup-warning", `${e.source}: ${e.message}`));
    if (p.result.notes.length) {
      const notes = root.appendChild(document.createElement("div"));
      notes.className = "cts-notes";
      for (const n of p.result.notes) notes.appendChild(text("p", "cts-note-line", n));
    }
    if (index > 0) root.appendChild(text("div", "cts-popup-hint", "↑↓ choose · Enter insert · Esc close"));
  }
  root.addEventListener("mousedown", (e) => { if (e.target === root) e.preventDefault(); });
  void view;
  return root;
}

const text = (tag: string, cls: string, content: string): HTMLElement => {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = content; // model and API text go in as text nodes, never as HTML
  return el;
};

/**
 * The floating box. A StateField holds what is shown; `showTooltip` places
 * it under the command; a ViewPlugin watches the cursor for a typed command
 * and drives the debounced lookup; a keymap walks and inserts. Results for
 * a query the cursor has left are never shown.
 */
export function thesaurusExtension(options: ThesaurusOptions): Extension {
  const tooltip = showTooltip.compute([popupField], (state: EditorState): Tooltip | null => {
    const p = state.field(popupField);
    if (!p) return null;
    return {
      pos: Math.min(p.from, state.doc.length),
      above: false,
      strictSide: false,
      arrow: false,
      create: (view) => {
        const dom = renderPopup(view, p, (word) => { pick(view, word); options.onPick?.(p.queryText, word, view); });
        // showTooltip makes `dom` the `.cm-tooltip` element itself (no host wrapper as with hoverTooltip), so styles.css targets `.cm-tooltip.cts-popup`.
        return { dom, mount: () => dom.querySelector(".is-selected")?.scrollIntoView?.({ block: "nearest" }) };
      },
    };
  });

  const driver = ViewPlugin.fromClass(
    class {
      private readonly scheduler: ScheduleLookup;
      private destroyed = false;
      private dismissedKey: string | null = null;

      constructor(private readonly view: EditorView) {
        const settings = view.state.facet(settingsFacet);
        this.scheduler = new ScheduleLookup(
          options.lookup,
          (key, result) => this.deliver(key, result),
          {
            timers: options.timers ?? windowTimers(view.dom.ownerDocument.defaultView ?? window),
            idleMs: options.idleMs ?? settings.idleMs,
            onBusy: (busy) => { if (busy) this.showLoading(); },
            onError: (key, e) => this.fail(key, e),
          },
        );
      }

      update(u: ViewUpdate) {
        if (this.destroyed) return;
        const now = u.transactions.some((tr) => tr.effects.some((e) => e.is(lookupNow)));
        const closed = u.transactions.some((tr) => tr.effects.some((e) => e.is(closePopup)));
        if (closed) { this.dismissedKey = u.startState.field(popupField)?.key ?? commandAtCursor(u.state)?.query?.key ?? null; this.scheduler.cancel(); }
        if (settingsChanged(u)) {
          if (options.idleMs === undefined) this.scheduler.setIdleMs(u.state.facet(settingsFacet).idleMs);
          if (!sourcesEqual(u.startState.facet(settingsFacet), u.state.facet(settingsFacet))) this.later(() => this.view.dispatch({ effects: setPopup.of(null) }));
        }
        if (now) { this.explicit(u.state); return; }
        if (!(u.docChanged || u.selectionSet || settingsChanged(u))) return;
        this.follow(u.state);
      }

      destroy() {
        this.destroyed = true;
        this.scheduler.dispose();
      }

      /** The command palette: look up the typed command, else the selection, else the word — right now. */
      private explicit(state: EditorState) {
        const target = explicitTarget(state);
        if (!target?.query) return;
        this.dismissedKey = null;
        this.later(() => this.view.dispatch({ effects: setPopup.of({ from: target.from, to: target.to, key: target.query!.key, queryText: target.query!.text, status: "loading", result: null, error: null, selected: 0 }) }));
        this.scheduler.request(target.query, true);
      }

      /** Typing: keep the box in step with the command under the cursor. */
      private follow(state: EditorState) {
        const popup = state.field(popupField);
        const cmd = state.facet(settingsFacet).enabled ? commandAtCursor(state) : null;
        if (!cmd?.query) {
          this.scheduler.cancel();
          // A box from an explicit lookup stays while the cursor is still inside its span.
          const inside = popup && !popup.result === false && state.selection.main.head >= popup.from && state.selection.main.head <= popup.to && !cmd;
          if (popup && !inside) this.later(() => this.view.dispatch({ effects: setPopup.of(null) }));
          if (!cmd) this.dismissedKey = null;
          return;
        }
        if (cmd.query.key === this.dismissedKey) return;
        if (popup && popup.key === cmd.query.key) return;
        this.dismissedKey = null;
        if (popup) this.later(() => this.view.dispatch({ effects: setPopup.of(null) }));
        this.scheduler.request(cmd.query, false);
      }

      private showLoading() {
        const target = commandAtCursor(this.view.state);
        if (!target?.query) return;
        const p = this.view.state.field(popupField);
        if (p?.key === target.query.key && p.status !== "loading") return;
        this.later(() => this.view.dispatch({ effects: setPopup.of({ from: target.from, to: target.to, key: target.query!.key, queryText: target.query!.text, status: "loading", result: null, error: null, selected: 0 }) }));
      }

      private deliver(key: string, result: LookupResult) {
        const current = this.currentTarget(key);
        if (!current) return;
        this.view.dispatch({ effects: setPopup.of({ from: current.from, to: current.to, key, queryText: result.query.text, status: "ready", result, error: null, selected: 0 }) });
        options.onResult?.(result, this.view);
      }

      private fail(key: string, e: unknown) {
        options.onError?.(e);
        const current = this.currentTarget(key);
        if (!current) return;
        this.view.dispatch({ effects: setPopup.of({ from: current.from, to: current.to, key, queryText: current.query!.text, status: "error", result: null, error: e instanceof Error ? e.message : String(e), selected: 0 }) });
      }

      /** Where the answer to `key` goes now — the typed command if it still says so, else the loading box for an explicit lookup. */
      private currentTarget(key: string): LookupTarget | null {
        const cmd = commandAtCursor(this.view.state);
        if (cmd?.query?.key === key) return cmd;
        const p = this.view.state.field(popupField);
        if (p?.key === key) return { from: p.from, to: p.to, query: { text: p.queryText, key, isPhrase: p.queryText.includes(" ") }, typed: false };
        return null;
      }

      /** Cannot dispatch inside update(); the next tick is soon enough. */
      private later(fn: () => void) {
        queueMicrotask(() => { if (!this.destroyed) fn(); });
      }
    },
  );

  const keys = Prec.high(keymap.of([
    { key: "ArrowDown", run: (v) => step(v, 1) },
    { key: "ArrowUp", run: (v) => step(v, -1) },
    { key: "Enter", run: (v) => {
      const p = v.state.field(popupField);
      const item = p?.result ? flatItems(p.result)[p.selected] : undefined;
      if (!p || !item) return false;
      pick(v, item.word);
      options.onPick?.(p.queryText, item.word, v);
      return true;
    } },
    { key: "Escape", run: (v) => { if (!v.state.field(popupField)) return false; v.dispatch({ effects: closePopup.of(null) }); return true; } },
  ]));

  return [popupField, tooltip, driver, keys];
}

function step(view: EditorView, delta: number): boolean {
  const p = view.state.field(popupField);
  if (!p?.result || flatItems(p.result).length === 0) return false;
  view.dispatch({ effects: moveSelection.of(delta) });
  return true;
}

import { EditorView, hoverTooltip, type Tooltip } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import type { HistoryEntry } from "../../domain/history/History";
import { wordAt } from "../../domain/command/ThesaurusCommand";
import { findOccurrences } from "../../domain/text/Occurrences";

export interface ProvenanceOptions {
  /** History entries whose pick is this word, the current note's first. */
  readonly picksFor: (word: string, notePath: string | null) => readonly HistoryEntry[];
  readonly pathOf: (state: EditorState) => string | null;
}

export interface Provenance {
  readonly from: number;
  readonly to: number;
  readonly word: string;
  readonly entries: readonly HistoryEntry[];
  /** Other places the word appears in this note (the hovered one excluded). */
  readonly elsewhere: readonly { line: number; ch: number; snippet: string }[];
}

/** What a hover at `pos` should say, or null when the word under it was never a pick. */
export function provenanceAt(state: EditorState, pos: number, options: ProvenanceOptions): Provenance | null {
  const line = state.doc.lineAt(pos);
  const w = wordAt(line.text, pos - line.from);
  if (!w) return null;
  const entries = options.picksFor(w.text, options.pathOf(state));
  if (entries.length === 0) return null;
  const elsewhere = findOccurrences(state.doc.toString(), w.text).filter((o) => !(o.line === line.number - 1 && o.ch === w.from));
  return { from: line.from + w.from, to: line.from + w.to, word: w.text, entries, elsewhere };
}

const text = (tag: string, cls: string, content: string): HTMLElement => {
  const el = document.createElement(tag);
  el.className = cls;
  el.textContent = content;
  return el;
};

export function renderProvenance(p: Provenance, reveal: (line: number, ch: number) => void): HTMLElement {
  const dom = document.createElement("div");
  dom.className = "cts-provenance";
  const e = p.entries[0]!;
  const head = dom.appendChild(document.createElement("div"));
  head.className = "cts-provenance-head";
  head.appendChild(text("span", "cts-provenance-was", e.query));
  head.appendChild(text("span", "cts-provenance-arrow", "→"));
  head.appendChild(text("span", "cts-provenance-now", p.word));
  dom.appendChild(text("div", "cts-provenance-meta", `looked up ${e.at.slice(0, 10)}${p.entries.length > 1 ? ` · ${p.entries.length} times` : ""}`));
  if (p.elsewhere.length) {
    dom.appendChild(text("div", "cts-provenance-title", `Also in this note (${p.elsewhere.length})`));
    const ul = dom.appendChild(document.createElement("ul"));
    ul.className = "cts-provenance-list";
    for (const o of p.elsewhere.slice(0, 8)) {
      const li = ul.appendChild(text("li", "cts-provenance-hit", ""));
      li.appendChild(text("span", "cts-provenance-line", `${o.line + 1}`));
      li.appendChild(text("span", "cts-provenance-snippet", o.snippet));
      li.addEventListener("mousedown", (ev) => { ev.preventDefault(); reveal(o.line, o.ch); });
    }
  }
  return dom;
}

/** Hover a word you inserted from the box: where it came from, and where else it is in the note. */
export function provenanceTooltip(options: ProvenanceOptions) {
  return hoverTooltip((view: EditorView, pos: number): Tooltip | null => {
    const p = provenanceAt(view.state, pos, options);
    if (!p) return null;
    return {
      pos: p.from,
      end: p.to,
      above: true,
      create: () => ({
        dom: renderProvenance(p, (line, ch) => {
          const l = view.state.doc.line(line + 1);
          view.dispatch({ selection: { anchor: l.from + ch }, effects: EditorView.scrollIntoView(l.from + ch, { y: "center" }) });
          view.focus();
        }),
        mount: () => undefined,
      }),
    };
  }, { hoverTime: 300 });
}

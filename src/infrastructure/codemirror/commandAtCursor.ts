import type { EditorState } from "@codemirror/state";
import { findCommand, wordAt } from "../../domain/command/ThesaurusCommand";
import { parseQuery, type Query } from "../../domain/thesaurus/Query";
import { settingsFacet } from "./settingsFacet";

/** What a lookup is about and where in the document its answer goes. Absolute offsets. */
export interface LookupTarget {
  readonly from: number;
  readonly to: number;
  readonly query: Query | null;
  /** True when the writer typed a trigger; false when the command palette picked up the word or selection under the cursor. */
  readonly typed: boolean;
}

/** The typed `/thesaurus::` command the main cursor is inside, or null. */
export function commandAtCursor(state: EditorState): LookupTarget | null {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const cmd = findCommand(line.text, head - line.from, state.facet(settingsFacet).triggers);
  return cmd ? { from: line.from + cmd.from, to: line.from + cmd.to, query: cmd.query, typed: true } : null;
}

/** For the explicit command: the typed command if any, else the selection, else the word under the cursor. */
export function explicitTarget(state: EditorState): LookupTarget | null {
  const typed = commandAtCursor(state);
  if (typed) return typed;
  const sel = state.selection.main;
  if (!sel.empty && state.doc.lineAt(sel.from).number === state.doc.lineAt(sel.to).number) {
    return { from: sel.from, to: sel.to, query: parseQuery(state.doc.sliceString(sel.from, sel.to)), typed: false };
  }
  const line = state.doc.lineAt(sel.head);
  const w = wordAt(line.text, sel.head - line.from);
  return w ? { from: line.from + w.from, to: line.from + w.to, query: parseQuery(w.text), typed: false } : null;
}

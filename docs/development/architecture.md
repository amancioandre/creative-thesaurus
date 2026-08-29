# Architecture

Same rules as the sibling plugin, [Creative Writer](https://github.com/amancioandre/creative-writer): Clean Architecture with DDD naming, test-first, `main.ts` as a composition root with no logic.

## The rule

Dependencies point inward. `domain` imports nothing from outside itself. `application` imports `domain`. `infrastructure` imports both and is the only layer that knows CodeMirror, Obsidian, Datamuse or Ollama exist. `main.ts` wires them together.

```bash
grep -rn 'from "@codemirror\|from "obsidian' src/domain src/application   # → nothing
```

## Ubiquitous language (DDD)

| Term | Meaning | Lives in |
|---|---|---|
| **Trigger** | What the writer types before the word: `/thesaurus::`, `/th::`. Configurable, longest match wins. | `domain/settings/Settings.ts` (`normalizeTriggers`) |
| **Command** | A trigger plus everything up to the cursor on the same line. `[from, to)` is what a pick replaces. | `domain/command/ThesaurusCommand.ts` |
| **Query** | The tidied text of a command: whitespace collapsed, edge punctuation dropped, a lowercase `key` for caching and history. Word or phrase. | `domain/thesaurus/Query.ts` |
| **Suggestion** | One candidate: word, kind, source, score, optional note and part of speech. | `domain/thesaurus/Suggestion.ts` |
| **Kind** | How a suggestion relates to the query: synonym, alternative (another way to say it), antonym, related. Groups render in that order. | `SUGGESTION_KINDS` |
| **Source** | Anything that answers a query: Datamuse, a local model. A port. | `application/ports/SuggestionSource.ts` |
| **Lookup result** | Merged groups, free-text notes (example, caution), which sources answered, which failed. | `domain/thesaurus/Suggestion.ts` |
| **Target** | Where a result's pick goes: the typed command, or the selection / word the explicit command was run on. | `infrastructure/codemirror/commandAtCursor.ts` |
| **Provenance** | For a word in the text: the history entries whose pick it is (`picksFor`) and where else the word occurs (`findOccurrences`). Shown on hover in the editor (`provenanceTooltip`) and on hover in the history pane. | `domain/history/Provenance.ts`, `domain/text/Occurrences.ts` |
| **Story** | The Creative Writer project a note belongs to: the folder (or single note) declared by `writing-target` / `story: true` front matter, minus `creative-writer: false` notes and plugin data notes. Read from the metadata cache; no dependency on the other plugin. | `domain/scope/StoryScope.ts` |
| **History entry** | One command call: time, query, note path, sources, count, and the pick once made. | `domain/history/History.ts` |

## The use cases

```
LookupThesaurus   SuggestionSource[] (ports, parallel, any may fail) ──► mergeSuggestions (domain) ──► LookupResult   [LRU cache by query + source set]
ScheduleLookup    "the command now says X" stream ──► debounce, abort in-flight ──► deliver(key, result)
RecordLookup      LookupResult ──► appendEntry / recordPick (domain) ──► HistoryRepository (port)
```

Use cases return plain data. Rendering is infrastructure.

## How the box works

```
keystroke ──► ViewPlugin (driver) ──► commandAtCursor(state) ──► ScheduleLookup.request(query)
                                                                        │ idle
                                                                        ▼
                                          popupField ◄── setPopup ◄── LookupThesaurus.execute
                                              │
                                              ▼
                        showTooltip.compute([popupField]) ──► renderPopup (text nodes only) under the command
                                              │
        keymap (Prec.high): ↑↓ moveSelection · Enter pick · Esc closePopup
```

Invariants:
- **Stale answers never show.** Every delivery is keyed by the query; the driver recomputes the command at delivery time and drops the result if the cursor's command no longer says that.
- **The box follows the cursor.** Leaving the command clears it; `Esc` remembers the dismissed key until the query changes.
- **A pick replaces the whole command**, recomputed from the document at pick time (so a trailing space typed after the word is included).
- **Nothing the model or the API says is HTML.** `renderPopup` and `HistoryView` build DOM with `textContent` only.
- **Settings are read, never held.** Extensions read `state.facet(settingsFacet)`; `main.ts` reconfigures a `Compartment` on change. A change to the source set invalidates the cache and closes the box.

## Sources

| Adapter | Endpoint | Notes |
|---|---|---|
| `DatamuseSource` | `GET /words?rel_syn=` · `rel_ant` · `rel_trg` for a word (parallel), `ml=` for a phrase; `md=p` for parts of speech; `key=` when configured | `ml` is the fallback for a word with no strict relations. One call failing keeps the others. |
| `OllamaThesaurusSource` | `POST /api/chat`, `format` = JSON schema, `temperature: 0` | System prompt in `prompts/thesaurusRulebook.ts`; the answer goes through `validateModelSuggestions` (domain) — strings only, capped, query dropped — before it becomes suggestions. |

`mergeSuggestions` normalises scores per source (Datamuse scores are in the millions, the model's are ranks), then sorts by how many sources agree, then score.

## Persistence

Everything is in the plugin folder by default so the vault stays clean: settings in `data.json` (`PluginDataSettingsRepository` + `normalizeSettings`), history in `history.json` (`AdapterHistoryRepository`), answers in `cache.json` (`AdapterCacheRepository`, `domain/thesaurus/ResultCache.ts`: LRU by last use, 2000 entries, keyed by sources + variant + max per group + query; partial answers are never cached). All three go through `AdapterJsonFile` over Obsidian's `DataAdapter`. The history can instead be a Markdown note (`HistoryNote.ts`: front matter flag, readable list, one ```json block, via `HistoryNoteRepository` + `vaultNoteIO`) when `history.inVaultNote` is on — a note is the one file type every sync path carries; `main.ts` picks the repository per call.

## Testing

See [testing.md](testing.md). Tests mirror `src/` under `tests/`; every file except `main.ts` was written test-first.

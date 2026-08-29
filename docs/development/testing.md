# Testing

```bash
npm test              # the whole suite, ~100 tests, under 2 s
npm run test:watch
npm run test:coverage # thresholds: 90 % lines/functions/statements, 85 % branches
npm run typecheck     # sources and tests
npm run test:live     # Datamuse and a local Ollama, for real (DATAMUSE_LIVE=1 OLLAMA_LIVE=1)
```

## How the layers are tested

| Layer | How | Doubles |
|---|---|---|
| `domain` | Plain unit tests on pure functions | none |
| `application` | Unit tests with hand-written fakes for ports; fake timers for the scheduler | fake `SuggestionSource`, in-memory `HistoryRepository` |
| `infrastructure/codemirror` | A real `EditorView` mounted in jsdom; typing, cursor moves, key events; assertions on the rendered `.cts-popup` and the document after a pick | `tests/infrastructure/codemirror/helpers.ts` |
| `infrastructure/datamuse`, `infrastructure/llm` | Recorded fixtures through a `FakeHttp` | `tests/infrastructure/llm/fixtures.ts` |
| `infrastructure/obsidian` | Real DOM; `tests/stubs/obsidian.ts` stands in for the types-only `obsidian` package | stub |

jsdom has no layout, so the box's *placement* cannot be asserted (`Range.getClientRects` is polyfilled in `tests/setup.ts` so CodeMirror's tooltip measuring does not throw); its *content* and the keyboard/mouse behaviour are. Placement was checked by hand in Obsidian.

## Live tests

`tests/integration/live.test.ts` talks to `api.datamuse.com` and to an Ollama at `localhost:11434` (`OLLAMA_MODEL` to pick the model). Opt-in so the suite stays hermetic. On 2026-08-29: Datamuse answered in ~340 ms; qwen2.5:7b returned 4 synonyms with register notes, 3 alternatives, 2 antonyms and an example sentence in ~10 s.

## Conventions

- Dependencies point inward: `grep -rn 'from "@codemirror\|from "obsidian' src/domain src/application` must print nothing.
- No `innerHTML` with model or API text — everything goes in as text nodes; a test in `HistoryView.test.ts` pins it.
- Sentence-case settings, no default hotkeys, commands named without the plugin name.
- Manual QA before a user-visible commit: build → `npm run install:vault` → reload → type `/th::quiet` in a note, pick with Enter, check the history pane.

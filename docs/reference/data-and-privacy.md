# Files & privacy

## What goes where

Everything is in the plugin folder, `<vault>/.obsidian/plugins/creative-thesaurus/`, out of the file explorer and search:

| File | Holds |
|---|---|
| `data.json` | Settings (including the Datamuse key, in plaintext). |
| `history.json` | The history: time, query, note, sources, count, pick. |
| `cache.json` | Cached answers, 2000 most recently used. |

Obsidian Sync carries them when "installed community plugins" sync is on; git carries them unless `.obsidian` is ignored. With *History as a vault note* on, the history is instead a Markdown note (`Creative Thesaurus/History.md` by default) with front matter `creative-thesaurus-history: 1`, a readable list, and one ```` ```json ```` block that is the source of truth.

## What leaves your machine

- **Datamuse**: the word or phrase you look up, over HTTPS to `api.datamuse.com`. Nothing else — not the sentence, not the note.
- **Ollama**: the same word or phrase, to the address you configure (default `localhost`).

No other network requests. No analytics.

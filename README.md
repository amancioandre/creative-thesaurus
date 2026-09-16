# Creative Thesaurus

[![CI](https://github.com/amancioandre/creative-thesaurus/actions/workflows/ci.yml/badge.svg)](https://github.com/amancioandre/creative-thesaurus/actions/workflows/ci.yml) [![Docs](https://img.shields.io/badge/docs-amancioandre.github.io-blue)](https://amancioandre.github.io/creative-thesaurus/) ![MIT](https://img.shields.io/badge/license-MIT-green)

A command-line-like thesaurus for creative writers in [Obsidian](https://obsidian.md). Type `/thesaurus::` and a word or phrase in the middle of a sentence, pause, and a box opens under it with synonyms, other ways to say it, antonyms and related words. Pick one with the arrows and Enter (or a click) and the whole command is replaced by your choice. Every call goes into a history you can open in the right-side pane.

Built for writers working in English who think in another language: with a local model switched on, every suggestion carries its register (formal, informal, literary…) and a line on how it differs from your word, plus an example sentence and a caution about the usual mistake — in the language you choose.

```
She closed the door /thesaurus::quietly
                    ┌──────────────────────────────────────────────┐
                    │ quietly                     datamuse · ollama │
                    │ SYNONYMS                                      │
                    │ ▸ softly   adv  Less about sound than touch.  │
                    │   silently adv  No sound at all.              │
                    │   gently   adv  informal — Care, not volume.  │
                    │ ANTONYMS                                      │
                    │   loudly   adv                                │
                    │ e.g. She closed the door softly behind her.   │
                    │ ↑↓ choose · Enter insert · Esc close          │
                    └──────────────────────────────────────────────┘
```

## How it works

- **Trigger.** `/thesaurus::` or `/th::` (configurable), anywhere on a line. Everything between the trigger and the cursor is the query — a word or a phrase. Nothing happens while only the trigger is typed; two spaces after the query tell the plugin you have moved on.
- **Pause.** The lookup runs after 700 ms of quiet (configurable) so you can finish the word. Typing more cancels the lookup in flight; a box is never shown for a query the cursor has left.
- **Box.** Groups in a fixed order — synonyms, other ways to say it, antonyms, related — each capped. `↑`/`↓` walk the list, `Enter` inserts, `Esc` closes (it stays closed until the query changes). A click inserts too. Insertion replaces the whole command, trigger included.
- **Command palette.** *Look up at cursor* runs immediately on the typed command, else on the selection, else on the word under the cursor — and replaces that word on pick.
- **History pane.** *Open thesaurus history* (or the ribbon icon): every command call, newest first, with what you picked and the note it was typed in. Click an entry to run it again in the pane (not recorded again); click a suggestion there to insert it at the cursor; type in the filter box and press Enter to look up anything.
- **Where did that word come from?** Hover a word you inserted, in the note: a box shows the term you looked up, when, and every other place that word appears in the note (click to jump). Hover an entry in the history pane: the same, across the notes of **the story** — the [Creative Writer](https://github.com/amancioandre/creative-writer) project the note belongs to (a folder declared by a note with `writing-target` or `story: true`; `creative-writer: false` keeps memos and research out). Outside any project: the note itself plus notes marked `creative-writer: true`. *Search in* can widen this to the vault. The pane's **This story** toggle filters the history the same way.
- **Cache.** Every complete answer is kept in `.obsidian/plugins/creative-thesaurus/cache.json` (2000 most recent), so the same word is instant next time and next session — a different model or language is a different entry. An answer with a failed source is shown but not cached. *Clear cached answers* forgets them.
- **Nothing in your vault.** History and cache live in the plugin folder, out of the file explorer and search. If you would rather have the history as a note that syncs with your manuscript, switch *History as a vault note* on.

## Sources

| Source | What it gives | Where it runs |
|---|---|---|
| **Datamuse** (default on) | Synonyms, antonyms and related words for a word, rewordings for a phrase, with parts of speech. Fast, free, no key today. | Web — only the word you look up is sent. |
| **Local model** (Ollama, default off) | Register and nuance per synonym, natural rewordings, an example sentence, a caution about common mistakes — optionally explained in your first language. | Your machine. Nothing leaves it. |

Use either or both: answers are merged, a word two sources agree on ranks first, and one source failing never hides the other's answer (the box says which one failed). When Datamuse starts requiring an API key, paste it in settings; it is stored in plaintext in the vault's `data.json`, like every plugin setting.

## Install

**Manual / development:** `npm install && npm run build`, then `npm run install:vault -- /path/to/vault` (or set `OBSIDIAN_VAULT`) and enable *Creative Thesaurus* under Settings → Community plugins. Reload Obsidian after each build, or use the Hot Reload community plugin.

**Local model:** install [Ollama](https://ollama.com), `ollama pull qwen2.5:7b`, then set *Model* to *Local (Ollama)* in the plugin settings. A 7B model answers in a few seconds; smaller ones are faster and rougher.

Desktop only; editing mode (Source and Live Preview).

## Settings

| Setting | Default | Notes |
|---|---|---|
| Enabled | on | Master switch. The command still works when off. |
| Search in | the note's story | Or the whole vault. |
| Triggers | `/thesaurus::`, `/th::` | One per line; longest match wins. |
| Pause before looking up | 700 ms | 200–3000. |
| Suggestions per group | 8 | 3–20. |
| Use Datamuse / API key | on / empty | |
| Model / Ollama URL / model / Explain in | off / `localhost:11434` / `qwen2.5:7b` / English | *Explain in* is the language of the notes; the words are always English. |
| Keep a history / as a vault note / note / entries kept | on / off / `Creative Thesaurus/History.md` / 500 | Off = `history.json` in the plugin folder. |

## Privacy

Datamuse receives the word or phrase you look up and nothing else. The local model receives the same, through the Ollama address you configure (default `localhost`). No other network requests. History and cached answers are JSON files in the plugin folder (or, if you choose, a Markdown note in the vault).

## Support

Bug reports and ideas: [GitHub issues](https://github.com/amancioandre/creative-thesaurus/issues). Two minutes on how it is going for you: [the feedback form](https://tally.so/r/obJ6AN). News of the Creative Suite, roughly one letter per release: [the newsletter on Substack](https://andramnc.substack.com).

## Contributing

Build, test and the Clean Architecture layout are in [docs/development](docs/development/architecture.md). Short version: `npm install && npm run build`, `npm test`. Live tests against the real services: `npm run test:live`.

Full documentation: [amancioandre.github.io/creative-thesaurus](https://amancioandre.github.io/creative-thesaurus/). Sibling project, same conventions: [Creative Writer](https://github.com/amancioandre/creative-writer). MIT.

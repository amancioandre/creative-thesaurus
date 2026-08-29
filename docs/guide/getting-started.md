# Getting started

## Install

**Manual (until the plugin is in the community list):** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/amancioandre/creative-thesaurus/releases) into `<vault>/.obsidian/plugins/creative-thesaurus/`, then enable *Creative Thesaurus* under Settings → Community plugins.

**Beta via [BRAT](https://github.com/TfTHacker/obsidian42-brat):** add `amancioandre/creative-thesaurus`.

**From source:** `npm install && npm run build`, then `npm run install:vault -- /path/to/vault`.

Desktop only; editing mode (Source and Live Preview).

## First lookup

In any note, type:

```
She closed the door /thesaurus::quietly
```

Pause for a moment. A box opens under the command:

```
┌──────────────────────────────────────────────┐
│ quietly                             datamuse │
│ SYNONYMS                                     │
│ ▸ softly   adv                               │
│   silently adv                               │
│   gently   adv                               │
│ ANTONYMS                                     │
│   loudly   adv                               │
│ ↑↓ choose · Enter insert · Esc close         │
└──────────────────────────────────────────────┘
```

`↓` to *softly*, `Enter`. The line now reads `She closed the door softly`. `/th::` is the short trigger; both are [configurable](/reference/settings).

## Add a local model

Datamuse gives you words. A local model tells you which one: register, nuance, an example, a caution. Install [Ollama](https://ollama.com), pull a model, switch it on:

```bash
ollama pull qwen2.5:7b
```

Settings → Creative Thesaurus → *Model* → *Local (Ollama)*. Set *Explain in* to your first language if you like — the words stay English, the notes don't have to. See [Sources](/guide/sources).

## Open the history

*Open thesaurus history* in the command palette, or the book icon in the ribbon. See [History & provenance](/guide/history).

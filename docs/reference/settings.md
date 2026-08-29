# Settings

| Setting | Default | Notes |
|---|---|---|
| Enabled | on | Master switch. Off: typing a trigger does nothing; *Look up at cursor* still works. |
| Triggers | `/thesaurus::`, `/th::` | One per line. Longest match wins. At least two characters, no spaces. |
| Pause before looking up | 700 ms | 200–3000. Quiet time after the last keystroke. |
| Suggestions per group | 8 | 3–20. |
| Search in | The note's story | Or *The whole vault*. Where "where else does this word appear" looks; see [The story](/reference/front-matter). |

## Datamuse

| Setting | Default | Notes |
|---|---|---|
| Use Datamuse | on | |
| Datamuse API key | empty | Not needed today. Stored in plaintext in `data.json`. |

## Local model

| Setting | Default | Notes |
|---|---|---|
| Model | Off | *Local (Ollama)*. |
| Ollama URL | `http://localhost:11434` | |
| Ollama model | `qwen2.5:7b` | Any chat model you have pulled. |
| Explain in | English | Language of the notes, example and caution. Words stay English. |

## History

| Setting | Default | Notes |
|---|---|---|
| Keep a history | on | Recorded in `history.json` in the plugin folder. |
| History as a vault note | off | Keep it as a Markdown note instead — visible, synced with your notes. Reload after switching. |
| History note | `Creative Thesaurus/History.md` | Path of that note. |
| Entries kept | 500 | 50–5000. |

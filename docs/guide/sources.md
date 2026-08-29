# Sources

Two sources, either or both. Answers are merged; a word both name ranks first.

## Datamuse

[Datamuse](https://www.datamuse.com/api/) is a free web thesaurus with no key (today). For a word it gives synonyms, antonyms and related terms with parts of speech; for a phrase, rewordings ("means like"). Fast — a few hundred milliseconds.

Only the word or phrase you look up is sent. When Datamuse starts requiring an API key, paste it in *Datamuse API key*; it is stored in plaintext in the plugin's `data.json`, like every plugin setting.

## Local model (Ollama)

A word list cannot tell you that *hushed* is literary, that *calm* is about the person rather than the room, or that *quiet* is rarely a verb. A local model can, and it stays on your machine.

Each synonym comes with its **register** (neutral, formal, informal, literary, slang, technical, dated) and a one-line **note** on the nuance. Then **other ways to say it** — natural, idiomatic rewordings a non-native writer might not know — antonyms, an **example sentence** using the best pick, and a **caution** about the most common mistake.

*Explain in* sets the language of the notes, example and caution (Portuguese, Spanish, German…). The suggested words are always English.

`qwen2.5:7b` answers in a few seconds on a laptop and follows the JSON format well. Smaller models are faster and rougher; reasoning models are slower and not better at this.

The model's answer is validated before it is shown: only strings, capped in length, the query itself dropped. Nothing it says is ever rendered as HTML.

## Cache

Every complete answer is cached in the plugin folder — the same word is instant next time and next session. A different model, language or *Suggestions per group* is a different entry. An answer with a failed source is shown but not cached, so the next call tries the full lookup again. *Clear cached answers* forgets everything.

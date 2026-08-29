# The box

## Invoking it

Type a trigger — `/thesaurus::` or `/th::` — anywhere on a line, then the word or phrase. Everything between the trigger and the cursor is the query, so phrases work: `/th::in the end`. Text after the cursor is left alone; the command can sit mid-sentence.

Nothing happens while only the trigger is typed. The lookup runs after a pause (700 ms by default) so you can finish the word. Keep typing and the lookup in flight is cancelled; an answer to an older query is never shown.

Two spaces after the query tell the plugin you have moved on: the box closes and the text stays as typed.

## Choosing

| Key | Does |
|---|---|
| `↓` `↑` | Walk the list, across groups. |
| `Enter` | Insert the highlighted word. The **whole command** — trigger and query — is replaced. |
| `Esc` | Close. Stays closed until the query changes. |
| click | Insert that word. |

The groups, in order: **Synonyms**, **Other ways to say it** (rewordings and phrases), **Antonyms**, **Related**. Each is capped by *Suggestions per group*. A word two sources agree on comes first.

Under the groups, when a model is on: an example sentence and a caution about the usual mistake with the word.

## Without typing a trigger

*Look up at cursor* (command palette; give it a hotkey) runs immediately on the typed command if there is one, else on the selection, else on the word under the cursor. The pick then replaces that word.

## When something is off

A source that failed is named at the bottom of the box (`ollama:qwen2.5:7b: connection refused`) while the other source's answer still shows. If every source fails, the box says so. Notices are rate-limited to one a minute so a switched-off Ollama does not nag.
